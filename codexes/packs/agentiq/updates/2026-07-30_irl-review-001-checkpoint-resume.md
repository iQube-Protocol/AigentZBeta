# IRL-REVIEW-001 — Checkpoint Persistence + Resume (2026-07-30)

## Ruling on the interrupted vP1 run

The vP1 run that refused at R2 batch-011 is permanently:

```text
REFUSED — NON-RECOVERABLE EXECUTION
```

R1 completed cleanly (464/464 decisions, 0 unanswered, across 29 batches — confirmed from the
operator's saved console log, including two transient timeout-retries at batch-009 and batch-020
that each recovered on a fresh attempt). R2 completed 11 batches (000–010) before batch-011 failed
after 3 attempts (2 transient aborts, then an HTTP 429). None of this was persisted to disk before
the process exited — the CLI wrote artifacts only on full success — so there is nothing on disk to
resume from. The operator's saved console log is preserved as **operational evidence** of what
happened; it is explicitly **not** treated as a resumable artifact, per the ruling: *"Do not infer
or reconstruct row-level decisions from console summaries."* A fresh run must redo both R1 and R2
against the identical frozen package. This is an accepted, one-time cost — the operator separately
confirmed the reviewer work is no longer on the pilot's critical path, so there is no urgency to
redo it before Bitcent testnet/mainnet execution.

## What changed — checkpoint persistence

Every accepted batch is now persisted the moment it is accepted, never only at the end:

- `services/research/review/batching.ts` — `runBatchedAdjudication` gained an optional
  `onBatchAccepted` callback, fired (and awaited) immediately after each FRESH batch acceptance,
  never for a batch reused via `resumeFrom`. `BatchAttemptRecord` gained an optional `decisions`
  field so a resumed batch can be served from pre-parsed checkpoint content instead of needing raw
  provider text (checkpoints deliberately never store raw provider output — see below).
- `services/research/review/runner.ts` — `runDualReview` threads `onBatchAccepted` through both
  reviewer passes, plus `onR1BatchPlanReady` / `onR2BatchPlanFrozen` hooks fired the moment each
  reviewer's batch plan is built (BEFORE its first dispatch), so a caller can freeze the plan into
  its run manifest without repartitioning risk. `runDualReview` also gained an optional `startedAt`
  override — a resumed run MUST reproduce the identical pre-run-manifest commitment (every
  batchHash is bound to it), so `startedAt` lets a resume pin the manifest's `committedAt` to the
  original run's value while every other timestamp (`reviewedAt`, `completedAt`) is still read
  fresh from the injected clock.
- `services/research/review/checkpoint.ts` (new) — pure, IO-free identity/construction/
  verification logic, matching the directory's existing no-clock/no-randomness discipline:
  - `computeRubricHash()` / `computePromptHash()` — hash the rubric's and prompt template's
    SUBSTANTIVE content (not just their version strings), catching an edited rubric/prompt that
    wasn't accompanied by a version bump.
  - `buildRunIdentity()` — packageId/packageHash/preRunManifestHash + rubric/prompt version+hash +
    checkpoint schema version.
  - `BatchCheckpoint` — per the operator's exact field list: package/manifest/rubric/prompt
    identity, reviewer slot + model identity, batchId/batchHash, orderedSubjectIds, rawResponseHash,
    parsedDecisionHash, the parsed decisions themselves, attempt count, completion timestamp,
    checkpoint schema version. Deliberately **excludes** raw provider text, API keys, and hidden
    reasoning, per the operator's instruction.
  - `verifyCheckpointCompatible()` — checks every field individually (not one aggregate hash) so a
    mismatch says exactly what drifted, plus recomputes `parsedDecisionHash` from the checkpoint's
    own `decisions` to catch a tampered/corrupt file even when every identity field matches.
  - A 7-state run state machine (`CREATED → R1_IN_PROGRESS → R1_COMPLETE → R2_IN_PROGRESS →
    COMPLETE`, with `REFUSED_RESUMABLE` and `INVALIDATED` as the two off-ramps) and
    `assertValidTransition` — `COMPLETE` is reachable ONLY via `R2_IN_PROGRESS`, so a partial run
    structurally cannot produce a final result.
- `scripts/_lib/reviewCheckpointStore.ts` (new) — the actual filesystem adapter (atomic
  write-then-rename per file), living outside `services/research/review/` for the same reason
  `independentReviewPlan.ts` does (that directory imports no database client and, per its own
  canary, performs no IO of any kind). Named `_lib` rather than `lib` — a bare `lib/` pattern in
  `.gitignore` matches any directory named `lib` at any depth (the repo's existing convention for
  this exact collision is `services/agents/_lib/`).
- `scripts/run-independence-review.ts` — new `--resume=<run-directory>` flag. On resume: rereads
  the corpus with the ORIGINAL `packageCreatedAt` (refusing if the corpus no longer reproduces the
  identical package/reviewId — the corpus changed since the run began), re-verifies the pinned
  reviewer pair against the live catalogue and refuses on any identity drift, recomputes the
  pre-run manifest and refuses if it no longer matches the checkpointed one, loads and verifies
  every on-disk checkpoint against the current run identity before treating it as reusable, and
  marks the run `REFUSED_RESUMABLE` (printing the exact resume command) rather than losing progress
  when a batch exhausts its retries. `--batch-size` / `--max-attempts` are read back from the
  existing run manifest on resume rather than accepted fresh from the CLI — a resume must use the
  same batch size and exact batch membership as the run it resumes, so a conflicting flag refuses
  rather than silently repartitioning.

## Run directory layout

```text
codexes/packs/irl/foundation/reviews/<version>/<reviewId>/
  run-manifest.json
  r1/batch-000.json ...
  r2/batch-000.json ...
  final/review-result.json      (written ONLY at state COMPLETE)
  final/review-receipt.json     (written ONLY at state COMPLETE)
```

The existing flat-file artifacts (`${reviewId}.package.json` etc. under
`codexes/packs/irl/foundation/reviews/`) are unchanged and still written on full success — the
nested run directory is additive, not a replacement.

## Test coverage

`tests/independent-review-checkpoint.test.ts` (19 tests, all against the real `runBatchedAdjudication`
/ `runDualReview` / `checkpoint.ts` — no mocking of the runner itself):

- interruption after a completed batch preserves that batch (`onBatchAccepted` fires before the
  later batch's failure propagates)
- resume skips verified batches (provider never called for a checkpointed batch) and retries only
  the uncheckpointed one
- altered package hash / rubric hash / prompt hash / model identity (`resolvedModelId`) / reordered
  subject membership / tampered decisions (recomputed hash mismatch) / checkpoint schema version
  drift — each individually refuses reuse, verified against the SAME matching-checkpoint baseline
- a corrupt (unparseable) checkpoint file throws rather than being silently skipped; a well-formed
  one round-trips through the file store unchanged
- an unaccepted `BatchAttemptRecord` can never become a checkpoint
- the run-state machine forbids reaching `COMPLETE` from anything except `R2_IN_PROGRESS`
- a resumed run (R1 served entirely from checkpoints, R1's provider never called; R2 dispatched
  fresh) produces byte-identical `resolutions`/`tally`/`r1Decisions`/`r2Decisions` to an
  uninterrupted straight-through run over the same fixtures

Full suite: 187 files / 3363 tests, green.

## What is NOT done in this slice

- **No live Venice call was made as part of this work**, per the operator's explicit instruction.
- The vP1 run itself has not been re-executed — R1 and R2 both need a fresh dispatch against the
  identical frozen package, whenever the operator chooses to trigger it (confirmed off the pilot's
  critical path).
- No change to the deterministic partitioning, manifest commitment mechanics beyond the additive
  `startedAt` override, reviewer isolation, or fail-closed completeness semantics — this is
  persistence and resume, not an architecture change.

## Next live run

Once ready (VENICE_API_KEY confirmed set):

```bash
npx tsx scripts/run-independence-review.ts --version=vP1 --execute --batch-size=8 --full-coverage
```

This starts a FRESH, fully checkpointed run (both R1 and R2 from the beginning — there is nothing
to resume from the prior non-recoverable run). If it is interrupted for any reason, it will print
the exact `--resume=<path>` command to continue from its own checkpoints rather than losing
progress.
