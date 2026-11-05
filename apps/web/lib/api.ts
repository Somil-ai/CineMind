export const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const KEY = 'cinemind.tokens';
export interface Tokens { accessToken: string; refreshToken: string }

/** Tokens live in localStorage for now (XSS-exposed); moving the refresh token to an httpOnly cookie is on the roadmap. */
export const tokens = {
  get(): Tokens | null { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } },
  set(t: Tokens) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage unavailable */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

let refreshing: Promise<boolean> | null = null;
/** Single-flight: concurrent 401s share one refresh call (refresh tokens rotate, so a second call would trigger reuse detection). */
export function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const t = tokens.get(); if (!t) return false;
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: t.refreshToken }) });
      if (!r.ok) { tokens.clear(); return false; }
      const b = await r.json(); tokens.set({ accessToken: b.accessToken, refreshToken: b.refreshToken }); return true;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const send = () => {
    const t = tokens.get();
    return fetch(BASE + path, { method: init.method ?? 'GET', headers: { 'content-type': 'application/json', ...(t ? { Authorization: `Bearer ${t.accessToken}` } : {}) }, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  };
  let r: Response;
  try { r = await send(); } catch { throw new ApiError(0, 'Can’t reach CineMind. Check your connection and try again.'); }
  if (r.status === 401 && tokens.get() && (await refresh())) r = await send();
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new ApiError(r.status, Array.isArray(b.message) ? b.message.join(', ') : b.message ?? 'Something went wrong. Try again.');
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
