'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MovieRow, Section } from './Row';

export function MovieExtras({ movieId }: { movieId: number }) {
  const p = useQuery({ queryKey: ['providers', movieId], queryFn: () => api<{ region: string; flatrate?: any[]; rent?: any[]; buy?: any[] }>(`/movies/${movieId}/watch-providers`) });
  const groups: [string, any[] | undefined][] = [['Stream', p.data?.flatrate], ['Rent', p.data?.rent], ['Buy', p.data?.buy]];
  const any = groups.some(([, g]) => g?.length);
  return (
    <>
      <Section title="Where to watch" hint={p.data?.region ? `Region: ${p.data.region}` : undefined}>
        {p.isLoading ? <div className="h-10 animate-pulse rounded bg-surface" aria-hidden /> : !any ? <p className="text-sm text-muted">Streaming availability isn’t available for this title in your region yet.</p>
          : <dl className="space-y-2 text-sm">{groups.filter(([, g]) => g?.length).map(([k, g]) => <div key={k} className="flex gap-3"><dt className="w-14 text-muted">{k}</dt><dd>{g!.map((x) => x.provider_name).join(', ')}</dd></div>)}</dl>}
      </Section>
      <MovieRow title="More like this" queryKey={['recs', 'similar', movieId]} path={`/recommendations/similar/${movieId}?k=12`} kind="rec" empty="No similar titles found yet." />
    </>
  );
}
