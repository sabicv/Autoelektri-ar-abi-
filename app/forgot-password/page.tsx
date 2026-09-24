'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setIsLoading(false);

    if (resetError) {
      setError('Slanje poveznice nije uspjelo. Provjerite email adresu.');
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Zaboravljena lozinka</h1>
          <p className="mt-1 text-sm text-slate-500">
            Unesite email s kojim ste registrirani — poslat ćemo poveznicu za postavljanje nove lozinke.
          </p>
        </div>

        {sent ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Provjerite email — poslali smo poveznicu za
            resetiranje.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="ime@radionica.hr"
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              {isLoading ? 'Slanje…' : 'Pošalji poveznicu'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Natrag na prijavu
        </Link>
      </div>
    </main>
  );
}
