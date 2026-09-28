import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purgeClients } from '@/lib/purgeClients';

// Deletes one client with all their vehicles, jobs, messages and files —
// test entries before going live, or a customer asking to be forgotten.
// Owner only; RLS first proves the client belongs to the caller's workshop.

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { clientId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Samo vlasnik može obrisati mušteriju.' }, { status: 403 });
  }

  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Mušterija nije pronađena.' }, { status: 404 });

  try {
    const removed = await purgeClients(createAdminClient(), profile.tenant_id, [client.id]);
    return NextResponse.json(removed);
  } catch (error) {
    console.error('Client delete failed', error);
    return NextResponse.json({ error: 'Brisanje nije uspjelo.' }, { status: 500 });
  }
}
