import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';
import { PHOTO_TAGS, type PhotoTag } from '@/types/database';
import { ArchiveJobsTab } from '@/components/dashboard/archive/ArchiveJobsTab';
import { ArchiveDocumentsTab } from '@/components/dashboard/archive/ArchiveDocumentsTab';
import { ArchiveSearchResults } from '@/components/dashboard/archive/ArchiveSearchResults';

export const dynamic = 'force-dynamic';

// Vehicles live under Klijenti and money under Poslovanje, so the archive
// is just history: search, past jobs and stored documents.
const TABS = [
  { id: 'nalozi', label: 'Nalozi' },
  { id: 'dokumenti', label: 'Dokumenti' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface PageProps {
  searchParams: Promise<{ tab?: string; q?: string; tag?: string }>;
}

export default async function ArchivePage({ searchParams }: PageProps) {
  const { supabase } = await requireOwner();
  const params = await searchParams;

  const tab: TabId = TABS.some((t) => t.id === params.tab) ? (params.tab as TabId) : 'nalozi';
  const query = params.q?.trim() ?? '';
  const isSearching = query.length >= 2;
  const tag = PHOTO_TAGS.includes(params.tag as PhotoTag) ? (params.tag as PhotoTag) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Arhiva</h1>

      <form method="GET" action="/dashboard/archive" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tablica, VIN, ime, telefon, OIB, DTC kod, bilješka..."
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
        />
        {query && (
          <Link
            href={`/dashboard/archive?tab=${tab}`}
            aria-label="Očisti pretragu"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </form>

      {query.length > 0 && !isSearching && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Unesite barem 2 znaka za pretragu.</p>
      )}

      {isSearching ? (
        <ArchiveSearchResults supabase={supabase} query={query} />
      ) : (
        <>
          <nav className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-workshop-surface">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/archive?tab=${t.id}`}
                className={cn(
                  'press-effect rounded-lg py-2 text-center text-sm font-semibold',
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-workshop-dark dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {tab === 'nalozi' && <ArchiveJobsTab supabase={supabase} />}
          {tab === 'dokumenti' && <ArchiveDocumentsTab supabase={supabase} tag={tag} />}
        </>
      )}
    </div>
  );
}
