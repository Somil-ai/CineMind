import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

const RECO = () => process.env.RECO_URL || 'http://localhost:8001';

/** TMDB client with TTL cache and timeout. Cached entries are served stale if TMDB errors (graceful degradation). */
@Injectable()
export class TmdbService {
  private cache = new Map<string, { exp: number; data: any }>();
  async get(path: string, params: Record<string, string | number> = {}, ttlMs = 300_000): Promise<any> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return this.demo(path, params);
    const url = new URL('https://api.themoviedb.org/3' + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const ck = url.toString(), hit = this.cache.get(ck);
    if (hit && hit.exp > Date.now()) return hit.data;
    url.searchParams.set('api_key', key);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json(); this.cache.set(ck, { exp: Date.now() + ttlMs, data }); return data;
    } catch {
      if (hit) return hit.data;
      throw new BadGatewayException('Movie data provider unavailable');
    }
  }

  /** Dev/demo mode (no TMDB key): serve the reco service's small seed catalog in TMDB's response shape. */
  private async demo(path: string, p: Record<string, string | number>): Promise<any> {
    const sort = path.includes('top_rated') ? 'top_rated' : path.includes('now_playing') ? 'new' : 'popularity';
    let url: string;
    const id = path.match(/^\/movie\/(\d+)$/);
    if (id) url = `/catalog/${id[1]}`;
    else if (path.startsWith('/search/')) url = `/catalog?q=${encodeURIComponent(String(p.query ?? ''))}&page=${p.page ?? 1}`;
    else if (/^\/(trending|movie)\/(movie\/week|popular|top_rated|now_playing)$/.test(path)) url = `/catalog?sort=${sort}&page=${p.page ?? 1}`;
    else return { results: [], cast: [], crew: [] };   // credits/videos/providers/similar are empty in demo mode
    try {
      const r = await fetch(RECO() + url, { signal: AbortSignal.timeout(2000) });
      if (r.status === 404) throw new NotFoundException('Movie not found');
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new ServiceUnavailableException('Set TMDB_API_KEY, or start the reco service for demo data');
    }
  }
}
