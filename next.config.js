/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const isAmplifyBuild = Boolean(process.env.AWS_BRANCH || process.env.AMPLIFY_APP_ID);
const embedPolicy = require("./configs/embed/policy.v1.json");
const EMBED_CSP = `frame-ancestors ${embedPolicy.frameAncestors.join(" ")};`;

const nextConfig = {
  // Disable double-invocation and extra checks in dev to speed up refresh
  reactStrictMode: !isDev,
  // swcMinify removed in Next 15 (SWC minification is the default).
  // Keep standalone only for Amplify build environments to avoid local tracing edge-cases.
  output: isAmplifyBuild ? "standalone" : undefined,
  // Prevent playwright and other native/large packages from being bundled in server routes.
  // This reduces per-page memory pressure and avoids "Critical dependency" warnings.
  serverExternalPackages: ["playwright", "playwright-core", "pdf-parse", "@napi-rs/canvas", "ffmpeg-static"],
  // Next 15's standalone output is larger than 14's and pushed the Amplify SSR
  // deploy package past its 220 MiB limit. The bulk was DEAD-WEIGHT native
  // binaries: Next traces BOTH glibc (gnu / linux-x64) AND musl (linuxmusl)
  // prebuilt binaries for @napi-rs/canvas and sharp, but the Amplify/Lambda
  // runtime is Amazon Linux (glibc) and never loads the musl copies (~47 MB).
  // Dropping them is safe — the glibc variants remain and the loaders resolve
  // those at runtime. If canvas/sharp ever fail at runtime with a "module not
  // found" for a platform binary, the runtime moved off glibc — revisit here.
  outputFileTracingExcludes: {
    "*": [
      // musl native binaries — Lambda is glibc, never loads these (~48 MB)
      "node_modules/@napi-rs/canvas-linux-x64-musl/**",
      "node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "node_modules/@img/sharp-linuxmusl-x64/**",
      // Build-time-only deps Next conservatively traces but the runtime never
      // executes: the TypeScript compiler (no runtime import in this app) and
      // browserslist's caniuse-lite data. ~11 MB more headroom under the limit.
      "node_modules/typescript/**",
      "node_modules/caniuse-lite/**",
    ],
  },
  // Promoted from experimental in Next 15 — these entries carry the codex-pack
  // markdown/JSON into the standalone Lambda bundle. A silent miss here breaks
  // /api/codex/chat pack search and the docs tab at runtime, so it MUST stay at
  // the top level (Next 15 ignores experimental.outputFileTracingIncludes).
  outputFileTracingIncludes: {
    "/api/codex/packs/[packId]/file": ["./codexes/packs/**/*.md", "./codexes/packs/**/*.json"],
    // EXP-001 evaluation step API reads the Living KnowledgeQube artifact
    // markdown at runtime (services/experiments/exp001.ts). Without this the
    // Lambda ships without the files and every 'answers' step 500s.
    "/api/experiments/exp001": [
      "./codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/*.md",
    ],
    // Stage 8+ docs tab — markdown reader serves the legibility profile
    // (docs/) + the PRD trail (codexes/packs/agentiq/updates/). Without
    // these the Lambda bundle ships without the .md files and the route
    // returns HTTP 500 read_failed.
    "/api/admin/registry/docs": [
      "./docs/iqube-agent-legibility-profile.md",
      "./docs/iqube-score-derivation.md",
      "./codexes/packs/agentiq/updates/**/*.md",
    ],
    // Copilot chat routes read the aigency + agentiq packs at runtime via
    // services/knowledge/agentiqPackSearch (aigent-z platform knowledge and
    // the AgentiQ cartridge copilot). Without these entries the Lambda
    // bundle ships without the pack files and searchCodex returns nothing —
    // the copilot then answers "[NOT DOCUMENTED]" for documented topics.
    // Scoped to aigency + agentiq only — the wildcard ./codexes/packs/**
    // follows the alpha-knyt symlink and collides with the bundler's
    // directory-vs-non-directory check on Amplify.
    "/api/codex/chat": [
      "./codexes/packs/aigency/**/*.md",
      "./codexes/packs/aigency/**/*.json",
      "./codexes/packs/agentiq/**/*.md",
      "./codexes/packs/agentiq/**/*.json",
    ],
    "/api/codex/chat/aigentiq": [
      "./codexes/packs/aigency/**/*.md",
      "./codexes/packs/aigency/**/*.json",
      "./codexes/packs/agentiq/**/*.md",
      "./codexes/packs/agentiq/**/*.json",
    ],
  },
  experimental: {
    // Limit worker parallelism on Amplify to avoid ENOMEM when forking page-data workers.
    // The main build process consumes ~3 GB; each forked worker needs additional RAM.
    cpus: isAmplifyBuild ? 1 : undefined,
    // Next 15's build is heavier than 14's and OOM'd Amplify at the old 3 GB
    // heap cap. This flag trades a little build speed for a materially lower
    // peak webpack memory footprint — the primary lever for the OOM fix
    // (paired with a raised --max-old-space-size in amplify.yml).
    webpackMemoryOptimizations: true,
  },
  transpilePackages: [
    "@qriptoagentiq/core-client",
    "@qriptoagentiq/a2a-client",
    "@agentiq/article-reader",
    "@metame/contracts",
    "@metame/aa-client",
    "@metame/browser-contracts",
    "@metame/iframe-bridge",
  ],
  // Ignore ESLint and TypeScript errors during build (legacy code cleanup in progress)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config, { isServer }) {
    // Temporary alias: resolve SDK to source until dist is present in npm tarball
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    config.resolve.alias["@qriptoagentiq/core-client"] = require("path").join(
      __dirname,
      "node_modules/@qriptoagentiq/core-client/src/index.ts"
    );
    config.resolve.alias["@metame/contracts"] = require("path").join(
      __dirname,
      "packages/metame-contracts/src/index.ts"
    );

    // Stub wagmi connector peer deps that aren't installed — the connectors barrel
    // imports all connectors unconditionally; stubs prevent build failure for ones we don't use.
    config.resolve.alias["porto/internal"] = false;
    config.resolve.alias["porto"] = false;
    config.resolve.alias["@metamask/connect-evm"] = false;
    config.resolve.alias["@walletconnect/ethereum-provider"] = false;
    config.resolve.alias["accounts"] = false;

    // Make pdf-parse and canvas external on server to prevent native binary bundling
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("pdf-parse");
        config.externals.push("@napi-rs/canvas");
        config.externals.push("playwright-core");
        config.externals.push("playwright");
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
  // Security headers
  // X-Frame-Options handling moved to middleware.ts as the single source of
  // truth — Next.js's path-to-regexp negative lookahead in source patterns
  // is unreliable and was matching paths it shouldn't, applying SAMEORIGIN
  // to /triad/embed/* routes which Firefox then enforced (blocking the
  // cartridge iframe with "dev-beta.aigentz.me will not allow Firefox to
  // display the page if another site has embedded it").
  //
  // Only the explicit Content-Security-Policy frame-ancestors entries
  // remain here for the embed/runtime routes — those use exact-match
  // patterns that path-to-regexp handles correctly.
  async headers() {
    return [
      // SmartTriad embed routes: explicit CSP frame-ancestors.
      {
        source: "/triad/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: EMBED_CSP,
          },
        ],
      },
      // metaMe runtime iframe route: explicit CSP frame-ancestors.
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
