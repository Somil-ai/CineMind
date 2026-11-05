import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { NegKind, Prefs, RecLog, Session, Signals, Store, User } from './store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_SQL = `SELECT u.id, u.email, u.password_hash, u.role, u.created_at, p.display_name
                  FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.deleted_at IS NULL`;
const toUser = (r: any): User => ({ id: r.id, email: r.email, passwordHash: r.password_hash, role: r.role, displayName: r.display_name, createdAt: r.created_at.getTime() });

/** PostgreSQL implementation of Store, mapped onto db/schema.sql. All queries are parameterised. */
@Injectable()
export class PgStore extends Store implements OnModuleDestroy {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 10) });
  onModuleDestroy() { return this.pool.end(); }

  async createUser(u: User) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,to_timestamp($5/1000.0))', [u.id, u.email, u.passwordHash, u.role, u.createdAt]);
      await c.query('INSERT INTO profiles (user_id, display_name) VALUES ($1,$2)', [u.id, u.displayName]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async findUserByEmail(email: string) { const r = await this.pool.query(`${USER_SQL} AND u.email = $1`, [email]); return r.rows[0] ? toUser(r.rows[0]) : undefined; }
  async findUserById(id: string) { if (!UUID.test(id)) return undefined; const r = await this.pool.query(`${USER_SQL} AND u.id = $1`, [id]); return r.rows[0] ? toUser(r.rows[0]) : undefined; }
  async listUsers() { return (await this.pool.query(`${USER_SQL} ORDER BY u.created_at LIMIT 1000`)).rows.map(toUser); }

  async saveSession(s: Session) {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, revoked_at)
       VALUES ($1,$2,$3,$4,to_timestamp($5/1000.0), CASE WHEN $6 THEN now() END)
       ON CONFLICT (id) DO UPDATE SET revoked_at = CASE WHEN $6 THEN COALESCE(sessions.revoked_at, now()) ELSE NULL END`,
      [s.id, s.userId, s.familyId, s.tokenHash, s.expiresAt, s.revoked]);
  }
  async findSession(id: string) {
    if (!UUID.test(id)) return undefined;
    const r = (await this.pool.query('SELECT * FROM sessions WHERE id = $1', [id])).rows[0];
    return r && { id: r.id, userId: r.user_id, familyId: r.family_id, tokenHash: r.refresh_token_hash, revoked: r.revoked_at !== null, expiresAt: r.expires_at.getTime() } as Session;
  }
  async revokeFamily(f: string) { await this.pool.query('UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1', [f]); }

  async getSignals(userId: string): Promise<Signals> {
    const q = (sql: string) => this.pool.query(sql, [userId]);
    const [rat, wl, fav, wat, neg, pr] = await Promise.all([
      q('SELECT movie_id, value FROM ratings WHERE user_id = $1'), q('SELECT movie_id FROM watchlist_items WHERE user_id = $1'),
      q('SELECT movie_id FROM favorites WHERE user_id = $1'), q('SELECT movie_id FROM watched_history WHERE user_id = $1'),
      q('SELECT movie_id, kind FROM negative_feedback WHERE user_id = $1'), q('SELECT favorite_genres, languages, allow_adult FROM profiles WHERE user_id = $1')]);
    const ids = (r: any) => new Set<number>(r.rows.map((x: any) => x.movie_id));
    const p = pr.rows[0] ?? {};
    return {
      ratings: Object.fromEntries(rat.rows.map((x: any) => [x.movie_id, parseFloat(x.value)])), watchlist: ids(wl), favorites: ids(fav), watched: ids(wat),
      disliked: new Set(neg.rows.filter((x: any) => x.kind === 'dislike').map((x: any) => x.movie_id)),
      notInterested: new Set(neg.rows.filter((x: any) => x.kind === 'not_interested').map((x: any) => x.movie_id)),
      prefs: { favoriteGenres: p.favorite_genres ?? [], languages: p.languages ?? [], allowAdult: p.allow_adult ?? false },
    };
  }

  /** Movies are synced lazily from TMDB; an action on a not-yet-synced movie creates a stub row so FKs hold. */
  private async touch(movieId: number, sql: string, params: any[]) {
    await this.pool.query(`INSERT INTO movies (id, title) VALUES ($1, '(pending sync)') ON CONFLICT (id) DO NOTHING`, [movieId]);
    await this.pool.query(sql, params);
  }
  setRating(u: string, m: number, v: number) { return this.touch(m, `INSERT INTO ratings (user_id, movie_id, value) VALUES ($1,$2,$3) ON CONFLICT (user_id, movie_id) DO UPDATE SET value = $3, updated_at = now()`, [u, m, v]); }
  addWatchlist(u: string, m: number) { return this.touch(m, 'INSERT INTO watchlist_items (user_id, movie_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u, m]); }
  async removeWatchlist(u: string, m: number) { await this.pool.query('DELETE FROM watchlist_items WHERE user_id = $1 AND movie_id = $2', [u, m]); }
  addFavorite(u: string, m: number) { return this.touch(m, 'INSERT INTO favorites (user_id, movie_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u, m]); }
  markWatched(u: string, m: number) { return this.touch(m, 'INSERT INTO watched_history (user_id, movie_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u, m]); }
  setNegative(u: string, m: number, k: NegKind) { return this.touch(m, `INSERT INTO negative_feedback (user_id, movie_id, kind) VALUES ($1,$2,$3) ON CONFLICT (user_id, movie_id) DO UPDATE SET kind = $3`, [u, m, k]); }
  async clearNegative(u: string, m: number, k: NegKind) { await this.pool.query('DELETE FROM negative_feedback WHERE user_id = $1 AND movie_id = $2 AND kind = $3', [u, m, k]); }

  async updatePrefs(userId: string, patch: Partial<Prefs>): Promise<Prefs> {
    const cols: Record<keyof Prefs, string> = { favoriteGenres: 'favorite_genres', languages: 'languages', allowAdult: 'allow_adult' };  // whitelist: never interpolate caller keys
    const sets: string[] = [], vals: any[] = [userId];
    (Object.keys(cols) as (keyof Prefs)[]).forEach((k) => { if (patch[k] !== undefined) { vals.push(patch[k]); sets.push(`${cols[k]} = $${vals.length}`); } });
    if (sets.length) await this.pool.query(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $1`, vals);
    return (await this.getSignals(userId)).prefs;
  }
  async addRecLog(l: RecLog) {
    await this.pool.query('INSERT INTO recommendation_feedback (request_id, user_id, movie_id, outcome) VALUES ($1,$2,$3,$4)', [UUID.test(l.requestId) ? l.requestId : null, l.userId, l.movieId, l.outcome]);
  }
}
