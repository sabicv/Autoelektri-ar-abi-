import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { triageFormSchema } from '@/lib/validation/triage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const parsed = triageFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provjerite unesene podatke.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const { data: rpcData, error: rpcError } = await admin
    .rpc('submit_triage_intake', {
      p_tenant_slug: data.tenantSlug,
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
    if (rpcError?.message?.includes('TENANT_NOT_FOUND')) {
      return NextResponse.json({ error: 'Radionica nije pronađena.' }, { status: 404 });
    }
    console.error('submit_triage_intake failed', rpcError);
    return NextResponse.json({ error: 'Prijava nije uspjela. Pokušajte ponovno.' }, { status: 500 });
  }

  const { job_id: jobId, tenant_id: tenantId, job_reference: jobReference } = rpcData;

  // Move each staged photo from its temp path into the job's permanent
  // vault path and record it. Best-effort: a photo failure should not
  // undo an already-created job — the customer's ticket still matters.
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

  return NextResponse.json(
    {
      jobId,
      jobReference,
      registrationPlate: data.registrationPlate,
      photoWarnings,
    },
    { status: 201 }
  );
}
