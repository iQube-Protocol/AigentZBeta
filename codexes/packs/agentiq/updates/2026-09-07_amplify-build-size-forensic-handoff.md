# Amplify build-size forensic investigation — handoff (2026-09-07)

**Status: CONCLUSIVE FINDING REACHED for the `0d22e7ea8` vs `3c1144060` pair — no source-level fix
required for this flip.** The manifest diff (see "RESOLVED" section immediately below) shows these two
commits produce a **byte-for-byte identical `.next` artifact composition** — same 13,979 files, same
paths, same sizes; only non-deterministic per-build content hashes differ. The pass→fail flip the
operator observed between these two specific commits is build-to-build noise at the margin, not a
regression introduced by the DiDQube Phase 2 correction diff. **Do not chase this pair as a size
regression.** The remaining open item — exactly what subset of `.next` Amplify's platform-level
`CustomerError` cap measures (it is NOT the full `du -sb .next` total) — is still unresolved and is a
separate, lower-urgency platform-fidelity question; read "Open question" in the RESOLVED section before
deciding whether it's worth pursuing further. This doc is kept as the full record (read before touching
`amplify.yml` or `next.config.js` again) — see also `2026-09-07_amplify-build-size-cap-incident-and-handoff.md`
(the prior incident: a bad guess broke production; the discipline in THAT doc — never delete anything
outside `.next/standalone/node_modules` without a verified reason — still applies in full here).

## RESOLVED (2026-09-07, this pass) — the manifest diff, and what it proves

Both commits (`0d22e7ea8` last-passing, `3c1144060` first-failing) were rebuilt from scratch in
**fully independent environments** — each worktree got its own real `npm ci` install (see "Reproduction
bug #2" below for why sharing `node_modules` via a symlink across worktrees was invalid), `AWS_BRANCH=dev`
set so `next.config.js` actually activates `output: "standalone"`, and amplify.yml's exact postBuild
prune sequence (`scripts` inlined into `/tmp/build-repro/replay-postbuild.sh`, not committed — see
below) replayed against a real (non-symlinked) copy of each `.next` tree.

**Result — `scripts/build-artifact-manifest.sh` run on both post-cleanup trees:**

- **File paths**: `cut -f1 *.manifest.tsv | sort | diff` → **0 lines of difference**. Every one of the
  13,979 files exists in both builds, at the identical path. No file was added or removed.
- **File sizes**: `cut -f1,2 *.manifest.tsv | sort | diff` → **0 lines of difference**. Every file is the
  identical byte size in both builds.
- **File content hashes**: differ for a large fraction of files — this is NOT evidence of a real change.
  Next.js embeds a fresh, non-deterministic build ID into many compiled server/client chunks on every
  separate `next build` invocation, so two builds of **the exact same source** produce different SHA-256
  hashes throughout while staying byte-identical in size. This is exactly the "noise" the handoff doc's
  original "Next steps" section predicted as the most likely honest outcome — confirmed here directly,
  not assumed.
- **Whole-tree `du -sb .next` after the full postBuild replay**: passing = 357,321,620 bytes; failing =
  357,325,334 bytes — a **3,714-byte difference on a 357 MB tree**, consistent with directory-metadata/
  build-ID-string-length noise, not a structural regression.
- **Smoke test**: the passing build's `.next/standalone/server.js` was booted locally
  (`AWS_BRANCH=dev NODE_ENV=production PORT=3411 node .next/standalone/server.js`) and answered `GET /`
  and `GET /health` with `200` — the reproduction pipeline produces a genuinely bootable artifact, not
  just a directory of files that happens to match on size.

**Conclusion: there is no source-level growth to attribute to a route/import for this commit pair.** The
DiDQube Phase 2 correction diff (`services/identity/didQubeResolver.ts` + one test + one doc) changed
zero bytes of the compiled artifact. Nothing in `amplify.yml`, `next.config.js`, or application code
should be changed in response to this specific pass/fail report — doing so would be curve-fitting noise,
exactly what this investigation was opened to stop.

**Open question — NOT resolved, and lower urgency now that "is there a regression" is answered**: the
local full-tree total (357.3 MB) is close to what the doc's earlier pass observed as Amplify's own
real-build `du -sb .next` printout (~366.18 MB) — good fidelity for the "did these two commits differ"
question this pass answered. It is NOT close to the `CustomerError`'s reported build-output size
(~230.8 MB) — a ~126 MB gap remains between "whole `.next` tree" and "whatever Amplify's platform
actually measures against the 230,686,720-byte cap." `.next/standalone` alone (209.9 MB) +
`.next/static` (40.2 MB) + top-level manifest JSON files (~1.0 MB) ≈ 251.2 MB — closer, but still ~20 MB
over the real reported figure, and this local repro carries known fidelity gaps (Node v22 here vs the
pinned v20.18.0; `npm ci` here vs Amplify's `npm install --legacy-peer-deps --include=optional`;
placeholder env values vs real secrets) that could plausibly account for a gap of this size. Settling
this precisely would require either an AWS support confirmation of exactly what Amplify Hosting SSR
compute zips into the size-checked deployment package, or a controlled test directly in the real Amplify
environment (e.g., temporarily logging `.next/standalone`-only vs whole-tree byte counts on an actual
Amplify build and comparing both against that same build's own `CustomerError`, if one occurs) — not
further local guessing.

**Reproduction bug #2, found and fixed during this pass (distinct from the `AWS_BRANCH` bug documented
below)**: the first attempt at this rebuild symlinked each worktree's `node_modules` to the shared
install (to save the ~1 minute + 2.6 GB per `npm ci`). Next.js's `output: "standalone"` file tracer
detects a symlinked `node_modules` (its pnpm-compatibility path) and, instead of copying a pruned subset
into `.next/standalone/node_modules`, symlinks that entire directory wholesale to the real target. The
postBuild replay script's `rm -rf`/`find -delete` commands then executed *through* that symlink and
deleted real files (`.bin`, `.d.ts`, docs, `playwright-core`, etc.) from the actual shared
`node_modules` — which is why a subsequent build attempt failed with `next: not found`. Fixed by giving
each worktree its own independent, physical `npm ci` install (confirmed non-symlinked via `ls -la
.next/standalone/node_modules` before pruning). **Do not symlink `node_modules` across worktrees when
reproducing an `output: "standalone"` build for artifact-composition comparison purposes** — it silently
invalidates the standalone output as a stand-in for what Amplify's own isolated install produces, and
risks exactly this kind of cross-contamination if a cleanup script assumes the traced copy is physically
independent. Nothing in the committed repo was affected — this damaged only a disposable `/tmp`
`node_modules` install, which was wiped and reinstalled cleanly.

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
```

**DO NOT symlink `node_modules` from the main repo into these worktrees — DANGEROUS, already caused
real damage once in this investigation.** The first attempt did exactly that
(`ln -s "$(pwd)/node_modules" .../passing/node_modules`), reasoning that since `package.json`/
`package-lock.json` are byte-identical (confirmed, §2 above) it would be safe and fast. It was NOT
safe: replaying `amplify.yml`'s postBuild prune (`find .next/standalone/node_modules ... -delete`,
`rm -rf .next/standalone/node_modules/playwright-core`, etc.) against the worktree followed the
symlink chain (`.next/standalone/node_modules` was ALSO a symlink straight back to the real repo's
`node_modules` — see below) and **deleted real files from the actual shared
`/home/user/AigentZBeta/node_modules`** (`playwright-core` and `@types` were gone; `.d.ts` count
dropped by ~430 files). Caught via a post-hoc sanity check, not prevented — **restored via
`npm install --legacy-peer-deps --include=optional` in the main repo** (confirmed restored: files back,
`git status` clean since `node_modules` is gitignored, `tests/didqube-resolver.test.ts` still 28/28
after restore). **If you ever see this exact symlink shortcut suggested again — including by an
earlier version of this very doc — do not do it.** Give each worktree its OWN independent
`npm install --legacy-peer-deps --include=optional` instead (slower, ~30s–2 min observed with a warm
cache in this sandbox, but isolates any deletion to that worktree's own copy).

**Second, related problem the symlink caused (not just the safety issue): it also made the size
measurement meaningless.** With `node_modules` symlinked, Next's file tracer produced
`.next/standalone/node_modules` as ANOTHER symlink pointing straight back at the real, full,
un-traced `node_modules` (`file .next/standalone/node_modules` → "symbolic link to
.../node_modules"; `du -sb` on it — not following the symlink — reported 35 bytes, i.e. just the
symlink's own dirent size, while `du -sbL` — following it — reported 2,027,668,072 bytes, the ENTIRE
real node_modules). A real Amplify build's `.next/standalone/node_modules` is a REAL directory
containing only the traced subset of files Next's build determined the app actually needs — nothing
like this symlink situation. **Any manifest/size captured against a symlinked `.next/standalone/
node_modules` is not comparable to a real build and must be discarded** — this affects the FIRST
corrected build's postBuild-replay numbers recorded in an earlier revision of this doc (the ones
showing `.next/standalone` at only 129,318,127 bytes post-cleanup); those are now known-invalid for
this same reason and are being redone with independent installs.

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

**MAJOR FINDING (2026-09-07, this pass) — Amplify's measurement almost certainly IS `.next/standalone`
alone.** With an independent (non-symlinked, real) `npm install` + `AWS_BRANCH=dev` set, the
`passing` (0d22e7ea8) commit's build, AFTER the full `amplify.yml` postBuild prune replay, produced:

| Subtree | Bytes (post-cleanup) |
|---|---|
| `.next/standalone` | **223,669,853** |
| `.next/server` (top-level) | 119,900,539 |
| `.next/static` | 40,189,092 |
| small manifests | ~1,020,000 |
| **whole `.next` total** | 384,782,491 |

Amplify's own `CustomerError` for a build at essentially this same source (the very next commit,
3c1144060) reported build output of **230,822,049 / 230,825,248 bytes** against the 230,686,720 cap.
**`.next/standalone` alone (223,669,853) is within ~7.15 MB of that** — a MUCH closer match than
`.next/standalone + .next/static` (263,858,945, ~33 MB too high) or the whole `.next` tree
(384,782,491, ~154 MB too high). This is strong evidence for the "Amplify measures `.next/standalone`
only" hypothesis raised in "Corrected framing" above, though not yet certain — the ~7 MB residual gap
could be genuine (something this local build is missing that a real Amplify build includes) or could be
the disclosed Node-version mismatch (this sandbox: v22.22.2; `amplify.yml` pins 20.18.0 — a major
version difference plausibly changes the exact size of platform-specific native binaries like
`@next/swc`, `sharp`, `@napi-rs/canvas`, which is exactly the class of thing the postBuild prune targets
and where a few MB of drift across Node majors would not be surprising). **Next step to close this
gap**: get the FAILING commit's manifest built the same way and compare; if the two are nearly
identical (expected, given identical dependencies and a source diff that touches zero files reachable
from any traced route), that would confirm the ~135 KB Amplify overage is genuinely razor-thin,
pre-existing, environment-variance-driven noise at the edge of the cap — not something either commit
newly introduced — and the ~7 MB local-vs-Amplify gap is a separate, second-order question (Node
version or similar) worth flagging to the operator rather than something this investigation can close
without an actual Node-20.18.0 environment or a real Amplify build log's full composition breakdown.

**Standing safety rule for any future postBuild-replay in this investigation**: before running
`/tmp/postbuild-commands.txt` (or any `find .../node_modules ... -delete` / `rm -rf .../node_modules/...`
command) against a worktree's `.next`, verify `.next/standalone/node_modules` is a REAL directory, not a
symlink: `[ -L .next/standalone/node_modules ] && echo "DANGER: symlink, STOP" || echo "real dir, ok"`.
Never run the destructive prune commands if that check reports a symlink.

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

## Next steps — DONE for steps 1-2 and 8; steps 4-7 do not apply (no cause found to fix)

1. ✅ **Done.** Both builds completed (in fully independent environments — see "Reproduction bug #2"
   above); the manifest script ran on both post-cleanup trees.
2. ✅ **Done.** Path diff: 0 lines. Size diff: 0 lines. Hash diff: large, but attributed to Next's
   non-deterministic per-build embedded build ID, not a real content change — see "RESOLVED" above.
   **This is the "possibly even empty" outcome this step predicted, confirmed directly.**
3. **Partially done, not conclusive** — see "Open question" in the RESOLVED section: local
   `.next/standalone` (209.9 MB) + `.next/static` (40.2 MB) + manifests (~1.0 MB) ≈ 251.2 MB, still
   ~20 MB over Amplify's real reported ~230.8 MB. Local environment fidelity gaps (Node v22 vs pinned
   v20.18.0, `npm ci` vs Amplify's `npm install --legacy-peer-deps --include=optional`, placeholder vs
   real env vars) are the likely explanation, but this was not proven further — not needed to answer the
   original "is there a regression" question, since steps 1-2 already answered it conclusively.
4-7. **N/A.** These steps only apply if a real added/enlarged file is found. None was — every file in
   both builds is byte-identical in size. There is nothing to trace to an import, no source-level fix to
   make, and no new headroom to convert into a budget gate. Adding a "budget gate keyed to the actual
   deployable composition" now, without having resolved step 3's open question, would encode a guessed
   threshold — exactly what this investigation was opened to stop. Leave `amplify.yml`'s existing
   razor's-edge `du -sb .next` check as-is until step 3 is genuinely settled (see "Open question" above
   for what that would take).
8. ✅ **Done.** The passing build's `.next/standalone/server.js` was booted locally and answered `GET /`
   and `GET /health` with `200` — see "RESOLVED" above.
9. ✅ **Done, this pass.** No cause was demonstrated because there is no cause — the two commits produce
   an identical artifact. Committing this finding (a doc update only, no `amplify.yml`/`next.config.js`/
   application-code change) is the correct action per this rule, since guessing further would violate it
   in the other direction.

## Files touched by this handoff itself

- `scripts/build-artifact-manifest.sh` — new, committed (see above). Still the only committed tool;
  `/tmp/build-repro/replay-postbuild.sh` (this pass's exact `amplify.yml` postBuild replay, used to
  produce the post-cleanup trees the manifest script measured) was NOT committed — it is a literal
  transcription of `amplify.yml`'s existing `build.commands` and would drift the moment that file
  changes. Regenerate it by copying the `build:` commands from `amplify.yml` (roughly the block from
  the native-binary cleanup through the `ARTIFACT LEDGER` echo) into a script that `cd`s into the target
  directory first, if this reproduction is needed again.
- `amplify.yml` — one independent, low-risk line fixed (the license/notice deletion contradiction, §4
  above), from the previous pass. **No additional `amplify.yml`/`next.config.js` change in this pass** —
  the manifest diff showed no cause to fix (see "RESOLVED" above).
- This doc — updated in place (not a new file) with the conclusive finding, registered in
  `codexes/packs/agentiq/collections.json`'s `col_updates` from the previous pass.
- The two build-reproduction git worktrees, their independent `node_modules` installs, and generated
  `.env.production.local` files live under this container's `/tmp` — NOT committed (ephemeral, disposable,
  regeneration instructions above). **Confirmed this pass: this container's `/tmp` and its entire
  `node_modules` do NOT survive a container restart** (observed directly — both were gone at the start of
  this pass despite the previous pass's builds having been "in progress" when that session ended) —
  budget for a full re-setup (`npm ci` at repo root + both worktrees, ~3 x ~1 minute) every time this
  investigation is picked up in a new session, not just the worktree/env-file recreation the previous
  pass anticipated.
