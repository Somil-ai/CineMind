import { beforeEach, describe, expect, it, vi } from 'vitest';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
import { api, ApiError, tokens } from '../lib/api';

const json = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });
beforeEach(() => { store.clear(); vi.restoreAllMocks(); });

describe('api client', () => {
  it('sends the bearer token', async () => {
    tokens.set({ accessToken: 'A1', refreshToken: 'R1' });
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: true }));
    await api('/x'); expect((f.mock.calls[0][1] as any).headers.Authorization).toBe('Bearer A1');
  });
  it('shares ONE refresh between concurrent 401s, then retries with the new token', async () => {
    tokens.set({ accessToken: 'old', refreshToken: 'R1' }); let refreshCalls = 0;
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: any, init: any) => {
      if (String(url).endsWith('/auth/refresh')) { refreshCalls++; await new Promise((r) => setTimeout(r, 20)); return json(200, { accessToken: 'new', refreshToken: 'R2' }); }
      return init.headers.Authorization === 'Bearer new' ? json(200, { ok: 1 }) : json(401, { message: 'expired' });
    }) as any);
    const [a, b] = await Promise.all([api('/a'), api('/b')]);
    expect(a).toEqual({ ok: 1 }); expect(b).toEqual({ ok: 1 }); expect(refreshCalls).toBe(1);
    expect(tokens.get()).toEqual({ accessToken: 'new', refreshToken: 'R2' }); expect(f).toHaveBeenCalled();
  });
  it('clears tokens and surfaces the 401 when refresh fails', async () => {
    tokens.set({ accessToken: 'old', refreshToken: 'bad' });
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: any) => (String(url).endsWith('/auth/refresh') ? json(401) : json(401, { message: 'expired' }))) as any);
    await expect(api('/a')).rejects.toMatchObject({ status: 401 }); expect(tokens.get()).toBeNull();
  });
  it('turns validation arrays into one readable message and handles 204', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    f.mockResolvedValueOnce(json(400, { message: ['email must be an email', 'password too short'] }));
    await expect(api('/x')).rejects.toThrow('email must be an email, password too short');
    f.mockResolvedValueOnce(json(204)); expect(await api('/y', { method: 'POST', body: {} })).toBeUndefined();
  });
  it('reports network failure as status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'));
    const e = await api('/x').catch((x) => x); expect(e).toBeInstanceOf(ApiError); expect(e.status).toBe(0);
  });
});
