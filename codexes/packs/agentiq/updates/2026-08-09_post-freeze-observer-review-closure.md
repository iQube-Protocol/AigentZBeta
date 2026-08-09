# Post-Freeze Observer Review Closure — EXP-P1 Crystal vP1

**2026-08-09**

## What shipped

A 12-point governance closure for what happens to Crystal vP1 (and, by
construction, any future frozen crystal) once it is actually frozen —
distinct from the pre-freeze readiness/statistics/freeze-recommendation work
that already existed.

1. **Frozen suppresses freeze-prep affordances.** `IndependentReviewPanel`'s
   Crystal vP1 section now checks the real persisted `lifecycle.stageId`
   (`app/api/research/crystal/[experimentId]/route.ts`) and, once `FROZEN`,
   hides the domain-override input and the freeze-ceremony-preview form for
   every caller — replacing them with an immutable Frozen Crystal summary
   (content hash, commitment hash, signatories, receipt) plus the live
   observer-acceptance status.
2. **`autonomi-review-exp-p1` is the canonical external-reviewer surface.**
   The workspace now declares its own `irl-observer-review` link explicitly
   (not inherited — EXP-P2/P3 have no frozen crystal to observe yet).
3. **Hash-bound Observer Review Package.** `services/research/crystalObserverReview.ts::buildObserverReviewPackage`
   refuses unless the target artifact is already `frozen` with both
   `contentHash`/`commitmentHash` present — the package is built FROM the
   freeze record, never a candidate.
4. **Self-service, persona-scoped decision submission.** `POST
   /api/research/observer-review/[experimentId]/decision` — the caller's own
   `personaPublicRef` is the only observer identity accepted; gated by the
   same Independent Reviewer Agreement that already governs "submit findings
   attributable to you".
5. **N observers, one package hash — never widened R1/R2.** `ObserverDecision`/
   `ObserverReviewPackage` are a new, crystal-specific vocabulary, deliberately
   distinct from `ReviewerSlot` ('R1'|'R2'), which remains the automated
   dual-model pipeline's own concern.
6. **Explicit round policy.** `resolveObserverRound` accepts `any-assigned` |
   `all-assigned`; EXP-P1's round can be assigned `all-assigned` so every
   named observer must accept before the round reads `accepted`. A single
   `changes_requested` always blocks, regardless of any other acceptance.
7. **Delegated agent evidence, never a second vote.** `submittedByAgentRef` on
   a decision records that an agent assisted; the write is keyed by the human
   `observerRef` alone (`upsertObserverDecision`), so any number of
   agent-assisted resubmissions still resolve to exactly one vote.
8. **`changes_requested` → a Change Proposal, never a mutation.** `POST
   .../change-proposal` (steward/PI/admin only) provisions a superseding
   candidate artifact at `draft` — never touches the frozen row — and opens a
   fresh round against the new id.
9. **Agent Package extended.** `/api/journey/validation-programme/agent-package`
   now carries the frozen package hash, the decision JSON schema, and the
   submission/change-proposal endpoints; the prior (now stale) "no separate
   structured reviewer-decision API" prose is corrected.
10. **One Workspace Review flow.** `components/composer/CrystalObserverReviewPanel.tsx`
    replaces the journey's direct `IndependentReviewPanel(reviewerMode)` mount
    — it composes the existing read-only readiness projection with the new
    decision form, rather than the journey and the workspace independently
    duplicating the review surface.
11. **`observerAcceptance` derived from real decisions.** Exposed on
    `/api/research/crystal/[experimentId]` as the gate for post-crystal
    experiment preparation — `null` (never a fabricated `pending`) until a
    round is actually assigned.
12. **Authority boundary verified.** Reviewers may inspect/comment/propose/
    submit; only a steward/PI/admin may assign a round or resolve a change
    proposal, and no path in the new code imports `freezeArtifact`.

## Fixed in passing

`app/api/journey/validation-programme/state/route.ts`'s `reviewDecisionSubmitted`
was checking the caller's ref against the automated R1/R2 pipeline's decision
arrays — a mechanism a real external observer could never satisfy by doing
the thing the stage actually asks. Renamed to `observerDecisionSubmitted` and
derived from the real Observer Review round.

## Files

- New: `services/research/crystalObserverReview.ts`, `services/research/observerReviewStore.ts`
- New API: `app/api/research/observer-review/[experimentId]/{route,decision/route,change-proposal/route}.ts`
- New UI: `components/composer/CrystalObserverReviewPanel.tsx`
- Edited: `app/api/research/crystal/[experimentId]/route.ts`, `components/composer/IndependentReviewPanel.tsx`,
  `services/research/researchWorkspace.ts`, `services/journey/validationProgrammeJourney.ts`,
  `services/journey/journeySurfaceRegistry.ts`, `app/triad/components/codex/tabs/ValidationProgrammeJourneyTab.tsx`,
  `app/api/journey/validation-programme/agent-package/route.ts`, `app/api/journey/validation-programme/state/route.ts`
- Tests: `tests/post-freeze-observer-review.test.ts` (new), `tests/validation-programme-journey.test.ts`,
  `tests/validation-programme-agent-package.test.ts` (updated for the rename/new action)
- Resolution record: `RES-2026-08-09-POST-FREEZE-OBSERVER-REVIEW-001`
- Candidate invariant: `CI-2026-08-09-POST-FREEZE-OBSERVER-REVIEW-001`

## Status

Committed locally only. **Not pushed** — holding per explicit operator
instruction while another agent works on the same repo, to avoid merge
clashes with the auto-merge-to-dev workflow.
