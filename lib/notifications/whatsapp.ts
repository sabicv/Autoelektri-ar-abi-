import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatEuroHR, vehicleLabel } from '@/lib/format';
import type { Client, Job, Tenant, Vehicle } from '@/types/database';

// =====================================================================
// Meta WhatsApp Cloud API integration.
//
// Two dispatch paths, because Meta's platform genuinely distinguishes them:
//
// - Proactive / cold-outbound (customer hasn't messaged us recently) MUST
//   use a pre-approved Message Template (`type: "template"`). The three
//   named functions below use templates for exactly this reason — they're
//   the ones a status-change trigger would call automatically.
// - Freeform `type: "text"` messages only succeed inside the 24h customer
//   service session window (the customer messaged the business number
//   recently). sendFreeformText() is for that case — used by the mechanic
//   dashboard's "send exactly this edited text" flow.
//
// Important Meta constraint: a Quick Reply button's visible CAPTION is
// fixed at template-approval time — you cannot put a dynamic "{price}€" on
// the button label itself. Only the button's tracking payload can be set
// per send. sendUpsellRequest() therefore puts the price in the template
// BODY text (which does support variables) and uses a static button
// caption (e.g. "✅ Odobravam"); create the template in Meta Business
// Manager accordingly.
// =====================================================================

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendMetaMessage(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp API nije konfiguriran (nedostaju env varijable).' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      }
    );

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ??
        `Meta API greška (HTTP ${response.status}).`;
      return { success: false, error: message };
    }

    const messageId = (json as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepoznata mrežna greška prilikom slanja.',
    };
  }
}

function toWhatsAppRecipient(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, '');
}

interface JobDispatchContext {
  job: Job;
  client: Client;
  vehicle: Vehicle;
  tenant: Tenant;
}

export async function loadJobDispatchContext(jobId: string): Promise<JobDispatchContext> {
  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin.from('jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) throw new Error('Nalog nije pronađen.');

  const [clientRes, vehicleRes, tenantRes] = await Promise.all([
    admin.from('clients').select('*').eq('id', job.client_id).single(),
    admin.from('vehicles').select('*').eq('id', job.vehicle_id).single(),
    admin.from('tenants').select('*').eq('id', job.tenant_id).single(),
  ]);

  if (clientRes.error || !clientRes.data) throw new Error('Klijent nije pronađen.');
  if (vehicleRes.error || !vehicleRes.data) throw new Error('Vozilo nije pronađeno.');
  if (tenantRes.error || !tenantRes.data) throw new Error('Radionica nije pronađena.');

  return { job, client: clientRes.data, vehicle: vehicleRes.data, tenant: tenantRes.data };
}

interface LogJobEventParams {
  tenantId: string;
  jobId: string;
  eventType: string;
  actor: 'system' | 'mechanic' | 'client';
  message: string;
  metadata?: Record<string, unknown>;
}

export async function logJobEvent(params: LogJobEventParams): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('job_events').insert({
    tenant_id: params.tenantId,
    job_id: params.jobId,
    event_type: params.eventType,
    actor: params.actor,
    message: params.message,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error('Failed to log job event', error);
  }
}

// ---------------------------------------------------------------------
// sendJobFinishedNotification
// ---------------------------------------------------------------------
export async function sendJobFinishedNotification(
  jobId: string,
  totalAmount: number,
  parkingClause: string
): Promise<WhatsAppSendResult> {
  const { client, vehicle, tenant } = await loadJobDispatchContext(jobId);

  const templateName = process.env.WHATSAPP_TEMPLATE_JOB_FINISHED ?? 'job_finished_notice';

  const result = await sendMetaMessage({
    to: toWhatsAppRecipient(client.phone_number),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'hr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: client.first_name },
            { type: 'text', text: vehicleLabel(vehicle) },
            { type: 'text', text: formatEuroHR(totalAmount) },
            { type: 'text', text: parkingClause },
          ],
        },
      ],
    },
  });

  await logJobEvent({
    tenantId: tenant.id,
    jobId,
    eventType: result.success ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
    actor: 'system',
    message: result.success
      ? `WhatsApp obavijest o završetku posla poslana za ${vehicleLabel(vehicle)} (${formatEuroHR(totalAmount)}).`
      : `Slanje WhatsApp obavijesti o završetku posla nije uspjelo: ${result.error}`,
    metadata: { notificationType: 'JOB_FINISHED', totalAmount, parkingClause, messageId: result.messageId },
  });

  return result;
}

// ---------------------------------------------------------------------
// sendUpsellRequest
//
// `photoUrl` is the TEMP storage path in job-vault (e.g. from
// PhotoUploadDropzone: "{tenant_id}/temp_{timestamp}_{filename}"), not a
// public URL — the bucket is private. This function archives it into the
// job's permanent vault path, then generates a short-lived signed URL for
// Meta to fetch as the template's image header.
// ---------------------------------------------------------------------
export async function sendUpsellRequest(
  jobId: string,
  defectDescription: string,
  price: number,
  photoUrl: string
): Promise<WhatsAppSendResult> {
  const { client, vehicle, tenant } = await loadJobDispatchContext(jobId);
  const admin = createAdminClient();

  const extension = photoUrl.split('.').pop() || 'jpg';
  const finalPhotoPath = `${tenant.id}/${jobId}/WIRING_DEFECT_${Date.now()}.${extension}`;

  const { error: moveError } = await admin.storage.from('job-vault').move(photoUrl, finalPhotoPath);
  if (moveError) {
    return { success: false, error: 'Fotografija nije dostupna za slanje (premještanje nije uspjelo).' };
  }

  await admin.from('job_photos').insert({
    job_id: jobId,
    tenant_id: tenant.id,
    photo_url: finalPhotoPath,
    tag: 'WIRING_DEFECT',
    caption: defectDescription,
  });

  const { data: signedUrlData, error: signError } = await admin.storage
    .from('job-vault')
    .createSignedUrl(finalPhotoPath, 600);

  if (signError || !signedUrlData) {
    return { success: false, error: 'Fotografija nije dostupna za slanje (potpisivanje URL-a nije uspjelo).' };
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_UPSELL_REQUEST ?? 'upsell_request';

  const result = await sendMetaMessage({
    to: toWhatsAppRecipient(client.phone_number),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'hr' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { link: signedUrlData.signedUrl } }],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: client.first_name },
            { type: 'text', text: vehicleLabel(vehicle) },
            { type: 'text', text: defectDescription },
            { type: 'text', text: formatEuroHR(price) },
          ],
        },
        // Static button captions (e.g. "✅ Odobravam" / "❌ Odbijam") are
        // fixed in the approved template. Only the payload is dynamic —
        // that's how the webhook knows which job this reply belongs to.
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [{ type: 'payload', payload: `UPSELL_APPROVE:${jobId}` }],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '1',
          parameters: [{ type: 'payload', payload: `UPSELL_REJECT:${jobId}` }],
        },
      ],
    },
  });

  if (result.success) {
    await logJobEvent({
      tenantId: tenant.id,
      jobId,
      eventType: 'UPSELL_REQUESTED',
      actor: 'system',
      message: `Zahtjev za dodatni zahvat poslan klijentu: ${defectDescription} (${formatEuroHR(price)}).`,
      metadata: { notificationType: 'UPSELL_REQUEST', price, defectDescription, photoPath: finalPhotoPath, messageId: result.messageId },
    });
  } else {
    await logJobEvent({
      tenantId: tenant.id,
      jobId,
      eventType: 'WHATSAPP_FAILED',
      actor: 'system',
      message: `Slanje zahtjeva za dodatni zahvat nije uspjelo: ${result.error}`,
      metadata: { notificationType: 'UPSELL_REQUEST', price, defectDescription, error: result.error },
    });
  }

  return result;
}

// ---------------------------------------------------------------------
// sendParkingWarningNotification
// ---------------------------------------------------------------------
export async function sendParkingWarningNotification(
  jobId: string,
  daysParked: number,
  accruedFee: number
): Promise<WhatsAppSendResult> {
  const { client, vehicle, tenant } = await loadJobDispatchContext(jobId);

  const templateName = process.env.WHATSAPP_TEMPLATE_PARKING_WARNING ?? 'parking_warning';

  const result = await sendMetaMessage({
    to: toWhatsAppRecipient(client.phone_number),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'hr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: client.first_name },
            { type: 'text', text: vehicleLabel(vehicle) },
            { type: 'text', text: String(daysParked) },
            { type: 'text', text: formatEuroHR(accruedFee) },
            { type: 'text', text: formatEuroHR(tenant.daily_parking_fee) },
          ],
        },
      ],
    },
  });

  await logJobEvent({
    tenantId: tenant.id,
    jobId,
    eventType: result.success ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
    actor: 'system',
    message: result.success
      ? `Upozorenje o ležarini poslano (${daysParked} dana, ${formatEuroHR(accruedFee)}).`
      : `Slanje upozorenja o ležarini nije uspjelo: ${result.error}`,
    metadata: { notificationType: 'PARKING_WARNING', daysParked, accruedFee, messageId: result.messageId },
  });

  return result;
}

// ---------------------------------------------------------------------
// sendFreeformText — only succeeds inside an open 24h session window.
// Used by the mechanic dashboard's approve-and-edit flow (CUSTOM type).
// ---------------------------------------------------------------------
export async function sendFreeformText(to: string, body: string): Promise<WhatsAppSendResult> {
  return sendMetaMessage({
    to: toWhatsAppRecipient(to),
    type: 'text',
    text: { body, preview_url: false },
  });
}

// ---------------------------------------------------------------------
// Incoming webhook signature verification (X-Hub-Signature-256).
// ---------------------------------------------------------------------
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET not set — skipping webhook signature verification.');
    return true;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expectedHex = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const providedHex = signatureHeader.slice('sha256='.length);

  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const providedBuffer = Buffer.from(providedHex, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
