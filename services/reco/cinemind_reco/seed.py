"""Small real-world sample catalog for local dev/demo (TMDB-style ratings are approximate)."""
from .models import Movie
S, D, A, C, T, M, H, R, F, AN, FA, MU, FN, MY, CO, AD = ("Science Fiction","Drama","Action","Crime","Thriller","Mystery","Horror","Romance","Fantasy","Animation","Family","Music","Fantasy","Mystery","Comedy","Adventure")
_ROWS = [  # id, title, genres, year, popularity, vote_avg, votes, keywords, director, lang
 (27205,"Inception",{S,A,T},2010,90,8.4,36000,{"dream","twist","heist"},"Christopher Nolan","en"),
 (157336,"Interstellar",{S,D,AD},2014,95,8.4,34000,{"time travel","journey"},"Christopher Nolan","en"),
 (155,"The Dark Knight",{A,C,T},2008,98,8.5,33000,{"suspense"},"Christopher Nolan","en"),
 (807,"Se7en",{C,T,M},1995,70,8.4,20000,{"serial killer","noir"},"David Fincher","en"),
 (550,"Fight Club",{D,T},1999,85,8.4,28000,{"twist"},"David Fincher","en"),
 (603,"The Matrix",{S,A},1999,80,8.2,25000,{"simulation"},"Lana Wachowski","en"),
 (329865,"Arrival",{S,D,M},2016,60,7.6,17000,{"time travel","twist"},"Denis Villeneuve","en"),
 (335984,"Blade Runner 2049",{S,D},2017,55,7.6,14000,{"simulation"},"Denis Villeneuve","en"),
 (146233,"Prisoners",{C,T,D,M},2013,45,8.1,12000,{"suspense"},"Denis Villeneuve","en"),
 (120467,"The Grand Budapest Hotel",{CO,AD},2014,40,8.0,15000,{"heist","friendship"},"Wes Anderson","en"),
 (194,"Amélie",{R,CO},2001,35,7.9,9500,{"love"},"Jean-Pierre Jeunet","fr"),
 (129,"Spirited Away",{AN,FA,F},2001,60,8.5,16000,{"journey","childhood"},"Hayao Miyazaki","ja"),
 (496243,"Parasite",{T,D,CO},2019,75,8.5,18000,{"satire"},"Bong Joon-ho","ko"),
 (313369,"La La Land",{R,D,MU},2016,55,7.9,16000,{"love"},"Damien Chazelle","en"),
 (244786,"Whiplash",{D,MU},2014,50,8.4,13000,{"underdog"},"Damien Chazelle","en"),
 (278,"The Shawshank Redemption",{D,C},1994,90,8.7,27000,{"friendship"},"Frank Darabont","en"),
 (419430,"Get Out",{H,T,M},2017,65,7.6,15000,{"twist"},"Jordan Peele","en"),
 (493922,"Hereditary",{H,M},2018,45,7.3,10000,{"supernatural","haunted"},"Ari Aster","en"),
 (8363,"Superbad",{CO},2007,40,7.2,8500,{"friendship"},"Greg Mottola","en"),
 (346648,"Paddington 2",{FA,CO,AD},2017,30,7.5,3500,{"uplifting"},"Paul King","en"),
 (76341,"Mad Max: Fury Road",{A,AD,S},2015,85,7.6,22000,{"chase","journey"},"George Miller","en"),
 (354912,"Coco",{AN,FA,MU},2017,70,8.2,16000,{"family"},"Lee Unkrich","en"),
 (120,"The Fellowship of the Ring",{AD,F,A},2001,88,8.4,25000,{"quest"},"Peter Jackson","en"),
 (438631,"Dune",{S,AD},2021,80,7.8,13000,{"journey"},"Denis Villeneuve","en"),
 (14337,"Primer",{S,T},2004,8,6.8,2200,{"time travel"},"Shane Carruth","en"),
 (17431,"Moon",{S,D,M},2009,14,7.6,5800,{"twist"},"Duncan Jones","en"),
 (505192,"Shoplifters",{D,C},2018,12,7.9,4000,{"family"},"Hirokazu Kore-eda","ja"),
]
def seed_movies():
    return [Movie(i, t, set(g), y, p, va, vc, set(k), d, language=l) for i, t, g, y, p, va, vc, k, d, l in _ROWS]
