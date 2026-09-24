'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="press-effect print:hidden flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white"
    >
      <Printer className="h-4 w-4" strokeWidth={2} /> Ispiši / spremi kao PDF
    </button>
  );
}
