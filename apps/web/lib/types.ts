export interface MovieLite { id: number; title: string; year?: number; poster_path?: string | null; vote_average?: number; reason?: string }
export const fromTmdb = (m: any): MovieLite => ({ id: m.id, title: m.title, year: m.release_date ? Number(String(m.release_date).slice(0, 4)) || undefined : undefined, poster_path: m.poster_path, vote_average: m.vote_average });
export const fromRec = (i: any): MovieLite => ({ id: i.movie_id, title: i.title, year: i.year || undefined, poster_path: i.poster_path, reason: i.reason });
export interface Signals { ratings: Record<string, number>; watchlist: number[]; favorites: number[]; watched: number[]; notInterested: number[] }
export const MOODS = ['feel-good', 'thrilling', 'emotional', 'mind-bending', 'funny', 'romantic', 'dark', 'inspiring', 'nostalgic', 'scary', 'relaxing', 'epic-adventure'];
export const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'Thriller'];
