import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToProfiles } from '@/lib/push';
import { vehicleLabel } from '@/lib/format';

// Creates a task (owner → mechanic) or a help request (mechanic → owners)
// with the caller's own session, so RLS decides who may send what, then
// pushes a phone notification to whoever should see it.

export const dynamic = 'force-dynamic';

const taskSchema = z.object({
  kind: z.enum(['TASK', 'HELP']),
  message: z.string().trim().min(1).max(2000),
  jobId: z.string().uuid().nullable().optional(),
  receiverId: z.string().uuid().nullable().optional(),
  replyToId: z.string().uuid().nullable().optional(),
  photoPath: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Nalog nije povezan s radionicom.' }, { status: 403 });

  const parsed = taskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provjerite poruku.' }, { status: 400 });
  const data = parsed.data;

  if (data.photoPath && !data.photoPath.startsWith(`${profile.tenant_id}/`)) {
    return NextResponse.json({ error: 'Nemate pristup ovoj fotografiji.' }, { status: 403 });
  }

  const { data: task, error } = await supabase
    .from('mechanic_tasks')
    .insert({
      tenant_id: profile.tenant_id,
      sender_id: user.id,
      kind: data.kind,
      receiver_id: data.kind === 'HELP' ? null : (data.receiverId ?? null),
      job_id: data.jobId ?? null,
      reply_to_id: data.replyToId ?? null,
      photo_path: data.photoPath ?? null,
      message_text: data.message,
    })
    .select('*')
    .single();

  if (error || !task) {
    console.error('Task insert failed', error);
    return NextResponse.json({ error: 'Slanje nije uspjelo.' }, { status: error?.code === '42501' ? 403 : 500 });
  }

  // Short vehicle label so the notification alone says which car it's about.
  let vehicleText = '';
  if (task.job_id) {
    const { data: job } = await supabase.from('jobs').select('vehicle_id').eq('id', task.job_id).maybeSingle();
    const { data: vehicle } = job
      ? await supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle()
      : { data: null };
    if (vehicle) vehicleText = `${vehicleLabel(vehicle)}: `;
  }
  const url = task.job_id ? `/dashboard/jobs/${task.job_id}?poruke=1` : '/dashboard/jobs';
  const senderName = profile.full_name ?? 'Djelatnik';

  if (task.kind === 'HELP') {
    const { data: owners } = await createAdminClient()
      .from('profiles')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'owner');
    await sendPushToProfiles(
      (owners ?? []).map((o) => o.id),
      { title: `Trebam pomoć — ${senderName}`, body: `${vehicleText}${task.message_text}`, url }
    );
  } else if (task.receiver_id) {
    await sendPushToProfiles([task.receiver_id], {
      title: `Novi zadatak od ${senderName}`,
      body: `${vehicleText}${task.message_text}`,
      url,
    });
  }

  return NextResponse.json({ task });
}
