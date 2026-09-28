import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import PwaSetup from '@/components/PwaSetup';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Auto Električar',
    template: '%s',
  },
  description: 'Digitalna prijava kvara za auto-električarske radionice.',
  applicationName: 'Radionica',
  // Installed on an iPhone: full screen, content runs under the status bar
  // (the header pads itself with env(safe-area-inset-top)).
  appleWebApp: { capable: true, title: 'Radionica', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  // iOS would otherwise turn every phone number into a call link — a stray
  // tap on a client card must never dial.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#070a0d',
};

// Runs before hydration so the dashboard's workshop dark mode / text size
// don't flash back to defaults on load. Reads plain localStorage values
// only — no remote calls, nothing user-controlled gets injected into the
// DOM. Font scale is applied as a root font-size percentage, which scales
// every rem-based Tailwind size (text, spacing, icons) proportionally —
// the same effect as a browser zoom, but controlled in-app and persisted.
const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem('workshop-theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
    var steps = [100, 112, 125, 137];
    var idx = parseInt(localStorage.getItem('workshop-font-scale-index'), 10);
    if (!isNaN(idx) && idx >= 0 && idx < steps.length && idx !== 0) {
      document.documentElement.style.fontSize = steps[idx] + '%';
    }
  } catch (e) {}
  // Chrome's install offer fires once, possibly before React is up: keep it
  // for the "Instaliraj na mobitel" menu item (lib/pwa.ts) instead of the
  // browser's own banner, which would also pop up for customers on /t/.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__installPrompt = e;
    window.dispatchEvent(new Event('installpromptready'));
  });
  window.addEventListener('appinstalled', function () {
    window.__installPrompt = null;
  });
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <PwaSetup />
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
