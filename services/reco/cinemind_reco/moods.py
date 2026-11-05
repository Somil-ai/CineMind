"""Each mood -> weighted genre + keyword features."""
MOODS = {
 "feel-good": {"genres": {"Comedy": 1, "Family": .8, "Romance": .5, "Music": .5}, "keywords": {"friendship", "uplifting"}},
 "thrilling": {"genres": {"Thriller": 1, "Action": .8, "Crime": .5}, "keywords": {"heist", "chase", "suspense"}},
 "emotional": {"genres": {"Drama": 1, "Romance": .4}, "keywords": {"loss", "family", "grief"}},
 "mind-bending": {"genres": {"Science Fiction": 1, "Mystery": .8, "Thriller": .5}, "keywords": {"time travel", "dream", "twist", "simulation"}},
 "funny": {"genres": {"Comedy": 1}, "keywords": {"satire", "parody"}},
 "romantic": {"genres": {"Romance": 1, "Drama": .3, "Comedy": .3}, "keywords": {"love", "wedding"}},
 "dark": {"genres": {"Crime": .8, "Thriller": .8, "Horror": .6, "Drama": .4}, "keywords": {"serial killer", "noir", "revenge"}},
 "inspiring": {"genres": {"Drama": .7, "History": .6, "Music": .4}, "keywords": {"true story", "underdog", "biography"}},
 "nostalgic": {"genres": {"Family": .6, "Adventure": .6, "Animation": .5}, "keywords": {"coming of age", "childhood"}, "era": (1980, 2005)},
 "scary": {"genres": {"Horror": 1, "Thriller": .5}, "keywords": {"haunted", "supernatural", "slasher"}},
 "relaxing": {"genres": {"Animation": .6, "Family": .6, "Comedy": .4, "Documentary": .4}, "keywords": {"cozy", "nature", "travel"}},
 "epic-adventure": {"genres": {"Adventure": 1, "Fantasy": .8, "Action": .5, "Science Fiction": .4}, "keywords": {"quest", "kingdom", "journey"}},
}

def mood_score(movie, mood: str) -> float:
    spec = MOODS[mood]
    g = sum(spec["genres"].get(x, 0) for x in movie.genres) / max(1, sum(sorted(spec["genres"].values(), reverse=True)[:2]))
    k = len(movie.keywords & spec["keywords"]) / max(1, len(spec["keywords"]))
    e = 0.0
    if "era" in spec and spec["era"][0] <= movie.year <= spec["era"][1]:
        e = 0.2
    return min(1.0, 0.75 * min(g, 1.0) + 0.5 * k + e)
