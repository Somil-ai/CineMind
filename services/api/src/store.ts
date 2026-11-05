import { Injectable } from '@nestjs/common';

export type Role = 'user' | 'moderator' | 'admin';
export type NegKind = 'dislike' | 'not_interested';
export interface User { id: string; email: string; passwordHash: string; role: Role; displayName: string; createdAt: number }
export interface Session { id: string; userId: string; familyId: string; tokenHash: string; revoked: boolean; expiresAt: number }
export interface Prefs { favoriteGenres: string[]; languages: string[]; allowAdult: boolean }
/** Read-only snapshot of a user's signals. Mutations go through explicit Store methods so any backend can implement them. */
export interface Signals {
  ratings: Record<number, number>; watchlist: Set<number>; favorites: Set<number>; watched: Set<number>;
  disliked: Set<number>; notInterested: Set<number>; prefs: Prefs;
}
export interface RecLog { requestId: string; userId: string; movieId: number; outcome: string; at: number }

export abstract class Store {
  abstract createUser(u: User): Promise<void>;
  abstract findUserByEmail(email: string): Promise<User | undefined>;
  abstract findUserById(id: string): Promise<User | undefined>;
  abstract listUsers(): Promise<User[]>;
  abstract saveSession(s: Session): Promise<void>;
  abstract findSession(id: string): Promise<Session | undefined>;
  abstract revokeFamily(familyId: string): Promise<void>;
  abstract getSignals(userId: string): Promise<Signals>;
  abstract setRating(userId: string, movieId: number, value: number): Promise<void>;
  abstract addWatchlist(userId: string, movieId: number): Promise<void>;
  abstract removeWatchlist(userId: string, movieId: number): Promise<void>;
  abstract addFavorite(userId: string, movieId: number): Promise<void>;
  abstract markWatched(userId: string, movieId: number): Promise<void>;
  abstract setNegative(userId: string, movieId: number, kind: NegKind): Promise<void>;
  abstract clearNegative(userId: string, movieId: number, kind: NegKind): Promise<void>;
  abstract updatePrefs(userId: string, patch: Partial<Prefs>): Promise<Prefs>;
  abstract addRecLog(l: RecLog): Promise<void>;
}

/** Dev/test store; data is lost on restart. Used when DATABASE_URL is unset. */
@Injectable()
export class MemoryStore extends Store {
  private users = new Map<string, User>(); private sessions = new Map<string, Session>();
  private sig = new Map<string, Signals>(); logs: RecLog[] = [];
  private s(id: string): Signals {
    if (!this.sig.has(id)) this.sig.set(id, { ratings: {}, watchlist: new Set(), favorites: new Set(), watched: new Set(), disliked: new Set(), notInterested: new Set(), prefs: { favoriteGenres: [], languages: [], allowAdult: false } });
    return this.sig.get(id)!;
  }
  async createUser(u: User) { this.users.set(u.id, u); }
  async findUserByEmail(email: string) { return [...this.users.values()].find((u) => u.email === email); }
  async findUserById(id: string) { return this.users.get(id); }
  async listUsers() { return [...this.users.values()]; }
  async saveSession(s: Session) { this.sessions.set(s.id, s); }
  async findSession(id: string) { return this.sessions.get(id); }
  async revokeFamily(f: string) { this.sessions.forEach((s) => { if (s.familyId === f) s.revoked = true; }); }
  async getSignals(id: string) { return this.s(id); }
  async setRating(u: string, m: number, v: number) { this.s(u).ratings[m] = v; }
  async addWatchlist(u: string, m: number) { this.s(u).watchlist.add(m); }
  async removeWatchlist(u: string, m: number) { this.s(u).watchlist.delete(m); }
  async addFavorite(u: string, m: number) { this.s(u).favorites.add(m); }
  async markWatched(u: string, m: number) { this.s(u).watched.add(m); }
  async setNegative(u: string, m: number, k: NegKind) { (k === 'dislike' ? this.s(u).disliked : this.s(u).notInterested).add(m); }
  async clearNegative(u: string, m: number, k: NegKind) { (k === 'dislike' ? this.s(u).disliked : this.s(u).notInterested).delete(m); }
  async updatePrefs(u: string, patch: Partial<Prefs>) { return Object.assign(this.s(u).prefs, patch); }
  async addRecLog(l: RecLog) { this.logs.push(l); }
}
