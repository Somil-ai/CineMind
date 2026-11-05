'use client';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, useSignals } from '@/lib/hooks';
import { fromTmdb } from '@/lib/types';
import { MovieCard } from '@/components/MovieCard';

export default function Watchlist() {
  const { status } = useAuth(); const s = useSignals();
  const ids = s.data?.watchlist ?? [];
  const movies = useQueries({ queries: ids.map((id) => ({ queryKey: ['movie', id], queryFn: () => api(`/movies/${id}`) })) });
  if (status === 'anon') return <p className="py-10">Your watchlist lives in your account. <Link href="/auth" className="underline">Sign in</Link> to start one.</p>;
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Watchlist</h1>
      {s.isLoading || status === 'loading' ? <p className="mt-6 text-muted" role="status">Loading…</p>
        : s.isError ? <p role="alert" className="mt-6">{(s.error as Error).message}</p>
        : ids.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-line p-6"><p>Nothing saved yet.</p><Link href="/" className="mt-3 inline-block rounded-md bg-marquee px-4 py-2 font-medium text-onmarquee">Find something to watch</Link></div>
        : <ul className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">{movies.map((m, i) => m.data ? <MovieCard key={ids[i]} movie={fromTmdb(m.data)} fluid /> : <li key={ids[i]} className="aspect-[2/3] animate-pulse rounded-md bg-surface" aria-hidden />)}</ul>}
    </div>
  );
}
