'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, tokens } from './api';
import type { Signals } from './types';

export function useAuth() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => setHasToken(!!tokens.get()), []);
  const q = useQuery({ queryKey: ['me'], queryFn: () => api<{ id: string; email: string; displayName: string; role: string }>('/auth/me'), enabled: hasToken === true, retry: false, staleTime: 300_000 });
  const status = hasToken === null || (hasToken && q.isLoading) ? 'loading' : hasToken && q.data ? 'authed' : 'anon';
  return { status: status as 'loading' | 'authed' | 'anon', user: q.data };
}

export function useSignals() {
  const { status } = useAuth();
  return useQuery({ queryKey: ['signals'], queryFn: () => api<Signals>('/users/me/signals'), enabled: status === 'authed', staleTime: 30_000 });
}

export type ActionKind = 'watchlist' | 'unwatchlist' | 'favorite' | 'watched' | 'rate' | 'notInterested';
export function useActions() {
  const qc = useQueryClient(); const router = useRouter();
  return async (kind: ActionKind, movieId: number, value?: number) => {
    if (!tokens.get()) { router.push('/auth'); return; }
    const prev = qc.getQueryData<Signals>(['signals']);
    if (prev) { // optimistic update; rolled back on failure
      const n: Signals = { ...prev, ratings: { ...prev.ratings }, watchlist: [...prev.watchlist], favorites: [...prev.favorites], watched: [...prev.watched], notInterested: [...prev.notInterested] };
      const add = (a: number[]) => { if (!a.includes(movieId)) a.push(movieId); };
      if (kind === 'watchlist') add(n.watchlist);
      if (kind === 'unwatchlist') n.watchlist = n.watchlist.filter((i) => i !== movieId);
      if (kind === 'favorite') add(n.favorites);
      if (kind === 'watched') { add(n.watched); n.watchlist = n.watchlist.filter((i) => i !== movieId); }
      if (kind === 'rate') { n.ratings[movieId] = value!; n.watchlist = n.watchlist.filter((i) => i !== movieId); }
      if (kind === 'notInterested') add(n.notInterested);
      qc.setQueryData(['signals'], n);
    }
    try {
      if (kind === 'watchlist') await api('/watchlist', { method: 'POST', body: { movieId } });
      if (kind === 'unwatchlist') await api(`/watchlist/${movieId}`, { method: 'DELETE' });
      if (kind === 'favorite') await api('/favorites', { method: 'POST', body: { movieId } });
      if (kind === 'watched') await api('/watched', { method: 'POST', body: { movieId } });
      if (kind === 'rate') await api('/ratings', { method: 'POST', body: { movieId, value } });
      if (kind === 'notInterested') await api('/not-interested', { method: 'POST', body: { movieId } });
      if (kind === 'rate' || kind === 'notInterested' || kind === 'watched') qc.invalidateQueries({ queryKey: ['recs'] });
    } catch (e) { if (prev) qc.setQueryData(['signals'], prev); throw e; }
  };
}
