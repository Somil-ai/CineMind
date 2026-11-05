"""Hybrid ranker: content + collaborative + quality + recency + mood, then MMR diversity + exploration."""
import math, random
import numpy as np
from .moods import mood_score

CURRENT_YEAR = 2026

def _mm(a):
    a = np.asarray(a, dtype=float); lo, hi = a.min(), a.max()
    return (a - lo) / (hi - lo) if hi > lo else np.zeros_like(a)

def bayesian_quality(m, prior=6.5, strength=500):
    return (m.vote_avg * m.vote_count + prior * strength) / (m.vote_count + strength)

class HybridRecommender:
    def __init__(self, movies, content, cf=None, item_pos=None, lam=0.75, explore=0.1, seed=7):
        self.movies = {m.id: m for m in movies}
        self.content, self.cf = content, cf
        self.item_pos = item_pos or {m.id: i for i, m in enumerate(movies)}
        self.lam, self.explore = lam, explore
        self.rng = random.Random(seed)

    def _eligible(self, u):
        out = []
        for m in self.movies.values():
            if m.id in u.watched or m.id in u.disliked or m.id in u.not_interested or m.id in u.ratings: continue
            if m.adult and not u.allow_adult: continue
            if u.languages and m.language not in u.languages: continue
            out.append(m)
        return out

    def weights(self, n_signals, has_cf, mood):
        """Cold start leans on quality/popularity. Content trust ramps fast (full by ~6 signals) so the feed
        visibly adapts after a few ratings; CF and the rest ramp slower. An explicit mood choice dominates."""
        tc, t = min(1.0, n_signals / 6), min(1.0, n_signals / 20)
        w = {"content": .10 + .60 * tc, "cf": (.35 * t if has_cf else 0), "quality": .30 - .15 * t,
             "popularity": .20 - .15 * t - (.1 if mood else 0), "recency": .05, "mood": .9 if mood else 0, "prefs": .15 * (1 - tc) + .05}
        s = sum(w.values()); return {k: v / s for k, v in w.items()}

    def recommend(self, u, k=20, mood=None, hidden_gems=False):
        cands = self._eligible(u)
        if not cands: return []
        if hidden_gems:  # hard constraint: below-median popularity AND well rated; relax only if too few remain
            med = sorted(m.popularity for m in cands)[len(cands) // 2]
            gems = [m for m in cands if m.popularity <= med and m.vote_avg >= 7.0]
            cands = gems if len(gems) >= min(k, 5) else cands
        liked = {i: r for i, r in u.ratings.items() if r >= 4}
        profile = self.content.profile(u.ratings) if u.ratings else None
        cs = _mm([float(self.content.X[self.content.pos[m.id]] @ profile) for m in cands]) if profile is not None else np.zeros(len(cands))
        cfs = np.zeros(len(cands)); has_cf = False
        if self.cf is not None and u.ratings:
            row = np.zeros(self.cf.Y.shape[0])
            for mid, r in u.ratings.items():
                if mid in self.item_pos and r >= 3: row[self.item_pos[mid]] = (r - 2.5) / 2.5
            if row.any():
                sc = self.cf.score(self.cf.fold_in_user(row))
                cfs = _mm([sc[self.item_pos[m.id]] for m in cands]); has_cf = True
        q = _mm([bayesian_quality(m) for m in cands])
        pop = _mm([math.log1p(m.popularity) for m in cands])
        if hidden_gems: pop = 1 - pop
        rec = np.array([math.exp(-max(0, CURRENT_YEAR - m.year) / 8) for m in cands])
        md = np.array([mood_score(m, mood) for m in cands]) if mood else np.zeros(len(cands))
        pr = np.array([min(1, len(m.genres & u.favorite_genres) / 2) for m in cands])
        w = self.weights(len(u.ratings) + len(u.watched), has_cf, mood)
        parts = {"content": cs, "cf": cfs, "quality": q, "popularity": pop, "recency": rec, "mood": md, "prefs": pr}
        total = sum(w[n] * v for n, v in parts.items())

        n_explore = int(round(k * self.explore)) if u.ratings else 0
        selected = self._mmr(cands, total, k - n_explore)
        chosen = {cands[i].id for i in selected}
        out = [(cands[i], float(total[i]), self._explain(cands[i], {n: w[n] * parts[n][i] for n in parts}, liked, mood, u)) for i in selected]
        return out + self._explore(cands, u, chosen, n_explore, q, pop)

    def _mmr(self, cands, score, k):
        idx, sel = list(range(len(cands))), []
        while idx and len(sel) < k:
            def mmr(i):
                red = max((self.content.sim(cands[i].id, cands[j].id) for j in sel), default=0)
                return self.lam * score[i] - (1 - self.lam) * red
            best = max(idx, key=mmr); sel.append(best); idx.remove(best)
        return sel

    def _explore(self, cands, u, chosen, n, q, pop):
        """Controlled exploration: well-reviewed, less-popular, outside the user's usual genres."""
        if n <= 0: return []
        seen_g = {g for mid, r in u.ratings.items() if r >= 4 and mid in self.movies for g in self.movies[mid].genres}
        pool = [(i, m) for i, m in enumerate(cands) if m.id not in chosen and q[i] > .5 and pop[i] < .6 and (m.genres - seen_g)]
        self.rng.shuffle(pool)
        return [(m, float(q[i]), f"Something different: a well-reviewed {sorted(m.genres - seen_g)[0]} film outside your usual picks.") for i, m in pool[:n]]

    def _explain(self, m, contrib, liked, mood, u):
        top = max(contrib, key=contrib.get)
        anchor = max(liked, key=lambda i: self.content.sim(m.id, i), default=None) if liked else None
        a = self.movies.get(anchor)
        if top == "mood" and mood: return f"Matches your {mood} mood: {', '.join(sorted(m.genres))}."
        if top == "content" and a:
            if m.director and m.director == a.director: return f"Because you liked {a.title} — also directed by {m.director}."
            shared = ', '.join(sorted(m.genres & a.genres)[:2]).lower() or 'similar'
            return f"Because you liked {a.title} and {shared} films."
        if top == "cf": return "Popular among viewers with taste similar to yours."
        if top == "recency": return f"New release matching your taste in {', '.join(sorted(m.genres)[:2])}."
        if top == "prefs" and m.genres & u.favorite_genres: return f"Highly rated {sorted(m.genres & u.favorite_genres)[0]} pick, based on your onboarding choices."
        return f"Critically acclaimed {sorted(m.genres)[0]} — {m.vote_avg:.1f}/10 from {m.vote_count:,} votes."
