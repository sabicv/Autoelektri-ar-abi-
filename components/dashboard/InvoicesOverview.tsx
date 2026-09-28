import { FileText, Receipt } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatEuroHR } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { JobList, loadJobOwners } from './archive/ArchiveJobsTab';
import { ArchiveRow, EmptyState, FilterPill } from './archive/shared';

export type InvoiceFilter = 'unpaid' | 'paid' | 'all';

const HAS_COST = 'total_labor_cost.gt.0,total_parts_cost.gt.0,accrued_parking_fees.gt.0';

export default async function InvoicesOverview({
  supabase,
  filter,
}: {
  supabase: ServerSupabaseClient;
  filter: InvoiceFilter;
}) {
  let listQuery = supabase.from('jobs').select('*').or(HAS_COST).order('created_at', { ascending: false }).limit(200);
  if (filter === 'unpaid') listQuery = listQuery.eq('payment_status', 'UNPAID');
  if (filter === 'paid') listQuery = listQuery.eq('payment_status', 'PAID');

  const [{ data: listed }, { data: allPriced }, { count: supplierInvoiceCount }] = await Promise.all([
    listQuery,
    supabase
      .from('jobs')
      .select('total_labor_cost, total_parts_cost, accrued_parking_fees, payment_status, paid_at')
      .or(HAS_COST),
    supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('tag', 'PARTS_INVOICE'),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let unpaidTotal = 0;
  let unpaidCount = 0;
  let paidThisMonth = 0;
  for (const j of allPriced ?? []) {
    if (j.payment_status === 'UNPAID') {
      unpaidTotal += jobTotal(j);
      unpaidCount += 1;
    } else if (j.paid_at && new Date(j.paid_at) >= monthStart) {
      paidThisMonth += jobTotal(j);
    }
  }

  const jobs = listed ?? [];
  const { vehicles, clients } = await loadJobOwners(supabase, jobs);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Neplaćeno ({unpaidCount})</p>
          <p className="mt-1 text-lg font-black text-amber-600 dark:text-amber-400">{formatEuroHR(unpaidTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Naplaćeno ovaj mjesec</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">{formatEuroHR(paidThisMonth)}</p>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
            <Receipt className="h-4 w-4" strokeWidth={2} /> Računi (nalozi)
          </h2>
          <div className="flex gap-1.5">
            <FilterPill href="/dashboard/analytics?pay=unpaid" active={filter === 'unpaid'}>
              Neplaćeno
            </FilterPill>
            <FilterPill href="/dashboard/analytics?pay=paid" active={filter === 'paid'}>
              Plaćeno
            </FilterPill>
            <FilterPill href="/dashboard/analytics?pay=all" active={filter === 'all'}>
              Sve
            </FilterPill>
          </div>
        </div>
        {jobs.length === 0 ? (
          <EmptyState>{filter === 'unpaid' ? 'Nema neplaćenih naloga.' : 'Nema naloga s upisanom cijenom.'}</EmptyState>
        ) : (
          <JobList jobs={jobs} vehicles={vehicles} clients={clients} />
        )}
      </section>

      <ArchiveRow
        href="/dashboard/archive?tab=dokumenti&tag=PARTS_INVOICE"
        icon={<FileText className="h-5 w-5" strokeWidth={2} />}
        title="Ulazni računi dobavljača"
        subtitle={`${supplierInvoiceCount ?? 0} spremljenih dokumenata u Arhivi`}
      />
    </div>
  );
}
