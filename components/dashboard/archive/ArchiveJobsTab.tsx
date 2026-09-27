import { Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import type { Client, Job, Vehicle } from '@/types/database';
import { JOB_STATUS_BADGE_VARIANT, PaymentChip } from '../JobBadges';
import { ArchiveRow, EmptyState } from './shared';

export async function loadJobOwners(supabase: ServerSupabaseClient, jobs: Job[]) {
  if (jobs.length === 0) return { vehicles: new Map<string, Vehicle>(), clients: new Map<string, Client>() };

  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase.from('vehicles').select('*').in('id', [...new Set(jobs.map((j) => j.vehicle_id))]),
    supabase.from('clients').select('*').in('id', [...new Set(jobs.map((j) => j.client_id))]),
  ]);
  return {
    vehicles: new Map((vehicles ?? []).map((v) => [v.id, v])),
    clients: new Map((clients ?? []).map((c) => [c.id, c])),
  };
}

export function JobList({
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
        const total = jobTotal(job);
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
                {total > 0 && (
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatEuroHR(total)}</span>
                )}
                <div className="flex gap-1">
                  <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status]}>{JOB_STATUS_LABELS_HR[job.status]}</Badge>
                  {total > 0 && <PaymentChip status={job.payment_status} />}
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

  const { vehicles, clients } = await loadJobOwners(supabase, jobs);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">Zadnjih {jobs.length} radnih naloga, najnoviji prvi.</p>
      <JobList jobs={jobs} vehicles={vehicles} clients={clients} />
    </div>
  );
}
