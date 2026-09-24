import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import ClientsBoard from '@/components/dashboard/ClientsBoard';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login');

  // RLS scopes these to the current tenant automatically.
  const [{ data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('vehicles').select('*'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Klijenti</h1>
      <ClientsBoard clients={clients ?? []} vehicles={vehicles ?? []} tenantId={profile.tenant_id} />
    </div>
  );
}
