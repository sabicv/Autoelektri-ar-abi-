import { requireOwner } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import TenantSettingsForm from '@/components/dashboard/TenantSettingsForm';
import StaffManager, { type StaffMember } from '@/components/dashboard/StaffManager';
import DemoResetButton from '@/components/dashboard/DemoResetButton';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireOwner();

  const [{ data: tenant }, { data: profiles }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle(),
    supabase.from('profiles').select('*').eq('tenant_id', profile.tenant_id).order('created_at'),
  ]);
  // Suspended workshop — the layout already shows the lock screen.
  if (!tenant) return null;

  // Login emails live in auth.users, not profiles — a handful of lookups
  // for a workshop-sized team.
  const admin = createAdminClient();
  const staff: StaffMember[] = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return { id: p.id, full_name: p.full_name, role: p.role, email: data.user?.email ?? null };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Postavke radionice</h1>
      <TenantSettingsForm tenant={tenant} />
      <StaffManager initialStaff={staff} currentUserId={user.id} />
      <DemoResetButton />
    </div>
  );
}
