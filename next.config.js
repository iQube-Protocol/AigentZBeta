/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const nextConfig = {
  // Disable double-invocation and extra checks in dev to speed up refresh
  reactStrictMode: !isDev,
  swcMinify: true,
  // Use standalone output for better Amplify compatibility
  output: 'standalone',
  transpilePackages: [
    '@qriptoagentiq/core-client',
    '@qriptoagentiq/a2a-client',
    '@agentiq/article-reader',
  ],
  // Ignore ESLint errors during build (legacy code cleanup in progress)
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config, { dev, isServer, webpack }) {
    // Temporary alias: resolve SDK to source until dist is present in npm tarball
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@qriptoagentiq/core-client'] = require('path').join(
      __dirname,
      'node_modules/@qriptoagentiq/core-client/src/index.ts'
    );
    
    // Make pdf-parse and canvas external on server to prevent native binary bundling
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('pdf-parse');
        config.externals.push('@napi-rs/canvas');
        // Avoid Next vendor-chunk resolution issues for OpenTelemetry in some environments.
        // Use an explicit commonjs mapping because scoped package names are not valid JS identifiers.
        config.externals.push({ '@opentelemetry/api': 'commonjs @opentelemetry/api' });
      }
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
  // Security headers: protect all routes EXCEPT SmartTriad embeds
  async headers() {
    return [
      // Default: protect everything with X-Frame-Options EXCEPT /triad/embed/*
      {
        source: '/((?!triad/embed/).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      // SmartTriad embed routes: NO X-Frame-Options, explicit CSP frame-ancestors
      {
        source: '/triad/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
