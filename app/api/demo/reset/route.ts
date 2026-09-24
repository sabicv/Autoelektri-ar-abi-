import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_CLIENTS, type DemoJobSeed } from '@/lib/demo-seed';
import { JOB_STATUS_LABELS_HR } from '@/lib/format';

// =====================================================================
// Wipes and re-seeds this tenant's curated sales-demo dataset so a
// mechanic can reset the app back to a clean, realistic-looking state
// before a demo pitch. Only ever touches rows tagged is_demo = true —
// real client/job data (is_demo = false by default) is never selected
// by these queries, so this can't destroy production records.
// =====================================================================

export const dynamic = 'force-dynamic';

function daysAgoIso(days: number, from: number) {
  return new Date(from - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST() {
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

  const admin = createAdminClient();
  const tenantId = profile.tenant_id;
  const now = Date.now();

  // Cascades to vehicles / jobs / diagnostic_reports / job_photos / job_events.
  const { error: deleteError } = await admin.from('clients').delete().eq('tenant_id', tenantId).eq('is_demo', true);
  if (deleteError) {
    console.error('Demo reset: delete failed', deleteError);
    return NextResponse.json({ error: 'Brisanje starih demo podataka nije uspjelo.' }, { status: 500 });
  }

  let jobsCreated = 0;

  for (const clientSeed of DEMO_CLIENTS) {
    const { data: client, error: clientError } = await admin
      .from('clients')
      .insert({
        tenant_id: tenantId,
        first_name: clientSeed.firstName,
        last_name: clientSeed.lastName,
        phone_number: clientSeed.phoneNumber,
        address: clientSeed.address ?? null,
        oib: clientSeed.oib ?? null,
        is_demo: true,
      })
      .select('id')
      .single();

    if (clientError || !client) {
      console.error('Demo reset: client insert failed', clientSeed, clientError);
      continue;
    }

    for (const vehicleSeed of clientSeed.vehicles) {
      const { data: vehicle, error: vehicleError } = await admin
        .from('vehicles')
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          make: vehicleSeed.make,
          model: vehicleSeed.model,
          year: vehicleSeed.year,
          registration_plate: vehicleSeed.registrationPlate,
          vin: vehicleSeed.vin ?? null,
        })
        .select('id')
        .single();

      if (vehicleError || !vehicle) {
        console.error('Demo reset: vehicle insert failed', vehicleSeed, vehicleError);
        continue;
      }

      for (const jobSeed of vehicleSeed.jobs) {
        await createDemoJob(admin, tenantId, client.id, vehicle.id, jobSeed, now);
        jobsCreated += 1;
      }
    }
  }

  return NextResponse.json({ clientsCreated: DEMO_CLIENTS.length, jobsCreated }, { status: 200 });
}

async function createDemoJob(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  clientId: string,
  vehicleId: string,
  jobSeed: DemoJobSeed,
  now: number
) {
  const createdAt = daysAgoIso(jobSeed.daysAgoCreated, now);

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      vehicle_id: vehicleId,
      status: jobSeed.status,
      is_emergency: jobSeed.isEmergency ?? false,
      diagnostic_hours: jobSeed.diagnosticHours ?? 0,
      repair_hours: jobSeed.repairHours ?? 0,
      symptoms: jobSeed.symptoms,
      diagnostic_notes: jobSeed.diagnosticNotes ?? null,
      work_summary: jobSeed.workSummary ?? null,
      total_parts_cost: jobSeed.totalPartsCost ?? 0,
      total_labor_cost: jobSeed.totalLaborCost ?? 0,
      finished_at: jobSeed.daysAgoFinished !== undefined ? daysAgoIso(jobSeed.daysAgoFinished, now) : null,
      collected_at: jobSeed.daysAgoCollected !== undefined ? daysAgoIso(jobSeed.daysAgoCollected, now) : null,
      confirmed_at: jobSeed.confirmedDaysAgo !== undefined ? daysAgoIso(jobSeed.confirmedDaysAgo, now) : null,
      created_at: createdAt,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('Demo reset: job insert failed', jobSeed, jobError);
    return;
  }

  if (jobSeed.dtcCodes?.length || jobSeed.batteryDrainMa !== undefined || jobSeed.moduleNotes) {
    await admin.from('diagnostic_reports').insert({
      job_id: job.id,
      dtc_codes: jobSeed.dtcCodes ?? [],
      battery_drain_ma: jobSeed.batteryDrainMa ?? null,
      module_notes: jobSeed.moduleNotes ?? null,
      created_at: createdAt,
    });
  }

  const events = (jobSeed.statusTrail ?? []).map((entry) => ({
    tenant_id: tenantId,
    job_id: job.id,
    event_type: 'STATUS_CHANGED',
    actor: 'mechanic' as const,
    message: `Status promijenjen u "${JOB_STATUS_LABELS_HR[entry.status]}".`,
    created_at: daysAgoIso(entry.daysAgo, now),
  }));

  if (jobSeed.confirmedDaysAgo !== undefined) {
    events.push({
      tenant_id: tenantId,
      job_id: job.id,
      event_type: 'JOB_CONFIRMED',
      actor: 'mechanic' as const,
      message: 'Nalog potvrđen i zaključan.',
      created_at: daysAgoIso(jobSeed.confirmedDaysAgo, now),
    });
  }

  if (events.length > 0) {
    await admin.from('job_events').insert(events);
  }
}
