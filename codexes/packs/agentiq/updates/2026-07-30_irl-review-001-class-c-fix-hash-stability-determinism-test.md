# IRL-REVIEW-001 — Class C block-rule fix, package-hash stability, reviewer-slot control, and the determinism test (2026-07-30)

This closes out the work opened in commit `354be3796` ("Fix Class C block rule + package-hash
stability; add reviewer-slot control"), whose own commit message left three items explicitly open:
a standalone `--reviewer=r1` dispatch, a determinism test, and this doc. See
`codexes/packs/agentiq/updates/2026-07-30_irl-review-001-checkpoint-resume.md` for the checkpoint/
resume work that precedes this, and for the full vP1 `REFUSED — NON-RECOVERABLE EXECUTION` history.

**No live Venice call was made anywhere in this work.** No `VENICE_API_KEY` was set or used.

## 1. The Class C block-rule fix

A live `--preview` run against the real corpus (run by the operator/prior session, reproduced here
against a fabricated corpus shaped identically — see §4) showed `unresolvedChronologyOrProvenance`
in `services/research/review/blockDecision.ts` extracting **all 402/402** Class C rows, defeating
the ratified block ruling outright: a block rule that extracts everything is not a block decision,
it is a namespace filter with a ruling attached to it.

**Root cause:** the rule's OLD test was `!r.createdAt || r.sourceProvenance === null ||
(r.sourceRefs.length === 0 && r.derivationRefs.length === 0)`. Most of the corpus predates a
provenance-CLASS tagging convention that was never retrofitted onto existing rows — so nearly every
row carries `sourceProvenance: null` despite having real `sourceRefs`, `derivationRefs`, and a real
`createdAt`. A missing provenance-class LABEL is not the same fact as missing chronology/provenance
EVIDENCE, but the old rule conflated them.

**Fix:** the `sourceProvenance === null` disjunct was removed. The rule is now:

```ts
test: (r) => !r.createdAt || (r.sourceRefs.length === 0 && r.derivationRefs.length === 0),
```

— it fires only when the record itself cannot establish when or how it arose (no creation date, or
neither a source nor a derivation trail), which is what the ratified ruling's "insufficiently
evidenced" exception actually describes.

### Before / after (verified in this session — see §4 for how, given an environment constraint)

| | Assessed | Extracted (this rule) | Admitted |
|---|---|---|---|
| Before the fix (old test, reproduced) | 402 | 402 (100%) | 0 |
| After the fix (current test, reproduced) | 402 | 2 (the genuinely-unresolved rows only) | 400 |

`blockDecision.ts` also gained `blockExtractionByRule(b)` — returns `{ byRule: Record<ruleId,
subjectRef[]>, multiRuleCount }` — so a run's console output reports extraction counts **per rule**
(`mentions-experiment-or-target`, `created-or-revised-after-cutoff`,
`unresolved-chronology-or-provenance`, plus any `flaggedBySampleReview` rows), not one opaque
aggregate. Wired into `scripts/run-independence-review.ts`'s block-decision print block.

## 2. Package-hash / reviewId stability fix

`buildReviewPackage` (in `services/research/review/reviewPackage.ts`) previously hashed the
caller-supplied `createdAt` directly. `createdAt` is a fresh wall-clock value on every invocation of
the CLI or the Lab route, so the SAME corpus content produced a DIFFERENT `packageHash` every time —
"no clock read inside this module" is not the same guarantee as "no run-varying value folded into
the content commitment" when the caller's own timestamp gets hashed anyway.

**Fix:**
- `reviewPackage.ts`: `createdAt` is excluded from the hashed body (`const { createdAt,
  ...hashableBody } = body; return { ...body, packageHash: commit(hashableBody) }`). `createdAt`
  remains a real field on the returned `ReviewPackage` — useful metadata (when this instance was
  constructed) — it is simply not part of what `packageHash` proves. `verifyPackageHash` was updated
  to match (strips `createdAt` before recomputing).
- `services/research/independentReviewPlan.ts`: `reviewId` is now derived from actual package
  CONTENT — sorted subject refs + the block decision's own `assessed`/`admitted`/extracted-refs —
  instead of `commit({ v: input.version, at: input.createdAt })`. Two builds from the identical
  corpus now produce identical `reviewId` → identical `packageId` → identical `packageHash`,
  regardless of when either build happened to run.

Execution/run metadata (when a run started, wall-clock timestamps) still belongs in the run
manifest (`checkpoint.ts`'s `RunManifestRecord`), never in the frozen content commitment — this fix
does not change that split, it just stops `createdAt` from leaking into the wrong side of it.

## 3. Reviewer-slot control

- `services/research/review/runner.ts`: `RunDualReviewInput` gained `reviewerMode: 'r2-only'`. When
  set, `runBatchedAdjudication` is **never called for R1** — every R1 decision must already exist in
  `resumeFrom.r1`; the run refuses if any R1 subject lacks a decision there. This is what makes
  `--reviewer=r2` actually skip R1 dispatch rather than silently re-running it.
- `scripts/run-independence-review.ts`: `--reviewer=r1|r2|both` (default `both`).
  - `--reviewer=r2` requires `--resume=<dir>` and passes `reviewerMode: 'r2-only'` through to
    `runDualReview`.
  - `--reviewer=r1` **refuses** with an explicit message: *"an isolated, standalone R1-only dispatch
    that bypasses runDualReview entirely) is not yet implemented in this build... it must never
    silently fall back to running both passes."* See §5 for why this remains a refusal rather than a
    real implementation.

## 4. The determinism test — and an honest note on how it was verified

The operator asked for: *"Add a determinism test proving two builds from identical inputs produce
byte-identical package commitments."* Two tests were added to
`tests/independent-review-capability.test.ts`, in the existing "package construction and hashing
read no clock and no random source" describe block:

1. **`buildReviewPackage` level** — seals the same subjects/boundary/rubric/ruling twice with
   DIFFERENT `createdAt` values (`2026-01-01…` vs `2099-12-31…`) and asserts `packageHash` is equal
   on both, `verifyPackageHash` passes on both, and `createdAt` is still present and DIFFERS between
   the two (proving the fix excludes it from the hash without dropping it from the type).
2. **`buildReviewPlan` level** — the layer the CLI actually calls. A minimal fake Supabase-shaped
   client (`.from().select().order().range()`, no clock, no randomness of its own) serves a small
   fixed corpus. `buildReviewPlan` is called twice with different `createdAt` and the SAME corpus;
   `reviewId`, `pkg.packageId`, and `pkg.packageHash` are asserted equal across both calls, with
   `pkg.createdAt` still differing.

A third test proves the Class C fix directly and at scale: a **402-row fake population shaped
exactly like the real vP1 corpus** (400 rows with real `sourceRefs`/`derivationRefs`/`createdAt` but
`sourceProvenance: null` — the untagged-pre-convention majority — plus 2 genuinely-unresolved rows
with no refs at all) is run through `buildBlockDecision` with the real `expP1ClassCExceptionRules()`.
Before the fix this would extract all 402; after the fix it extracts exactly the 2 genuinely-
unresolved rows, admitting 400. This is the source of the before/after table in §1.

### Why this is a fabricated/synthetic corpus, not the live one — and why that's still valid evidence

This session's sandbox has an organization-level network egress policy that blocks the Supabase
project host (`bsjhfvctmduxhohtllly.supabase.co`) outright — `curl
$HTTPS_PROXY/__agentproxy/status` shows repeated `403` "policy denial" rejections for that host, and
the proxy's own guidance is explicit: *"do not retry organization policy denials — report them
instead."* This is a **separate, environment-level restriction** from the Venice restriction (which
this session avoided deliberately, per the operator's instruction never to call Venice or set a real
key) — it is not something this session can or should work around.

Concretely, this means:

- `npx tsx scripts/run-independence-review.ts --version=vP1 --preview` was attempted twice in this
  session and failed identically both times, with `Error: corpus read failed: Host not in
  allowlist: bsjhfvctmduxhohtllly.supabase.co` — a network-policy failure, not a code defect. It
  never reached the point of printing `package …` / `packageHash …`, so **this session could not
  reproduce the operator's own "run --preview twice, compare the printed hash" check against the
  real corpus.**
- What COULD be verified without any network access: direct code inspection of the three fixed
  files (confirming the described changes are actually present and correctly shaped — not just
  "looks plausible"), plus the synthetic-corpus tests above, which reproduce the EXACT reported
  shape of the bug (402 Class C rows, ~100% carrying a null provenance-class label with otherwise
  real refs) and the exact numbers from the operator's live preview (402 assessed). This is
  behavioural evidence, not a source-level assertion — the same `buildBlockDecision` and
  `expP1ClassCExceptionRules()` that the CLI calls are exercised end-to-end, just against fixture
  rows instead of a live Supabase read.
- The **stable package ID/hash across repeated builds** requirement (item 1 of the operator's list)
  is fully proven by the `buildReviewPlan`-level determinism test, which drives the identical code
  path (`buildReviewPlan` → `buildBlockDecision` → `buildReviewPackage`) the CLI drives — the only
  difference is the row source (in-memory fixture vs. a live `.range()` read), which is not part of
  what the determinism guarantee is about (the guarantee is about hashing not depending on
  wall-clock time, not about the corpus read itself).
- The **effective batch size (16)**, **R2 batch count (29)**, and **reviewer-pair-verification**
  lines from the operator's checklist require either `--execute` or a set `VENICE_API_KEY` to reach
  in the CLI's control flow (`scripts/run-independence-review.ts:413`) — with neither set, the CLI
  prints the corpus/block-decision/package section and then exits at *"VENICE_API_KEY not set — plan
  mode only, no reviewer pair verification performed."* `DEFAULT_BATCH_SIZE` was confirmed at
  `services/research/review/batching.ts:50` to be `16`, matching
  `2026-07-30_irl-review-001-batching-parameter-amendment.md`'s ratified default, but the CLI's own
  printed confirmation of that number for a specific run requires reaching the `--execute`/key-gated
  branch, which this session correctly did not trigger.

**This is reported explicitly rather than silently substituted or glossed over.** The operator
should re-run `npx tsx scripts/run-independence-review.ts --version=vP1 --preview` (twice) from an
environment with real Supabase network access to get the live-corpus confirmation of the exact
figures in §1's table and the batch-plan figures — the code-level fix and the synthetic-corpus proof
above are what this session can vouch for.

## 5. `--reviewer=r1` — still an explicit refusal, not implemented

`--reviewer=r1` continues to refuse with the message quoted in §3. A standalone R1-only dispatch
that bypasses `runDualReview` entirely would need its own checkpoint wiring (calling
`runBatchedAdjudication` directly for R1 only, its own `onBatchAccepted` persistence, its own run-
manifest state transitions ending at `R1_COMPLETE` rather than `COMPLETE`) — a small but real second
code path through the CLI, not a one-line addition. This session chose to leave it as an honest,
documented refusal rather than ship a partial implementation, per the instruction to implement it
fully or not at all. **Not implemented in this change.**

## 6. Test coverage added this session

`tests/independent-review-capability.test.ts`, "package construction and hashing read no clock and
no random source" describe block:
- `buildReviewPackage: identical subjects/boundary/rubric/ruling with DIFFERENT createdAt produce
  the SAME packageHash, and createdAt is still returned`
- `buildReviewPlan: two builds from an identical corpus produce byte-identical reviewId, packageId
  and packageHash, even from different createdAt`

"a block decision reports its exceptions rather than presuming none" describe block:
- `a null sourceProvenance LABEL alone does NOT extract a row that has real
  sourceRefs/derivationRefs/createdAt`
- `a Class C population dominated by untagged-but-evidenced rows (the vP1 shape) admits most of it,
  rather than extracting 100% (regression guard for the 402/402 defect)`

Full suite: `npx vitest --config vitest.config.mjs run` — 188 files / 3394 tests, green, no
regressions (the file/test count rose from the 187/3363 baseline recorded in the checkpoint-resume
doc because of concurrent work — `tests/pilot-treasury-authority.test.ts` — landing on this branch
from a separate, concurrently-running session in the interim; this session did not touch it).

## What is NOT done in this slice

- No live Venice call. No `VENICE_API_KEY` was set or used anywhere in this session.
- No live Supabase corpus read — blocked by this session's network egress policy (see §4). The
  operator's own before/after figures from the earlier live `--preview` run are quoted in §1 as the
  source of the original 402/402 finding; this session's contribution is the fix, the code-level
  verification, and the synthetic-corpus regression test reproducing the same numbers.
- `--reviewer=r1` remains an explicit refusal (§5).
