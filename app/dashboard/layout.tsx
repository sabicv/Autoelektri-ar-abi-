import { getSessionProfile } from '@/lib/session';
import DashboardNav from '@/components/dashboard/DashboardNav';
import TenantSuspendedScreen from '@/components/dashboard/TenantSuspendedScreen';
import TenantWatermark from '@/components/dashboard/TenantWatermark';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSessionProfile();

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle();

  // RLS hides a suspended workshop's own row from its staff (see
  // auth_tenant_id() in schema.sql), so "profile but no tenant" = locked.
  if (!tenant) {
    return <TenantSuspendedScreen />;
  }

  // isolate: the watermark's negative z-index then sits above this
  // background but below everything else.
  return (
    <div className="isolate min-h-dvh bg-slate-50 dark:bg-workshop-dark">
      <TenantWatermark logoUrl={tenant.logo_url} />
      <DashboardNav tenantName={tenant.name} logoUrl={tenant.logo_url} role={profile.role} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
