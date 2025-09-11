/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Configure external backend proxy under a dedicated prefix so local Next.js API routes remain intact
  async rewrites() {
    return [
      {
        // Any calls to /core/* will proxy to the external core API
        source: '/core/:path*',
        destination: (process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:5000') + '/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
