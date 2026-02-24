/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const isAmplifyBuild = Boolean(process.env.AWS_BRANCH || process.env.AMPLIFY_APP_ID);
const embedPolicy = require("./configs/embed/policy.v1.json");
const EMBED_CSP = `frame-ancestors ${embedPolicy.frameAncestors.join(" ")};`;

const nextConfig = {
  // Disable double-invocation and extra checks in dev to speed up refresh
  reactStrictMode: !isDev,
  swcMinify: true,
  // Keep standalone only for Amplify build environments to avoid local tracing edge-cases.
  output: isAmplifyBuild ? "standalone" : undefined,
  transpilePackages: [
    "@qriptoagentiq/core-client",
    "@qriptoagentiq/a2a-client",
    "@agentiq/article-reader",
    "@metame/contracts",
  ],
  // Ignore ESLint errors during build (legacy code cleanup in progress)
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config, { isServer }) {
    // Temporary alias: resolve SDK to source until dist is present in npm tarball
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias["@qriptoagentiq/core-client"] = require("path").join(
      __dirname,
      "node_modules/@qriptoagentiq/core-client/src/index.ts"
    );
    config.resolve.alias["@metame/contracts"] = require("path").join(
      __dirname,
      "packages/metame-contracts/src/index.ts"
    );

    // Make pdf-parse and canvas external on server to prevent native binary bundling
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("pdf-parse");
        config.externals.push("@napi-rs/canvas");
        // Avoid externalizing OpenTelemetry for edge/middleware bundles.
        // (External requires can break middleware in dev with "Native module not found".)
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
          source: "/core/:path*",
          destination: (process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:5000") + "/:path*",
        },
      ],
    };
  },
  // Security headers: protect all routes EXCEPT SmartTriad embeds
  async headers() {
    return [
      // Default: protect everything with X-Frame-Options EXCEPT embed/runtime iframe targets.
      {
        source: "/((?!(?:triad/embed(?:/|$)|metame/runtime(?:/|$))).*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      // SmartTriad embed routes: NO X-Frame-Options, explicit CSP frame-ancestors.
      {
        source: "/triad/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: EMBED_CSP,
          },
        ],
      },
      // metaMe runtime iframe route: NO X-Frame-Options, explicit CSP frame-ancestors.
      {
        source: "/metame/runtime",
        headers: [
          {
            key: "Content-Security-Policy",
            value: EMBED_CSP,
          },
        ],
      },
      {
        source: "/metame/runtime/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: EMBED_CSP,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
