import { FileText, Receipt, Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import type { Client, Job, Vehicle } from '@/types/database';
import { ArchiveRow, EmptyState, FilterPill, JOB_STATUS_BADGE_VARIANT, PaymentChip } from './shared';

async function loadOwners(supabase: ServerSupabaseClient, jobs: Job[]) {
  const vehicleIds = [...new Set(jobs.map((j) => j.vehicle_id))];
  const clientIds = [...new Set(jobs.map((j) => j.client_id))];
  if (jobs.length === 0) return { vehicles: new Map<string, Vehicle>(), clients: new Map<string, Client>() };

  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase.from('vehicles').select('*').in('id', vehicleIds),
    supabase.from('clients').select('*').in('id', clientIds),
  ]);
  return {
    vehicles: new Map((vehicles ?? []).map((v) => [v.id, v])),
    clients: new Map((clients ?? []).map((c) => [c.id, c])),
  };
}

function JobList({
  jobs,
  vehicles,
  clients,
}: {
  jobs: Job[];
  vehicles: Map<string, Vehicle>;
  clients: Map<string, Client>;
}) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const vehicle = vehicles.get(job.vehicle_id);
        const client = clients.get(job.client_id);
        return (
          <ArchiveRow
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            icon={<Wrench className="h-5 w-5" strokeWidth={2} />}
            title={vehicle ? vehicleLabel(vehicle) : 'Vozilo'}
            subtitle={[
              client ? `${client.first_name} ${client.last_name}` : null,
              new Date(job.created_at).toLocaleDateString('hr-HR'),
            ]
              .filter(Boolean)
              .join(' · ')}
            meta={
              <>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatEuroHR(jobTotal(job))}</span>
                <div className="flex gap-1">
                  <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status]}>{JOB_STATUS_LABELS_HR[job.status]}</Badge>
                  {jobTotal(job) > 0 && <PaymentChip status={job.payment_status} />}
                </div>
              </>
            }
          />
        );
      })}
    </div>
  );
}

export async function ArchiveJobsTab({ supabase }: { supabase: ServerSupabaseClient }) {
  const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(100);
  const jobs = data ?? [];
  if (jobs.length === 0) return <EmptyState>Još nema radnih naloga.</EmptyState>;

  const { vehicles, clients } = await loadOwners(supabase, jobs);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">Zadnjih {jobs.length} radnih naloga, najnoviji prvi.</p>
      <JobList jobs={jobs} vehicles={vehicles} clients={clients} />
    </div>
  );
}

export type InvoiceFilter = 'unpaid' | 'paid' | 'all';

export async function ArchiveInvoicesTab({
  supabase,
  filter,
}: {
  supabase: ServerSupabaseClient;
  filter: InvoiceFilter;
}) {
  const hasCost = 'total_labor_cost.gt.0,total_parts_cost.gt.0,accrued_parking_fees.gt.0';

  let listQuery = supabase.from('jobs').select('*').or(hasCost).order('created_at', { ascending: false }).limit(200);
  if (filter === 'unpaid') listQuery = listQuery.eq('payment_status', 'UNPAID');
  if (filter === 'paid') listQuery = listQuery.eq('payment_status', 'PAID');

  const [{ data: listed }, { data: allPriced }, { count: supplierInvoiceCount }] = await Promise.all([
    listQuery,
    supabase
      .from('jobs')
      .select('total_labor_cost, total_parts_cost, accrued_parking_fees, payment_status, paid_at')
      .or(hasCost),
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
  const { vehicles, clients } = await loadOwners(supabase, jobs);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Neplaćeno ({unpaidCount})</p>
          <p className="mt-1 text-lg font-black text-amber-600 dark:text-amber-400">{formatEuroHR(unpaidTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Naplaćeno ovaj mjesec</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">{formatEuroHR(paidThisMonth)}</p>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
            <Receipt className="h-4 w-4" strokeWidth={2} /> Izlazni računi (nalozi)
          </h2>
          <div className="flex gap-1.5">
            <FilterPill href="/dashboard/archive?tab=racuni&pay=unpaid" active={filter === 'unpaid'}>
              Neplaćeno
            </FilterPill>
            <FilterPill href="/dashboard/archive?tab=racuni&pay=paid" active={filter === 'paid'}>
              Plaćeno
            </FilterPill>
            <FilterPill href="/dashboard/archive?tab=racuni&pay=all" active={filter === 'all'}>
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

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <FileText className="h-4 w-4" strokeWidth={2} /> Ulazni računi (dobavljači)
        </h2>
        <ArchiveRow
          href="/dashboard/archive?tab=dokumenti&tag=PARTS_INVOICE"
          icon={<FileText className="h-5 w-5" strokeWidth={2} />}
          title="Računi za dijelove"
          subtitle={`${supplierInvoiceCount ?? 0} spremljenih dokumenata`}
        />
      </section>
    </div>
  );
}
