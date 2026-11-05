'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActions } from '@/lib/hooks';
import { fetchRow, UUID } from '@/lib/queries';
import { MovieCard } from './MovieCard';

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-9">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3"><h2 className="font-display text-xl">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>
      {children}
    </section>
  );
}
export function RowSkeleton() {
  return (
    <ul className="flex gap-4 overflow-hidden" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="w-36 shrink-0 sm:w-44"><div className="aspect-[2/3] animate-pulse rounded-md bg-surface" /><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-surface" /></li>
      ))}
    </ul>
  );
}

/** One carousel row. `kind="rec"` rows show the reason line and log clicks/not-interested back as feedback. */
export function MovieRow({ title, hint, queryKey, path, kind, empty }: { title: string; hint?: string; queryKey: unknown[]; path: string; kind: 'rec' | 'tmdb'; empty?: string }) {
  const act = useActions(); const [hidden, setHidden] = useState<Set<number>>(new Set());
  const q = useQuery({ queryKey, queryFn: () => fetchRow(path, kind) });
  const movies = (q.data?.movies ?? []).filter((m) => !hidden.has(m.id));
  const click = (id: number) => { const r = q.data?.requestId; if (r && UUID.test(r)) api('/recommendations/feedback', { method: 'POST', body: { requestId: r, movieId: id, outcome: 'click' } }).catch(() => {}); };
  return (
    <Section title={title} hint={hint}>
      {q.data?.degraded && <p role="status" className="mb-3 text-sm text-muted">Personalized picks are temporarily unavailable. Showing popular titles instead.</p>}
      {q.isLoading ? <RowSkeleton />
        : q.isError ? (
          <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-surface p-4 text-sm">
            <span>{(q.error as Error).message}</span><button onClick={() => q.refetch()} className="rounded bg-marquee px-3 py-1.5 font-medium text-onmarquee">Try again</button>
          </div>)
        : movies.length === 0 ? <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">{empty ?? 'Nothing to show yet. Rate a few movies and check back.'}</p>
        : (
          <ul className="rail -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
            {movies.map((m) => (
              <MovieCard key={m.id} movie={m} onOpen={kind === 'rec' ? () => click(m.id) : undefined}
                onHide={kind === 'rec' ? () => { setHidden(new Set(hidden).add(m.id)); act('notInterested', m.id).catch(() => {}); } : undefined} />
            ))}
          </ul>)}
    </Section>
  );
}
