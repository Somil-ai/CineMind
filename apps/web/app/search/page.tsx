'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fromTmdb } from '@/lib/types';
import { MovieCard } from '@/components/MovieCard';

const RK = 'cinemind.recent';
const loadRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RK) ?? '[]'); } catch { return []; } };
export default function Search() {
  const [text, setText] = useState(''); const [term, setTerm] = useState(''); const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(loadRecent()), []);
  useEffect(() => { const t = setTimeout(() => setTerm(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const q = useQuery({ queryKey: ['search', term], queryFn: async () => (await api(`/search/movies?q=${encodeURIComponent(term)}`)).results.map(fromTmdb), enabled: term.length >= 2 });
  useEffect(() => { if (q.data?.length) { const next = [term, ...loadRecent().filter((r) => r !== term)].slice(0, 6); try { localStorage.setItem(RK, JSON.stringify(next)); } catch { /* ignore */ } setRecent(next); } }, [q.data, term]);
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Search</h1>
      <label className="sr-only" htmlFor="q">Search movies</label>
      <input id="q" type="search" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title" className="mt-4 w-full rounded-md border border-line bg-surface px-4 py-3 text-lg placeholder:text-muted" />
      {term.length < 2 ? (
        recent.length > 0 && <div className="mt-5"><p className="mb-2 text-sm text-muted">Recent searches</p><div className="flex flex-wrap gap-2">{recent.map((r) => <button key={r} onClick={() => setText(r)} className="rounded-full border border-line px-3 py-1.5 text-sm">{r}</button>)}</div></div>
      ) : q.isLoading ? <p className="mt-6 text-muted" role="status">Searching…</p>
        : q.isError ? <p role="alert" className="mt-6">{(q.error as Error).message}</p>
        : q.data!.length === 0 ? <p className="mt-6 text-muted">No movies match “{term}”. Check the spelling or try a shorter title.</p>
        : <ul className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">{q.data!.map((m: any) => <MovieCard key={m.id} movie={m} fluid />)}</ul>}
    </div>
  );
}
