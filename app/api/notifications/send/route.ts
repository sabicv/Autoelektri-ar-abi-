import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formatEuroHR, daysSince } from '@/lib/format';
import {
  loadJobDispatchContext,
  logJobEvent,
  sendFreeformText,
  sendJobFinishedNotification,
  sendParkingWarningNotification,
  sendUpsellRequest,
  type WhatsAppSendResult,
} from '@/lib/notifications/whatsapp';

// =====================================================================
// Mechanic-approved dispatch endpoint — called by
// components/dashboard/NotificationDraftModal.tsx after "POŠALJI NA
// WHATSAPP" is clicked.
//
// JOB_FINISHED / PARKING_WARNING / UPSELL_REQUEST route to the Meta
// Message Template functions in lib/notifications/whatsapp.ts (required
// for proactive/cold-outbound sends). `message` is the mechanic's
// reviewed/edited text — since a template's wording is fixed by Meta's
// approval process, it's recorded as the audit-log entry for that
// dispatch rather than sent verbatim.
//
// CUSTOM sends the mechanic's text exactly as written via freeform
// WhatsApp text — only works inside an open 24h session; Meta's rejection
// in that case is surfaced back to the mechanic rather than swallowed.
// =====================================================================

const baseFields = {
  jobId: z.string().uuid(),
  message: z.string().trim().min(1, 'Poruka ne smije biti prazna.').max(1500),
};

const sendSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('JOB_FINISHED'), ...baseFields }),
  z.object({ type: z.literal('PARKING_WARNING'), ...baseFields }),
  z.object({
    type: z.literal('UPSELL_REQUEST'),
    ...baseFields,
    defectDescription: z.string().trim().min(1).max(500),
    price: z.number().positive(),
    photoPath: z.string().min(1, 'Fotografija je obavezna za zahtjev za dodatni zahvat.'),
  }),
  z.object({ type: z.literal('CUSTOM'), ...baseFields }),
]);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provjerite podatke.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  let context;
  try {
    context = await loadJobDispatchContext(data.jobId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nalog nije pronađen.' },
      { status: 404 }
    );
  }

  const { job, client, tenant } = context;

  let result: WhatsAppSendResult;

  switch (data.type) {
    case 'JOB_FINISHED': {
      const totalAmount = job.total_parts_cost + job.total_labor_cost + job.accrued_parking_fees;
      const parkingClause = `Besplatno parkiranje ${tenant.free_parking_days} dana nakon završetka radova, nakon čega se obračunava ležarina od ${formatEuroHR(tenant.daily_parking_fee)}/dan.`;
      result = await sendJobFinishedNotification(data.jobId, totalAmount, parkingClause);
      break;
    }
    case 'PARKING_WARNING': {
      const parkedDays = daysSince(job.finished_at);
      result = await sendParkingWarningNotification(data.jobId, parkedDays, job.accrued_parking_fees);
      break;
    }
    case 'UPSELL_REQUEST': {
      result = await sendUpsellRequest(data.jobId, data.defectDescription, data.price, data.photoPath);
      break;
    }
    case 'CUSTOM': {
      result = await sendFreeformText(client.phone_number, data.message);
      await logJobEvent({
        tenantId: tenant.id,
        jobId: data.jobId,
        eventType: result.success ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
        actor: 'mechanic',
        message: result.success ? data.message : `Slanje poruke nije uspjelo: ${result.error}`,
        metadata: { notificationType: 'CUSTOM', messageId: result.messageId },
      });
      break;
    }
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Slanje nije uspjelo.' }, { status: 502 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
