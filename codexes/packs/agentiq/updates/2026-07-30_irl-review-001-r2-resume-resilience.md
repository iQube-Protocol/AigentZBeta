# IRL-REVIEW-001 — R2 Resume Resilience + Honest Coverage Reporting (2026-07-30)

**Trigger:** the vP1 live run's R2 pass refused at `batch-011` on an HTTP 429 from the provider.
Per the frozen state at that point: `R1: COMPLETE` (all batches accepted), `R2: 11 batches
complete, batch 011 unresolved`. Package integrity remained `VERIFIED` (the refusal is a batch
dispatch failure, not a package-construction defect). No aggregate adjudication or crystal
admission was issued — this is a status update on resilience work, not a review conclusion.

**Status: `Status: REFUSED — R2 INCOMPLETE / R1: COMPLETE / R2: 11 batches complete, batch 011
unresolved / Package integrity: VERIFIED / No review conclusion issued.`** This status is
preserved verbatim per the operator's instruction and is not to be reworded in any future summary
of this run.

**Test status:** targeted (`tests/independent-review-capability.test.ts` 82/82,
`tests/independent-review-batching.test.ts` 20/20, `tests/independent-review-lab-surface.test.ts`
33/33, `tests/experiment-relation.test.ts` 48/48) and full suite (186 files / 3344 tests) green.

## What changed

### 1. 429-aware retry, distinguished from a genuine adjudication failure

`services/agents/_lib/llmDraftHelper.ts`'s `callVeniceChatRaw` now reads the `Retry-After` header
on a failed response and returns it (`retryAfterSeconds: number | null`) alongside the existing
`ok`/`status`/`text`/`error` fields — additive, present in every return branch.

`services/research/review/types.ts`'s `ReviewRefusal` now optionally carries `httpStatus` and
`retryAfterSeconds` (both additive — every existing two-argument constructor call is unaffected).
`services/research/review/providers.ts`'s Venice `adjudicate()` and `listModels()` populate them
when a call fails.

`services/research/review/batching.ts`'s per-batch retry loop (`runBatchedAdjudication`) now backs
off before a retry rather than re-dispatching immediately:

- **HTTP 429 with a `Retry-After` value** — waits that many seconds (capped at 30s).
- **HTTP 429 with no `Retry-After`, or any other transient dispatch failure** (isolation breach,
  cross-batch contamination, malformed output, network error) — bounded exponential backoff with
  jitter (1s base, doubling per attempt, capped at 30s).

Each recorded `BatchAttemptRecord` now carries `failureCategory: 'rate-limited' | 'transient'`, so
a capacity condition is distinguishable from a genuine adjudication failure when reading the audit
trail after the fact — even though both back off the same way before the next attempt.

**The jitter itself is deterministic**, derived via `commit({ reviewerSlot, batchId, attempt })`
rather than `Math.random()` — `services/research/review/` reads no clock and no random source
(the reproducibility guarantee `tests/independent-review-capability.test.ts` canaries at the file
level), so a retry-delay computation does not get an exception carved out for itself.

### 2. Honest coverage reporting — no more "478 rows to second review"

Root cause of the 478-vs-464 discrepancy (found and fixed in this same window): an unguarded push
of every `packageExclusions` ref into `byRule['proposed-exclusion']` in
`services/research/review/coverage.ts`, without checking the ref was actually a subject in the
package. Out-of-boundary rows (style/narrative, excluded from the confirmatory population by the
2026-07-29 ruling) are not part of the 464-subject package and cannot be dispatched to R2 — they
are informational context for the operator, not a coverage-set member. Fixed with the same
`byRef.has(ref)` guard already used for `mechanicallyFlagged`.

The CLI (`scripts/run-independence-review.ts`) now prints the honest breakdown instead of one
opaque total:

```
Live Invariant Corpus: 478 rows.
  pre-boundary:                             478
  excluded by namespace boundary (14 — style:8, narrative:6)
  frozen package (in boundary):             464
  ...
  mechanically flagged (union, any rule): <n>
  by rule (a row may match more than one — this is a breakdown, not a partition):
    mentions-experiment-or-target      <n>  — mentions the experiment, its tasks, arms or expected outcomes...
    created-or-revised-after-cutoff    <n>  — created or materially revised on or after 2026-07-27...
    unresolved-chronology-or-provenance <n> — chronology or provenance cannot be resolved from the record...
    flagged-by-sample-review           0    — flagged for individual review by the stratified sample review
```

`expP1MechanicalFlagsByRule` (new, `templates/expP1Admissibility.ts`) computes the per-rule
breakdown; `expP1MechanicalFlags` (the existing union) is unchanged so nothing downstream that
already depends on it is affected. `independentReviewPlan.ts`'s `ReviewPlan` gained
`outOfBoundaryByNamespace` and `mechanicallyFlaggedByRule`/`mechanicallyFlaggedRuleReasons` —
additive fields only; `app/api/research/review/route.ts`'s existing field reads are unaffected.

### 3. Operator-directed full coverage, reported under its own honest category

For the vP1 run specifically, the operator directed that R2 see every subject in the package —
not because a per-row rule fired for all 464, but as a run-level decision. `coverage.ts` gained an
optional `fullCoveragePolicy` input; when set, every subject not already selected by a mandatory
rule or the stratified sample is added and returned under `addedByFullCoveragePolicy` — **never**
folded into `byRule['mechanically-flagged']` or any other rule bucket, which would misstate an
operator policy as a per-row finding. `runner.ts`'s `runDualReview` threads the flag through to
`selectReviewer2Coverage`, and its `coverage` step message now reports the full `byRule` breakdown
plus the `operator-directed-full-coverage` count when present, instead of a single subject count.

The CLI exposes this as `--full-coverage` (new flag, defaults off) — an explicit, visible choice
for this run, not a change to the template's ratified `EXP_P1_COVERAGE.sampleRate`.

### 4. Configurable batch size / max attempts for the R2 resume pass

`scripts/run-independence-review.ts` gained `--batch-size=<n>` and `--max-attempts=<n>` (defaults
unchanged: `DEFAULT_BATCH_SIZE`, `DEFAULT_MAX_ATTEMPTS_PER_BATCH`). Both are still recorded in the
pre-run manifest via `runDualReview`'s existing `batching` option, so a smaller batch size for a
resumed pass is a visible, auditable choice.

## What did NOT change in this slice

- **R1 is frozen as complete and is not rerun.** Nothing in this change re-executes R1; the CLI's
  `--execute` path still dispatches both passes from scratch, because true resume (reusing R1's
  already-accepted batch attempts and R2's first 11 accepted batches from the interrupted run,
  without re-deriving an identical `createdAt`-pinned package) requires checkpoint persistence
  that is **not yet built** — see below.
- **No `--resume=<path>` CLI flag yet.** `runBatchedAdjudication`'s `resumeFrom` parameter (hash-
  verified per batch) already exists and is exercised by tests, but nothing in the CLI persists
  attempt records to disk or reconstructs the original `createdAt` to rebuild an identical package
  for a resumed run. This is the next piece of this work, not yet done.
- **Deterministic partitioning, manifest commitment, reviewer isolation, canonical merge order,
  and fail-closed completeness are all unchanged** — this is a resilience and reporting amendment,
  not an architecture change.

## Remaining (tracked, not yet done)

- Checkpoint persistence: write each accepted `BatchAttemptRecord` to disk as it completes (rather
  than only at full-run success), so an interrupted run's completed batches are not lost.
- `--resume=<path>` CLI flag: reuse the exact original `createdAt` to rebuild an identical package,
  verify package hash / manifest hash / model IDs / rubric version / prompt hash / batch membership
  against the checkpoint before reusing any accepted attempt, and dispatch only the unresolved
  batches (rulings §6, "resume safety" — the mechanism already exists in `batching.ts`; the CLI
  wiring does not yet).
- Re-run R2 from batch-011 once the resume path exists, with `--batch-size=8 --full-coverage`,
  concurrency already 1 (the dispatch loop is sequential — no change needed there).

## Where this lives in code

- `services/agents/_lib/llmDraftHelper.ts` — `retryAfterSeconds` on `VeniceChatResult`.
- `services/research/review/types.ts` — `ReviewRefusal.httpStatus` / `.retryAfterSeconds`.
- `services/research/review/providers.ts` — Venice provider populates both on failure.
- `services/research/review/batching.ts` — `computeBatchRetryBackoff`, `failureCategory`.
- `services/research/review/coverage.ts` — the `packageExclusions` guard fix, `fullCoveragePolicy`.
- `services/research/review/runner.ts` — `fullCoveragePolicy` threaded through, honest step message.
- `services/research/review/templates/expP1Admissibility.ts` — `expP1MechanicalFlagsByRule`.
- `services/research/independentReviewPlan.ts` — `outOfBoundaryByNamespace`,
  `mechanicallyFlaggedByRule`, `mechanicallyFlaggedRuleReasons`.
- `scripts/run-independence-review.ts` — honest CLI output, `--batch-size`, `--max-attempts`,
  `--full-coverage`.
- `tests/independent-review-capability.test.ts` — updated coverage fixture (`excluded-1` is now a
  real subject, matching the guard fix rather than encoding the bug it fixes).
