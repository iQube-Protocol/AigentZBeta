# Amplify build-size cap — incident record and handoff (2026-09-07)

**Status:** unresolved. The cap-fix work is currently REVERTED to its pre-incident state. Production
is stable (manually rolled back by the operator to a build from before this incident). This doc exists
so the next agent who picks up the build-size problem does not repeat the mistake that caused an
outage.

## TL;DR for the next agent

- The 230,686,720-byte (220 MiB) Amplify SSR Compute cap is a **hard AWS platform limit**, not
  app-configurable (see `amplify.yml` lines ~125-136 for the referenced GitHub issues).
- **Every previously-successful fix for this cap operates exclusively inside
  `.next/standalone/node_modules`.** Read the full history in `amplify.yml`'s `build.commands` — it is
  extensively commented, with real measurements from real builds, going back months. That history IS
  the reference; do not rediscover it from scratch.
- **Do NOT delete anything under the top-level (non-standalone) `.next/server`.** I did this
  (`.next/server/app` + `.next/server/chunks`, ~105 MB) on the theory that `.next/standalone` is fully
  self-contained and Amplify only ever runs `.next/standalone/server.js`. That theory was **wrong** —
  the deploy fit under the cap, got promoted, and then the entire application 500'd on every request.
  Amplify's Next.js SSR Compute hosting evidently depends on the top-level `.next/server` in some way
  I did not correctly identify from static/local-build inspection alone.
- If you find yourself reasoning "X is a duplicate of Y, so X is safe to delete" **without an actual
  successful Amplify build to verify it against**, stop. A local `next build` (even with real env vars)
  proves what Next.js's tracer *produced*; it does not prove what AWS Amplify's compute runtime
  actually *reads at request time*. Those are different systems, and this incident is the proof.

## What happened, in order

1. Repeated Amplify build failures: `The size of the build output (X) exceeds the max allowed size of
   230686720 bytes`, overage in the 20-25 KB range per build (razor-thin, consistent with the historical
   note in `amplify.yml` that build size has ~180 KB of run-to-run variance at identical source — see
   the "WHY THIS ESCALATED" comment block there).
2. First attempt (wrong target): relocated `public/metaMe/sources/` and `public/metaMe/iQube/`
   (~20 MB, verified zero code references) out of `public/` into `design-assets/metaMe/`. **Zero
   measurable effect** on the reported Amplify size — confirmed by the next build failing at almost
   the same overage. Root cause: these files were never part of the measured artifact's bulk in the
   first place (the artifact ships more than `public/`; see next.config.js's own tracing-exclude
   history for the real cost centers).
3. Second attempt: added `codexes/packs/agentiq/updates/**` to `outputFileTracingExcludes` for
   `/api/admin/registry/docs` in `next.config.js`, reasoning that route already reads those files via
   the remote pack-corpus store (`corpusReadFile`), so the bundled copies are dead weight. **Verified
   locally to have zero effect** — a real `next build` still showed all ~499 files under
   `codexes/packs/agentiq/updates/` present in `.next/standalone`. This exclude is still in place (it's
   harmless, just apparently ineffective — something else traces the whole directory regardless of
   this one route's own exclude list). Not the cause of anything; just didn't help.
4. **Third attempt — the one that broke production.** A real local `next build` (with placeholder
   Supabase env vars to get past page-data collection, since this sandbox has no real credentials)
   showed `.next/server` (top-level) at 106.3 MB, almost byte-identical to
   `.next/standalone/.next/server` (105.8 MB). Reasoning: `.next/standalone/server.js` embeds
   `__NEXT_PRIVATE_STANDALONE_CONFIG` and never reads the top-level `required-server-files.json` at
   runtime (confirmed by reading the file), and `required-server-files.json`'s own `files` array (18
   entries) only references small manifests, never `app/` or `chunks/`. Concluded the top-level
   `.next/server/app` + `.next/server/chunks` were dead duplicate weight and added
   `rm -rf .next/server/app .next/server/chunks` to `amplify.yml`'s postBuild. **This shipped, fit
   under the cap, got promoted — and crashed the entire live application** (Internal Server Error on
   every request). Reverted in commit `14bab1e5d`.

## The actual, PROVEN-safe pattern (read `amplify.yml` itself, this is just a summary)

Every one of these has a real measurement and a real build behind it in `amplify.yml`'s comments:

- Non-`linux-x64-gnu` native binaries for `@next/swc`, `@swc/core`, `@esbuild`, `@img/sharp`,
  `@napi-rs/canvas` under `.next/standalone/node_modules` — Amplify's Lambda is glibc x64; the other
  platform variants are traced conservatively but never loaded.
- `*.map` source maps anywhere under `.next` — devtools-only, never `require()`d.
- `*.ts`/`*.mts`/`*.cts` (including `.d.ts`) under `.next/standalone/node_modules` — a compiled
  standalone app has no TypeScript loader; only compiled `.js` is ever resolved.
- `@types/*` packages and `node_modules/.bin` under `.next/standalone/node_modules` — type-only /
  CLI-shim-only, never touched by the SSR runtime's module resolution.
- `playwright-core` under `.next/standalone/node_modules` — loaded only via a guarded
  `try/catch`-wrapped dynamic `require` that degrades gracefully; browser automation cannot run in the
  Lambda anyway.
- `test/`, `tests/`, `__tests__/`, `example*/`, `doc*/`, `coverage/`, `.github/`, `.idea/` directories,
  and misc build-meta files (`.flow`, `.coffee`, `.eslintrc*`, `.tsbuildinfo`, etc.) under
  `.next/standalone/node_modules` — never resolved via `package.json` `main`/`exports`.
- Dependency `README`/`CHANGELOG`/`HISTORY`/etc. at package root under
  `.next/standalone/node_modules` — same class, added later because directory-level sweeps miss
  root-level doc files. `LICENSE`/`COPYING`/`NOTICE` are deliberately never touched (legal, not size).
- `pdf-parse`'s vendored `lib/pdf.js/*` builds, keeping only the one version the app actually calls
  (`v1.10.100`) — pdf-parse ships four full pdf.js distributions (~32 MB) because its `require()` call
  uses a template literal the tracer can't resolve statically, so it conservatively bundles all four.
- `.next/cache`, `.next/trace`, `.next/types` at the top level (not inside standalone) — build-only
  artifacts (cache, trace log, generated route type declarations), confirmed unread by anything the
  artifact serves.

**The common thread: every one of these is either (a) definitively unreachable via normal Node module
resolution (docs, types, source maps, wrong-platform native binaries), or (b) an explicitly-named
build-time-only directory (`cache`, `trace`, `types`) with a code-level citation for why nothing reads
it at runtime.** Nothing on this list is "a compiled route bundle that looks like a duplicate."

## What's still true and unresolved

- The size-cap problem itself is **not fixed**. The next build is expected to fail the cap again
  (same ~20-25 KB overage ballpark, though it drifts run-to-run per the documented variance).
  A failed build is safe — Amplify does not promote it, so whatever is currently live stays live.
- `amplify.yml`'s own historical note (search for "WHY MEASUREMENT AND NOT ANOTHER CUT") already
  flagged that `standalone + static` doesn't account for the full artifact total, leaving an
  "unitemised" remainder — and explicitly stopped rather than guess further at that time. That
  discipline held for months. This incident happened because it wasn't followed this time.
- The `next.config.js` exclude added in step 3 above (`/api/admin/registry/docs` excluding
  `codexes/packs/agentiq/updates/**`) is still in place and is harmless; leave it unless you have a
  specific reason to touch it.

## Recommended next steps (in order of safety)

1. **Re-run the existing measurement steps in `amplify.yml` and actually read the printed
   composition** (`du -sm .next/standalone/node_modules/* .next/standalone/node_modules/@*/*` and the
   `.next/static` breakdown are already logged, just never acted on for whatever's newly grown). Look
   for a NEW large package or asset that wasn't there when the historical cuts were made — the repo
   has grown substantially since then (this session alone merged in a new `services/research/`
   surface). A genuinely new, unreached dependency is the most likely source of fresh growth.
2. If a candidate cut is found, **verify it is inside `.next/standalone/node_modules` (or one of the
   already-established build-only top-level directories) before proposing it.** If it's anywhere near
   `.next/server`, `.next/standalone/.next/server`, or any compiled `app/`/`pages/`/`chunks/`
   directory, do not delete it based on local reasoning alone — treat that as instant disqualification
   given this incident.
3. If no safe cut is found, the honest options are: (a) ask the operator whether AWS support can raise
   the platform limit for this specific Amplify app (the comment in `amplify.yml` says it's "not an
   app-configurable quota" as of when that was written — worth re-checking with AWS directly rather
   than assuming), or (b) reduce genuine application weight (fewer bundled routes, a heavy dependency
   moved to a separate service/edge function, etc.) rather than chasing build-artifact dead weight that
   has already been fully swept.
4. **Never ship a cut to `.next/server` (or anything outside the proven `.next/standalone/node_modules`
   scope) without a way to verify it against a real Amplify build first.** If you don't have that
   verification path, say so explicitly and let the operator decide whether to accept the risk — don't
   present local-build confidence as equivalent to production verification.

## Relevant commits (this repo, branch history)

- `1cf7cda28` — the `/api/admin/registry/docs` trace exclude (kept, harmless, apparently ineffective).
- `805d03082` — **the commit that broke production** (`.next/server/app`+`chunks` deletion).
- `14bab1e5d` — the revert of `805d03082`. This is the current state of `amplify.yml`.
- `97078e693` — deploy trigger re-pushing this session's unrelated UI fixes after the operator's
  manual Amplify-console rollback, on the reverted (safe) `amplify.yml`.
