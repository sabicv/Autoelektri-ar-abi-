import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

async function loadProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return profile;
}

export async function POST(request: Request) {
  const profile = await loadProfile();
  if (!profile) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neispravna pretplata.' }, { status: 400 });

  // A shared workshop phone may switch users — the device follows whoever enabled it last.
  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
  const { error } = await admin.from('push_subscriptions').insert({
    tenant_id: profile.tenant_id,
    profile_id: profile.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  if (error) {
    console.error('Push subscribe failed', error);
    return NextResponse.json({ error: 'Uključivanje obavijesti nije uspjelo.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const profile = await loadProfile();
  if (!profile) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });

  await createAdminClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('profile_id', profile.id);
  return NextResponse.json({ success: true });
}
