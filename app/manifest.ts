import type { MetadataRoute } from 'next';

// Lets the dashboard be added to the home screen; iPhones only deliver web
// push notifications to apps installed this way.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Radionica',
    short_name: 'Radionica',
    start_url: '/dashboard/jobs',
    display: 'standalone',
    background_color: '#070a0d',
    theme_color: '#070a0d',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
