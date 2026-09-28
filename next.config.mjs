/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fonts for server-side PDF generation are read from disk, not imported,
  // so they must be traced into the route's serverless bundle explicitly.
  outputFileTracingIncludes: {
    '/api/jobs/[jobId]/document': ['./lib/pdf/fonts/**'],
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
