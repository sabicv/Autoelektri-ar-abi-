'use client';

// Home-screen install. Chrome/Android offers a real install dialog through
// the `beforeinstallprompt` event, which the inline script in app/layout.tsx
// catches before React loads (it fires once per page load and would
// otherwise be missed). iOS has no such API: the user adds the app from
// Safari's Share menu, so there we can only say where to tap.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

export const INSTALL_READY_EVENT = 'installpromptready';

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canPromptInstall(): boolean {
  return Boolean(window.__installPrompt);
}

export async function promptInstall(): Promise<boolean> {
  const event = window.__installPrompt;
  if (!event) return false;
  window.__installPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Not fatal: the app works as a normal website without it.
  });
}

// The status bar of the installed app follows the in-app light/dark switch.
export function syncThemeColor() {
  const dark = document.documentElement.classList.contains('dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070a0d' : '#ffffff');
}
