import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardNav from '@/components/dashboard/DashboardNav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (!profile) {
    // Authenticated, but no workshop assigned to this account yet.
    redirect('/login');
  }

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle();

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-workshop-dark">
      <DashboardNav tenantName={tenant?.name ?? 'Radionica'} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
