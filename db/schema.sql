-- CineMind core schema (PostgreSQL 16 + pgvector). Phase 1-3 tables; social/admin tables included for FK integrity.
CREATE EXTENSION IF NOT EXISTS vector;  CREATE EXTENSION IF NOT EXISTS pg_trgm;  CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext UNIQUE, password_hash text,        -- argon2id; NULL for OAuth-only
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  is_guest boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, display_name text NOT NULL, bio text, avatar_url text,
  favorite_genres text[] DEFAULT '{}', languages text[] DEFAULT '{}', region char(2) DEFAULT 'US',
  taste_style text CHECK (taste_style IN ('mainstream','indie','classic','experimental')),
  allow_adult boolean NOT NULL DEFAULT false, max_certification text, is_private boolean NOT NULL DEFAULT false,
  consent_personalization boolean NOT NULL DEFAULT false, consent_analytics boolean NOT NULL DEFAULT false,
  notification_prefs jsonb NOT NULL DEFAULT '{}', theme text DEFAULT 'dark');
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  family_id uuid NOT NULL, refresh_token_hash text NOT NULL, user_agent text, expires_at timestamptz NOT NULL, revoked_at timestamptz);   -- rotation + reuse detection
CREATE INDEX ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ON sessions (family_id);
CREATE TABLE oauth_accounts (provider text NOT NULL, provider_uid text NOT NULL, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, PRIMARY KEY (provider, provider_uid));

CREATE TABLE genres (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE movies (
  id int PRIMARY KEY,  -- TMDB id
  title text NOT NULL, original_title text, tagline text, overview text, release_date date, runtime int, certification text,
  original_language text, countries text[], poster_path text, backdrop_path text, adult boolean DEFAULT false,
  popularity real, vote_avg real, vote_count int, genre_ids int[] NOT NULL DEFAULT '{}', keywords text[] DEFAULT '{}',
  embedding vector(384), embedding_model text, metadata_synced_at timestamptz, deleted_at timestamptz);
CREATE INDEX movies_embedding_hnsw ON movies USING hnsw (embedding vector_cosine_ops);
CREATE INDEX movies_title_trgm ON movies USING gin (title gin_trgm_ops);               -- typo-tolerant search
CREATE INDEX movies_genres_gin ON movies USING gin (genre_ids);
CREATE INDEX movies_release ON movies (release_date DESC, id);                          -- keyset pagination
CREATE TABLE people (id int PRIMARY KEY, name text NOT NULL, profile_path text, known_for text);
CREATE TABLE credits (movie_id int REFERENCES movies ON DELETE CASCADE, person_id int REFERENCES people, kind text CHECK (kind IN ('cast','crew')),
  job text, character text, ord int, PRIMARY KEY (movie_id, person_id, kind, job));
CREATE INDEX ON credits (person_id);
CREATE TABLE videos (id text PRIMARY KEY, movie_id int NOT NULL REFERENCES movies ON DELETE CASCADE, site text, key text, type text, official boolean);
CREATE TABLE watch_providers (movie_id int REFERENCES movies ON DELETE CASCADE, region char(2), provider_id int, provider_name text,
  kind text CHECK (kind IN ('flatrate','rent','buy')), updated_at timestamptz DEFAULT now(), PRIMARY KEY (movie_id, region, provider_id, kind));

CREATE TABLE ratings (user_id uuid REFERENCES users ON DELETE CASCADE, movie_id int REFERENCES movies, value numeric(2,1) NOT NULL CHECK (value BETWEEN 0.5 AND 5 AND (value*2)=floor(value*2)),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, movie_id));
CREATE INDEX ON ratings (movie_id);
CREATE TABLE favorites (user_id uuid REFERENCES users ON DELETE CASCADE, movie_id int REFERENCES movies, created_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, movie_id));
CREATE TABLE watchlist_items (user_id uuid REFERENCES users ON DELETE CASCADE, movie_id int REFERENCES movies, created_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, movie_id));
CREATE TABLE watched_history (user_id uuid REFERENCES users ON DELETE CASCADE, movie_id int REFERENCES movies, watched_at timestamptz DEFAULT now(), rewatch_intent boolean, PRIMARY KEY (user_id, movie_id));
CREATE TABLE negative_feedback (user_id uuid REFERENCES users ON DELETE CASCADE, movie_id int REFERENCES movies, kind text CHECK (kind IN ('dislike','not_interested')), created_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, movie_id));
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users, movie_id int NOT NULL REFERENCES movies,
  body text NOT NULL CHECK (char_length(body) <= 5000), has_spoilers boolean DEFAULT false, status text DEFAULT 'visible' CHECK (status IN ('visible','flagged','removed')),
  created_at timestamptz DEFAULT now(), deleted_at timestamptz, UNIQUE (user_id, movie_id));
CREATE INDEX ON reviews (movie_id, created_at DESC, id) WHERE deleted_at IS NULL;
CREATE TABLE comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES reviews ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users, body text NOT NULL, created_at timestamptz DEFAULT now(), deleted_at timestamptz);
CREATE TABLE collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users, title text NOT NULL, visibility text DEFAULT 'private' CHECK (visibility IN ('private','friends','public')), is_editorial boolean DEFAULT false, created_at timestamptz DEFAULT now(), deleted_at timestamptz);
CREATE TABLE collection_items (collection_id uuid REFERENCES collections ON DELETE CASCADE, movie_id int REFERENCES movies, added_by uuid REFERENCES users, position int, PRIMARY KEY (collection_id, movie_id));
CREATE TABLE follows (follower_id uuid REFERENCES users ON DELETE CASCADE, followee_id uuid REFERENCES users ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY (follower_id, followee_id), CHECK (follower_id <> followee_id));
CREATE TABLE notifications (id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, kind text NOT NULL, payload jsonb, read_at timestamptz, created_at timestamptz DEFAULT now());
CREATE INDEX ON notifications (user_id, id DESC);

-- Behavioural signals: append-only, partition by month in production.
CREATE TABLE interactions (id bigserial, user_id uuid, anon_id text, movie_id int, kind text NOT NULL CHECK (kind IN ('view','click','dwell','trailer_play','search','skip')),
  value real, mood text, device text, region char(2), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE interactions_default PARTITION OF interactions DEFAULT;
CREATE INDEX ON interactions (user_id, created_at DESC);
CREATE TABLE search_history (user_id uuid REFERENCES users ON DELETE CASCADE, query text, created_at timestamptz DEFAULT now());
CREATE TABLE model_versions (id serial PRIMARY KEY, name text, version text, artifact_uri text, metrics jsonb, is_active boolean DEFAULT false, trained_at timestamptz DEFAULT now(), UNIQUE (name, version));
CREATE TABLE ab_test_experiments (id serial PRIMARY KEY, key text UNIQUE NOT NULL, variants jsonb NOT NULL, traffic_pct int CHECK (traffic_pct BETWEEN 0 AND 100), status text DEFAULT 'draft');
CREATE TABLE feature_flags (key text PRIMARY KEY, enabled boolean DEFAULT false, rollout_pct int DEFAULT 100, updated_by uuid REFERENCES users);
CREATE TABLE recommendation_logs (id bigserial PRIMARY KEY, user_id uuid, request_id uuid, movie_id int, position int, score real, reason text, source text, model_version_id int REFERENCES model_versions, experiment_key text, variant text, created_at timestamptz DEFAULT now());
CREATE INDEX ON recommendation_logs (user_id, created_at DESC);
CREATE TABLE recommendation_feedback (id bigserial PRIMARY KEY, log_id bigint REFERENCES recommendation_logs, request_id uuid, movie_id int, user_id uuid, outcome text CHECK (outcome IN ('click','watchlist','rate','dislike','not_interested','dismiss')), created_at timestamptz DEFAULT now());
CREATE TABLE audit_logs (id bigserial PRIMARY KEY, actor_id uuid, action text, target text, detail jsonb, created_at timestamptz DEFAULT now());
