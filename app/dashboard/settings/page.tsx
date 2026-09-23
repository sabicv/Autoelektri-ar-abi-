import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import TenantSettingsForm from '@/components/dashboard/TenantSettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    redirect('/login');
  }

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle();
  if (!tenant) {
    redirect('/login');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Postavke radionice</h1>
      <TenantSettingsForm tenant={tenant} />
    </div>
  );
}
