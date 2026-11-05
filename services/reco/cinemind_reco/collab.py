"""Implicit-feedback ALS (Hu, Koren, Volinsky 2008) with online fold-in for new interactions."""
import numpy as np

class ImplicitALS:
    def __init__(self, factors=8, reg=10.0, alpha=10.0, iters=12, seed=0):
        self.f, self.reg, self.alpha, self.iters = factors, reg, alpha, iters
        self.rng = np.random.default_rng(seed)

    def fit(self, R: np.ndarray):
        """R: users x items implicit strength (e.g. rating/5, watch=1, dislike=0)."""
        nu, ni = R.shape
        self.X = self.rng.normal(0, .1, (nu, self.f))
        self.Y = self.rng.normal(0, .1, (ni, self.f))
        for _ in range(self.iters):
            self.X = self._solve(R, self.Y)
            self.Y = self._solve(R.T, self.X)
        return self

    def _solve(self, R, F):
        FtF = F.T @ F + self.reg * np.eye(self.f)
        return np.stack([self._fold(R[u], F, FtF) for u in range(R.shape[0])])

    def _fold(self, row, F, FtF=None):
        if FtF is None:
            FtF = F.T @ F + self.reg * np.eye(self.f)
        idx = np.nonzero(row)[0]
        if len(idx) == 0:
            return np.zeros(self.f)
        c = self.alpha * row[idx]
        Fi = F[idx]
        return np.linalg.solve(FtF + (Fi.T * c) @ Fi, ((1 + c)[:, None] * Fi).sum(0))

    def fold_in_user(self, row):
        """Online update: new/changed user vector without retraining."""
        return self._fold(row, self.Y)

    def score(self, user_vec):
        return self.Y @ user_vec
