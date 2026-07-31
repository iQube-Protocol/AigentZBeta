# Pack Corpus → Remote Store (Supabase + AutoDrive) — ends the SSR size-cap treadmill

**Date:** 2026-07-21
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Type:** infrastructure / deploy

## Problem

The codex pack corpus (`codexes/packs/**/*.{md,json}`) was traced into the Amplify
SSR Lambda bundle. Amplify Hosting SSR has a **hard 230,686,720-byte (220 MiB)
platform cap** — not configurable by any amplify.yml / next.config / console
setting. The corpus is ~5 MB of markdown that **grows every deploy** (a session
update doc lands in `agentiq/updates/` each time), so the bundle repeatedly
retipped the cap. Every prior fix (native-binary prune, source-map sweep,
dead-file excludes) bought only a few deploys.

## Fix — move the markdown bodies out of the bundle

A read seam serves the corpus from a remote store instead of the Lambda filesystem.

- **`services/knowledge/packCorpusStore.ts`** — per-container in-memory cache,
  hydrated **once per Lambda container** from a single concatenated blob. Search
  runs full-content, in-memory, exactly as before (no excerpt-index recall loss).
  Auto-detects mode: **local FS** in dev/tests (corpus present on disk),
  **remote** in the Lambda (corpus absent). `corpusReadFile` / `corpusListMarkdown`
  are drop-in for the old `fs.readFileSync` / `readdirSync` helpers.
- **`scripts/export-pack-corpus.mjs`** (amplify.yml build step) — uploads the
  corpus blob to **Supabase Storage** (`pack-corpus/<branch>/corpus.json`,
  public-read — the fast runtime read path) and pins the **canonical subset**
  (`irl/foundation/`, `polity-core/`) to **Autonomys AutoDrive** for permanence +
  provenance (the hybrid split, operator-chosen). It **bakes the exact uploaded
  URL into `.env.production`** (`PACK_CORPUS_URL`) so the runtime fetches what the
  build uploaded regardless of `AWS_BRANCH`, and **self-verifies** the blob is
  publicly readable + parseable before letting the build succeed.

### Metadata/body split (keeps the registry safe)

`packRegistry.ts` reads only pack **JSON** (`collections.json` / `index.json` /
`meta.json`, ~100 KB) and lists pack **directories** — it never reads `.md`
bodies. So Phase B keeps **all pack `.json` traced** (registry unaffected) and
moves **only the `.md` bodies** (~5 MB) to the corpus store.

### Every `.md` reader rewired (audit-driven)

Async route/action readers now go through the seam:
`agentiqPackSearch`, the pack-file route, `agentiq-os` chat, `aigentiq` chat,
`aigentZPlatformKnowledge` (pack-path branch), `agentiq-codex` copilot actions,
public IRL doc route, knyt-wheel ingest, polity-commentary ingest, registry docs
(pack-path branch). Two tiny **sync-context** readers (`exp001.ts` artifacts and
the `constitutional-glossary.md` ontology source) keep **targeted `next.config`
includes** rather than being forced async.

## Rollout (two phase, no broken-bundle window)

- **Phase A (commit `319c002b`):** additive — seam + exporter shipped while the
  corpus was still bundled (seam read local FS, zero behaviour change). The build
  populated + validated the blob.
- **Phase B (this commit):** `next.config` stops tracing `codexes/packs/**/*.md`;
  the exporter becomes **fatal** (build fails if upload/verify fails → the prior
  corpus-bundled revision keeps serving; there is never a corpus-less deploy).

## Safety interlocks

1. Fatal exporter → failed upload aborts the build.
2. Self-verify public read + key count → "uploaded but unreadable" aborts the build.
3. Runtime hydration is non-throwing → a transient blip degrades grounding
   (empty results) rather than 500ing, and retries after a short cooldown.

## Operator notes

- Env already in the build allowlist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `AUTONOMYS_API_KEY` (`scripts/create-env-production.js`).
- If the `pack-corpus` bucket can't be auto-created public, the build fails loudly
  with the reason; create it manually (Supabase → Storage → New bucket
  `pack-corpus`, Public) and redeploy.
- Result: the corpus is decoupled from the 220 MiB cap and **no longer grows the
  bundle every deploy**. The copilot's recent-commits grounding (`index.json`) is
  restored (served from the blob).
