import { MessagesSquare, Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import { CLOSED_JOBS_FILTER } from '@/lib/jobLifecycle';
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

// Internal messages per job — they belong to the job's permanent record.
export async function loadMessageCounts(supabase: ServerSupabaseClient, jobs: Job[]) {
  const counts: Record<string, number> = {};
  if (jobs.length === 0) return counts;
  const { data } = await supabase.from('mechanic_tasks').select('job_id').in('job_id', jobs.map((j) => j.id));
  for (const row of data ?? []) if (row.job_id) counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
  return counts;
}

export function JobList({
  jobs,
  vehicles,
  clients,
  from,
  messageCounts = {},
}: {
  jobs: Job[];
  vehicles: Map<string, Vehicle>;
  clients: Map<string, Client>;
  // Tells the job page where its "Natrag" should lead (lib/jobLifecycle.ts).
  from: string;
  messageCounts?: Record<string, number>;
}) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const vehicle = vehicles.get(job.vehicle_id);
        const client = clients.get(job.client_id);
        const total = jobTotal(job);
        const messageCount = messageCounts[job.id] ?? 0;
        return (
          <ArchiveRow
            key={job.id}
            href={`/dashboard/jobs/${job.id}?from=${from}`}
            icon={<Wrench className="h-5 w-5" strokeWidth={2} />}
            title={vehicle ? vehicleLabel(vehicle) : 'Vozilo'}
            subtitle={[
              client ? `${client.first_name} ${client.last_name}` : null,
              new Date(job.created_at).toLocaleDateString('hr-HR'),
            ]
              .filter(Boolean)
              .join(' · ')}
            aside={total > 0 ? formatEuroHR(total) : undefined}
            meta={
              <>
                <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status]}>{JOB_STATUS_LABELS_HR[job.status]}</Badge>
                {total > 0 && <PaymentChip status={job.payment_status} />}
                {messageCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                    <MessagesSquare className="h-3.5 w-3.5" strokeWidth={2} /> {messageCount}
                  </span>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

export async function ArchiveJobsTab({ supabase }: { supabase: ServerSupabaseClient }) {
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .or(CLOSED_JOBS_FILTER)
    .order('created_at', { ascending: false })
    .limit(100);
  const jobs = data ?? [];
  if (jobs.length === 0) return <EmptyState>Još nema zatvorenih naloga.</EmptyState>;

  const [{ vehicles, clients }, messageCounts] = await Promise.all([
    loadJobOwners(supabase, jobs),
    loadMessageCounts(supabase, jobs),
  ]);
  return <JobList jobs={jobs} vehicles={vehicles} clients={clients} from="arhiva" messageCounts={messageCounts} />;
}
