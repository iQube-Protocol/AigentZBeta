/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const nextConfig = {
  // Disable double-invocation and extra checks in dev to speed up refresh
  reactStrictMode: !isDev,
  swcMinify: true,
  transpilePackages: [
    '@qriptoagentiq/core-client',
    '@qriptoagentiq/a2a-client',
  ],
  // Ignore ESLint errors during build (legacy code cleanup in progress)
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config, { dev }) {
    // Temporary alias: resolve SDK to source until dist is present in npm tarball
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@qriptoagentiq/core-client'] = require('path').join(
      __dirname,
      'node_modules/@qriptoagentiq/core-client/src/index.ts'
    );
    if (dev) {
      // Turn off heavy source maps in dev for faster rebuilds
      config.devtool = false;
    }
    return config;
  },
  // Important: do NOT rewrite /api/* so local Next.js API routes are used.
  // If you need to proxy to a separate backend, use a distinct prefix like /core/*.
  async rewrites() {
    return {
      // Keep clean separation: local API under /api, external backend under /core
      afterFiles: [
        {
          source: '/core/:path*',
          destination: (process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:5000') + '/:path*',
        },
      ],
    };
  },
};

module.exports = nextConfig;
