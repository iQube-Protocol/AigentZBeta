# Repo-weight fix: removed dead-weight design-assets/metaMe binaries (2026-09-14)

**Status:** resolved. `tests/repo-weight.test.ts` now passes; the operator's flagged breach is closed.

## What was flagged

`npx vitest run tests/repo-weight.test.ts` failed: total tracked bytes were **116,395,201 bytes
(111.0 MB)**, against the `MAX_TRACKED_TOTAL_BYTES` budget of **103,000,000 bytes (98 MB)** — ~13.4 MB
over. Unrelated to the concurrent Vela Use Case Zero work; nothing under `services/vela/`,
`services/factor/`, `services/moneypenny/`, `app/(shell)/moneypenny/`, or `app/api/moneypenny/` was
touched by this fix (confirmed via `git status --short | grep`).

## Investigation

The per-file oversize check (`no NEW tracked file exceeds 1MB`) was passing throughout — no single
new file caused this. Diffing `git ls-tree -r -l` at the commit that last froze the budget
(`e1240c6f0`, 2026-08-02, repo at 93.25 MB) against HEAD (111.0 MB) showed 2,322 newly tracked files
(39.2 MB), 111 removed files (24.4 MB), and growth in existing files — organic, distributed
codebase growth across ~1,836 commits, with no single smoking-gun commit.

Within that growth, one identifiable, non-organic block stood out: **`design-assets/metaMe/{sources,iQube}/**`**
— 45 files, 19.4 MB of PNG/EPS/AI/CDR brand renders and per-colorway icon-size-ladder derivatives.
A repo-wide `grep -r design-assets` matched only `tests/repo-weight.test.ts` (the grandfather-list
entries) and one prose doc recording its own history — **zero application-code references anywhere.**

This material was not new. It originated from a 2026-09-07 Amplify **build-artifact-size** incident
(`2026-09-07_amplify-build-size-cap-incident-and-handoff.md`), which relocated
`public/metaMe/sources/` and `public/metaMe/iQube/` (~20 MB, "verified zero code references") out of
`public/` into `design-assets/metaMe/` to stop those bytes from being traced into the Next.js/Amplify
deploy artifact (`.next/standalone`, governed by the separate Amplify Build-Size Budget in
CLAUDE.md). **That fix was correct for the problem it solved** — but a relocation from one in-repo
path to another does not remove a single byte from `git ls-files`, which is what the repo-weight
budget (a different, whole-tree measurement) tracks. The 2026-09-07 fix's own grandfather-list
comment even said as much at the time: "still grandfathered debt, now at least not costing every
Amplify build its size budget" — correctly scoped to the artifact-size problem, silent on this one.
The other 36 files (icon-size-ladder derivatives under `iQube/`) were never individually over 1 MB,
so they were never grandfathered or flagged by the per-file check at all — they simply rode along as
untracked debt until the aggregate total-budget canary caught them here.

This closes the unresolved risk flagged in a prior repo-weight resolution
(`RES-2026-08-23-REPO-WEIGHT-PREEXISTING-HEADROOM-001`), which explicitly deferred exactly this kind
of triage to a dedicated pass rather than folding it into unrelated work.

## What was fixed

1. Computed a sha256 manifest of all 45 files and copied their bytes into this session's scratchpad
   before touching anything, so the original content is independently verifiable/recoverable.
2. Removed the 45 files from git tracking: `git rm -r design-assets/metaMe/iQube design-assets/metaMe/sources`.
   Left the small (8.7 KB) `design-assets/metaMe/CONSTITUTIONAL_BRAND_ASSETS.md` registry doc in
   place untouched — it's prose (provenance, usage rules, canonical hex values), not dense binary
   material, and CLAUDE.md's Dense Materials section explicitly permits "a JSON or Markdown record
   with the CID or storage path, title, hash, provenance" to stay in the repo.
3. Retired the 6 now-nonexistent `GRANDFATHERED_OVERSIZE` entries in `tests/repo-weight.test.ts`
   (the 2026-09-07 `sources/*` entries) with a dated retirement comment, following the file's own
   established pattern (see its existing 2026-08-15 `artifacts/build-info/...` retirement comment).
   Per CLAUDE.md's own text, deleting/relocating a grandfathered file "needs no permission and no
   bookkeeping" — no operator sign-off was required for this step.
4. Did **not** touch `MAX_TRACKED_TOTAL_BYTES` and did **not** add any new grandfathered entry.

## Result

| | Before | After |
|---|---|---|
| Total tracked bytes | 116,395,201 (111.0 MB) | 96,026,077 (91.6 MB) |
| Budget | 103,000,000 (98 MB) | 103,000,000 (98 MB, unchanged) |
| Margin | **−13.4 MB (failing)** | **+6.4 MB (passing)** |

`npx vitest run tests/repo-weight.test.ts` now passes all five `repo weight` assertions (the
separate `pdf-parse specialization` failure in the same file is a pre-existing, unrelated
environment condition in this worktree — `node_modules/pdf-parse` is simply not installed here;
it failed identically before this change and is out of this task's scope).

`git diff --stat` against the base commit shows exactly 46 files changed: the 45 deleted design
assets + the one test-file edit. Nothing under `services/vela/`, `services/factor/`,
`services/moneypenny/`, `app/(shell)/moneypenny/`, or `app/api/moneypenny/` was touched.

## What's still outstanding (not blocking, flagged for the operator / a future pass)

- **The removed bytes are not yet in Supabase Storage or Auto Drive** — CLAUDE.md's Dense Materials
  table says Media (design exports) belongs in Supabase Storage with the repo carrying only the
  storage path. This session has no verified live Supabase Storage upload path (no MCP
  storage-upload tool, and per CLAUDE.md's connector-verification rule, reachability must be
  confirmed, never assumed — even a reachable Supabase MCP here exposes only SQL/migration tools,
  not a blob-upload primitive), so uploading them was not attempted rather than guessed at. The
  original 45 files plus a sha256 manifest are preserved in this session's scratchpad directory;
  they are also recoverable from git history at the commit immediately before this one
  (`git show <that-commit>:<path>`) until any future history rewrite/prune. Completing the actual
  Supabase Storage upload and updating `CONSTITUTIONAL_BRAND_ASSETS.md` with the resulting path is
  the natural next step for whoever has real Supabase Storage credentials.
- **`codexes/packs/polity-core/items/commentary/constitutional-internet/`** (2.3 MB of book chapter
  drafts) is a genuine Dense-Materials-rule violation candidate — CLAUDE.md explicitly names
  "Manuscripts and long-form work — chapter drafts, book builds, exports" as never-commit material.
  **Not touched here**: it wasn't needed to clear the budget, and its canonical destination (still an
  active working draft → Supabase, vs. a ratified/frozen edition → Auto Drive with a CID) needs
  operator judgment this task's own instructions reserve for the operator, not an agent guess.
- **`docs/qubetalk-bridge/outbox/`** (0.62 MB across 28 files) is a growing, never-pruned
  accumulation of transient fire-and-forget bridge packets (CLAUDE.md's own bridge doc describes
  them as ephemeral relay payloads). Not touched here either; a future session could add a
  retention/pruning policy if this becomes a recurring budget pressure.

## Resolution → invariant loop

- Resolution record: `codexes/packs/agentiq/resolution-records/records/RES-2026-09-14-REPO-WEIGHT-DESIGN-ASSETS-METAME-001.json`
- Candidate invariant (status: `candidate`): `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-14-RELOCATION-WITHIN-REPO-DOES-NOT-EXIT-GIT-001.json`
  — the reusable lesson: relocating confirmed-dead material from one in-repo path to another solves
  whichever size budget is measured on a *subset* of the tree (here, the Amplify deploy-artifact
  budget) but does not solve a *different* budget measured on the whole tracked tree (here,
  repo-weight) — a fix scoped to one budget should be labelled as such, and "verified zero code
  references" found along the way is a standing invitation to finish the job (remove from git, or
  externalize with a pointer) rather than leave it as debt whose original justification has already
  been achieved.
