import Link from 'next/link';
import { ChevronRight, FileText, Receipt } from 'lucide-react';
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
  period,
}: {
  supabase: ServerSupabaseClient;
  filter: InvoiceFilter;
  period: string;
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

  let unpaidTotal = 0;
  let unpaidCount = 0;
  for (const j of allPriced ?? []) {
    if (j.payment_status === 'UNPAID') {
      unpaidTotal += jobTotal(j);
      unpaidCount += 1;
    }
  }

  const jobs = listed ?? [];
  const { vehicles, clients } = await loadJobOwners(supabase, jobs);
  const href = (pay: InvoiceFilter) => `/dashboard/analytics?period=${period}&pay=${pay}`;

  return (
    <div className="space-y-4">
      {/* Outstanding money is all-time on purpose — a debt doesn't expire with the period filter. */}
      <Link href={`${href('unpaid')}#racuni`} replace>
        <Card hoverLift className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Za naplatu ukupno ({unpaidCount})</p>
          <p className="flex items-center gap-1 text-lg font-black text-amber-600 dark:text-amber-400">
            {formatEuroHR(unpaidTotal)}
            <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" strokeWidth={2} />
          </p>
        </Card>
      </Link>

      <section id="racuni" className="scroll-mt-32 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
            <Receipt className="h-4 w-4" strokeWidth={2} /> Računi
          </h2>
          <div className="flex gap-1.5">
            <FilterPill href={href('unpaid')} active={filter === 'unpaid'}>
              Za naplatu
            </FilterPill>
            <FilterPill href={href('paid')} active={filter === 'paid'}>
              Plaćeno
            </FilterPill>
            <FilterPill href={href('all')} active={filter === 'all'}>
              Sve
            </FilterPill>
          </div>
        </div>
        {jobs.length === 0 ? (
          <EmptyState>{filter === 'unpaid' ? 'Nema naloga za naplatu.' : 'Nema naloga s upisanom cijenom.'}</EmptyState>
        ) : (
          <JobList jobs={jobs} vehicles={vehicles} clients={clients} from="poslovanje" />
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
