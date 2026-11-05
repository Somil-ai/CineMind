import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configure } from '../src/main';

/** Runs the whole suite against MemoryStore and (when TEST_DATABASE_URL is set) against real PostgreSQL. */
const PG = process.env.TEST_DATABASE_URL;
let app: INestApplication, http: any, recoUp = true, recoBodies: any[] = [], tmdbCalls = 0;
const PW = 'correct-horse-9';
const signup = async (email: string, extra = {}) => (await request(http).post('/v1/auth/register').send({ email, password: PW, displayName: 'T', ...extra })).body;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function boot(url?: string) {
  if (url) process.env.DATABASE_URL = url; else delete process.env.DATABASE_URL;
  process.env.ADMIN_EMAILS = 'boss@x.com'; process.env.TMDB_API_KEY = 'test';
  const a = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication(); configure(a); await a.init();
  app = a; http = a.getHttpServer(); return a;
}

beforeAll(() => {
  jest.spyOn(global, 'fetch').mockImplementation((async (url: any, init: any) => {
    const u = String(url);
    if (u.includes('localhost:8001')) {
      if (!recoUp) throw new Error('ECONNREFUSED');
      if (u.includes('/catalog')) return new Response(JSON.stringify({ results: [{ id: 1, title: 'Demo', release_date: '2010-01-01' }] }));
      if (u.endsWith('/recommend')) { const body = JSON.parse(init.body); recoBodies.push(body);
        if (body.mood === 'bogus') return new Response(JSON.stringify({ detail: 'Unknown mood' }), { status: 422 });
        return new Response(JSON.stringify({ request_id: 'r1', model_version: 'hybrid-v1', degraded: false, items: [{ movie_id: 1, title: 'A', reason: 'x', position: 0 }] })); }
    }
    if (u.includes('themoviedb')) { tmdbCalls++; return new Response(JSON.stringify({ results: [{ id: 9, title: 'Trend', release_date: '2020-01-01', popularity: 5 }] })); }
    return new Response('{}', { status: 404 });
  }) as any);
});

for (const [name, url] of [['memory', undefined], ['postgres', PG]] as [string, string | undefined][]) {
(name === 'postgres' && !url ? describe.skip : describe)(`${name} store`, () => {
beforeAll(async () => {
  if (url) { const p = new Pool({ connectionString: url }); await p.query('TRUNCATE users CASCADE'); await p.end(); }
  recoUp = true; tmdbCalls = 0; await boot(url);
});
afterAll(() => app.close());
describe('auth', () => {
  it('registers, rejects duplicates and weak passwords, returns /me', async () => {
    const a = await signup('a@x.com'); expect(a.accessToken).toBeDefined();
    expect((await request(http).post('/v1/auth/register').send({ email: 'a@x.com', password: PW, displayName: 'T' })).status).toBe(409);
    expect((await request(http).post('/v1/auth/register').send({ email: 'w@x.com', password: 'short', displayName: 'T' })).status).toBe(400);
    expect((await request(http).get('/v1/auth/me').set(auth(a.accessToken))).body.email).toBe('a@x.com');
    expect((await request(http).get('/v1/auth/me')).status).toBe(401);
  });
  it('login fails with wrong password; unknown fields are rejected', async () => {
    expect((await request(http).post('/v1/auth/login').send({ email: 'a@x.com', password: 'nope-nope-1' })).status).toBe(401);
    expect((await request(http).post('/v1/auth/login').send({ email: 'a@x.com', password: PW, isAdmin: true })).status).toBe(400);
  });
  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const a = await signup('r@x.com');
    const r2 = (await request(http).post('/v1/auth/refresh').send({ refreshToken: a.refreshToken })).body; expect(r2.refreshToken).not.toBe(a.refreshToken);
    expect((await request(http).post('/v1/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401); // reuse
    expect((await request(http).post('/v1/auth/refresh').send({ refreshToken: r2.refreshToken })).status).toBe(401); // family revoked
  });
  it('logout revokes the session', async () => {
    const a = await signup('l@x.com');
    await request(http).post('/v1/auth/logout').send({ refreshToken: a.refreshToken }).expect(204);
    expect((await request(http).post('/v1/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);
  });
  it('enforces RBAC on admin routes and never leaks hashes', async () => {
    const u = await signup('u@x.com'), boss = await signup('boss@x.com');
    expect((await request(http).get('/v1/admin/users').set(auth(u.accessToken))).status).toBe(403);
    const list = await request(http).get('/v1/admin/users').set(auth(boss.accessToken)); expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|argon2/);
  });
});

describe('actions + recommendations', () => {
  it('validates ratings and feeds user signals to the reco service', async () => {
    const t = (await signup('s@x.com')).accessToken;
    expect((await request(http).post('/v1/ratings').set(auth(t)).send({ movieId: 5, value: 6 })).status).toBe(400);
    await request(http).post('/v1/ratings').set(auth(t)).send({ movieId: 27205, value: 5 }).expect(204);
    await request(http).post('/v1/watchlist').set(auth(t)).send({ movieId: 603 }).expect(204);
    await request(http).post('/v1/watched').set(auth(t)).send({ movieId: 155 }).expect(204);
    await request(http).post('/v1/not-interested').set(auth(t)).send({ movieId: 8363 }).expect(204);
    await request(http).patch('/v1/users/me/preferences').set(auth(t)).send({ favoriteGenres: ['Comedy'] }).expect(200);
    const res = await request(http).get('/v1/recommendations/for-you?k=5').set(auth(t)); expect(res.status).toBe(200);
    const sent = recoBodies.at(-1); expect(sent.user.ratings['27205']).toBe(5); expect(sent.user.watched).toContain(155);
    expect(sent.user.not_interested).toContain(8363); expect(sent.user.favorite_genres).toEqual(['Comedy']); expect(sent.k).toBe(5);
    await request(http).delete('/v1/watchlist/603').set(auth(t)).expect(204);
  });
  it('a low rating counts as a dislike; feedback endpoint validates', async () => {
    const t = (await signup('d@x.com')).accessToken;
    await request(http).post('/v1/ratings').set(auth(t)).send({ movieId: 7, value: 1 }).expect(204);
    await request(http).get('/v1/recommendations/for-you').set(auth(t)); expect(recoBodies.at(-1).user.disliked).toContain(7);
    await request(http).post('/v1/recommendations/feedback').set(auth(t)).send({ movieId: 3, outcome: 'click' }).expect(204);
    expect((await request(http).post('/v1/recommendations/feedback').set(auth(t)).send({ movieId: 3, outcome: 'hack' })).status).toBe(400);
  });
  it('invalid mood from reco becomes a 400, not a 500', async () => {
    const t = (await signup('m@x.com')).accessToken;
    expect((await request(http).get('/v1/recommendations/mood/bogus').set(auth(t))).status).toBe(400);
  });
  it('degrades gracefully when the reco service is down', async () => {
    const t = (await signup('g@x.com')).accessToken;
    await request(http).get('/v1/recommendations/for-you').set(auth(t)); // primes last-good cache
    recoUp = false;
    const cached = (await request(http).get('/v1/recommendations/for-you').set(auth(t))).body; expect(cached.degraded).toBe(true); expect(cached.items[0].title).toBe('A');
    const t2 = (await signup('g2@x.com')).accessToken;
    const fresh = (await request(http).get('/v1/recommendations/for-you').set(auth(t2))).body;
    expect(fresh.degraded).toBe(true); expect(fresh.items[0].reason).toBe('Trending this week');
    recoUp = true;
  });
});

describe('demo mode + signals', () => {
  it('serves the seed catalog when TMDB_API_KEY is unset', async () => {
    const key = process.env.TMDB_API_KEY; delete process.env.TMDB_API_KEY;
    const r = await request(http).get('/v1/movies/popular'); process.env.TMDB_API_KEY = key;
    expect(r.status).toBe(200); expect(r.body.results[0].title).toBe('Demo');
  });
  it('exposes the user signals in one call', async () => {
    const t = (await signup('sig@x.com')).accessToken;
    await request(http).post('/v1/ratings').set(auth(t)).send({ movieId: 10, value: 4 }).expect(204);
    await request(http).post('/v1/watchlist').set(auth(t)).send({ movieId: 11 }).expect(204);
    const s = (await request(http).get('/v1/users/me/signals').set(auth(t))).body;
    expect(s.ratings['10']).toBe(4); expect(s.watchlist).toEqual([11]);
  });
});

describe('movies', () => {
  it('caches TMDB responses and validates input', async () => {
    tmdbCalls = 0;
    await request(http).get('/v1/movies/trending').expect(200); await request(http).get('/v1/movies/trending').expect(200);
    expect(tmdbCalls).toBe(1);
    expect((await request(http).get('/v1/movies/abc')).status).toBe(400);
    expect((await request(http).get('/v1/search/movies')).status).toBe(400);
  });
});

describe('persistence', () => {
  (url ? it : it.skip)('data and sessions survive an API restart', async () => {
    const a = await signup('persist@x.com');
    await request(http).post('/v1/ratings').set(auth(a.accessToken)).send({ movieId: 424242, value: 4.5 }).expect(204); // movie not synced yet -> stub row
    await request(http).post('/v1/watchlist').set(auth(a.accessToken)).send({ movieId: 99 }).expect(204);
    await request(http).patch('/v1/users/me/preferences').set(auth(a.accessToken)).send({ favoriteGenres: ['Drama'], allowAdult: true }).expect(200);
    await app.close(); await boot(url);
    const r = await request(http).post('/v1/auth/refresh').send({ refreshToken: a.refreshToken }).expect(200);
    const prof = (await request(http).get('/v1/users/me/profile').set(auth(r.body.accessToken))).body;
    expect(prof.counts).toMatchObject({ ratings: 1, watchlist: 1 }); expect(prof.prefs).toEqual({ favoriteGenres: ['Drama'], languages: [], allowAdult: true });
    await request(http).get('/v1/recommendations/for-you').set(auth(r.body.accessToken));
    expect(recoBodies.at(-1).user.ratings['424242']).toBe(4.5);
  });
});
});
}
