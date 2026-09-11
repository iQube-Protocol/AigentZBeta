# IRL-REVIEW-001 — deterministic batched adjudication dispatch (the 464-subject fix)

**Date:** 2026-07-29
**Capability:** `IRL-REVIEW-001` — Independent Review
**Spec:** `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md`
**Prior build doc:** `codexes/packs/agentiq/updates/2026-07-29_irl-review-001-phase-1-adjudication-workflow.md`
**Status:** built, canary-covered, **not run against the live corpus**. Consumer call
signatures are unchanged; the operator can run the live 464-row review with no code changes
on their end.

---

## 1. The confirmed defect this fixes

A live run against the real 464-subject corpus asked one reviewer (R1) to adjudicate all 464
subjects in a single completion. Result: **1 decision returned, 463 `unanswered`**. Raising
`DEFAULT_DETERMINISM.maxTokens` from 8000 to 32000 changed **nothing** — identical result. R2
also failed on the same run with an aborted/timed-out call.

This proves the failure is **not a token-budget problem**. The model cannot reliably track
hundreds of individual adjudications across one completion regardless of how much room it has
to answer. The fix is architectural, not a bigger ceiling: partition each reviewer's package
into deterministic batches, adjudicate each batch independently, validate completeness per
batch, and merge canonically.

This is a **dispatch-layer correction**. It does not touch the frozen corpus, the review
question, the rubric, or (as far as it was possible to avoid) the external call shape either
consumer uses.

---

## 2. What shipped

| Concern | Where |
|---|---|
| Deterministic batch plan (partition + per-batch hash bound to package + manifest) | `services/research/review/batching.ts` — `buildBatchPlan` |
| Batched dispatch, per-batch retry, per-batch fail-closed validation, resume | `services/research/review/batching.ts` — `runBatchedAdjudication` |
| Completeness assertion callers can apply independently | `services/research/review/batching.ts` — `assertReviewerComplete` |
| Runner wiring — R1 and R2 both dispatch through the batch plan | `services/research/review/runner.ts` — `runDualReview` |
| Per-call scripted responses (one response per batch, not one per model id) | `services/research/review/providers.ts` — `createScriptedProvider({ respond })` |
| Canaries (20, all mutation-verified where a guard exists) | `tests/independent-review-batching.test.ts` |

`parseAdjudication` (`adjudication.ts`) is **reused unmodified** at the batch level — the
batching layer wraps it with per-batch dispatch, retry and merge; it does not fork the parser
or its fail-closed unanswered/unsolicited/invalid-label behaviour.

---

## 3. The batch size and token ceiling — and why

**Batch size: 32 subjects. Frozen into `PreRunManifest.batchSize`, configuration-backed
(`DEFAULT_BATCH_SIZE` in `batching.ts`), never hardcoded somewhere the manifest can't see it.**

- 464 subjects → 15 batches (14 full batches of 32, one of 16).
- Each completion asks for far fewer adjudications than a single 464-row call needed, well
  within what the model has already shown it can track reliably in the smaller EXP-P1 fixture
  runs.
- Each call is far less exposed to the provider's 180-second timeout (`createVeniceProvider`'s
  `timeoutMs`, unchanged) — a batch that times out costs one retry of ~32 rows, not the whole
  reviewer pass.
- Deterministic, inspectable, reproducible: `buildBatchPlan` is a pure function of (reviewer
  slot, package hash, manifest hash, frozen subject order, batch size) — no clock, no
  randomness, no response ordering enters batch membership.

**Token ceiling: left at 8000 (`DEFAULT_DETERMINISM.maxTokens`, unchanged).** The operator's
local 32000 experiment during diagnosis is **not carried forward** — it was already proven not
to be the fix (the 32-and-8-thousand-token single-call runs produced the identical 1-decision
result), and per the ruling that produced this fix, a bump is only warranted "after a measured
canary." No live Venice call was made in this session (no `VENICE_API_KEY`, and this was a
code-and-tests task). 8000 tokens for a 32-row batch is generous headroom relative to the
~8000-token ceiling that previously had to cover 464 rows; if the operator's first live batched
run shows batches finishing with room to spare or, conversely, truncating near the ceiling,
adjust `DEFAULT_DETERMINISM.maxTokens` from the measured `finishReason` — this is exactly the
per-batch telemetry `BatchAttemptRecord` is shaped to support (see §5).

---

## 4. Pipeline order — unchanged, now batch-aware

```
Frozen package → deterministic batches → R1 batch adjudications → R1 completeness validation
→ R2 batch adjudications → R2 completeness validation → canonical merge
→ agreement and disagreement analysis
```

R1's batch plan is committed against `preRunManifest.manifestCommitment` **before any provider
is called** — same timing guarantee the manifest already gave the rest of the run. R2's batch
plan is committed the moment R2's coverage-selected subject list is known, which is **before
R2's first call** but necessarily **after** R1 completes — this is not a new asymmetry, it
mirrors the pre-existing, deliberate rule in `coverage.ts`: "WHICH rows R2 sees may depend on
R1; WHAT R1 said about them may not." Batching didn't relax that boundary; it just gives the
already-asymmetric coverage step a deterministic, hashed partition of its own once the subject
list exists.

Reviewer isolation (`assertPromptCarriesNoPriorAdjudication`) is now applied **per batch** — R2
gets a fresh isolation check on every batch's composed prompt, not once for one giant prompt.
Canaried directly (`tests/independent-review-batching.test.ts` — "no R1 decision material
enters any R2 batch request payload").

---

## 5. Fail-closed shape, at the batch level

| Failure | Behaviour |
|---|---|
| A row missing from an otherwise well-formed batch response | Recorded as `unanswered`, exact ref preserved — never inferred or defaulted (unchanged `parseAdjudication` contract, now scoped per batch and merged) |
| A row answered that belongs to a **different batch** | `cross-batch-contamination` refusal, naming the ref |
| The same `subjectRef` answered **twice within one batch** | `duplicate-batch-decision` refusal — never last-write-wins |
| A batch that cannot produce a valid response after `maxAttemptsPerBatch` attempts | `batch-adjudication-failed` — the run stops; a batch that cannot be completed is not recorded as a passing one |
| A resumed attempt whose `batchHash` no longer matches the current plan | `resume-batch-hash-mismatch` — refuses to reuse an answer against a stale plan |

Retries (`maxAttemptsPerBatch`, default 2) reuse the **identical** batch membership, prompt,
model id and determinism settings — never a different one — and every attempt (accepted or
not) is kept in `BatchAttemptRecord[]` (`RunArtifacts.r1BatchAttempts` /
`r2BatchAttempts`) for audit: `batchId`, `batchHash`, `attempt`, `rawOutputRef`, `outputHash`,
`accepted`, `failureReason`. Retry is scoped to the failing batch only — it never restarts
earlier, already-accepted batches, and a batch present in an optional `resumeFrom` list (with a
matching `batchHash`) is reused rather than redispatched, so a rerun after a partial failure
executes only the unresolved batches.

Merge is by the **original frozen manifest order** — `input.subjects`, which is `pkg.subjects`
itself for R1 and the coverage-filtered, order-preserved subset of it for R2 — never response
order, batch completion time, or retry order.

---

## 6. Consumer call signatures — unchanged

Both consumers (`scripts/run-independence-review.ts` and `app/api/research/review/route.ts`
via `services/research/independentReviewPlan.ts`) call `runDualReview(input)` with the exact
same required fields as before. Batching is wired in as two **optional** additions to
`RunDualReviewInput`:

```ts
batching?: { batchSize?: number; maxAttemptsPerBatch?: number };   // defaults: 32, 2
resumeFrom?: { r1?: readonly BatchAttemptRecord[]; r2?: readonly BatchAttemptRecord[] };
```

Neither consumer passes either field today, so neither needs a code change to get batched
dispatch — omitting them yields the frozen defaults. `RunArtifacts` gained four additive
fields (`r1BatchPlan`, `r2BatchPlan`, `r1BatchAttempts`, `r2BatchAttempts`); existing
destructuring in both consumers ignores unknown fields, so this is non-breaking.

**What did change, necessarily:** `PreRunManifest` gained `batchSize` and
`maxAttemptsPerBatch` fields (ruling §1 requires the batch size be frozen into the manifest,
not hidden inline), and `RunArtifacts.rawOutputs` / the receipt's `rawOutputCommitments` now
contain **one entry per batch per reviewer** instead of one entry per reviewer — for the live
464-row corpus that's up to 15 raw outputs per reviewer instead of 1. This is the intended,
documented shape of the fix (each batch's raw response is independently hashed and retained for
audit) and is purely additive to an array both consumers already treat as a list, not a
fixed-length tuple.

**The web route's separate known issue (HTTP gateway 504 on long synchronous dispatches) is
explicitly out of scope here.** Batching makes each individual provider call much faster, which
may incidentally help, but fixing that gateway-timeout problem is flagged for a future
async-dispatch redesign of the route itself, not this change.

---

## 7. Canaries (20, in `tests/independent-review-batching.test.ts`)

| Canary | What it proves | Mutation-verified |
|---|---|---|
| Deterministic partitioning | Same manifest → same batch ids, membership, order, hashes; a different package/manifest hash changes every batch hash | — |
| Full reconstruction | Flattening all batches reproduces every original `subjectRef` exactly once, in canonical order | — |
| Missing response fails closed | `assertReviewerComplete` names the exact missing ref; a batch missing one decision surfaces that exact ref as `unanswered` | Yes — shows the primitive alone (without the wrapper) still reports it, then shows the wrapper preserves that through multi-batch assembly |
| Duplicate response fails | A batch answering the same `subjectRef` twice is rejected | **Yes** — first shows `parseAdjudication` alone does NOT reject the duplicate (both rows kept), then shows the batching guard does |
| Cross-batch contamination fails | A batch answering for a subject in a different batch is rejected | **Yes** — shows the same payload is NOT rejected when there's no batch boundary (whole-package `expectedSubjectRefs`), proving the per-batch boundary is what does the work |
| Reviewer isolation across every batch | No R1 material appears in any R2 batch prompt; a leak in any single batch's prompt is caught by the SAME gate | — (reuses the already-canaried `assertPromptCarriesNoPriorAdjudication`) |
| Resume safety | A rerun with `resumeFrom` redispatches only the unresolved batch; a provider that would throw if called for an already-resolved batch is never called for it; a stale `batchHash` in `resumeFrom` is refused | — |
| Oversized package guard | A 100-subject batch plan is NEVER dispatched in one call (4 calls, never 1); driving the FULL `runDualReview` at 70 subjects confirms the runner itself always routes through the batch plan, never a legacy single-shot path | Directly demonstrates the guard by counting provider calls |
| Idempotent retry | A retry reuses the identical prompt; the accepted attempt number is recorded; a batch that exhausts retries fails the run rather than being recorded as passing | — |
| Completion before agreement | Pipeline order is unchanged and batch-aware: last R1 batch call → coverage → first R2 batch call → last R2 batch call → resolution | — |

Full existing suite (`tests/independent-review-capability.test.ts`, 82 tests, and
`tests/independent-review-lab-surface.test.ts`, 33 tests) passes **unchanged** — no test in
either file was modified. Both rely on a 4-subject fixture, which fits in a single 32-row
batch, so the pre-existing single-batch-per-reviewer assertions (`rawOutputs` length 2,
`rawOutputCommitments` length 2) hold exactly as before.

---

## 8. Test suite / typecheck results

**Full suite:** `npx vitest run` — **185 test files, 3331 tests, all green**, with only this
session's changes applied. (Two other Claude Code sessions are working concurrently in this
same tree, in `data/codex-configs.ts`, `services/research/researchWorkspace.ts`,
`services/research/researchWorkspaceViews.ts`, `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx`,
and `services/horizen/*` — none of which this change touches. Their in-progress, uncommitted
edits transiently fail 24 tests in 4 unrelated files; stashing those files and rerunning
confirms all 185 files / 3331 tests pass with only the batching change present, and restoring
their WIP reproduces the same 24 failures independent of this change.)

**Typecheck:** `npx tsc --noEmit` fails **repo-wide**, before and after this change, because
`tsconfig.json`'s `ignoreDeprecations: "6.0"` is not a value the installed TypeScript (5.9.3)
accepts (`TS5103`) — confirmed pre-existing by stashing this session's diff entirely and
reproducing the identical failure on the base commit. Patching that one value in a throwaway
diagnostic copy of `tsconfig.json` (never committed) surfaces exactly the **same single
pre-existing, unrelated error** as before this change: `TS2688` — `types/iqube` cannot be
resolved as an implicit type-library entry. Zero errors in any file this change touches
(`batching.ts`, `runner.ts`, `providers.ts`, `index.ts`,
`tests/independent-review-batching.test.ts`).

---

## 9. Flagged rather than decided

1. **Not run against the live corpus.** This session had no `VENICE_API_KEY` and this was a
   code-and-tests task per the operator's instruction. The operator runs the live batched
   464-row review and the batch-size canary next.
2. **Token ceiling left at 8000 per batch, unmeasured against a real 32-row completion.** If
   the first live run's `BatchAttemptRecord`s show batches truncating near the ceiling, raise
   `DEFAULT_DETERMINISM.maxTokens` — 12,000–16,000 is the acceptable range per the ruling — but
   only after that measurement, not preemptively.
3. **Sequential dispatch, not parallel.** Batches for one reviewer are awaited one at a time.
   The ruling permits either; sequential was chosen for this pass because it keeps raw-output
   ordering trivially reproducible and avoids concurrent-request concerns against the Venice
   endpoint. Parallelising per-reviewer batch dispatch (with the same fail-closed/retry
   semantics) is a follow-on if the live run's wall-clock time matters enough to warrant it.
4. **`resumeFrom` is wired into `runDualReview` and canaried, but neither consumer persists
   `BatchAttemptRecord[]` to reuse it across process runs.** Both consumers currently omit it.
   Wiring persistence (so a genuinely interrupted live 464-row run can resume without
   redispatching completed batches) is a follow-on once the operator has run the live review
   once and knows whether interruption is a real operational concern.
