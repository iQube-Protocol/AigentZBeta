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
    // The agentiq/updates changelog is 2.8 MB across 250+ CFS/PRD session
    // docs and grows every deploy. It is traced into THREE Lambdas — both
    // copilot chat routes (via the codexes/packs/agentiq/**/*.md include) AND
    // /api/admin/registry/docs. Shipping the full change-log into the two
    // size-capped copilot Lambdas is what re-tipped the output past the
    // 230686720-byte cap (2026-07-20) — same class as the build_/COMMITS
    // exclusion below. Drop it from the copilot chat routes ONLY: the copilot
    // still grounds on the agentiq ITEMS (product knowledge); it just no
    // longer searches the session change-log. The Updates tab keeps working —
    // /api/admin/registry/docs still traces updates/**/*.md (not excluded here).
    "/api/codex/chat": ["codexes/packs/agentiq/updates/**"],
    "/api/codex/chat/aigentiq": ["codexes/packs/agentiq/updates/**"],
    "*": [
      // musl native binaries — Lambda is glibc, never loads these (~48 MB)
      "node_modules/@napi-rs/canvas-linux-x64-musl/**",
      "node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "node_modules/@img/sharp-linuxmusl-x64/**",
      // Next's own SWC native compiler — standalone traces BOTH the glibc and
      // musl prebuilt binaries; Amazon Linux (glibc) loads the gnu copy and
      // never the musl one (~40 MB). Dropping it is the same safe move as the
      // canvas/sharp musl excludes above and reclaims the headroom that tipped
      // the 2026-07-19 build past the 230686720-byte output cap. If SWC ever
      // fails to load at runtime, the runtime moved off glibc — revisit here.
      "node_modules/@next/swc-linux-x64-musl/**",
      "node_modules/@swc/core-linux-x64-musl/**",
      // playwright-core (~6 MB) — the agentic-browser exec
      // (services/aa-api/src/browser/exec/playwright.ts) loads it via a GUARDED
      // dynamic require.resolve/require in try/catch that degrades to "browser
      // control unavailable" when absent. Browser automation cannot run in an
      // Amplify SSR Lambda anyway (no browser binary), so this 6 MB is dead weight
      // — the single biggest traced package (2026-07-21 compute-composition log)
      // and ~30x the size overage. Also hard-removed in amplify.yml postBuild
      // (the reliable lever). classifierService's "playwright" is a keyword
      // string, not an import — unaffected.
      "node_modules/playwright-core/**",
      // Build/ingest-time pack DATA that the SSR runtime never reads AND that is
      // not browsable via any pack collections.json — so tracing it into the
      // standalone bundle is pure dead weight against the 230686720-byte output
      // cap. Next's node_modules trace is already minimal (the amplify.yml
      // native-binary/source-map sweep confirmed there's little left there), so
      // the only remaining discretionary bytes are the traced codexes/packs
      // corpus; the pack-file route globs ALL of ./codexes/packs/**/*.{md,json}
      // (see outputFileTracingIncludes below) and pulls these data artifacts in
      // with it. Verified 2026-07-21: NO services/app readFileSync of any of
      // these, and grep of every collections.json shows no UI browse path.
      //   - canonical-invariants.seed.json (304 KB): the invariant INGEST source.
      //     Runtime reads invariants from the DB; ontologyResolver reads
      //     platform-ontology.md (with a built-in mirror fallback), never this.
      //   - retrieval-index.md (149 KB): a memory-compilation DUMP artifact; the
      //     runtime memory reads the DB, and a missing pack file is skipped at
      //     read time.
      //   - operation-metawill + experiment result JSONs: committed RECORD
      //     artifacts; the Results/Report tabs read the DB (/api/experiments/*),
      //     not these files.
      // Excludes are applied AFTER includes and win (confirmed by the 2026-07-20
      // /api/codex/chat updates exclude), so these override the pack-file glob.
      "codexes/packs/irl/foundation/canonical-invariants.seed.json",
      "codexes/packs/aigency/items/memory/retrieval-index.md",
      "codexes/packs/agentiq/items/venture-iqube/operation-metawill-v0.2.json",
      "codexes/packs/irl/foundation/experiments/**/*results*.json",
      // Build-time-only deps Next conservatively traces but the runtime never
      // executes: the TypeScript compiler (no runtime import in this app) and
      // browserslist's caniuse-lite data. ~11 MB more headroom under the limit.
      "node_modules/typescript/**",
      "node_modules/caniuse-lite/**",
      // shiki (+ its oniguruma/regex engine) — a CLIENT-ONLY rendering
      // dependency. It arrives transitively via
      // @copilotkit/react-ui -> @copilotkitnext/react -> streamdown (the
      // chat markdown/code-block renderer), never imported directly by any
      // app file (verified 2026-07-24: zero direct `shiki`/`@shikijs`
      // imports anywhere under app/components/services). The two server
      // routes that DO use CopilotKit (app/api/copilotkit/[[...path]]/route.ts,
      // app/api/copilotkit/system/route.ts) import ONLY from
      // @copilotkit/runtime — never react-ui, @copilotkitnext, or streamdown
      // — so nothing server-executed calls into shiki. @shikijs alone traced
      // at ~11 MB (2026-07-24 compute-composition log), ~14x the byte
      // overage that tipped the last 12 builds past the 230686720-byte cap;
      // the rest of this list is its supporting oniguruma/regex engine,
      // none of which is a general-purpose utility used elsewhere in this
      // app (confirmed against package-lock.json: none of these packages
      // have any other dependent in this repo's tree). If a future
      // server-rendered surface genuinely needs shiki (e.g. SSR syntax
      // highlighting), the runtime will fail with "module not found" for
      // shiki/@shikijs — that is the signal to revisit this exclude, not to
      // silently re-add it.
      "node_modules/shiki/**",
      "node_modules/@shikijs/**",
      "node_modules/oniguruma-to-es/**",
      "node_modules/oniguruma-parser/**",
      "node_modules/regex/**",
      "node_modules/regex-recursion/**",
      "node_modules/regex-utilities/**",
      // NOTE: the broader hast/mdast utility cluster (hast-util-to-html,
      // ccount, zwitch, comma/space-separated-tokens, stringify-entities,
      // character-entities-html4, html-void-elements) is deliberately NOT
      // excluded here even though it rides in via the same streamdown chain
      // — package-lock.json shows react-markdown (a separately-resolvable
      // package) among its other requesters, and this sandbox has no
      // installed node_modules to verify react-markdown's own usage is
      // ALSO client-only before excluding shared dependencies. The six
      // entries above (shiki/@shikijs + its oniguruma/regex engine) have
      // exactly one requester each (streamdown, verified against
      // package-lock.json) and already reclaim ~11+ MB — comfortably enough
      // headroom on their own; leave the ambiguous cluster for a follow-up
      // pass with an actual build to verify against.
      // Auto-generated deploy-trigger commit briefs (~8 MB, 1900+ files and
      // growing every deploy). They are bundled by the codexes-pack tracing
      // include below, but the copilot skips them by default
      // (exclude_deploy_triggers in app/(shell)/copilot/actions/agentiq-codex.ts),
      // and a missing file is simply skipped at read time (readCodexFile → null).
      // Shipping build-log metadata in the size-capped SSR Lambda is what tipped
      // the output past the 230686720-byte hard cap (2026-07-17). Excluded here,
      // same philosophy as the typescript/caniuse entries above.
      "codexes/packs/aigency/items/build_/COMMITS/**",
      // build_/PR — auto-generated per-PR log archives (~156 KB, grows every PR),
      // same build-log class as COMMITS above. Only referenced as an EXAMPLE path
      // in a copilot tool-description string, never a required runtime read (a
      // missing pack file is skipped at read time). Excluded to reclaim headroom
      // under the 230686720-byte cap as session docs + UI grow (2026-07-21).
      "codexes/packs/aigency/items/build_/PR/**",
      // The auto-generated build changelog — same build-log class as COMMITS
      // above (grows every deploy; 374KB on 2026-07-20 when the output tipped
      // the cap by ~194KB). Same safety: a missing pack file is skipped at
      // read time; no surface depends on shipping it inside the Lambda.
      "codexes/packs/aigency/items/build_/changelog.md",
    ],
  },
  // Promoted from experimental in Next 15 — these entries carry files the SSR
  // runtime reads at runtime into the standalone Lambda bundle.
  //
  // PACK CORPUS SPLIT (Phase B, 2026-07-21): the pack MARKDOWN bodies
  // (codexes/packs/**\/*.md, ~5 MB and growing every deploy) are NO LONGER traced
  // — they moved to the remote pack-corpus store (Supabase blob + AutoDrive
  // provenance; services/knowledge/packCorpusStore.ts, scripts/export-pack-corpus.mjs)
  // and every .md reader now goes through that seam. Only the pack JSON
  // (collections.json / index.json / meta.json — the registry's metadata, ~100 KB)
  // stays bundled, because packRegistry.ts reads it via fs and lists pack
  // DIRECTORIES. This is what finally decouples the corpus from the 230686720-byte
  // SSR cap. Two tiny sync-context .md readers keep targeted includes below
  // (exp001 + the constitutional glossary) — they read at module/sync time and
  // can't cleanly await hydration, so their handful of files stay bundled.
  outputFileTracingIncludes: {
    // Pack JSON only — registry metadata + browsable JSON. The .md bodies are
    // served by the corpus store (pack-file route reads via corpusReadPackFile).
    // With output:'standalone' a file included on ANY route lands in the single
    // shared bundle, so this one entry covers packRegistry + every JSON reader.
    "/api/codex/packs/[packId]/file": ["./codexes/packs/**/*.json"],
    // EXP-001 evaluation step API reads these Living KnowledgeQube .md artifacts
    // synchronously (services/experiments/exp001.ts, EXP_DIR under irl/foundation
    // — NOT ccrl, the previous path was stale and only worked via the old
    // catch-all glob). Kept bundled (5 small files) rather than made async.
    "/api/experiments/exp001": [
      "./codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/*.md",
    ],
    // NOTE: an attempt to trace ffmpeg-static's binary (~70-80MB) into the
    // stitch/status routes here (2026-07-05) pushed the Amplify build output
    // past its 220 MiB hard cap (230686720 bytes) and broke ALL deploys —
    // reverted same day. The bundle-size-safe fix now lives in
    // app/api/skills/video/_thumbnail.ts:getFfmpegPath — the binary is
    // fetched into /tmp on first use (ffmpeg-static's own pinned release,
    // gzipped) and cached per container. Do not re-add a trace entry for
    // ffmpeg-static here.
    // registry docs tab: the two docs/*.md legibility files stay bundled (they
    // are NOT under codexes/packs). The route's ~18 pack updates .md are now read
    // via the corpus store (route branches on codexes/packs/ prefix).
    "/api/admin/registry/docs": [
      "./docs/iqube-agent-legibility-profile.md",
      "./docs/iqube-score-derivation.md",
    ],
    // Copilot chat: the aigency + agentiq pack search now reads via the corpus
    // store, so no pack globs here. Two non-pack docs/*.md stay bundled: the
    // ontology canon (platform-ontology.md) and the constitutional glossary,
    // both read synchronously by services/constitutional/ontologyResolver.ts.
    // (The glossary lives under codexes/packs/irl but is a sync-context read, so
    // it is pinned here rather than moved to the corpus store.)
    "/api/codex/chat": [
      "./docs/platform-ontology.md",
      "./codexes/packs/irl/foundation/constitutional-glossary.md",
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
