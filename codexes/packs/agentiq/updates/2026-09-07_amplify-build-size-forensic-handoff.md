# Amplify build-size forensic investigation — handoff (2026-09-07, in progress)

**Status: IN PROGRESS, not yet resolved.** This doc exists so another agent (or the same agent in a
fresh session) can pick this up without re-deriving what's already established below. Read this before
touching `amplify.yml` or `next.config.js` again — see also
`2026-09-07_amplify-build-size-cap-incident-and-handoff.md` (the prior incident: a bad guess broke
production; the discipline in THAT doc — never delete anything outside
`.next/standalone/node_modules` without a verified reason — still applies in full here).

## Corrected framing (read this first — it changes what "the problem" is)

**Do not compare the ARTIFACT LEDGER's `du -sb .next` output against the 230686720-byte cap.** Those
two numbers are NOT the same measurement, and conflating them (as an earlier pass in this same
investigation did) produces a false "135 MB over" reading that sent the investigation in the wrong
direction for a while.

- `du -sb .next` (the ARTIFACT LEDGER's own last line) measures the WHOLE `.next` tree — this includes
  `.next/standalone` (a full, mostly-self-contained copy of the app + a pruned `node_modules`) **as well
  as** the top-level `.next/server` + `.next/static`. That total was measured at **~366,182,184 /
  366,185,418 bytes** across the two most recent failing builds.
- **The actual number Amplify's platform complains about is the `CustomerError` line**:
  `The size of the build output (230,822,049 / 230,825,248) exceeds the max allowed size of
  230,686,720 bytes`. That is the REAL, relevant measurement — Amplify is evidently NOT sizing its
  "build output" as the raw `.next` total; it's ~136 MB smaller than that, i.e. some subset.
- **The real overage is ~135–139 KB** (230,822,049 − 230,686,720 = 135,329; 230,825,248 − 230,686,720
  = 138,528), not 135 MB. This is consistent with the ENTIRE prior history documented in `amplify.yml`'s
  own comments and the prior incident doc — every previous fight over this cap has been over a
  **20–200 KB** margin, never megabytes. Nothing about the true magnitude of this problem has changed;
  what changed is that an earlier pass in today's investigation misread the wrong number.
- **Open question, not yet answered**: exactly what does Amplify measure as "build output" if not
  `du -sb .next`? The two known candidates, given the ~136 MB gap: (a) it measures only
  `.next/standalone` (the actual deployable Lambda package) plus a small manifest/static slice, not the
  top-level `.next/server` at all — plausible, though the prior incident doc's own finding (deleting
  top-level `.next/server` broke production) shows the top-level `.next/server` is needed by the RUNTIME
  even if it isn't part of the SIZE measurement; those are two different questions ("is it counted
  toward the cap" vs "does the runtime read it") and must not be conflated. (b) It measures a compressed
  package, not raw bytes. **Do not guess further — measure it** (see "Next steps" below): the two
  reproduced builds' manifests, once diffed, plus a direct comparison of `.next/standalone` alone
  against 230,822,049 / 230,825,248, will settle this empirically.

## Operator's request (verbatim intent, 2026-09-07)

Stop making speculative prunes. Instead: identify last-passing/first-failing commits; reproduce both
builds in an identical environment; capture, for each, `.next/standalone` bytes, `.next/static` bytes,
every remaining top-level `.next` subtree, largest packages/files, file count, and a sorted
`path | bytes | sha256` manifest; diff the manifests to find exactly which added/enlarged files account
for growth; inspect the corresponding `.next/server/**/*.nft.json` trace files to attribute each newly-
included file to the ROUTE that traced it; check `package-lock.json`/dependency-tree changes between
the two commits; fix the import/tracing cause at the source (only remove an artifact once there is
executable evidence the deployed SSR runtime cannot load it); correct `amplify.yml`'s license*/licence*/
notice* deletion (it currently deletes them despite comments elsewhere claiming they're preserved);
establish ≥10 MB of real deterministic headroom, not a sub-200 KB near-pass; add a post-cleanup budget
gate measured against the **actual deployable composition**, not raw `.next` size; run a local runtime
smoke test against the assembled standalone server before committing anything. Report: commits,
manifest delta, responsible route/package, source-level fix, before/after sizes, smoke results, and
exactly what was removed and why it's provably non-runtime. **Commit and push only after the cause is
demonstrated** — this doc is written precisely because that has not happened yet.

## What is CONFIRMED so far (verified, not assumed)

1. **Last-passing / first-failing commits (as reported by the operator's own build logs in this
   session):** last passing = `0d22e7ea8` ("DiDQube Phase 2: canonical read-only resolver —
   implemented + verified"); first failing = `3c1144060` ("DiDQube Phase 2 correction: stable-container
   model for supersession"). Both are on `claude/agentiq-journey-closure-myppr6` — verify this pairing
   still holds before trusting it further; build-to-build variance (documented for months in
   `amplify.yml`'s own comments — up to ~180 KB) means a single failing/passing report is not
   automatically deterministic. **Given the true overage is only ~135 KB, this variance ALONE could
   plausibly explain the flip between these two specific commits without any structural change at
   all** — that must be checked, not assumed either way.
2. **`package.json` and `package-lock.json` are BYTE-IDENTICAL between `0d22e7ea8` and `3c1144060`**
   (`diff <(git show 0d22e7ea8:package-lock.json) <(git show 3c1144060:package-lock.json)` → 0 lines;
   same for `package.json`). **No dependency changed.** Whatever growth exists, it is not a new/updated
   npm package.
3. **The actual diff between the two commits is tiny**: `services/identity/didQubeResolver.ts`,
   `tests/didqube-resolver.test.ts`, and one markdown doc — a few hundred lines of TypeScript/Markdown,
   no new imports of anything not already used elsewhere in the tree (this resolver imports only
   `crypto`'s `createHash`-derived `didPublicRef` from an existing service and Supabase server helpers
   already used throughout the app). **This makes it very plausible the two builds differ by pure
   build-to-build noise, not a real regression from this session's own commits** — but this must be
   PROVEN by the manifest diff, not assumed, per the operator's explicit instruction not to guess.
4. **`amplify.yml`'s license-file contradiction is CONFIRMED — it is real, and it is NOT yet fixed.**
   Two separate `find ... -delete` sweeps exist in `amplify.yml`'s `postBuild` commands:
   - **Line ~160** (the original "battle-tested modclean-safe" test/doc/type-declaration sweep) DOES
     match and delete license/notice files:
     ```
     find .next/standalone/node_modules -type f \( -name "*.ts" -o ... -o -iname "readme*" \
       -o -iname "license*" -o -iname "licence*" -o ... -o -iname "notice*" -o ... \) -delete
     ```
     Confirmed via `grep -n "iname" amplify.yml | grep -i "licen\|notice"` → this line is the match.
   - **Later** (the "DEPENDENCY DOCUMENTATION at package ROOT" step, added 2026-08-02) explicitly
     comments: *"LICENSE, COPYING and NOTICE are deliberately NOT matched: they cost little and may
     carry attribution obligations. Removing them to save bytes would trade a legal duty for
     headroom."* — but that promise only describes THAT step's own `find` pattern
     (`README`/`CHANGELOG`/`HISTORY.md` only, genuinely no license/notice match there). It does not
     account for the EARLIER sweep at line ~160, which already deletes them.
   - **Net effect: the later comment's assurance is FALSE as a description of the whole postBuild
     pipeline** — `LICENSE`/`LICENCE`/`NOTICE` files (any case, any extension — `iname` + `*`) ARE
     deleted from `.next/standalone/node_modules`, by the earlier step, despite the later comment
     implying they never are. This is exactly the contradiction the operator flagged, precisely located.
   - **This is a real compliance/legal-risk defect independent of the byte-size investigation** — some
     of these packages' licenses may impose attribution/inclusion obligations, and shipping the
     compiled code without the license file (while it remains fully legal to delete build artifacts
     generally) could violate specific license terms (e.g. MIT/BSD's attribution-notice requirement)
     for any package whose ONLY shipped copy of its license was under `node_modules`. **FIXED in this
     pass** (committed locally, not yet pushed — see "Files touched" below): removed
     `-iname "license*" -o -iname "licence*" -o -iname "notice*"` from the line ~160 pattern in
     `amplify.yml` (everything else in that sweep — `.ts`/`.md`/`readme*`/`changelog*`/etc. — is
     unaffected). The later step's comment is now actually true of the whole pipeline. This was
     independent of the byte-size investigation (near-zero size impact either way — license files are
     tiny) and safe to fix immediately: it only STOPS a deletion, so it cannot introduce a new runtime
     risk the way removing something further would.

## Environment for reproduction — set up, builds in progress

Two git worktrees were created (NOT part of the tracked repo — ephemeral, under this container's `/tmp`,
**will not survive a container restart or a different session's filesystem** — recreate them with the
commands below if they're gone):

```bash
git worktree add /tmp/build-repro/passing 0d22e7ea8
git worktree add /tmp/build-repro/failing 3c1144060
ln -s "$(pwd)/node_modules" /tmp/build-repro/passing/node_modules   # package.json is IDENTICAL — safe to share
ln -s "$(pwd)/node_modules" /tmp/build-repro/failing/node_modules
```

A placeholder `.env.production.local` was generated (every var `scripts/create-env-production.js`
reads, with syntactically-valid dummy values — real URLs use `https://example.invalid`, everything else
a placeholder string) and copied into both worktrees, so `next build` can get past page-data collection
without real Supabase/PayPal/etc. credentials — **this env file is NOT committed anywhere and must be
regenerated** if picking this up fresh (it's disposable; nothing in it is a real secret). Regeneration:
enumerate `scripts/create-env-production.js`'s var list and fill placeholders (see the python snippet
used to build it, describable on request, or just recreate similarly).

**Known environment gap, disclosed not hidden:** this sandbox has Node **v22.22.2**; `amplify.yml`
pins **20.18.0** via `nvm install`, and `nvm` is not available in this container (checked: no `nvm`
command, no `~/.nvm`). Both are `linux x64` (matches Amplify's Lambda architecture), so native-binary
platform tracing should be representative, but a Node major-version difference COULD affect exact
bundling/tree-shaking output in ways that don't perfectly match Amplify's real build. **Report this
caveat explicitly in the final findings — do not present local-build byte counts as identical to what
Amplify would produce, only as the best available proxy**, per the prior incident doc's own core lesson
("local build ≠ Amplify runtime" cuts both ways: it under-verifies runtime *reads*, and it may also not
perfectly match exact byte counts).

Build command used (both worktrees, one at a time — NOT concurrently, to avoid OOM: each needs the same
~6 GB heap `amplify.yml` allocates):

```bash
cd /tmp/build-repro/<passing|failing>
export NODE_OPTIONS="--max-old-space-size=6144"
export NODE_ENV=production
# + all vars from the generated .env.production.local exported into the shell
npm run build
```

**CRITICAL CORRECTION, found after the first `passing` build completed:** the first attempt did NOT
set `AWS_BRANCH` or `AMPLIFY_APP_ID`. `next.config.js` reads
`const isAmplifyBuild = Boolean(process.env.AWS_BRANCH || process.env.AMPLIFY_APP_ID)` and only sets
`output: "standalone"` when that's true — so the first local build produced **NO `.next/standalone`
directory at all**, silently. Every postBuild prune step that targets
`.next/standalone/node_modules` therefore did nothing (there was nothing there), and the resulting
`.next` total (~149 MB post-cleanup: `.next/server` 107.75 MB + `.next/static` 40.19 MB + ~1 MB of
manifests) is NOT comparable to Amplify's real ~220 MB measured output — it is missing the standalone
bundle entirely. **Any reproduction MUST set `AWS_BRANCH=<something>` (or `AMPLIFY_APP_ID`) in the
build environment**, or the comparison is worthless. This also weakens (does not yet disprove) the
"maybe Amplify's measurement excludes `.next/standalone`" hypothesis from "Corrected framing" above:
if the non-standalone content alone is only ~149 MB and Amplify reports ~220 MB, `.next/standalone`
(once correctly produced) is very likely IN the measured total after all — this needs the corrected
rebuild to confirm, not additional guessing.

A second `passing` build, now WITH `AWS_BRANCH=dev` exported, was kicked off immediately after finding
this — check whether it's finished and whether `.next/standalone` now exists before doing anything else.
If it's done, run the manifest script (see below) and the postBuild replay (`/tmp/postbuild-commands.txt`
— extracted from `amplify.yml`'s `native-binary cleanup` through the `ARTIFACT LEDGER` line — was used
for the first, invalid attempt; reuse it, it doesn't depend on the env-var bug, only the build itself
does) on this corrected `.next` tree, THEN generate manifests.

**As of this handoff, the first `passing` (0d22e7ea8) build (missing `AWS_BRANCH`, later found invalid)
had already completed; the CORRECTED rebuild (same commit, `AWS_BRANCH=dev` set) is running in the
background.** Check `/tmp/build-passing-v2.log` for progress; when it finishes AND
`ls .next/standalone` shows content, run:

```bash
./scripts/build-artifact-manifest.sh /tmp/build-repro/passing /tmp/build-repro/passing-manifest
```

Then repeat the whole build+manifest cycle for `/tmp/build-repro/failing` (build log to e.g.
`/tmp/build-failing.log`, manifest prefix `/tmp/build-repro/failing-manifest`).

## `scripts/build-artifact-manifest.sh` (new, committed)

Written for this investigation and committed to the repo (not left in `/tmp`) so it survives and is
reusable for any future round of this recurring problem. Given `<dir-containing-.next>` and an
`<output-prefix>`, it writes:
- `<prefix>.summary.txt` — every top-level `.next` subtree's byte size, `.next/standalone`/`.next/static`/
  `.next/server` totals + whole-tree total, file count, biggest `node_modules` packages, biggest
  `.next/static` subtrees, and the 40 biggest individual files anywhere under `.next`.
- `<prefix>.manifest.tsv` — every file under `.next`: `path<TAB>bytes<TAB>sha256`, sorted by path, via a
  batched (`xargs -P 4 -n 200`) `sha256sum` rather than one process per file (this tree can have tens of
  thousands of files; a naive per-file loop would be prohibitively slow).

**This script measures whatever `.next` currently exists in the given directory — it does NOT run
`next build` and does NOT replay `amplify.yml`'s postBuild cleanup (native-binary prune, source-map/
doc/type-declaration deletion, `pdf-parse` vendored-build prune, cache/trace/types removal).** Run it
once on the raw post-`next build` output for the "what did the build produce, and via which route/
package" question; if you also need the POST-cleanup composition (closer to what Amplify actually
ships), manually replay the relevant `amplify.yml` `postBuild` command lines against a copy of that
`.next` tree first, then run this script again on the copy. Do not conflate the two runs.

## Next steps (in the order the operator specified)

1. Let both builds finish; run the manifest script on each.
2. `diff <(cut -f1,2,3 passing-manifest.manifest.tsv) <(cut -f1,2,3 failing-manifest.manifest.tsv)` —
   find every path present in only one manifest (added/removed) and every path present in both with a
   different size/hash (changed). Given confirmed-identical dependencies (§3 above) and a tiny source
   diff, **the most likely honest outcome is a very short diff, possibly even empty modulo
   nondeterministic build IDs/hashes/timestamps embedded in a handful of files** — if so, say that
   plainly; do not manufacture a "root cause" narrative to satisfy the request if the evidence says
   this is build-to-build noise at a razor-thin margin.
3. Compare `.next/standalone` bytes alone (from each `*.summary.txt`) against Amplify's own reported
   230,822,049 / 230,825,248 — this is the fastest way to test the "Amplify only measures standalone"
   hypothesis from §"Corrected framing" above.
4. If a real added/enlarged file is found, open its route's `.next/server/app/**/*.nft.json` (or
   `.next/server/pages/**/*.nft.json`) — these list every traced file path for that route — grep for
   the new/enlarged file's path to find which route(s) pulled it in, then trace that back to the
   specific import in application code.
5. Only then propose a source-level fix (an import change, a `next.config.js`
   `outputFileTracingExcludes`/`serverExternalPackages` entry, etc.) — and only remove a file from the
   artifact if you can point to the specific `.nft.json`/import evidence that the SSR runtime never
   resolves it, per the prior incident's hard-won rule.
6. Re-verify (or fix) the license/notice exclude contradiction the operator flagged (§4 above) once its
   exact current location is confirmed.
7. If real headroom is established, add a budget gate keyed to the actual deployable composition (very
   likely `.next/standalone` + `.next/static`, pending step 3's confirmation) with a ≥10 MB margin, not
   the current razor's-edge check against raw `.next`.
8. Build the standalone server locally (`node .next/standalone/server.js` with the same env) and smoke-
   test a few real routes before committing anything.
9. Commit and push only after all of the above produces a demonstrated (not guessed) cause and fix.

## Files touched by this handoff itself

- `scripts/build-artifact-manifest.sh` — new, committed (see above).
- `amplify.yml` — one independent, low-risk line fixed (the license/notice deletion contradiction, §4
  above). This is the ONLY change to `amplify.yml`/`next.config.js` in this pass; no byte-size-driven
  prune has been made — the manifest-diff investigation is still in progress (builds running) and per
  the operator's explicit instruction, no size-driven change should be committed until the cause is
  demonstrated.
- This doc — new, committed, registered in `codexes/packs/agentiq/collections.json`'s `col_updates`.
- The two build-reproduction git worktrees and generated `.env.production.local` live under this
  container's `/tmp` — NOT committed (ephemeral, disposable, regeneration instructions above).
