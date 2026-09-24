import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import PrintButton from '@/components/dashboard/PrintButton';
import type { DiagnosticReport } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function WorkOrderPage({ params }: PageProps) {
  const { jobId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) notFound();

  const [{ data: client }, { data: vehicle }, { data: tenant }, { data: reports }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    supabase.from('tenants').select('*').eq('id', job.tenant_id).maybeSingle(),
    supabase.from('diagnostic_reports').select('*').eq('job_id', jobId),
  ]);

  if (!client || !vehicle || !tenant) notFound();

  const dtcCodes = Array.from(new Set((reports ?? []).flatMap((r: DiagnosticReport) => r.dtc_codes)));
  const totalCost = job.total_labor_cost + job.total_parts_cost + job.accrued_parking_fees;
  const reference = job.id.slice(0, 8).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Radni nalog</h1>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 print:rounded-none print:border-0 print:p-0 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100 dark:print:bg-white dark:print:text-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-workshop-border dark:print:border-slate-200">
          <div>
            <p className="text-lg font-black">{tenant.name}</p>
            {tenant.address && <p className="text-sm text-slate-500 dark:text-slate-400 dark:print:text-slate-500">{tenant.address}</p>}
            {tenant.phone && <p className="text-sm text-slate-500 dark:text-slate-400 dark:print:text-slate-500">{tenant.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Radni nalog / predračun</p>
            <p className="text-2xl font-black tracking-widest">{reference}</p>
            <p className="text-xs text-slate-400">{new Date(job.created_at).toLocaleDateString('hr-HR')}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Klijent</p>
            <p className="mt-1 font-semibold">{client.first_name} {client.last_name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:print:text-slate-500">{client.phone_number}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vozilo</p>
            <p className="mt-1 font-semibold">{vehicleLabel(vehicle)}</p>
            {vehicle.vin && <p className="text-sm text-slate-500 dark:text-slate-400 dark:print:text-slate-500">VIN: {vehicle.vin}</p>}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 font-semibold">{JOB_STATUS_LABELS_HR[job.status]}</p>
        </div>

        {dtcCodes.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">DTC kodovi</p>
            <p className="mt-1 font-mono text-sm">{dtcCodes.join(', ')}</p>
          </div>
        )}

        {job.diagnostic_notes && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dijagnostičke napomene</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{job.diagnostic_notes}</p>
          </div>
        )}

        {job.work_summary && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Izvedeni radovi</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{job.work_summary}</p>
          </div>
        )}

        <div className="mt-8 border-t border-slate-200 pt-4 dark:border-workshop-border dark:print:border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400 dark:print:text-slate-500">Rad</span>
            <span className="font-semibold">{formatEuroHR(job.total_labor_cost)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400 dark:print:text-slate-500">Dijelovi</span>
            <span className="font-semibold">{formatEuroHR(job.total_parts_cost)}</span>
          </div>
          {job.accrued_parking_fees > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400 dark:print:text-slate-500">Ležarina</span>
              <span className="font-semibold">{formatEuroHR(job.accrued_parking_fees)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base dark:border-workshop-border dark:print:border-slate-200">
            <span className="font-bold">Ukupno</span>
            <span className="font-black">{formatEuroHR(totalCost)}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Ovo je interni radni nalog / predračun, a ne fiskalizirani račun u smislu Zakona o fiskalizaciji.
        </p>
      </div>
    </div>
  );
}
