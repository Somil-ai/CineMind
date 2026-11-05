'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokens } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter(); const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ email: '', password: '', displayName: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (location.hash === '#register') setMode('register'); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api(`/auth/${mode}`, { method: 'POST', body: mode === 'login' ? { email: f.email, password: f.password } : f });
      tokens.set({ accessToken: r.accessToken, refreshToken: r.refreshToken }); qc.clear(); router.push(mode === 'register' ? '/onboarding' : '/');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const input = 'w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted';
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl font-bold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {mode === 'register' && <label className="text-sm">Display name<input className={`${input} mt-1`} required maxLength={50} autoComplete="nickname" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>}
        <label className="text-sm">Email<input className={`${input} mt-1`} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="text-sm">Password<input className={`${input} mt-1`} type="password" required minLength={mode === 'register' ? 10 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby="pw-hint" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {mode === 'register' && <span id="pw-hint" className="mt-1 block text-muted">At least 10 characters, with letters and numbers.</span>}</label>
        {err && <p role="alert" className="rounded-md border border-line bg-surface p-3 text-sm">{err}</p>}
        <button disabled={busy} className="rounded-md bg-marquee px-4 py-2.5 font-medium text-onmarquee disabled:opacity-60">{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="mt-5 text-sm text-muted">{mode === 'login' ? 'New to CineMind?' : 'Already have an account?'}{' '}
        <button className="text-ink underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div>
  );
}
