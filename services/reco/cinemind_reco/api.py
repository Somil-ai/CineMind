"""Stateless reco service. The main API sends the user's signals in each request, so this scales horizontally and holds no PII."""
import logging, math, uuid
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from .models import UserState
from .content import ContentIndex
from .hybrid import HybridRecommender, bayesian_quality
from .moods import MOODS
from .seed import seed_movies
from .ab import assign

log = logging.getLogger("reco")
MODEL_VERSION = "hybrid-v1"
EXPLORE_EXPERIMENT = {"control": 50, "more_exploration": 50}   # A/B: exploration ratio .10 vs .20
EXPLORE_RATIO = {"control": 0.10, "more_exploration": 0.20}

class UserIn(BaseModel):
    user_id: str = "anon"
    ratings: dict[int, float] = Field(default_factory=dict, description="movie_id -> 0.5..5")
    watched: list[int] = []; disliked: list[int] = []; not_interested: list[int] = []
    favorite_genres: list[str] = []; languages: list[str] = []; allow_adult: bool = False
    def state(self): return UserState(self.ratings, set(self.watched), set(self.disliked), set(self.not_interested), set(self.favorite_genres), set(self.languages), self.allow_adult)

class RecIn(BaseModel):
    user: UserIn = UserIn()
    k: int = Field(20, ge=1, le=100)
    mood: str | None = None
    hidden_gems: bool = False

def create_app(movies=None, cf=None):
    movies = movies or seed_movies()
    index = ContentIndex(movies); by_id = {m.id: m for m in movies}
    app = FastAPI(title="CineMind Reco", version="1.0")

    def fallback(user: UserState, k):
        """Popularity+quality only: used if the ranker raises, so the feed never goes empty."""
        ok = [m for m in movies if m.id not in user.ratings | {i: 1 for i in user.watched | user.disliked | user.not_interested} and (user.allow_adult or not m.adult)]
        ok.sort(key=lambda m: bayesian_quality(m) + 0.1 * math.log1p(m.popularity), reverse=True)
        return [(m, bayesian_quality(m), f"Critically acclaimed {sorted(m.genres)[0]} pick.") for m in ok[:k]]

    def respond(items, variant, degraded=False):
        return {"request_id": str(uuid.uuid4()), "model_version": MODEL_VERSION, "variant": variant, "degraded": degraded,
                "items": [{"movie_id": m.id, "title": m.title, "year": m.year, "poster_path": m.poster_path, "score": round(s, 4), "reason": r, "position": i} for i, (m, s, r) in enumerate(items)]}

    @app.get("/health")
    def health(): return {"ok": True, "movies": len(movies), "model_version": MODEL_VERSION}

    @app.post("/recommend")
    def recommend(req: RecIn):
        if req.mood and req.mood not in MOODS: raise HTTPException(422, f"Unknown mood. Choose from: {sorted(MOODS)}")
        variant = assign(req.user.user_id, "explore_ratio", EXPLORE_EXPERIMENT)
        u = req.user.state()
        try:
            h = HybridRecommender(movies, index, cf=cf, explore=EXPLORE_RATIO[variant])
            return respond(h.recommend(u, k=req.k, mood=req.mood, hidden_gems=req.hidden_gems), variant)
        except Exception:
            log.exception("ranker failed; serving fallback")
            return respond(fallback(u, req.k), variant, degraded=True)

    @app.get("/similar/{movie_id}")
    def similar(movie_id: int, k: int = 10):
        if movie_id not in by_id: raise HTTPException(404, "Movie not in catalog")
        src = by_id[movie_id]
        items = [(by_id[i], s, f"Similar to {src.title}" + (f" — same director, {src.director}." if by_id[i].director == src.director and src.director else f" ({', '.join(sorted(by_id[i].genres & src.genres)[:2]) or 'similar tone'}).")) for i, s in index.similar(movie_id, min(k, 50))]
        return respond(items, "n/a")


    # ---- dev/demo catalog (TMDB-shaped) so the stack runs without a TMDB key ----
    def tmdb_shape(m):
        return {"id": m.id, "title": m.title, "release_date": f"{m.year}-01-01", "vote_average": m.vote_avg, "vote_count": m.vote_count,
                "popularity": m.popularity, "genres": [{"name": g} for g in sorted(m.genres)], "original_language": m.language, "poster_path": m.poster_path, "backdrop_path": None}

    @app.get("/catalog")
    def catalog(q: str = "", sort: str = "popularity", page: int = Query(1, ge=1), per_page: int = 20):
        items = [m for m in movies if q.lower() in m.title.lower()]
        keys = {"popularity": lambda m: -m.popularity, "top_rated": lambda m: -bayesian_quality(m), "new": lambda m: (-m.year, -m.popularity)}
        items.sort(key=keys.get(sort, keys["popularity"]))
        start = (page - 1) * per_page
        return {"page": page, "total_results": len(items), "total_pages": max(1, math.ceil(len(items) / per_page)), "results": [tmdb_shape(m) for m in items[start:start + per_page]]}

    @app.get("/catalog/{movie_id}")
    def catalog_item(movie_id: int):
        m = by_id.get(movie_id)
        if not m: raise HTTPException(404, "Movie not in catalog")
        return {**tmdb_shape(m), "overview": "", "tagline": "", "runtime": None, "keywords": sorted(m.keywords),
                "credits": {"cast": [{"name": c} for c in m.cast], "crew": [{"job": "Director", "name": m.director}] if m.director else []}, "videos": {"results": []}}

    @app.get("/moods")
    def moods(): return sorted(MOODS)
    return app

import os
from .tmdb import load_catalog
_CATALOG = os.environ.get("CATALOG_PATH", "data/catalog.json")   # created by: python -m cinemind_reco.tmdb 5 data/catalog.json
app = create_app(load_catalog(_CATALOG) if os.path.exists(_CATALOG) else None)
