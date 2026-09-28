import { getSessionProfile } from '@/lib/session';
import ClientsBoard from '@/components/dashboard/ClientsBoard';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const { supabase, profile } = await getSessionProfile();

  // RLS scopes these to the current tenant automatically.
  const [{ data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('vehicles').select('*'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Mušterije</h1>
      <ClientsBoard clients={clients ?? []} vehicles={vehicles ?? []} tenantId={profile.tenant_id} />
    </div>
  );
}
