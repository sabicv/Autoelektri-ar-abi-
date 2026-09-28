'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Action = 'clear' | 'reset';

// Demo data only ever means clients tagged is_demo (and what hangs off
// them). Clearing it is how a workshop goes live; reloading it is for
// sales presentations. Both delete irreversibly, so each needs a second
// tap within a few seconds instead of a browser dialog.
export default function DemoDataPanel({ demoClientCount }: { demoClientCount: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState<Action | null>(null);
  const [running, setRunning] = useState<Action | null>(null);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  async function run(action: Action) {
    // Nothing to lose when there's no demo data yet: load it straight away.
    const needsSecondTap = action === 'clear' || demoClientCount > 0;
    if (needsSecondTap && armed !== action) {
      setArmed(action);
      return;
    }
    setArmed(null);
    setRunning(action);
    const response = await fetch(action === 'clear' ? '/api/demo/clear' : '/api/demo/reset', { method: 'POST' });
    setRunning(null);

    if (!response.ok) {
      toast.error(action === 'clear' ? 'Uklanjanje demo podataka nije uspjelo.' : 'Učitavanje demo podataka nije uspjelo.');
      return;
    }
    toast.success(action === 'clear' ? 'Demo podaci su uklonjeni — aplikacija je spremna za rad.' : 'Demo podaci su učitani.');
    router.refresh();
  }

  const button = (action: Action, label: string, armedLabel: string, danger: boolean) => (
    <button
      type="button"
      onClick={() => run(action)}
      disabled={running !== null}
      className={cn(
        'press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold disabled:opacity-60',
        armed === action
          ? 'border-red-600 bg-red-600 text-white'
          : danger
            ? 'border-red-300 text-red-700 dark:border-red-500/50 dark:text-red-400'
            : 'border-slate-300 text-slate-700 dark:border-workshop-border dark:text-slate-200'
      )}
    >
      {running === action ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : action === 'clear' ? (
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      ) : (
        <RotateCcw className="h-4 w-4" strokeWidth={2} />
      )}
      {armed === action ? armedLabel : label}
    </button>
  );

  if (demoClientCount > 0) {
    return (
      <section className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Demo podaci</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            U aplikaciji su primjeri za prikaz: {demoClientCount}{' '}
            {demoClientCount === 1 ? 'demo mušterija' : 'demo mušterije'} s vozilima i nalozima. Stvarne mušterije se ne
            diraju.
          </p>
        </div>
        {button('clear', 'Ukloni demo podatke', 'Dodirni ponovno za trajno brisanje', true)}
        {button('reset', 'Vrati demo podatke na početno', 'Dodirni ponovno za vraćanje', false)}
      </section>
    );
  }

  return (
    <details className="group max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-500 dark:text-slate-300">
        Demo podaci (za prezentacije) <span className="text-slate-300 group-open:hidden">▸</span>
      </summary>
      <div className="mt-3">{button('reset', 'Učitaj demo podatke', 'Dodirni ponovno', false)}</div>
    </details>
  );
}
