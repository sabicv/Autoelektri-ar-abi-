import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';
import { PHOTO_TAGS, type PhotoTag } from '@/types/database';
import { ArchiveJobsTab } from '@/components/dashboard/archive/ArchiveJobsTab';
import { ArchiveDocumentsTab } from '@/components/dashboard/archive/ArchiveDocumentsTab';
import { ArchiveSearchResults } from '@/components/dashboard/archive/ArchiveSearchResults';
import ArchiveSearchBox from '@/components/dashboard/archive/ArchiveSearchBox';

export const dynamic = 'force-dynamic';

// Vehicles live under Mušterije and money under Poslovanje, so the archive
// is closed jobs (with their messages), stored documents and search.
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
      <Link
        href="/dashboard/jobs"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Poslovi
      </Link>

      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Arhiva</h1>

      <ArchiveSearchBox key={query} initialQuery={query} tab={tab} />

      {query.length > 0 && !isSearching && (
        <p className="text-sm text-slate-500 dark:text-slate-300">Unesite barem 2 znaka za pretragu.</p>
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
                replace
                className={cn(
                  'press-effect flex min-h-[48px] items-center justify-center rounded-lg text-sm font-semibold',
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-workshop-dark dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-300'
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
