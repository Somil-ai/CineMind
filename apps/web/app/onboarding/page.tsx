'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { fromTmdb, GENRES } from '@/lib/types';
import { Poster } from '@/components/Poster';

const MIN = 5;
export default function Onboarding() {
  const router = useRouter(); const qc = useQueryClient(); const { status } = useAuth();
  const [step, setStep] = useState<1 | 2>(1); const [picked, setPicked] = useState<number[]>([]); const [genres, setGenres] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (status === 'anon') router.replace('/auth'); }, [status, router]);
  const q = useQuery({ queryKey: ['list', 'onboarding'], queryFn: async () => (await api('/movies/popular')).results.map(fromTmdb) });
  const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const finish = async () => {
    setBusy(true); setErr('');
    try {
      await Promise.all(picked.map((movieId) => api('/ratings', { method: 'POST', body: { movieId, value: 5 } })));
      if (genres.length) await api('/users/me/preferences', { method: 'PATCH', body: { favoriteGenres: genres } });
      qc.invalidateQueries({ queryKey: ['recs'] }); qc.invalidateQueries({ queryKey: ['signals'] }); router.push('/');
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div>
      <div className="flex items-baseline justify-between"><h1 className="font-display text-3xl font-bold">{step === 1 ? 'Pick five films you love' : 'Which genres do you reach for?'}</h1><Link href="/" className="text-sm text-muted underline">Skip for now</Link></div>
      <p className="mt-2 text-muted">{step === 1 ? 'These teach CineMind your taste, so your first feed is already personal.' : 'Optional. You can change this later in settings.'}</p>
      {step === 1 ? (
        q.isLoading ? <p className="mt-6 text-muted">Loading films…</p> : q.isError ? <p role="alert" className="mt-6">{(q.error as Error).message}</p> : (
          <ul className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {q.data!.map((m: any) => { const on = picked.includes(m.id); return (
              <li key={m.id}><button aria-pressed={on} onClick={() => setPicked(toggle(picked, m.id))} className={`block w-full rounded-md text-left ring-offset-2 ring-offset-bg ${on ? 'ring-2 ring-marquee' : ''}`}>
                <Poster movie={m} /><span className="mt-1.5 block text-sm">{on ? '✓ ' : ''}{m.title}</span></button></li>); })}
          </ul>)
      ) : (
        <div role="group" aria-label="Favorite genres" className="mt-6 flex flex-wrap gap-2">
          {GENRES.map((g) => <button key={g} aria-pressed={genres.includes(g)} onClick={() => setGenres(toggle(genres, g))} className={`rounded-full border px-4 py-2 text-sm ${genres.includes(g) ? 'border-marquee bg-marquee text-onmarquee' : 'border-line text-muted hover:text-ink'}`}>{g}</button>)}
        </div>)}
      {err && <p role="alert" className="mt-4 text-sm">{err}</p>}
      <div className="sticky bottom-16 mt-8 flex items-center gap-4 rounded-lg border border-line bg-bg/95 p-3 backdrop-blur md:bottom-4">
        <p className="text-sm text-muted" aria-live="polite">{step === 1 ? `${Math.min(picked.length, MIN)} of ${MIN} chosen` : `${genres.length} selected`}</p>
        {step === 1
          ? <button disabled={picked.length < MIN} onClick={() => setStep(2)} className="ml-auto rounded-md bg-marquee px-5 py-2 font-medium text-onmarquee disabled:opacity-40">Continue</button>
          : <><button onClick={() => setStep(1)} className="ml-auto text-sm underline">Back</button><button disabled={busy} onClick={finish} className="rounded-md bg-marquee px-5 py-2 font-medium text-onmarquee disabled:opacity-60">{busy ? 'Building your feed…' : 'Show my recommendations'}</button></>}
      </div>
    </div>
  );
}
