/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Configure API routes to proxy to the backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:5000') + '/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
