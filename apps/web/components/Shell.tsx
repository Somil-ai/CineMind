'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokens } from '@/lib/api';
import { useAuth } from '@/lib/hooks';

const I = ({ d }: { d: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const NAV = [
  { href: '/', label: 'Home', d: 'M3 11l9-8 9 8v10H3z' },
  { href: '/search', label: 'Search', d: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5' },
  { href: '/watchlist', label: 'Watchlist', d: 'M6 3h12v18l-6-4-6 4z' },
  { href: '/settings', label: 'Settings', d: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2h-2.6v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H6.3v-2.6h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5v-.2H15v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.2V14h-.2a1.7 1.7 0 00-1.5 1z' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const qc = useQueryClient(); const { status, user } = useAuth();
  const [light, setLight] = useState(false);
  useEffect(() => { try { setLight(localStorage.getItem('cinemind.theme') === 'light'); } catch { /* ignore */ } }, []);
  useEffect(() => { document.documentElement.classList.toggle('light', light); try { localStorage.setItem('cinemind.theme', light ? 'light' : 'dark'); } catch { /* ignore */ } }, [light]);
  const signOut = async () => { const t = tokens.get(); if (t) await api('/auth/logout', { method: 'POST', body: { refreshToken: t.refreshToken } }).catch(() => {}); tokens.clear(); qc.clear(); router.push('/'); };
  const link = (active: boolean) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? 'bg-surface text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <div className="min-h-screen md:pl-56">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-bg p-5 md:flex">
        <Link href="/" className="mb-8 font-display text-2xl font-bold tracking-tight">CineMind</Link>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined} className={link(path === n.href)}><I d={n.d} />{n.label}</Link>)}
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-sm">
          {status === 'authed' ? (<><p className="truncate px-3 text-muted">{user?.displayName}</p><button onClick={signOut} className={link(false)}>Sign out</button></>)
            : status === 'anon' ? <Link href="/auth" className="rounded-md bg-marquee px-3 py-2 text-center font-medium text-onmarquee">Sign in</Link> : null}
          <button onClick={() => setLight(!light)} aria-pressed={light} className={link(false)}>{light ? 'Light theme' : 'Dark theme'}</button>
        </div>
      </aside>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg/95 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${path === n.href ? 'text-marquee' : 'text-muted'}`}><I d={n.d} />{n.label}</Link>
        ))}
        {status === 'authed' ? <button onClick={signOut} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs text-muted"><I d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" />Sign out</button>
          : <Link href="/auth" className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs text-muted"><I d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />Sign in</Link>}
      </nav>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-12">{children}</main>
    </div>
  );
}
