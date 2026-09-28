'use client';

import { useEffect } from 'react';
import { registerServiceWorker, syncThemeColor } from '@/lib/pwa';

// Mounted once in the root layout: registers the service worker (needed to
// install the app and for push) and matches the status bar to the theme.
export default function PwaSetup() {
  useEffect(() => {
    syncThemeColor();
    if (document.readyState === 'complete') registerServiceWorker();
    else window.addEventListener('load', registerServiceWorker, { once: true });
  }, []);

  return null;
}
