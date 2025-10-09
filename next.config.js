/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const nextConfig = {
  // Disable double-invocation and extra checks in dev to speed up refresh
  reactStrictMode: !isDev,
  swcMinify: true,
  // Allow build to succeed with ESLint warnings (don't block on errors)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Exclude nested AigentZBeta submodule from compilation
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  webpack(config, { dev }) {
    // Exclude the AigentZBeta submodule directory
    config.module.rules.push({
      test: /\.(tsx|ts|jsx|js)$/,
      exclude: /AigentZBeta\//,
    });
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
