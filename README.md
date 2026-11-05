# CineMind

Explainable, hybrid movie recommendations. The repository includes a Python recommendation service, a NestJS API, a Next.js web app, PostgreSQL schema, and Docker Compose setup. The web app supports discovery, search, onboarding, personalized feeds, movie details, watchlists, ratings, and taste preferences. The API and recommender can also run locally with a small demo catalog and no TMDB key.

## Architecture
```
 Next.js web ─┐                       ┌─ PostgreSQL (+pgvector, trigram search)
 Expo mobile ─┼─> NestJS API (REST) ──┼─ Redis (cache, rate limits, hot feeds, BullMQ)
 Admin (Next) ┘    JWT · RBAC · OpenAPI└─ Reco service (Python/FastAPI) ── model registry (model_versions)
                        │  TMDB sync workers (metadata, providers)
                        └─ impressions/clicks → recommendation_logs → nightly retrain + metrics
```
Graceful degradation: if the reco service is down, the API serves Redis-cached feeds, then TMDB trending/top-rated.

## Recommendation service (`services/reco`)
| Module | Purpose |
|---|---|
| `content.py` | IDF-weighted genre/keyword/director/cast/era vectors (+ optional text embeddings), taste profile, similar-movies |
| `collab.py` | Implicit-feedback ALS with online fold-in (new interactions update a user without retraining) |
| `moods.py` | 12 moods → weighted genres, keywords, era |
| `hybrid.py` | Weighted ensemble that shifts from quality/popularity (cold start) to personal signals as data grows; hard filters (seen, disliked, not-interested, adult, language); MMR diversity; exploration slots; per-item explanations; hidden-gems mode |
| `metrics.py` | Precision/Recall/NDCG@K, MAP, coverage, diversity, novelty, serendipity |
| `db/schema.sql` | Full normalised schema: indexes, FKs, soft deletes, keyset-pagination indexes, partitioned interactions |

### Reco HTTP API (`api.py`, stateless — the main API sends user signals per request)
`POST /recommend` (feed, mood, hidden-gems, exploration A/B variant, request_id + model_version for impression logging) ·
`GET /similar/{id}` · `GET /moods` · `GET /health`. If the ranker throws, it returns a popularity/quality fallback with `degraded: true`.
Data: `seed.py` ships 27 real films for local dev; `TMDB_API_KEY=... python -m cinemind_reco.tmdb 5 data/catalog.json` builds a real catalog (retry/backoff, tolerates missing metadata).
Run: `uvicorn cinemind_reco.api:app --port 8001` (docs at `/docs`).

Run tests: `cd services/reco && pip install -r requirements.txt && PYTHONPATH=. pytest`

## API (`services/api`, NestJS)
Versioned under `/v1`, Swagger at `/docs`. Argon2id passwords; 15-min JWT access tokens; refresh-token rotation with reuse detection (reuse revokes the whole family); role guard (`admin` via `ADMIN_EMAILS`); validation with unknown-field rejection; helmet, CORS allow-list, per-IP rate limits.
Implemented: auth (register/login/refresh/logout/me/password-reset request), movies + search (TMDB proxy, TTL cache, stale-on-error), watchlist/favorites/watched/ratings/not-interested/preferences, `/recommendations/*` + feedback, `/admin/users`.
Degradation chain for feeds: reco service → last good feed for that user → TMDB trending → empty state; responses are flagged `degraded`.
Storage: set `DATABASE_URL` to use PostgreSQL (`pg.store.ts`, parameterised queries, schema in `db/schema.sql`); unset it for the in-memory dev store. Actions on movies not yet synced from TMDB create a `(pending sync)` stub row so foreign keys hold; the sync job fills them in.
Run tests: `cd services/api && npm install && npm test` (add `TEST_DATABASE_URL=postgresql://...` to also run the suite against Postgres; load `db/schema.sql` into that database first) (install in a normal local directory, not a synced/network volume).

**Not done in the API:** schema migrations tooling (schema.sql is applied once at DB init), account export/delete, password-reset email delivery, OAuth (Google/Apple), reviews/comments/collections/follows/notifications, admin metrics/experiments/flags endpoints, rate-limit test, refresh token in httpOnly cookie for web.

## Web app (`apps/web`, Next.js 14 + TypeScript + Tailwind + TanStack Query)
Pages: home (hero top pick, Recommended for you, Because you liked…, mood chips, Trending, Hidden gems, New releases, Top rated), sign in / create account, 2-step onboarding (pick 5 films, genres, skippable), search (debounced, recent searches), watchlist, and a **server-rendered movie page** (title/OG metadata, JSON-LD, details, rating stars, watchlist/watched/favorite/not-interested, where to watch, "More like this" with reasons).
Design: ink-teal cinema dark (light theme toggle), marquee-yellow actions, Fraunces + Hanken Grotesk, typographic posters when artwork is missing, and the signature **reason line** on every recommendation. Sidebar on desktop, bottom nav on mobile; skeleton, empty, error and offline-message states; reduced-motion respected.
Closing the loop: clicking a recommendation logs a `click`, the ✕ on a card logs `not_interested`, and ratings invalidate the feed.
Checks: `tsc` clean, 5 client tests (token refresh single-flight, error mapping), production build passes (first-load JS ≈108 kB).

### Run everything locally (no Docker, no TMDB key)
```
cd services/reco && pip install -r requirements.txt && PYTHONPATH=. uvicorn cinemind_reco.api:app --port 8001
cd services/api  && npm install && RECO_URL=http://localhost:8001 npm run dev      # demo catalog is used when TMDB_API_KEY is unset
cd apps/web      && npm install && npm run dev                                      # http://localhost:3000
```

**Not done in the web app:** guest mode, privacy controls, data export/delete, reviews/comments/collections/social UI, search typo tolerance (relies on the data source), notifications, offline caching/PWA. The settings page currently covers taste preferences and account activity counts. Tokens are kept in localStorage (readable by any XSS); moving the refresh token to an httpOnly cookie is planned. Browser visual, contrast, and keyboard audits remain to be done before public launch.

## Potential next steps
1. Add account export and deletion, password-reset email delivery, and secure httpOnly refresh cookies for browser sessions.
2. Connect real catalog ingestion and model training to production data; evaluate ranking quality on temporal holdouts and live feedback before tuning weights.
3. Add social features such as reviews, shared lists, follows, and notifications if they fit the product direction.
4. Add operational pieces for production: schema migrations, Redis-backed caching and rate limits, observability, deployment automation, and load testing.

## Known limits / honest notes
- Ranker weights were tuned by hand against a 27-movie catalog and synthetic data; re-tune with real logs before trusting them.
- The API currently runs without the collaborative model loaded (`cf=None`); wiring trained ALS from `model_versions` is part of Phase 3.
- `/similar` and the feed rebuild `HybridRecommender` per request; cache the index and add vector-search candidate generation before scaling.
- ALS runs dense in NumPy: fine for tests and ~10k items; production should use the `implicit` library (sparse, GPU-capable) with the same interface.
- Performance targets (p95, 500 ms feeds) are unverified until the API exists; the ranker is O(candidates × k) in the MMR step and needs candidate pre-filtering (top ~500 from vector search) at scale.
- Metrics run on synthetic data only; real quality needs MovieLens/own logs.
- The included recommendation catalog is intentionally small for local demos. Set `TMDB_API_KEY` and create a larger catalog for useful real-world discovery.
- Redis is present in Compose but the current API does not yet use it. Production scale and availability have not been validated.
- Browser visual and accessibility audits, deployment, and production security review remain to be done before public launch.
