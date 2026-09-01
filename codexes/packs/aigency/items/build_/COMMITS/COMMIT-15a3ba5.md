# Commit Brief: `15a3ba5` — Rework Financial Sovereignty as a dormant branch off CHOOSE (AEE-XP-001 §4) [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`15a3ba5`](https://github.com/iQube-Protocol/AigentZBeta/commit/15a3ba5cc18032c15e2c5e4dcc56057ba7791787) |
| Author | Claude |
| Date | 2026-09-01T07:36:55Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Rework Financial Sovereignty as a dormant branch off CHOOSE (AEE-XP-001 §4) [merge review/irl-scoped-restoration-2026-08-27]

The main-spine implementation permanently inserted DISCOVER..CROSS as
five unconditional stages before CHOOSE, unconditionally visible in
every visitor's stepper. Corrected per operator direction: the segment
is now a typed but DORMANT branch that activates only when a Financial
Services intent is declared, in canonical order CHOOSE -> DISCOVER ->
LEARN -> EXPLORE -> PREPARE -> CROSS.

- types/journey.ts: new activationBranch field (presentation-only,
  modeled on the existing forkPosition precedent) — a stage carrying it
  is never gated/blocked differently, only hidden from the spine
  stepper until its branch activates.
- services/journey/journeyBranchActivation.ts: activates a branch
  (sessionStorage flag + declared intent + stage selection), mirrors
  the same per-visit persistence class already used for PREPARE's
  agent-candidate choice.
- Both journey definitions: fs-* stages moved after 'choose' and
  tagged activationBranch: 'financial-services'.
- KNYTS' CFS Pilot card and a new CI 'Join Financial Services' card
  (CI had no FS entry point at all before this) now call
  activateJourneyBranch instead of a bare stage-select.
- JourneyRunSurface: spine/fork stepper filters out any stage whose
  branch hasn't been activated yet — purely additive for every stage
  without activationBranch.
- CROSS's ExperienceHandoff.intent now carries the actual declared
  intent (LEARN_FINANCIAL_SERVICES / JOIN_FINANCIAL_SERVICES) instead
  of a fixed label.

Evidence-based compression of DISCOVER/LEARN/EXPLORE via existing
evidence is intentionally deferred to XP-1 (AEE-XP-001 §6) rather than
built as an ad hoc heuristic here — building that now would be exactly
the 'parallel recommendation engine' XP-1 itself forbids.
```

## Body

The main-spine implementation permanently inserted DISCOVER..CROSS as
five unconditional stages before CHOOSE, unconditionally visible in
every visitor's stepper. Corrected per operator direction: the segment
is now a typed but DORMANT branch that activates only when a Financial
Services intent is declared, in canonical order CHOOSE -> DISCOVER ->
LEARN -> EXPLORE -> PREPARE -> CROSS.

- types/journey.ts: new activationBranch field (presentation-only,
  modeled on the existing forkPosition precedent) — a stage carrying it
  is never gated/blocked differently, only hidden from the spine
  stepper until its branch activates.
- services/journey/journeyBranchActivation.ts: activates a branch
  (sessionStorage flag + declared intent + stage selection), mirrors
  the same per-visit persistence class already used for PREPARE's
  agent-candidate choice.
- Both journey definitions: fs-* stages moved after 'choose' and
  tagged activationBranch: 'financial-services'.
- KNYTS' CFS Pilot card and a new CI 'Join Financial Services' card
  (CI had no FS entry point at all before this) now call
  activateJourneyBranch instead of a bare stage-select.
- JourneyRunSurface: spine/fork stepper filters out any stage whose
  branch hasn't been activated yet — purely additive for every stage
  without activationBranch.
- CROSS's ExperienceHandoff.intent now carries the actual declared
  intent (LEARN_FINANCIAL_SERVICES / JOIN_FINANCIAL_SERVICES) instead
  of a fixed label.

Evidence-based compression of DISCOVER/LEARN/EXPLORE via existing
evidence is intentionally deferred to XP-1 (AEE-XP-001 §6) rather than
built as an ad hoc heuristic here — building that now would be exactly
the 'parallel recommendation engine' XP-1 itself forbids.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/KnytsBridgeChooseSurface.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Added | `services/journey/journeyBranchActivation.ts` |
| Modified | `services/journey/knytsBridgeCrossingJourney.ts` |
| Modified | `tests/ci-bridge-threshold-guide-architecture.test.ts` |
| Modified | `tests/constitutional-internet-bridge-journey.test.ts` |
| Modified | `tests/financial-sovereignty-main-spine.test.ts` |
| Added | `tests/journey-branch-activation.test.ts` |
| Modified | `tests/knyts-bridge-choose-final-closure.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 14 files changed, 349 insertions(+), 88 deletions(-)
