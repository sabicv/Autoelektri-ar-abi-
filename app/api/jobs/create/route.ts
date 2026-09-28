import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { existingVehicleJobSchema, newJobSchema } from '@/lib/validation/newJob';

// =====================================================================
// Staff-facing "create job" endpoint. Two shapes:
//  - { vehicleId, ... }: a returning vehicle — client/vehicle are already
//    on file and are reused as-is (edits happen on the job page).
//  - full client + vehicle fields: a new customer, created atomically via
//    the same submit_triage_intake RPC as the public QR flow.
// The tenant always comes from the caller's session, never the body.
// Staged photos (temp_ paths) are moved into the job's vault folder.
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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, emergency_surcharge_percent')
    .eq('id', profile.tenant_id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Radionica nije pronađena.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const isExistingVehicle = typeof body === 'object' && body !== null && 'vehicleId' in body;
  const parsed = isExistingVehicle ? existingVehicleJobSchema.safeParse(body) : newJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provjerite podatke.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // The admin client bypasses RLS when moving staged files, so photo paths
  // must be proven to live in the caller's own tenant folder.
  for (const photo of data.photos) {
    if (!photo.path.startsWith(`${profile.tenant_id}/`)) {
      return NextResponse.json({ error: 'Nemate pristup jednoj od fotografija.' }, { status: 403 });
    }
  }

  let jobId: string;

  if ('vehicleId' in data) {
    // RLS only returns the vehicle if it belongs to the caller's workshop.
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, client_id')
      .eq('id', data.vehicleId)
      .maybeSingle();
    if (!vehicle) {
      return NextResponse.json({ error: 'Vozilo nije pronađeno.' }, { status: 404 });
    }

    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        tenant_id: profile.tenant_id,
        client_id: vehicle.client_id,
        vehicle_id: vehicle.id,
        status: 'PENDING_TRIAGE',
        is_emergency: data.isEmergency,
        emergency_surcharge_percent: tenant.emergency_surcharge_percent,
        symptoms: data.symptoms,
        diagnostic_notes: data.description ?? null,
      })
      .select('id')
      .single();

    if (error || !job) {
      console.error('Job insert for existing vehicle failed', error);
      return NextResponse.json({ error: 'Kreiranje naloga nije uspjelo.' }, { status: 500 });
    }
    jobId = job.id;
  } else {
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
    jobId = rpcData.job_id;
  }

  const tenantId = profile.tenant_id;

  // Best-effort: a photo hiccup should never undo an already-created job.
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

  return NextResponse.json(
    { jobId, jobReference: jobId.slice(0, 8).toUpperCase(), photoWarnings },
    { status: 201 }
  );
}
