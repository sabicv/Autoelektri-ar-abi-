import { getSessionProfile } from '@/lib/session';
import { redactJobForRole } from '@/lib/finance';
import { vehicleLabel } from '@/lib/format';
import JobsBoard from '@/components/dashboard/JobsBoard';
import TaskFeed from '@/components/dashboard/tasks/TaskFeed';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const doneCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  // RLS scopes these to the current tenant (and, for tasks, to a mechanic's own).
  const [{ data: jobs }, { data: clients }, { data: vehicles }, { data: tasks }, { data: staff }] = await Promise.all([
    supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('*'),
    supabase.from('vehicles').select('*'),
    supabase
      .from('mechanic_tasks')
      .select('*')
      .or(`status.neq.DONE,updated_at.gt.${doneCutoff}`)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('created_at'),
  ]);

  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const jobLabels: Record<string, string> = {};
  for (const job of jobs ?? []) {
    const vehicle = vehicleById.get(job.vehicle_id);
    if (vehicle) jobLabels[job.id] = vehicleLabel(vehicle);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovi</h1>
      <TaskFeed
        initialTasks={tasks ?? []}
        role={profile.role}
        currentUserId={user.id}
        tenantId={profile.tenant_id}
        staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? 'Djelatnik' }))}
        jobLabels={jobLabels}
      />
      <JobsBoard
        jobs={(jobs ?? []).map((j) => redactJobForRole(j, profile.role))}
        clients={clients ?? []}
        vehicles={vehicles ?? []}
        tenantId={profile.tenant_id}
      />
    </div>
  );
}
