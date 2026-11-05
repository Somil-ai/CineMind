'use client';
import { useState } from 'react';
import { useActions, useSignals } from '@/lib/hooks';

function Stars({ value, onRate, title }: { value: number; onRate: (n: number) => void; title: string }) {
  const [hover, setHover] = useState(0); const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={`Your rating for ${title}`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onRate(n)}
          className={`px-0.5 text-3xl leading-none ${n <= shown ? 'text-marquee' : 'text-line'}`}>★</button>
      ))}
    </div>
  );
}

export function MovieActions({ movieId, title, trailerUrl }: { movieId: number; title: string; trailerUrl?: string }) {
  const { data: s } = useSignals(); const act = useActions(); const [err, setErr] = useState('');
  const run = (...a: Parameters<typeof act>) => act(...a).then(() => setErr('')).catch((e: Error) => setErr(e.message));
  const saved = s?.watchlist.includes(movieId), watched = s?.watched.includes(movieId), fav = s?.favorites.includes(movieId), hidden = s?.notInterested.includes(movieId);
  const btn = 'rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface aria-pressed:border-marquee aria-pressed:text-marquee';
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2.5">
        {trailerUrl && <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-marquee px-5 py-2 text-sm font-semibold text-onmarquee">Watch trailer</a>}
        <button className={btn} aria-pressed={!!saved} onClick={() => run(saved ? 'unwatchlist' : 'watchlist', movieId)}>{saved ? 'In watchlist' : 'Add to watchlist'}</button>
        <button className={btn} aria-pressed={!!watched} onClick={() => run('watched', movieId)}>{watched ? 'Watched' : 'Mark as watched'}</button>
        <button className={btn} aria-pressed={!!fav} onClick={() => run('favorite', movieId)}>{fav ? 'Favorite' : 'Favorite'}</button>
        <button className={btn} aria-pressed={!!hidden} onClick={() => run('notInterested', movieId)}>{hidden ? 'Hidden from picks' : 'Not interested'}</button>
      </div>
      <div className="flex items-center gap-3"><span className="text-sm text-muted">Your rating</span><Stars value={s?.ratings[movieId] ?? 0} title={title} onRate={(n) => run('rate', movieId, n)} /></div>
      {err && <p role="alert" className="text-sm">{err}</p>}
    </div>
  );
}
