import numpy as np, random
from cinemind_reco.models import Movie, UserState
from cinemind_reco.content import ContentIndex
from cinemind_reco.collab import ImplicitALS
from cinemind_reco.hybrid import HybridRecommender
from cinemind_reco import metrics
from cinemind_reco.moods import mood_score

GEN = ["Science Fiction", "Drama", "Comedy", "Horror", "Romance", "Thriller", "Animation", "Adventure"]
def catalog(n=120):
    r = random.Random(1); out = []
    for i in range(n):
        out.append(Movie(i, f"Movie {i}", {r.choice(GEN), r.choice(GEN)}, r.randint(1970, 2026), r.random() * 100, r.uniform(5, 8.5), r.randint(50, 20000),
                         keywords={r.choice(["twist", "love", "haunted", "quest"])}, director=f"Dir{i % 15}", language=r.choice(["en", "en", "fr"]), adult=(i % 40 == 0)))
    return out

def test_cold_start_returns_results_and_reasons():
    ms = catalog(); h = HybridRecommender(ms, ContentIndex(ms))
    res = h.recommend(UserState(favorite_genres={"Comedy"}), k=10)
    assert len(res) == 10 and all(reason for _, _, reason in res)
    assert not any(m.adult for m, _, _ in res)

def test_filters_seen_disliked_not_interested():
    ms = catalog(); h = HybridRecommender(ms, ContentIndex(ms))
    u = UserState(ratings={1: 5}, watched={2}, disliked={3}, not_interested={4})
    assert not {m.id for m, _, _ in h.recommend(u, k=30)} & {1, 2, 3, 4}

def test_feedback_shifts_recommendations():
    ms = catalog(); h = HybridRecommender(ms, ContentIndex(ms), explore=0)
    horror = [m.id for m in ms if "Horror" in m.genres][:5]
    comedy = [m.id for m in ms if "Comedy" in m.genres and "Horror" not in m.genres][:5]
    share = lambda u: np.mean(["Horror" in m.genres for m, _, _ in h.recommend(u, k=10)])
    assert share(UserState(ratings={i: 5 for i in horror})) > share(UserState(ratings={i: 5 for i in comedy}))

def test_diversity_control():
    ms = catalog(); ci = ContentIndex(ms)
    u = UserState(ratings={i: 5 for i in [m.id for m in ms if "Horror" in m.genres][:4]})
    div = lambda lam: metrics.intra_list_diversity([m.id for m, _, _ in HybridRecommender(ms, ci, lam=lam, explore=0).recommend(u, k=10)], ci.sim)
    assert div(0.5) >= div(1.0)

def test_mood_ranking():
    ms = catalog(); h = HybridRecommender(ms, ContentIndex(ms))
    res = h.recommend(UserState(), k=10, mood="scary")
    assert np.mean([mood_score(m, "scary") for m, _, _ in res]) > np.mean([mood_score(m, "scary") for m in ms])

def test_exploration_slots_and_hybrid_with_cf():
    ms = catalog(); ci = ContentIndex(ms)
    R = (np.random.default_rng(0).random((40, len(ms))) < .1).astype(float)
    h = HybridRecommender(ms, ci, cf=ImplicitALS(iters=4).fit(R), explore=0.2)
    res = h.recommend(UserState(ratings={0: 5, 1: 4.5}), k=10)
    assert len(res) == 10 and any("different" in r for _, _, r in res)

def test_als_recovers_taste_clusters():
    rng = np.random.default_rng(0); nu, ni = 60, 80
    taste = rng.integers(0, 3, nu); cluster = rng.integers(0, 3, ni)
    R = ((taste[:, None] == cluster[None, :]) & (rng.random((nu, ni)) < .5)).astype(float)
    train = R.copy()
    for u in range(nu): train[u, np.nonzero(R[u])[0][:3]] = 0   # hold out 3 positives per user
    als = ImplicitALS(iters=8).fit(train)
    in_cluster = np.mean([np.mean([cluster[i] == taste[u] for i in [j for j in np.argsort(-als.score(als.X[u])) if train[u, j] == 0][:10]]) for u in range(nu)])
    assert in_cluster > 0.9          # random would be ~0.33
    # online fold-in for a brand-new user reproduces the same behaviour
    row = np.zeros(ni); row[np.nonzero(cluster == 1)[0][:4]] = 1
    top = np.argsort(-als.score(als.fold_in_user(row)))
    assert np.mean(cluster[[i for i in top if row[i] == 0][:10]] == 1) >= 0.8

def test_metrics_sanity():
    assert metrics.ndcg_at_k([1, 2, 3], [1, 2, 3], 3) == 1.0
    assert metrics.precision_at_k([1, 9], [1], 2) == .5
