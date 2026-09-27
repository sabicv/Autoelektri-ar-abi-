import { getSessionProfile } from '@/lib/session';
import JobsBoard from '@/components/dashboard/JobsBoard';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const { supabase, profile } = await getSessionProfile();

  // RLS scopes these to the current tenant automatically.
  const [{ data: jobs }, { data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('*'),
    supabase.from('vehicles').select('*'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovi</h1>
      <JobsBoard jobs={jobs ?? []} clients={clients ?? []} vehicles={vehicles ?? []} tenantId={profile.tenant_id} />
    </div>
  );
}
