import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { newJobSchema } from '@/lib/validation/newJob';

// =====================================================================
// Staff-facing "create job manually" endpoint — for walk-ins, phone
// bookings, or adding a client from /dashboard/clients. Also the backing
// endpoint for photos captured during that flow (registration card,
// vehicle condition) — moved from their temp staging path into the job's
// permanent vault path here, same as the public triage submit route.
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

  // photoPath must live inside the caller's own tenant folder — enforced
  // manually since this route uses the admin client (bypasses RLS) to
  // move temp-staged files, same guard as /api/vision/registration-card.
  for (const photo of data.photos) {
    if (!photo.path.startsWith(`${profile.tenant_id}/`)) {
      return NextResponse.json({ error: 'Nemate pristup jednoj od fotografija.' }, { status: 403 });
    }
  }

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
      p_address: data.address ?? null,
      p_oib: data.oib || null,
    })
    .single();

  if (rpcError || !rpcData) {
    console.error('submit_triage_intake (staff-created job) failed', rpcError);
    return NextResponse.json({ error: 'Kreiranje naloga nije uspjelo.' }, { status: 500 });
  }

  const { job_id: jobId, tenant_id: tenantId, job_reference: jobReference } = rpcData;

  // Best-effort, same as the public triage route — a photo hiccup should
  // never undo an already-created job.
  const photoWarnings: string[] = [];

  for (const [index, photo] of data.photos.entries()) {
    try {
      const extension = photo.path.split('.').pop() || 'jpg';
      const finalPath = `${tenantId}/${jobId}/${photo.tag}_${Date.now()}_${index}.${extension}`;

      const { error: moveError } = await admin.storage.from('job-vault').move(photo.path, finalPath);
      if (moveError) throw moveError;

      const { error: insertError } = await admin.from('job_photos').insert({
        job_id: jobId,
        tenant_id: tenantId,
        photo_url: finalPath,
        tag: photo.tag,
      });
      if (insertError) throw insertError;
    } catch (error) {
      console.error('Photo attach failed', photo, error);
      photoWarnings.push(photo.tag);
    }
  }

  await admin.from('job_events').insert({
    tenant_id: tenantId,
    job_id: jobId,
    event_type: 'JOB_CREATED_MANUALLY',
    actor: 'mechanic',
    message: 'Nalog ručno kreiran od strane osoblja.',
    metadata: {},
  });

  return NextResponse.json({ jobId, jobReference, photoWarnings }, { status: 201 });
}
