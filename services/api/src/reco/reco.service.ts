import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Store } from '../store';
import { TmdbService } from '../movies/tmdb.service';

export interface RecOpts { k: number; mood?: string; hiddenGems?: boolean }

@Injectable()
export class RecoService {
  private log = new Logger('RecoService');
  private lastGood = new Map<string, any>();
  constructor(private store: Store, private tmdb: TmdbService) {}

  async forYou(userId: string, o: RecOpts) {
    const s = await this.store.getSignals(userId);
    const user = { user_id: userId, ratings: s.ratings, watched: [...s.watched], disliked: [...s.disliked], not_interested: [...s.notInterested],
      favorite_genres: s.prefs.favoriteGenres, languages: s.prefs.languages, allow_adult: s.prefs.allowAdult };
    const key = `${userId}:${o.mood ?? ''}:${o.hiddenGems ?? false}`;
    const r = await this.call('/recommend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, k: o.k, mood: o.mood, hidden_gems: !!o.hiddenGems }) });
    if (r) { await this.withPosters(r); this.lastGood.set(key, r); return r; }
    return this.lastGood.get(key) ? { ...this.lastGood.get(key), degraded: true } : this.fallback(o.k);
  }

  async similar(movieId: number, k: number) {
    const r = await this.call(`/similar/${movieId}?k=${k}`);
    return r ? this.withPosters(r) : this.fallback(k);
  }

  /** The reco service only knows ids/titles unless its catalog was synced with posters; fill any gaps from TMDB (cached 24h). */
  private async withPosters(r: any) {
    await Promise.all((r.items ?? []).filter((i: any) => !i.poster_path).map(async (i: any) => {
      try { i.poster_path = (await this.tmdb.get(`/movie/${i.movie_id}`, {}, 86_400_000)).poster_path ?? null; } catch { /* leave the typographic fallback poster */ }
    }));
    return r;
  }

  private async call(path: string, init: RequestInit = {}) {
    try {
      const res = await fetch((process.env.RECO_URL || 'http://localhost:8001') + path, { ...init, signal: AbortSignal.timeout(500) });
      if (res.status >= 400 && res.status < 500) throw new BadRequestException(((await res.json().catch(() => ({}))) as any).detail ?? 'Invalid recommendation request');
      if (!res.ok) throw new Error(`reco ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.log.warn(`reco service unavailable: ${(e as Error).message}`);
      return null;
    }
  }

  /** Last-resort feed: TMDB trending. Never errors the page; marks itself degraded so the UI/metrics know. */
  private async fallback(k: number) {
    let results: any[] = [];
    try { results = (await this.tmdb.get('/trending/movie/week')).results ?? []; } catch { /* no data at all: empty feed, UI shows empty state */ }
    return { request_id: null, model_version: 'fallback-trending', variant: 'n/a', degraded: true,
      items: results.slice(0, k).map((m: any, i: number) => ({ movie_id: m.id, title: m.title, year: +(m.release_date || '0').slice(0, 4), score: m.popularity, reason: 'Trending this week', position: i })) };
  }
}
