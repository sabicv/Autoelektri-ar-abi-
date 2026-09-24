'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Lozinka mora imati najmanje 8 znakova.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Lozinke se ne podudaraju.');
      return;
    }

    setIsLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (updateError) {
      setError('Postavljanje nove lozinke nije uspjelo. Pokušajte ponovno.');
      return;
    }

    router.push('/dashboard/jobs');
    router.refresh();
  }

  if (hasSession === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-6 w-6 text-red-500" />
          <p className="text-sm text-slate-600">Poveznica za resetiranje je istekla ili je nevažeća. Zatražite novu.</p>
          <a href="/forgot-password" className="text-sm font-semibold text-blue-600">
            Zatraži novu poveznicu
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Nova lozinka</h1>
          <p className="mt-1 text-sm text-slate-500">Postavite novu lozinku za svoj račun.</p>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Nova lozinka
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
            Potvrdi lozinku
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          {isLoading ? 'Spremanje…' : 'Postavi lozinku'}
        </button>
      </form>
    </main>
  );
}
