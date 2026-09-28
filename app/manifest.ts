import type { MetadataRoute } from 'next';

// Installable app: added to the home screen it opens full screen, without
// the browser bar. iPhones also only deliver web push to apps installed
// this way. PNG icons because Android and iOS won't install from SVG alone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard/jobs',
    name: 'Volt Files',
    short_name: 'Volt Files',
    description: 'Radni nalozi, mušterije i arhiva autoelektričarske radionice.',
    lang: 'hr',
    start_url: '/dashboard/jobs',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070a0d',
    theme_color: '#070a0d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press on the home-screen icon.
    shortcuts: [
      { name: 'Poslovi', url: '/dashboard/jobs', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Mušterije', url: '/dashboard/clients', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
