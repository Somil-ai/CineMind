'use client';
import Link from 'next/link';
import type { MovieLite } from '@/lib/types';
import { useActions, useSignals } from '@/lib/hooks';
import { Poster } from './Poster';

export function MovieCard({ movie, onOpen, onHide, fluid = false }: { movie: MovieLite; onOpen?: () => void; onHide?: () => void; fluid?: boolean }) {
  const { data: signals } = useSignals(); const act = useActions();
  const saved = signals?.watchlist.includes(movie.id) ?? false;
  const meta = [movie.year, movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : null].filter(Boolean).join('   ');
  return (
    <li className={fluid ? 'w-full' : 'w-36 shrink-0 snap-start sm:w-44'}>
      <div className="group relative">
        <Link href={`/movie/${movie.id}`} onClick={onOpen} className="block" aria-label={`${movie.title}${movie.year ? `, ${movie.year}` : ''}`}><Poster movie={movie} /></Link>
        <button aria-pressed={saved} aria-label={saved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
          onClick={() => act(saved ? 'unwatchlist' : 'watchlist', movie.id).catch(() => {})}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-bg/80 text-ink backdrop-blur hover:bg-bg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'rgb(var(--marquee))' : 'none'} stroke={saved ? 'rgb(var(--marquee))' : 'currentColor'} strokeWidth="2" aria-hidden><path d="M6 3h12v18l-6-4-6 4z" /></svg>
        </button>
        {onHide && (
          <button aria-label={`Not interested in ${movie.title}`} onClick={onHide}
            className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-bg/80 text-ink opacity-70 backdrop-blur hover:bg-bg focus:opacity-100 md:opacity-0 md:group-hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" aria-hidden><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        )}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{movie.title}</p>
      {meta && <p className="text-xs text-muted">{meta}</p>}
      {movie.reason && <p className="mt-1.5 border-l-2 border-reason pl-2 text-[13px] leading-snug text-reason">{movie.reason}</p>}
    </li>
  );
}
