import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import JobsBoard from '@/components/dashboard/JobsBoard';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login');

  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', profile.tenant_id).maybeSingle();
  if (!tenant) redirect('/login');

  // RLS scopes these to the current tenant automatically.
  const [{ data: jobs }, { data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('*'),
    supabase.from('vehicles').select('*'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovi</h1>
      <JobsBoard jobs={jobs ?? []} clients={clients ?? []} vehicles={vehicles ?? []} />
    </div>
  );
}
