"""TMDB -> Movie mapping and a catalog sync CLI:  TMDB_API_KEY=... python -m cinemind_reco.tmdb 5 data/catalog.json"""
import json, os, sys, time, urllib.request
from .models import Movie

def to_movie(d: dict) -> Movie | None:
    """Tolerates missing metadata (cold-start movies): returns None only if essential fields are absent."""
    if not d.get("id") or not d.get("title"): return None
    year = int((d.get("release_date") or "0000")[:4] or 0)
    crew = (d.get("credits") or {}).get("crew") or []
    cast = (d.get("credits") or {}).get("cast") or []
    kw = (d.get("keywords") or {}).get("keywords") or []
    return Movie(id=d["id"], title=d["title"], genres={g["name"] for g in d.get("genres", [])}, year=year,
                 popularity=float(d.get("popularity") or 0), vote_avg=float(d.get("vote_average") or 0), vote_count=int(d.get("vote_count") or 0),
                 keywords={k["name"] for k in kw}, director=next((c["name"] for c in crew if c.get("job") == "Director"), ""),
                 cast=tuple(c["name"] for c in cast[:5]), language=d.get("original_language") or "en", adult=bool(d.get("adult")), poster_path=d.get("poster_path"))

def _get(path, key, **q):
    qs = "&".join(f"{k}={v}" for k, v in {"api_key": key, **q}.items())
    for attempt in range(3):                       # simple backoff for 429/5xx
        try:
            with urllib.request.urlopen(f"https://api.themoviedb.org/3{path}?{qs}", timeout=10) as r: return json.load(r)
        except Exception:
            time.sleep(2 ** attempt)
    return {}

def sync(pages=5, out="data/catalog.json"):
    key = os.environ["TMDB_API_KEY"]; movies = {}
    for p in range(1, pages + 1):
        for it in _get("/discover/movie", key, sort_by="vote_count.desc", page=p, **{"vote_count.gte": 500}).get("results", []):
            d = _get(f"/movie/{it['id']}", key, append_to_response="credits,keywords")
            m = to_movie(d)
            if m: movies[m.id] = {"id": m.id, "title": m.title, "genres": sorted(m.genres), "year": m.year, "popularity": m.popularity, "vote_avg": m.vote_avg,
                                  "vote_count": m.vote_count, "keywords": sorted(m.keywords), "director": m.director, "cast": list(m.cast), "language": m.language, "adult": m.adult, "poster_path": m.poster_path}
    os.makedirs(os.path.dirname(out), exist_ok=True); json.dump(list(movies.values()), open(out, "w"), indent=1)
    print(f"wrote {len(movies)} movies to {out}")

def load_catalog(path):
    return [Movie(**{**r, "genres": set(r["genres"]), "keywords": set(r["keywords"]), "cast": tuple(r["cast"])}) for r in json.load(open(path))]

if __name__ == "__main__":
    sync(int(sys.argv[1]) if len(sys.argv) > 1 else 5, sys.argv[2] if len(sys.argv) > 2 else "data/catalog.json")
