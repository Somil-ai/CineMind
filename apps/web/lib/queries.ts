import { api } from './api';
import { fromRec, fromTmdb, MovieLite } from './types';

export interface RowData { requestId: string | null; degraded: boolean; movies: MovieLite[] }
/** Normalises both recommendation responses and TMDB list responses into one shape. */
export async function fetchRow(path: string, kind: 'rec' | 'tmdb'): Promise<RowData> {
  const d = await api(path);
  return kind === 'rec' ? { requestId: d.request_id ?? null, degraded: !!d.degraded, movies: (d.items ?? []).map(fromRec) } : { requestId: null, degraded: false, movies: (d.results ?? []).map(fromTmdb) };
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
