# Commit Brief: `43e2e15` — Insert Orient stage between Claim and Passport, render Ratify/Ingest/Standing as Consequence Fork

| Field | Value |
|-------|-------|
| SHA | [`43e2e15`](https://github.com/iQube-Protocol/AigentZBeta/commit/43e2e153cba171ab032c0af432dab6353d7814bd) |
| Author | Claude |
| Date | 2026-08-09T02:01:34Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Insert Orient stage between Claim and Passport, render Ratify/Ingest/Standing as Consequence Fork

Orient is a real, receipted stage (orientation_ritual_completed) whose
contextual ritual is resolved from the operator's own prior constitutional
history (services/journey/orientationContext.ts), never from agent name.
Claim -> Orient -> Passport; Passport now gates on Orient completing.

JourneyRunSurface renders the three post-aigentMe branches (forkPosition:
upper/middle/lower) as one trident after the spine instead of mixing them
into the numbered stepper row — Ratify upper, Ingest middle, Standing lower.
Each branch keeps its own independent state/evidence/receipts; forkPosition
is presentation-only and journeys with no tagged stages render unchanged.

Adds the orient/acknowledge route, OrientationPanel surface, journey-state
wiring, receipt-type registration (migration + DVN allowlist), and additive
tests for the new spine segment, ritual resolution, and fork topology.
```

## Body

Orient is a real, receipted stage (orientation_ritual_completed) whose
contextual ritual is resolved from the operator's own prior constitutional
history (services/journey/orientationContext.ts), never from agent name.
Claim -> Orient -> Passport; Passport now gates on Orient completing.

JourneyRunSurface renders the three post-aigentMe branches (forkPosition:
upper/middle/lower) as one trident after the spine instead of mixing them
into the numbered stepper row — Ratify upper, Ingest middle, Standing lower.
Each branch keeps its own independent state/evidence/receipts; forkPosition
is presentation-only and journeys with no tagged stages render unchanged.

Adds the orient/acknowledge route, OrientationPanel surface, journey-state
wiring, receipt-type registration (migration + DVN allowlist), and additive
tests for the new spine segment, ritual resolution, and fork topology.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/journey/moneypenny-horizen/orient/acknowledge/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `components/journey/OrientationPanel.tsx` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Added | `services/journey/orientationContext.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260930002400_orientation_ritual_completed_receipt_type.sql` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Modified | `tests/journey-monotonic-admission.test.ts` |
| Added | `tests/journey-orient-stage.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 15 files changed, 1089 insertions(+), 15 deletions(-)
