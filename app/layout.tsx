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

// Runs before hydration so the dashboard's workshop dark mode doesn't
// flash light-then-dark on load. Reads a plain localStorage flag only —
// no remote calls, nothing user-controlled gets injected into the DOM.
const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem('workshop-theme') === 'dark') {
      document.documentElement.classList.add('dark');
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
