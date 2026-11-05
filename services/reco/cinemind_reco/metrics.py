import numpy as np

def precision_at_k(rec, rel, k): return len(set(rec[:k]) & set(rel)) / k
def recall_at_k(rec, rel, k): return len(set(rec[:k]) & set(rel)) / max(1, len(rel))
def ndcg_at_k(rec, rel, k):
    rel = set(rel)
    dcg = sum(1 / np.log2(i + 2) for i, m in enumerate(rec[:k]) if m in rel)
    idcg = sum(1 / np.log2(i + 2) for i in range(min(k, len(rel))))
    return dcg / idcg if idcg else 0.0
def average_precision(rec, rel, k):
    rel, hits, s = set(rel), 0, 0.0
    for i, m in enumerate(rec[:k]):
        if m in rel:
            hits += 1; s += hits / (i + 1)
    return s / max(1, min(len(rel), k))
def coverage(all_recs, catalog_size): return len({m for r in all_recs for m in r}) / catalog_size
def intra_list_diversity(rec, sim):
    pairs = [(a, b) for i, a in enumerate(rec) for b in rec[i + 1:]]
    return 1 - float(np.mean([sim(a, b) for a, b in pairs])) if pairs else 0.0
def novelty(rec, popularity_share):
    return float(np.mean([-np.log2(max(popularity_share.get(m, 1e-6), 1e-6)) for m in rec])) if rec else 0.0
def serendipity(rec, relevant, expected):
    return len((set(rec) & set(relevant)) - set(expected)) / max(1, len(rec))

def evaluate(recommend_fn, holdout: dict, k=10, catalog_size=1):
    rows, allrecs = [], []
    for u, rel in holdout.items():
        r = recommend_fn(u); allrecs.append(r)
        rows.append((precision_at_k(r, rel, k), recall_at_k(r, rel, k), ndcg_at_k(r, rel, k), average_precision(r, rel, k)))
    p, r, n, m = np.mean(rows, axis=0)
    return {"precision@k": p, "recall@k": r, "ndcg@k": n, "map": m, "coverage": coverage(allrecs, catalog_size)}
