'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActions, useSignals } from '@/lib/hooks';
import { fetchRow } from '@/lib/queries';
import { MOODS } from '@/lib/types';
import { MovieRow, Section } from './Row';
import { Poster } from './Poster';

function Hero() {
  const act = useActions();
  const q = useQuery({ queryKey: ['recs', 'for-you'], queryFn: () => fetchRow('/recommendations/for-you?k=20', 'rec') });
  const top = q.data?.movies[0];
  if (q.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-surface" aria-hidden />;
  if (!top) return null;
  const h = (top.id * 47) % 360;
  return (
    <section aria-label="Top pick" className="grid items-end gap-6 rounded-xl p-6 md:grid-cols-[1fr_11rem] md:p-10" style={{ background: `linear-gradient(135deg, hsl(${h} 38% 22%), hsl(${(h + 50) % 360} 40% 11%))` }}>
      <div>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">{top.title}</h1>
        {top.reason && <p className="mt-5 max-w-xl border-l-4 border-reason pl-4 text-lg leading-snug text-white md:text-2xl">{top.reason}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/movie/${top.id}`} className="rounded-md bg-marquee px-5 py-2.5 font-medium text-onmarquee">View details</Link>
          <button onClick={() => act('watchlist', top.id).catch(() => {})} className="rounded-md border border-white/30 px-5 py-2.5 font-medium text-white hover:bg-white/10">Add to watchlist</button>
        </div>
      </div>
      <div className="hidden md:block"><Poster movie={top} /></div>
    </section>
  );
}

/** "Because you liked X" / "Similar to your favorite X": seeds a similar-movies row from the user's own signals. */
function SeedRow({ kind }: { kind: 'liked' | 'favorite' }) {
  const { data: s } = useSignals();
  const id = kind === 'liked' ? Object.entries(s?.ratings ?? {}).filter(([, v]) => v >= 4).map(([k]) => Number(k)).at(-1) : s?.favorites[0];
  const m = useQuery({ queryKey: ['movie', id], queryFn: () => api(`/movies/${id}`), enabled: !!id });
  if (!id || !m.data) return null;
  return <MovieRow title={kind === 'liked' ? `Because you liked ${m.data.title}` : `Similar to your favorite, ${m.data.title}`} queryKey={['recs', 'seed', kind, id]} path={`/recommendations/because-you-watched/${id}?k=15`} kind="rec" />;
}

function MoodRow() {
  const [mood, setMood] = useState<string | null>(null);
  return (
    <Section title="Based on your mood">
      <div role="group" aria-label="Choose a mood" className="mb-4 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button key={m} aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}
            className={`rounded-full border px-3.5 py-1.5 text-sm capitalize ${mood === m ? 'border-marquee bg-marquee text-onmarquee' : 'border-line text-muted hover:text-ink'}`}>{m.replace('-', ' ')}</button>
        ))}
      </div>
      {mood ? <MovieRow key={mood} title={`Feeling ${mood.replace('-', ' ')}`} queryKey={['recs', 'mood', mood]} path={`/recommendations/mood/${mood}?k=15`} kind="rec" />
        : <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">Pick a mood to see films that match it.</p>}
    </Section>
  );
}

export function Feed() {
  return (
    <>
      <Hero />
      <MovieRow title="Recommended for you" hint="Every pick comes with its reason." queryKey={['recs', 'for-you']} path="/recommendations/for-you?k=20" kind="rec" />
      <SeedRow kind="liked" /><SeedRow kind="favorite" />
      <MoodRow />
      <MovieRow title="Trending this week" queryKey={['list', 'trending']} path="/movies/trending" kind="tmdb" />
      <MovieRow title="Hidden gems" hint="Well rated, under the radar." queryKey={['recs', 'gems']} path="/recommendations/hidden-gems?k=15" kind="rec" />
      <MovieRow title="New releases" queryKey={['list', 'new']} path="/movies/new-releases" kind="tmdb" />
      <MovieRow title="Top rated" queryKey={['list', 'top']} path="/movies/top-rated" kind="tmdb" />
    </>
  );
}
