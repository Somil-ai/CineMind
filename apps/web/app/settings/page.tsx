'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { GENRES } from '@/lib/types';

type Profile = { id: string; email: string; displayName: string; prefs: { favoriteGenres: string[]; languages: string[]; allowAdult: boolean }; counts: { ratings: number; watchlist: number; favorites: number } };

export default function Settings() {
  const router = useRouter(); const qc = useQueryClient(); const { status } = useAuth();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/users/me/profile'), enabled: status === 'authed' });
  const [genres, setGenres] = useState<string[]>([]); const [languages, setLanguages] = useState(''); const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (status === 'anon') router.replace('/auth'); }, [status, router]);
  useEffect(() => { if (profile.data) { setGenres(profile.data.prefs.favoriteGenres); setLanguages(profile.data.prefs.languages.join(', ')); setAdult(profile.data.prefs.allowAdult); } }, [profile.data]);

  const save = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      const langs = [...new Set(languages.split(',').map((s) => s.trim()).filter(Boolean))];
      await api('/users/me/preferences', { method: 'PATCH', body: { favoriteGenres: genres, languages: langs, allowAdult: adult } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), qc.invalidateQueries({ queryKey: ['signals'] }), qc.invalidateQueries({ queryKey: ['recs'] })]);
      setMessage('Your preferences are saved. Your recommendations will use them.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const toggle = (g: string) => setGenres((old) => old.includes(g) ? old.filter((x) => x !== g) : [...old, g]);

  if (status === 'anon') return <p className="py-10">Sign in to manage your preferences. <Link href="/auth" className="underline">Sign in</Link></p>;
  if (status === 'loading' || profile.isLoading) return <p className="py-10 text-muted" role="status">Loading your settings…</p>;
  if (profile.isError || !profile.data) return <div className="py-10"><h1 className="font-display text-3xl font-bold">Settings</h1><p role="alert" className="mt-4">{(profile.error as Error)?.message ?? 'Could not load your account.'}</p><button onClick={() => profile.refetch()} className="mt-4 rounded-md border border-line px-4 py-2">Try again</button></div>;

  return <div className="mx-auto max-w-3xl">
    <h1 className="font-display text-3xl font-bold">Your settings</h1>
    <p className="mt-2 text-muted">Tune your taste profile. These choices shape your personal picks.</p>
    <section className="mt-8 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Account</h2><p className="mt-2">{profile.data.displayName}</p><p className="text-sm text-muted">{profile.data.email}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-md border border-line p-3"><strong className="block text-xl">{profile.data.counts.ratings}</strong><span className="text-muted">Rated</span></div><div className="rounded-md border border-line p-3"><strong className="block text-xl">{profile.data.counts.watchlist}</strong><span className="text-muted">Watchlist</span></div><div className="rounded-md border border-line p-3"><strong className="block text-xl">{profile.data.counts.favorites}</strong><span className="text-muted">Favorites</span></div></div>
    </section>
    <section className="mt-6 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Favorite genres</h2><p className="mt-1 text-sm text-muted">Choose the genres you want CineMind to prioritize.</p>
      <div role="group" aria-label="Favorite genres" className="mt-4 flex flex-wrap gap-2">{GENRES.map((g) => <button key={g} type="button" aria-pressed={genres.includes(g)} onClick={() => toggle(g)} className={`rounded-full border px-3 py-1.5 text-sm ${genres.includes(g) ? 'border-marquee bg-marquee text-onmarquee' : 'border-line text-muted hover:text-ink'}`}>{g}</button>)}</div>
      <label className="mt-6 block text-sm font-medium" htmlFor="languages">Preferred languages</label><p className="mt-1 text-sm text-muted">Enter original-language codes separated by commas, such as en, ja, hi.</p><input id="languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="en, ja" className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2" />
      <label className="mt-5 flex cursor-pointer items-start gap-3"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1 accent-[rgb(var(--marquee))]" /><span><span className="block text-sm font-medium">Include adult titles</span><span className="text-sm text-muted">Allow adult films in your recommendations.</span></span></label>
    </section>
    {message && <p role="status" className="mt-4 text-sm text-reason">{message}</p>}{error && <p role="alert" className="mt-4 text-sm">{error}</p>}
    <button disabled={busy} onClick={save} className="mt-5 rounded-md bg-marquee px-5 py-2.5 font-medium text-onmarquee disabled:opacity-60">{busy ? 'Saving…' : 'Save preferences'}</button>
  </div>;
}
