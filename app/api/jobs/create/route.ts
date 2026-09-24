import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { newJobSchema } from '@/lib/validation/newJob';

// =====================================================================
// Staff-facing "create job manually" endpoint — for walk-ins, phone
// bookings, or anything that didn't come through the public QR form.
//
// Reuses the same atomic submit_triage_intake RPC as the public triage
// flow (client/vehicle upsert + job insert in one transaction), but the
// tenant is resolved server-side from the caller's own authenticated
// session — never trusted from the request body — so a staff member can
// only ever create jobs inside their own tenant.
// =====================================================================

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Nalog nije povezan s radionicom.' }, { status: 403 });
  }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', profile.tenant_id).maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Radionica nije pronađena.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const parsed = newJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provjerite podatke.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const { data: rpcData, error: rpcError } = await admin
    .rpc('submit_triage_intake', {
      p_tenant_slug: tenant.slug,
      p_first_name: data.firstName,
      p_last_name: data.lastName,
      p_phone_number: `${data.countryCode}${data.phoneNumber}`,
      p_registration_plate: data.registrationPlate,
      p_make: data.make ?? null,
      p_model: data.model ?? null,
      p_year: data.year ?? null,
      p_vin: data.vin ?? null,
      p_symptoms: data.symptoms,
      p_description: data.description ?? null,
      p_is_emergency: data.isEmergency,
    })
    .single();

  if (rpcError || !rpcData) {
    console.error('submit_triage_intake (staff-created job) failed', rpcError);
    return NextResponse.json({ error: 'Kreiranje naloga nije uspjelo.' }, { status: 500 });
  }

  await admin.from('job_events').insert({
    tenant_id: rpcData.tenant_id,
    job_id: rpcData.job_id,
    event_type: 'JOB_CREATED_MANUALLY',
    actor: 'mechanic',
    message: 'Nalog ručno kreiran od strane osoblja.',
    metadata: {},
  });

  return NextResponse.json({ jobId: rpcData.job_id, jobReference: rpcData.job_reference }, { status: 201 });
}
