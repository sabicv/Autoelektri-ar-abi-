'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function DemoResetButton() {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    const confirmed = window.confirm(
      'Ovo će obrisati sve demo klijente/naloge (oznaka is_demo) i vratiti gotov, uredno posložen set primjera za prikaz. Stvarni klijenti i nalozi ostaju netaknuti. Nastaviti?'
    );
    if (!confirmed) return;

    setIsResetting(true);
    const res = await fetch('/api/demo/reset', { method: 'POST' });
    setIsResetting(false);

    if (!res.ok) {
      toast.error('Resetiranje demo podataka nije uspjelo.');
      return;
    }

    toast.success('Demo podaci su resetirani.');
    router.push('/dashboard/jobs');
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Demo podaci</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Vraća uredan, realističan set primjera klijenata i naloga za prikaz softvera — korisno prije demonstracije
          novom klijentu. Ne dira stvarne klijente i naloge.
        </p>
      </div>
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        className="press-effect flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-workshop-border dark:text-slate-200"
      >
        {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" strokeWidth={2} />}
        {isResetting ? 'Resetiranje…' : 'Resetiraj demo podatke'}
      </button>
    </section>
  );
}
