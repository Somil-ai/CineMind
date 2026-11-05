import hashlib
def assign(subject: str, experiment: str, variants: dict[str, int]) -> str:
    """Deterministic, sticky bucketing. variants: {name: weight}. Same subject+experiment -> same variant, no storage needed."""
    h = int(hashlib.sha256(f"{experiment}:{subject}".encode()).hexdigest()[:8], 16) % sum(variants.values())
    for name, w in variants.items():
        if h < w: return name
        h -= w
