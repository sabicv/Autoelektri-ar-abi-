/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fonts for server-side PDF generation are read from disk, not imported,
  // so they must be traced into the route's serverless bundle explicitly.
  outputFileTracingIncludes: {
    '/api/jobs/[jobId]/document': ['./lib/pdf/fonts/**'],
  },
  // Installed phones must pick up a new service worker on the next launch.
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;
