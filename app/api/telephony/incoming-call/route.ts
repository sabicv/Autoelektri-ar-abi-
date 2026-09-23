import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import type { DiagnosticReport, Job, Vehicle } from '@/types/database';

// =====================================================================
// Vapi.ai "assistant-request" webhook.
//
// Vapi POSTs this message type at the start of a call, before any audio
// is exchanged, and expects back either:
//   - { assistantId, assistantOverrides } — override firstMessage/prompt
//     on top of an assistant already configured (voice/model/tools) in
//     the Vapi dashboard, or
//   - { assistant: {...} } — a fully inline assistant definition.
// This route prefers the former (VAPI_ASSISTANT_ID) so the garage keeps
// full control of voice/model via Vapi's own UI; it falls back to an
// inline definition so the endpoint still works standalone.
//
// Vapi's exact payload shape has shifted across versions — the extractors
// below check a couple of plausible nesting paths defensively rather than
// assuming one exact shape.
// =====================================================================

interface VapiAssistantRequestBody {
  message?: {
    type?: string;
    call?: { id?: string; phoneNumberId?: string };
    phoneNumber?: { id?: string; number?: string };
    customer?: { number?: string };
  };
}

function extractCallerNumber(body: VapiAssistantRequestBody): string | null {
  return body.message?.customer?.number ?? null;
}

function extractCalledPhoneNumberId(body: VapiAssistantRequestBody): string | null {
  return body.message?.phoneNumber?.id ?? body.message?.call?.phoneNumberId ?? null;
}

function verifyVapiSecret(request: Request): boolean {
  const expected = process.env.VAPI_SERVER_SECRET;
  if (!expected) return true; // not configured yet — allow through for local dev/testing
  return request.headers.get('x-vapi-secret') === expected;
}

function buildAssistantResponse(firstMessage: string, systemPrompt: string) {
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const messages = [{ role: 'system', content: systemPrompt }];

  if (assistantId) {
    return {
      assistantId,
      assistantOverrides: {
        firstMessage,
        model: { messages },
      },
    };
  }

  // No pre-configured assistant yet — fully inline fallback so the
  // webhook is testable standalone. Verify voice/transcriber provider
  // ids against your current Vapi dashboard options before going live.
  return {
    assistant: {
      firstMessage,
      voice: { provider: '11labs', voiceId: 'default' },
      model: { provider: 'openai', model: 'gpt-4o', messages },
      transcriber: { provider: 'deepgram', language: 'hr' },
    },
  };
}

function genericReceptionPrompt(tenantName: string): string {
  return `Ti si AI recepcioner za "${tenantName}", auto-električarsku radionicu. Razgovaraj isključivo na hrvatskom jeziku, kratko, ljubazno i profesionalno. Ovo je nepoznat pozivatelj bez povijesti u sustavu. Zatraži ime, registarsku oznaku vozila i kratki opis kvara, te ponudi dolazak u radionicu ili dogovor termina. Ne izmišljaj podatke o cijenama ili dijagnozama.`;
}

function compileKnownCallerPrompt(params: {
  tenantName: string;
  clientFirstName: string;
  clientLastName: string;
  phoneNumber: string;
  vehicles: Vehicle[];
  totalSpent: number;
  dtcCodes: string[];
  activeJob: Job | null;
}): string {
  const lines: string[] = [
    `Ti si AI recepcioner za "${params.tenantName}", auto-električarsku radionicu. Razgovaraj isključivo na hrvatskom jeziku, ljubazno i profesionalno.`,
    '',
    'PODACI O POZIVATELJU (iz baze, koristi ih, ne izmišljaj druge):',
    `- Ime i prezime: ${params.clientFirstName} ${params.clientLastName}`,
    `- Broj telefona: ${params.phoneNumber}`,
  ];

  if (params.vehicles.length > 0) {
    lines.push(`- Vozila na klijentu: ${params.vehicles.map((v) => vehicleLabel(v)).join('; ')}`);
  }

  lines.push(`- Ukupno potrošeno kod nas do sada: ${formatEuroHR(params.totalSpent)}`);
  lines.push(
    `- Prijašnji dijagnostički kodovi (DTC): ${params.dtcCodes.length > 0 ? params.dtcCodes.join(', ') : 'nema zabilježenih'}`
  );

  if (params.activeJob) {
    lines.push(
      `- Aktivni nalog: status "${JOB_STATUS_LABELS_HR[params.activeJob.status]}", prijavljen ${new Date(params.activeJob.created_at).toLocaleDateString('hr-HR')}.`
    );
  } else {
    lines.push('- Nema trenutno aktivnog naloga.');
  }

  lines.push(
    '',
    'UPUTE:',
    '- Ako pozivatelj pita o statusu vozila, koristi gornje podatke.',
    '- Ako prijavljuje novi kvar, zabilježi simptome i ponudi termin ili dolazak.',
    '- Ne izmišljaj cijene, dijagnoze ili rokove koji nisu gore navedeni.',
    '- Ako nisi siguran ili klijent traži razgovor s čovjekom, ponudi spajanje s mehaničarem.'
  );

  return lines.join('\n');
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!verifyVapiSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: VapiAssistantRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (body.message?.type && body.message.type !== 'assistant-request') {
    // Not a call-context request (e.g. status update, end-of-call report,
    // function-call event) — acknowledge and ignore.
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const calledPhoneNumberId = extractCalledPhoneNumberId(body);
  const callerNumber = extractCallerNumber(body);

  const tenant = calledPhoneNumberId
    ? (
        await admin
          .from('tenants')
          .select('*')
          .eq('vapi_phone_number_id', calledPhoneNumberId)
          .maybeSingle()
      ).data
    : null;

  if (!tenant) {
    // Can't identify which workshop this call belongs to (phone number not
    // registered yet) — safe generic fallback rather than failing the call.
    return NextResponse.json(
      buildAssistantResponse(
        'Dobar dan, hvala što ste nazvali. Kako vam mogu pomoći?',
        'Ti si AI recepcioner auto-električarske radionice. Radionica nije prepoznata iz ovog broja telefona — ponašaj se generički, zatraži ime i najavi da ćeš proslijediti poziv djelatniku. Razgovaraj na hrvatskom.'
      )
    );
  }

  if (!callerNumber) {
    return NextResponse.json(
      buildAssistantResponse(
        `Dobar dan, hvala što ste nazvali ${tenant.name}. Kako vam mogu pomoći?`,
        genericReceptionPrompt(tenant.name)
      )
    );
  }

  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('phone_number', callerNumber)
    .maybeSingle();

  if (!client) {
    return NextResponse.json(
      buildAssistantResponse(
        `Dobar dan, hvala što ste nazvali ${tenant.name}. Kako vam mogu pomoći?`,
        genericReceptionPrompt(tenant.name)
      )
    );
  }

  const { data: vehicles } = await admin.from('vehicles').select('*').eq('client_id', client.id);
  const vehicleList = vehicles ?? [];
  const vehicleIds = vehicleList.map((v) => v.id);

  const { data: jobs } =
    vehicleIds.length > 0
      ? await admin
          .from('jobs')
          .select('*')
          .in('vehicle_id', vehicleIds)
          .order('created_at', { ascending: false })
      : { data: [] as Job[] };
  const jobList = jobs ?? [];
  const jobIds = jobList.map((j) => j.id);

  const { data: diagnosticReports } =
    jobIds.length > 0
      ? await admin.from('diagnostic_reports').select('*').in('job_id', jobIds)
      : { data: [] as DiagnosticReport[] };

  const totalSpent = jobList.reduce(
    (sum, j) => sum + j.total_parts_cost + j.total_labor_cost + j.accrued_parking_fees,
    0
  );

  const dtcCodes = Array.from(new Set((diagnosticReports ?? []).flatMap((r) => r.dtc_codes)));
  const activeJob = jobList.find((j) => j.status !== 'COLLECTED') ?? null;
  const primaryVehicle = activeJob
    ? (vehicleList.find((v) => v.id === activeJob.vehicle_id) ?? vehicleList[0])
    : vehicleList[0];

  const firstMessage = primaryVehicle
    ? `Dobar dan, ${client.first_name}! Zovete li u vezi vašeg vozila ${vehicleLabel(primaryVehicle)}?`
    : `Dobar dan, ${client.first_name}! Kako vam mogu pomoći?`;

  const systemPrompt = compileKnownCallerPrompt({
    tenantName: tenant.name,
    clientFirstName: client.first_name,
    clientLastName: client.last_name,
    phoneNumber: client.phone_number,
    vehicles: vehicleList,
    totalSpent,
    dtcCodes,
    activeJob,
  });

  return NextResponse.json(buildAssistantResponse(firstMessage, systemPrompt));
}
