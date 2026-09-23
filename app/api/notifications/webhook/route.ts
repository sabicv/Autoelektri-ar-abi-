import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyMetaWebhookSignature } from '@/lib/notifications/whatsapp';

// =====================================================================
// Meta WhatsApp Cloud API incoming webhook.
//
// GET  — verification handshake performed once when you register the
//        webhook URL in the Meta App Dashboard.
// POST — delivery of inbound events, including a client tapping the
//        ODOBRI/ODBIJ quick-reply button on an upsell request. The
//        button's payload ("UPSELL_APPROVE:{jobId}" / "UPSELL_REJECT:
//        {jobId}") drives an atomic DB update via apply_upsell_response.
// =====================================================================

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

interface MetaWebhookMessage {
  type?: string;
  button?: { payload?: string; text?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
}

interface MetaWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: MetaWebhookMessage[];
      };
    }[];
  }[];
}

function extractButtonPayload(message: MetaWebhookMessage): string | null {
  if (message.type === 'button' && message.button?.payload) {
    return message.button.payload;
  }
  if (message.interactive?.type === 'button_reply' && message.interactive.button_reply?.id) {
    return message.interactive.button_reply.id;
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyMetaWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createAdminClient();

  const messages = (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => change.value?.messages ?? [])
  );

  for (const message of messages) {
    const buttonPayload = extractButtonPayload(message);
    if (!buttonPayload) continue;

    const [action, jobId] = buttonPayload.split(':');
    if (!jobId) continue;

    if (action !== 'UPSELL_APPROVE' && action !== 'UPSELL_REJECT') continue;

    const { error } = await admin.rpc('apply_upsell_response', {
      p_job_id: jobId,
      p_approved: action === 'UPSELL_APPROVE',
    });

    if (error) {
      console.error('apply_upsell_response failed', { jobId, action, error });
    }
  }

  // Meta expects a fast 200 — it retries on non-2xx/timeout, which is
  // exactly why apply_upsell_response() is idempotent.
  return NextResponse.json({ received: true });
}
