"""Content-based retrieval: IDF-weighted metadata features (+ optional text embedding)."""
import numpy as np
from collections import Counter

class ContentIndex:
    def __init__(self, movies, embed_weight=0.5):
        self.movies = movies
        self.ids = [m.id for m in movies]
        self.pos = {m.id: i for i, m in enumerate(movies)}
        feats = [self._tokens(m) for m in movies]
        df = Counter(t for f in feats for t in set(f))
        self.vocab = {t: i for i, t in enumerate(df)}
        n = len(movies)
        idf = {t: np.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        X = np.zeros((n, len(self.vocab)), dtype=np.float32)
        for i, f in enumerate(feats):
            for t, w in f.items():
                X[i, self.vocab[t]] = w * idf[t]
        X = self._norm(X)
        if all(m.embedding is not None for m in movies):
            E = self._norm(np.stack([m.embedding for m in movies]).astype(np.float32))
            X = self._norm(np.hstack([(1 - embed_weight) * X, embed_weight * E]))
        self.X = X

    @staticmethod
    def _tokens(m):
        f = {f"g:{g}": 1.0 for g in m.genres}
        f.update({f"k:{k}": 0.8 for k in m.keywords})
        if m.director: f[f"d:{m.director}"] = 1.5
        f.update({f"c:{c}": 0.5 for c in m.cast[:5]})
        f[f"l:{m.language}"] = 0.3
        f[f"e:{m.year // 10}"] = 0.4
        return f

    @staticmethod
    def _norm(X):
        return X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-9)

    def sim(self, a: int, b: int) -> float:
        return float(self.X[self.pos[a]] @ self.X[self.pos[b]])

    def profile(self, ratings: dict):
        """Rating-centred taste vector; likes pull toward, dislikes push away."""
        v = np.zeros(self.X.shape[1], dtype=np.float32)
        for mid, r in ratings.items():
            if mid in self.pos:
                v += (r - 2.75) * self.X[self.pos[mid]]
        n = np.linalg.norm(v)
        return v / n if n > 0 else None

    def similar(self, movie_id, k=10):
        s = self.X @ self.X[self.pos[movie_id]]
        order = np.argsort(-s)
        return [(self.ids[i], float(s[i])) for i in order if self.ids[i] != movie_id][:k]
