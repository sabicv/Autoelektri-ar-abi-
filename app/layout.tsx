import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Auto Električar',
    template: '%s',
  },
  description: 'Digitalna prijava kvara za auto-električarske radionice.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
