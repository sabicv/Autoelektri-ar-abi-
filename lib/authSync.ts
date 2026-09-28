'use client';

// All tabs of one browser share a single login (cookies). Signing in as
// someone else in one tab silently turns every other open tab into that
// user — the page still shows the old person, but requests go out as the
// new one and get refused. Login/logout announce themselves here so the
// other tabs can reload into the right account.

const CHANNEL = 'volt-files-auth';

export function announceAuthChange() {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  } catch {
    // No BroadcastChannel (very old browser): the focus check still covers it.
  }
}

export function onAuthChangeElsewhere(callback: () => void): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener('message', callback);
    return () => channel.close();
  } catch {
    return () => {};
  }
}
