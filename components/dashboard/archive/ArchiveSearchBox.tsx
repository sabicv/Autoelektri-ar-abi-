'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

// router.replace, not a GET form: each search would otherwise be another
// step the phone's Back button has to walk through before reaching Poslovi.
export default function ArchiveSearchBox({ initialQuery, tab }: { initialQuery: string; tab: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.replace(q ? `/dashboard/archive?q=${encodeURIComponent(q)}` : `/dashboard/archive?tab=${tab}`);
  }

  function clear() {
    setQuery('');
    router.replace(`/dashboard/archive?tab=${tab}`);
  }

  return (
    <form onSubmit={submit} className="relative" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
      <input
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Traži u arhivi"
        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-12 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          aria-label="Očisti pretragu"
          className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </form>
  );
}
