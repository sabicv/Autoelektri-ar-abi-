'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="press-effect print:hidden flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-5 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
    >
      <Printer className="h-4 w-4" strokeWidth={2} /> Ispiši
    </button>
  );
}
