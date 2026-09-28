import 'server-only';

import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

let configured: boolean | null = null;

// Without VAPID keys push is simply off — realtime in the open app still works.
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://auto-elektricar-saas.vercel.app', publicKey, privateKey);
  configured = true;
  return configured;
}

// Best-effort: a failed notification must never fail the action that caused it.
export async function sendPushToProfiles(profileIds: string[], payload: PushPayload) {
  if (profileIds.length === 0 || !configure()) return;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin.from('push_subscriptions').select('*').in('profile_id', profileIds);

  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // The browser dropped this subscription (app uninstalled, permission revoked).
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('Push send failed', status, error);
        }
      }
    })
  );
}
