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
      'Ovo će obrisati sve demo mušterije/naloge (oznaka is_demo) i vratiti gotov, uredno posložen set primjera za prikaz. Stvarne mušterije i nalozi ostaju netaknuti. Nastaviti?'
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
    <details className="group max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-500 dark:text-slate-300">
        Demo podaci (za prezentacije) <span className="text-slate-300 group-open:hidden">▸</span>
      </summary>
      <div className="mt-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting}
          className="press-effect flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-workshop-border dark:text-slate-200"
        >
          {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" strokeWidth={2} />}
          {isResetting ? 'Resetiranje…' : 'Resetiraj demo podatke'}
        </button>
      </div>
    </details>
  );
}
