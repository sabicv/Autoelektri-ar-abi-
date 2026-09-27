import { Car, FileText, Wrench } from 'lucide-react';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { ArchiveRow, EmptyState } from './shared';

const KIND_META = {
  vehicle: { label: 'Vozila i klijenti', icon: Car },
  job: { label: 'Nalozi (bilješke, radovi, DTC)', icon: Wrench },
  document: { label: 'Dokumenti', icon: FileText },
} as const;

export async function ArchiveSearchResults({ supabase, query }: { supabase: ServerSupabaseClient; query: string }) {
  const { data, error } = await supabase.rpc('search_archive', { p_query: query });

  if (error) {
    console.error('search_archive failed', error);
    return <EmptyState>Pretraga trenutno nije dostupna.</EmptyState>;
  }

  const results = data ?? [];
  if (results.length === 0) return <EmptyState>Ništa ne odgovara pretrazi &quot;{query}&quot;.</EmptyState>;

  return (
    <div className="space-y-5">
      {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((kind) => {
        const group = results.filter((r) => r.kind === kind);
        if (group.length === 0) return null;
        const { label, icon: Icon } = KIND_META[kind];

        return (
          <section key={kind} className="space-y-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {label} ({group.length})
            </h2>
            {group.map((r) => (
              <ArchiveRow
                key={`${kind}-${r.job_id ?? r.vehicle_id}-${r.created_at}`}
                href={kind === 'vehicle' ? `/dashboard/vehicles/${r.vehicle_id}` : `/dashboard/jobs/${r.job_id}`}
                icon={<Icon className="h-5 w-5" strokeWidth={2} />}
                title={r.title || 'Bez naziva'}
                subtitle={[r.subtitle, kind === 'vehicle' ? null : new Date(r.created_at).toLocaleDateString('hr-HR')]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
