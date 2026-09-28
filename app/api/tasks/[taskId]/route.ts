import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendPushToProfiles } from '@/lib/push';

// Moves a task or help request along (Preuzmi → Gotovo, Riješeno) with the
// caller's own session, so RLS decides who may, and tells the sender. Runs
// on the server so a write that changed nothing is reported as a failure
// instead of the phone showing "U radu" that never reached the database.

export const dynamic = 'force-dynamic';

const statusSchema = z.object({ status: z.enum(['IN_PROGRESS', 'DONE']) });

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neispravan status.' }, { status: 400 });

  const { data: current } = await supabase.from('mechanic_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Zadatak nije pronađen.' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();

  // A task is taken and finished by the person it was sent to; the owner
  // only closes help requests. RLS alone would let an owner do both.
  const allowed = current.kind === 'HELP' ? profile?.role === 'owner' : current.receiver_id === user.id;
  if (!allowed) return NextResponse.json({ error: 'Ovaj zadatak nije poslan vama.' }, { status: 403 });

  const { data: task, error } = await supabase
    .from('mechanic_tasks')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('*')
    .maybeSingle();

  if (error || !task) {
    console.error('Task status update failed', error);
    return NextResponse.json({ error: 'Promjena nije spremljena.' }, { status: 500 });
  }

  // The sender hears back: the owner that a task was taken or done, the
  // mechanic that their help request was closed.
  if (task.sender_id && task.sender_id !== user.id && current.status !== task.status) {
    const actor = profile?.full_name ?? 'Djelatnik';
    const title =
      task.kind === 'HELP'
        ? 'Zahtjev za pomoć riješen'
        : task.status === 'IN_PROGRESS'
          ? `Zadatak preuzet — ${actor}`
          : `Zadatak gotov — ${actor}`;
    await sendPushToProfiles([task.sender_id], {
      title,
      body: task.message_text,
      url: task.job_id ? `/dashboard/jobs/${task.job_id}?poruke=1` : '/dashboard/jobs',
    });
  }

  return NextResponse.json({ task });
}
