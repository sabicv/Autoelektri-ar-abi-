import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purgeClients } from '@/lib/purgeClients';

// Takes the workshop live: removes the sales-demo dataset (clients tagged
// is_demo, with their vehicles, jobs, messages and files). Real records
// are never selected, so this can't touch production data.

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Samo vlasnik može ukloniti demo podatke.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: demoClients } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('is_demo', true);

  try {
    const removed = await purgeClients(admin, profile.tenant_id, (demoClients ?? []).map((c) => c.id));
    return NextResponse.json(removed);
  } catch (error) {
    console.error('Demo clear failed', error);
    return NextResponse.json({ error: 'Uklanjanje demo podataka nije uspjelo.' }, { status: 500 });
  }
}
