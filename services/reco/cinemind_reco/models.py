from dataclasses import dataclass, field
import numpy as np

@dataclass
class Movie:
    id: int
    title: str
    genres: set
    year: int
    popularity: float = 0.0
    vote_avg: float = 0.0
    vote_count: int = 0
    keywords: set = field(default_factory=set)
    director: str = ""
    cast: tuple = ()
    language: str = "en"
    adult: bool = False
    poster_path: str | None = None
    embedding: np.ndarray | None = None  # e.g. overview embedding (pgvector in prod)

@dataclass
class UserState:
    ratings: dict = field(default_factory=dict)      # movie_id -> 0.5..5
    watched: set = field(default_factory=set)
    disliked: set = field(default_factory=set)
    not_interested: set = field(default_factory=set)
    favorite_genres: set = field(default_factory=set)
    languages: set = field(default_factory=set)
    allow_adult: bool = False
