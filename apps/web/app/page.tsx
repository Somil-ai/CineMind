'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks';
import { Feed } from '@/components/Feed';
import { MovieRow } from '@/components/Row';

const SAMPLES = ['Because you liked Inception and sci-fi thrillers with complex narratives.', 'Highly rated psychological thrillers similar to Se7en.', 'Popular among viewers with taste similar to yours.'];

export default function Home() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="h-64 animate-pulse rounded-xl bg-surface" aria-label="Loading" />;
  if (status === 'authed') return <Feed />;
  return (
    <>
      <section className="py-10 md:py-16">
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Movies picked for you, with the reason attached.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">Rate five films you love. CineMind finds what to watch next and tells you why each one made the list.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/auth#register" className="rounded-md bg-marquee px-5 py-2.5 font-medium text-onmarquee">Get my recommendations</Link>
          <Link href="/search" className="rounded-md border border-line px-5 py-2.5 font-medium hover:bg-surface">Browse without an account</Link>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Example reasons">
          {SAMPLES.map((s) => <li key={s} className="border-l-2 border-reason pl-3 text-reason">{s}</li>)}
        </ul>
      </section>
      <MovieRow title="Trending this week" queryKey={['list', 'trending']} path="/movies/trending" kind="tmdb" />
      <MovieRow title="Top rated" queryKey={['list', 'top']} path="/movies/top-rated" kind="tmdb" />
    </>
  );
}
