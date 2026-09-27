'use client';

import { useRouter } from 'next/navigation';
import { Lock, LogOut } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function TenantSuspendedScreen() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-workshop-dark">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-workshop-surface dark:text-slate-300">
        <Lock className="h-7 w-7" strokeWidth={2} />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pristup je privremeno zaustavljen</h1>
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">
        Korištenje aplikacije za ovu radionicu je trenutno onemogućeno. Za ponovnu aktivaciju obratite se dobavljaču
        aplikacije. Vaši podaci su sačuvani.
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="press-effect flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Odjava
      </button>
    </div>
  );
}
