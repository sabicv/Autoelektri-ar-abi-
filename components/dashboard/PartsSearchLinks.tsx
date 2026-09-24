'use client';

import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { PARTS_SUPPLIERS } from '@/lib/parts-suppliers';

export default function PartsSearchLinks() {
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Broj dijela ili naziv (npr. alternator Golf 7)..."
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PARTS_SUPPLIERS.map((supplier) => (
          <a
            key={supplier.name}
            href={query.trim() ? supplier.buildUrl(query.trim()) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!query.trim()}
            onClick={(e) => {
              if (!query.trim()) e.preventDefault();
            }}
            className="press-effect flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-slate-200 px-2 text-center dark:border-workshop-border aria-disabled:opacity-40"
          >
            <span className="flex items-center gap-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {supplier.name} <ExternalLink className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            </span>
          </a>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Otvara pretragu izravno na stranici dobavljača u novoj kartici — nema službenog API-ja niti ponuda
        unutar appa, ovo je samo brzi prečac.
      </p>
    </div>
  );
}
