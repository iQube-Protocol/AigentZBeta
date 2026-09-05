# Track 2: auditing "Accept All High-Confidence (>95%)" and closing the gap for relationships (2026-09-05)

Operator audit request: the live Track 2 UI exposed `Accept All High-Confidence (>95%)` on both
the Stage 5 classification queue and the Stage 7 relationship queue, while observed machine
confidence tops out around 90%. Explicit instruction: do not simply replace 95 with 85 — trace the
actual confidence semantics first, and only replace the control if the evidence shows 95% is a bare
implementation/UI default rather than a ratified criterion.

## What was traced, and what it found

Both suggestion engines — `services/invariants/provenanceSuggestion.ts` (`suggestProvenanceClass`)
and `services/invariants/relationshipSuggestion.ts` (`suggestRelationships`) — call
`callSovereign('classification', ...)` and return a `confidence: number` field documented
identically in both files:

```ts
/** 0-100. The model's own estimate — advisory, never a measured probability. */
confidence: number;
```

Both clamp it via `Math.max(0, Math.min(100, Math.round(confidenceRaw)))`. There is no calibration
curve, no historical sampling against ground truth, and no persisted distribution anywhere in the
codebase for either pipeline — `confidence` is the LLM's raw self-report, on the same 0-100 scale,
for both provenance classification and relationship derivation. 90%, 85%, 95% carry no distinct
underlying meaning; they are just larger or smaller self-reported numbers from the same
uncalibrated estimate.

**`95` itself has no ratified source.** A repo-wide search found no governance record, no
experiment doc, no invariant, and no calibration study naming `95` (or any other percentage) as a
required threshold for provenance or relationship acceptance. The only place `95%` appears with any
apparent rigor is an unrelated statistical convention — bootstrap 95% confidence intervals in the
EXP-P1 experimental protocol README (`codexes/packs/irl/foundation/experiments/
exp-p1-representation-runtime-gauntlet/README.md`) — which is a different, legitimate statistical
concept (an interval estimator's coverage property) that has no relationship to an LLM's
self-reported classification confidence. It is circumstantial evidence for where "95% sounding
rigorous" may have been borrowed from, not proof, and is reported as such.

A fourth, unrelated mechanism was also traced and ruled out to avoid conflating it with the above:
`services/corpusScout/admissionRecommendation.ts`'s deterministic Stage-2 admission scoring
(`composeAdmissionRecommendation`) starts at `confidence = 1` and subtracts fixed penalties — no
`callSovereign` call, a 0-1 float scale, unrelated to the two audited buttons.

**Conclusion: `>95%` is a bare implementation/UI default, unreachable in practice for the current
EXP-P1 successor population, and carries no governance or scientific standing.** Per the operator's
own instruction, it is retired — not lowered to another arbitrary number.

## What changed

**Stage 5 (provenance)** already had a data-calibrated replacement as of 2026-09-03:
`ProvenanceCohortRatificationBoard` + `services/research/provenanceCohortPreparation.ts` +
`app/api/research/track2/[experimentId]/provenance-cohort/route.ts`. That fix was incomplete — the
dead `Accept All High-Confidence (>95%)` button in the manual `ClassificationQueue` still rendered
directly underneath the board. It is now removed.

**Stage 7 (relationships)** had no equivalent. Built by mirroring the Stage 5 triad exactly (per
this repo's "Extend, Don't Duplicate" rule — no new design was invented):

- `services/research/relationshipCohortPreparation.ts` (new) — `prepareRelationshipCohort(orphans,
  members)` calls `suggestRelationships` once per orphan (concurrent, never serialized), and marks
  a member `ready` only if a genuinely *writable* suggestion exists: never `contradicts` (skipped
  in favor of the next candidate regardless of its own confidence — a canonical invariant may only
  be quarantined by a human, never auto-related that way), never a suggestion that
  `wouldCreateCycle`. Everything else falls to a typed exception (`no-candidates`, `no-suggestions`,
  `no-writable-suggestion`) — no relationship is ever guessed. Confidence is carried through purely
  as informational context on the `ready` record; it never gates disposition.
- `app/api/research/track2/[experimentId]/relationship-cohort/route.ts` (new) — GET derives the
  cohort via the same `resolveSuccessorConstructionCohort` → `resolveFrozenPredecessorContext` →
  `reconcilePromotedCohort` chain every other cohort route uses, then
  `prepareRelationshipCohort`. POST ratifies: admin-gated, requires a steward rationale, stale-
  cohort protection via `expectedCohortHash` (409 `recommendation-set-changed` on drift), a dry-run
  preview branch, idempotent resume (re-checks `listEdgesForInvariants` per target and skips
  already-related members rather than re-writing), writes through `addEdge` (the one canonical
  edge writer — never a parallel write path), and records one lifecycle receipt per batch.
- `Track2ProgrammePanel.tsx` — new `RelationshipCohortRatificationBoard` component, rendered as the
  primary Stage 7 action (before the manual `RelationshipQueue`, which remains available for
  exceptions and manual override — never removed). The dead `acceptAllHighConfidence` batch
  function, its button, and its `batch` state were removed from both `ClassificationQueue` and
  `RelationshipQueue`. `HIGH_CONFIDENCE_THRESHOLD = 95` survives only as a per-item display-tier
  color constant inside the manual queues (never a batch-write gate) — it was not changed to
  another number, since no calibrated number was established for that purpose either.

## The resulting UX — a cohort count, never a percentage in the primary CTA

Per the operator's mid-task refinement, the primary control reads as a constitutional act, not a
statistics claim: **"Ratify relationship cohort — add N relationship(s)"** (Stage 5's equivalent
already read "Ratify provenance cohort — classify N item(s)"). The percentage is never the
authority; the steward's ratification is. Confidence is shown per-item as supporting context
(`{relationType} → {relatedLabel} · {confidence}% confidence`), never as the gate that gets a
recommendation written.

**What did not change, by design:** EXP-P1 scientific thresholds, `crystalCohortMembership.ts`,
`populationReconciliation.ts`, the remediation profile, namespace boundaries, Crystal membership
rules, and exception-isolation semantics — this pass only ever calls those as read-only resolvers,
never edits them. `contradicts` edges still can never be batch-accepted regardless of confidence —
quarantine still requires a human steward's own read of the conflict.

## Tests

New: `tests/relationship-cohort-preparation.test.ts` (9 tests — low-confidence-but-writable stays
`ready`; `contradicts` and cycle-creating suggestions always skipped in favor of the next
candidate; every exception cause proven independently; `suggestRelationships` called exactly once
per orphan, concurrently; never called when the candidate pool is empty).
`tests/relationship-cohort-route.test.ts` (auth, empty cohort, low-confidence-still-ready,
stale-cohort 409, dry-run bypasses staleness check, rationale required, real write calls `addEdge`
with the correct fields including `provenance.confidence`, idempotent resume via
`listEdgesForInvariants`, exceptions never written, one receipt per batch, a failed write counted
as `failed` not silently dropped). `tests/relationship-cohort-ui.test.ts` (15 tests — no
"Accept All High-Confidence" text/handler remains anywhere in the panel; the board renders before
the manual queue; the manual queue still exists; the board calls the real cohort endpoint with
`dryRun:false` + `expectedCohortHash`; the Ratify button is gated on rationale and `readyCount > 0`;
the primary CTA shows a real count and contains no `%`).

One real regression from removing `acceptAllHighConfidence`:
`tests/track2-steward-workflow.test.ts` had a test pinned to the now-deleted client function. Fixed
by rewriting it to assert the same constitutional guarantee — every accepted recommendation
declares `recommendation-accepted` per-record, even under a batch act — is enforced **server-side**
in the (unmodified) `provenance-cohort/route.ts` POST handler, since that is where the guarantee
now actually lives.

## Verification

Targeted (11 files, 179 tests): `relationship-cohort-preparation`, `relationship-cohort-route`,
`relationship-cohort-ui`, `provenance-cohort-preparation`, `provenance-cohort-route`,
`provenance-cohort-ui`, `relationship-suggestion`, `track2-suggest-relationships-route`,
`track2-steward-workflow` (67 tests, including the one fixed regression),
`provenance-suggestion`, `track2-relationship-adjudication-route` — all 179 passing.

Full regression (`npx vitest run`, 605 files / 10,042 tests): 15 files / 61 tests failing, zero
overlap with the 179 above. Confirmed by direct grep that none of the 15 failing files import
`Track2ProgrammePanel`, `relationshipCohortPreparation`, the new relationship-cohort route,
`provenanceCohortPreparation`, or the provenance-cohort route — these are pre-existing, unrelated
baseline failures (Journey Spine, Pulse transparency, myCanvas Article Zero, repo-weight budget,
resolution-records registry, canon-document resolution, corpus-scout, register-ceremony, KNYTS-
bridge parity, dev-merge-message-discipline).

`npx tsc --noEmit`: 1104 errors both with and without this change (confirmed by stashing the
Track2 diff and re-running) — this branch's own current baseline, unrelated to this pass; zero
errors in any file this pass touched or added.

**Not done, and not requested this pass:** merging to `dev` / confirming Amplify deployment — the
operator's instruction for this specific audit was to report the confidence-distribution/threshold-
provenance findings and implement the calibrated control, not to redeploy Track 2 to dev.
