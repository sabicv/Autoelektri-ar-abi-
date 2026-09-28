'use client';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  return Boolean(await registration?.pushManager.getSubscription());
}

// Must be called from a tap — browsers only show the permission prompt
// in response to a user gesture.
export async function enablePush(): Promise<'enabled' | 'denied' | 'failed'> {
  if (!pushSupported()) return 'failed';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToArrayBuffer(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      }));

    const json = subscription.toJSON();
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return response.ok ? 'enabled' : 'failed';
  } catch {
    return 'failed';
  }
}
