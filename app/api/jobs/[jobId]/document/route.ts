import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildWorkOrderPdf } from '@/lib/pdf/workOrderPdf';

// Generates the job's work order / invoice PDF on the server and files it
// in the job's vault (tag WORK_ORDER, owner-only via RLS). Each call adds a
// new version, so the archive keeps e.g. the predračun at lock time and
// the paid version later.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { jobId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  // RLS proves the job belongs to the caller's workshop.
  const { data: ownJob } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle();
  if (!ownJob) return NextResponse.json({ error: 'Nalog nije pronađen.' }, { status: 404 });

  // Full figures come from the admin client: a mechanic's session sees
  // prices zeroed, but the archived document must be complete.
  const admin = createAdminClient();
  const { data: job } = await admin.from('jobs').select('*').eq('id', jobId).single();
  if (!job) return NextResponse.json({ error: 'Nalog nije pronađen.' }, { status: 404 });

  const [{ data: tenant }, { data: client }, { data: vehicle }, { data: reports }] = await Promise.all([
    admin.from('tenants').select('*').eq('id', job.tenant_id).single(),
    admin.from('clients').select('*').eq('id', job.client_id).single(),
    admin.from('vehicles').select('*').eq('id', job.vehicle_id).single(),
    admin
      .from('diagnostic_reports')
      .select('dtc_codes, module_notes, battery_drain_ma, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
  ]);
  if (!tenant || !client || !vehicle) {
    return NextResponse.json({ error: 'Podaci naloga nisu potpuni.' }, { status: 500 });
  }

  let pdf: Uint8Array;
  try {
    pdf = await buildWorkOrderPdf({
      tenant,
      client,
      vehicle,
      job,
      dtcCodes: Array.from(new Set((reports ?? []).flatMap((r) => r.dtc_codes))),
      // Newest report first: it holds the current module readings.
      moduleNotes: reports?.[0]?.module_notes ?? null,
      batteryDrainMa: reports?.[0]?.battery_drain_ma ?? null,
    });
  } catch (error) {
    console.error('Work order PDF generation failed', error);
    return NextResponse.json({ error: 'Izrada PDF-a nije uspjela.' }, { status: 500 });
  }

  const reference = job.id.slice(0, 8).toUpperCase();
  const path = `${job.tenant_id}/${job.id}/WORK_ORDER_${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from('job-vault')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) {
    console.error('Work order PDF upload failed', uploadError);
    return NextResponse.json({ error: 'Spremanje PDF-a nije uspjelo.' }, { status: 500 });
  }

  const caption = `Radni nalog ${reference} — ${job.payment_status === 'PAID' ? 'plaćeno' : 'predračun'}`;
  const { error: insertError } = await admin.from('job_photos').insert({
    job_id: job.id,
    tenant_id: job.tenant_id,
    photo_url: path,
    tag: 'WORK_ORDER',
    caption,
  });
  if (insertError) {
    console.error('Work order PDF record failed', insertError);
    return NextResponse.json({ error: 'PDF je spremljen, ali nije upisan u arhivu.' }, { status: 500 });
  }

  await admin.from('job_events').insert({
    tenant_id: job.tenant_id,
    job_id: job.id,
    event_type: 'DOCUMENT_ARCHIVED',
    actor: 'system',
    message: `${caption} spremljen u arhivu (PDF).`,
    metadata: { path },
  });

  return NextResponse.json({ path, caption });
}
