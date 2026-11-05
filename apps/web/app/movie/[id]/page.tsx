import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MovieActions } from '@/components/MovieActions';
import { MovieExtras } from '@/components/MovieExtras';
import { IMG, Poster } from '@/components/Poster';
import { fromTmdb } from '@/lib/types';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

async function getMovie(id: string) {
  const r = await fetch(`${API}/movies/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error('The movie service is temporarily unavailable. Try again in a moment.');
  return r.json();
}
const year = (m: any) => (m.release_date ? String(m.release_date).slice(0, 4) : '');

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getMovie(params.id).catch(() => null);
  if (!m) return { title: 'Movie not found | CineMind' };
  const desc = m.overview || `Cast, rating and where to watch ${m.title}.`;
  return { title: `${m.title}${year(m) ? ` (${year(m)})` : ''} | CineMind`, description: desc, openGraph: { title: m.title, description: desc, images: m.poster_path ? [`${IMG}/w500${m.poster_path}`] : [] } };
}

export default async function MoviePage({ params }: { params: { id: string } }) {
  const m = await getMovie(params.id);
  if (!m) notFound();
  const lite = fromTmdb(m);
  const director = m.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
  const cast = (m.credits?.cast ?? []).slice(0, 6).map((c: any) => c.name).join(', ');
  const trailer = (m.videos?.results ?? []).find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  const meta = [year(m), m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : '', m.vote_average ? `★ ${Number(m.vote_average).toFixed(1)} (${(m.vote_count ?? 0).toLocaleString('en-US')} votes)` : ''].filter(Boolean).join('   ');
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Movie', name: m.title, datePublished: m.release_date || undefined, director: director ? { '@type': 'Person', name: director } : undefined,
    aggregateRating: m.vote_count ? { '@type': 'AggregateRating', ratingValue: m.vote_average, ratingCount: m.vote_count, bestRating: 10 } : undefined }).replace(/</g, '\\u003c');
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <div className="grid gap-6 md:grid-cols-[14rem_1fr] md:gap-10">
        <div className="w-40 md:w-full"><Poster movie={lite} size="w500" /></div>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">{m.title}</h1>
          {m.tagline && <p className="mt-2 font-display text-lg italic text-muted">{m.tagline}</p>}
          <p className="mt-3 text-sm text-muted">{meta}</p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Genres">{(m.genres ?? []).map((g: any) => <li key={g.name} className="rounded-full border border-line px-3 py-1 text-sm">{g.name}</li>)}</ul>
          <p className="mt-5 max-w-prose leading-relaxed">{m.overview || 'No synopsis is available for this title yet.'}</p>
          <dl className="mt-5 space-y-1 text-sm">
            {director && <div className="flex gap-3"><dt className="w-16 text-muted">Director</dt><dd>{director}</dd></div>}
            {cast && <div className="flex gap-3"><dt className="w-16 shrink-0 text-muted">Cast</dt><dd>{cast}</dd></div>}
          </dl>
          <MovieActions movieId={m.id} title={m.title} trailerUrl={trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined} />
        </div>
      </div>
      <MovieExtras movieId={m.id} />
    </article>
  );
}
