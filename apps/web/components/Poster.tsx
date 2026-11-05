import type { MovieLite } from '@/lib/types';
export const IMG = 'https://image.tmdb.org/t/p';

/** Real artwork when available; otherwise a typographic poster whose hue is derived from the movie id (stable across renders). */
export function Poster({ movie, size = 'w342', className = '' }: { movie: MovieLite; size?: string; className?: string }) {
  if (movie.poster_path) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${IMG}/${size}${movie.poster_path}`} alt={`${movie.title} poster`} loading="lazy" className={`aspect-[2/3] w-full rounded-md bg-surface object-cover ${className}`} />;
  }
  const h = (movie.id * 47) % 360;
  return (
    <div role="img" aria-label={`${movie.title}, no poster available`} className={`flex aspect-[2/3] w-full flex-col justify-end rounded-md p-3 ${className}`}
      style={{ background: `linear-gradient(165deg, hsl(${h} 42% 30%), hsl(${(h + 40) % 360} 48% 13%))` }}>
      <span className="font-display text-lg leading-tight text-white/95">{movie.title}</span>
      {movie.year && <span className="mt-0.5 text-xs text-white/60">{movie.year}</span>}
    </div>
  );
}
