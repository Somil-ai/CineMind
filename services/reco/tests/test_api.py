from fastapi.testclient import TestClient
from cinemind_reco.api import app, create_app
from cinemind_reco.tmdb import to_movie
from cinemind_reco.ab import assign
import cinemind_reco.api as api_mod

c = TestClient(app)
NOLAN_FAN = {"user_id": "u1", "ratings": {27205: 5, 157336: 5}, "watched": [155]}

def test_health_and_similar_reason():
    assert c.get("/health").json()["ok"]
    r = c.get("/similar/27205?k=3").json()["items"]
    assert len(r) == 3 and all(i["reason"] for i in r)

def test_personalised_feed_excludes_seen_and_explains():
    body = c.post("/recommend", json={"user": NOLAN_FAN, "k": 8}).json()
    ids = {i["movie_id"] for i in body["items"]}
    assert not ids & {27205, 157336, 155} and len(ids) == 8
    assert any("Because you liked" in i["reason"] for i in body["items"])
    assert body["model_version"] and body["variant"] in {"control", "more_exploration"} and not body["degraded"]

def test_cold_start_with_prefs_and_adult_default_off():
    body = c.post("/recommend", json={"user": {"favorite_genres": ["Comedy"]}, "k": 5}).json()
    assert len(body["items"]) == 5

def test_mood_and_validation():
    assert c.post("/recommend", json={"mood": "scary", "k": 3}).json()["items"][0]["title"] in {"Get Out", "Hereditary"}
    assert c.post("/recommend", json={"mood": "bogus"}).status_code == 422
    assert c.get("/similar/1").status_code == 404

def test_hidden_gems_favours_low_popularity():
    pops = {m.title: m.popularity for m in api_mod.seed_movies()}
    top = c.post("/recommend", json={"k": 5, "hidden_gems": True}).json()["items"]
    assert sum(pops[i["title"]] for i in top) / 5 < 40

def test_graceful_degradation(monkeypatch):
    def boom(*a, **k): raise RuntimeError("ranker down")
    monkeypatch.setattr(api_mod.HybridRecommender, "recommend", boom)
    r = c.post("/recommend", json={"user": NOLAN_FAN, "k": 5}).json()
    assert r["degraded"] and len(r["items"]) == 5

def test_ab_assignment_is_sticky_and_balanced():
    assert assign("u1", "x", {"a": 1, "b": 1}) == assign("u1", "x", {"a": 1, "b": 1})
    share = sum(assign(f"u{i}", "x", {"a": 1, "b": 1}) == "a" for i in range(2000)) / 2000
    assert 0.45 < share < 0.55

def test_tmdb_mapping_handles_missing_fields():
    m = to_movie({"id": 1, "title": "Obscure", "release_date": "", "genres": []})
    assert m.year == 0 and m.director == "" and m.genres == set()
    full = to_movie({"id": 2, "title": "X", "release_date": "2010-07-16", "genres": [{"name": "Drama"}], "credits": {"crew": [{"job": "Director", "name": "N"}], "cast": [{"name": "A"}]}, "keywords": {"keywords": [{"name": "dream"}]}})
    assert (full.year, full.director, full.cast, full.keywords) == (2010, "N", ("A",), {"dream"})
    assert to_movie({"title": "no id"}) is None

def test_demo_catalog_search_sort_and_detail():
    r = c.get("/catalog?q=dune").json(); assert r["total_results"] == 1 and r["results"][0]["title"] == "Dune"
    assert c.get("/catalog?sort=popularity&per_page=3").json()["results"][0]["popularity"] >= 90
    d = c.get("/catalog/27205").json(); assert d["credits"]["crew"][0]["name"] == "Christopher Nolan" and d["genres"]
    assert c.get("/catalog/1").status_code == 404
