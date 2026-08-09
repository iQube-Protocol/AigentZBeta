# Commit Brief: `51917a4` — Fix Orient regression, anchor Consequence Fork trident to spine end, verb labels

| Field | Value |
|-------|-------|
| SHA | [`51917a4`](https://github.com/iQube-Protocol/AigentZBeta/commit/51917a43e947c2d88de362c98ad57b825d58caf4) |
| Author | Claude |
| Date | 2026-08-09T03:25:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Orient regression, anchor Consequence Fork trident to spine end, verb labels

Root cause: resolveJourneyState checked prerequisites before a stage's own
completion evidence, so inserting Orient between Claim and Passport made
every downstream stage with real pre-existing evidence (Passport, Delegate,
Operate, Ratify, Ingest) render BLOCKED for legacy agents like Nakamoto.
Evidence-complete now precedes the prerequisite check — prerequisites gate
entry into an incomplete stage, they no longer erase an established one.

Orient itself is satisfied for legacy admissions via a derived, honestly-
named legacy-precedent signal (orientationLegacyPrecedentEstablished) when
Passport/delegation/aigentMe were already established before Orient existed
— never a fabricated orientation_ritual_completed receipt. The orient/
acknowledge route shares the same completion resolver so the panel and the
stepper never disagree.

JourneyRunSurface now anchors the Consequence Fork trident to the end of the
spine in the same horizontal strip (Ratify up, Ingest straight, Stand down
from one junction) instead of a detached block underneath. Stage labels are
verbs (Operate/Ingest/Stand) with internal ids unchanged.

Added the Consequence Fork projection (services/journey/consequenceForkProjection.ts)
— a pure, agent-generic classifier deriving PROVEN/PENDING/UNRESOLVED per
prong exclusively from existing stage state and activity_receipts.receipt_status,
preserving submitted-vs-confirmed and evidence-present-vs-DVN-final distinctions
without a fabricated pending-as-failure treatment.

Also closes a pre-existing gap: orientation_ritual_completed was missing from
the assistant receipts route's display allowlist.
```

## Body

Root cause: resolveJourneyState checked prerequisites before a stage's own
completion evidence, so inserting Orient between Claim and Passport made
every downstream stage with real pre-existing evidence (Passport, Delegate,
Operate, Ratify, Ingest) render BLOCKED for legacy agents like Nakamoto.
Evidence-complete now precedes the prerequisite check — prerequisites gate
entry into an incomplete stage, they no longer erase an established one.

Orient itself is satisfied for legacy admissions via a derived, honestly-
named legacy-precedent signal (orientationLegacyPrecedentEstablished) when
Passport/delegation/aigentMe were already established before Orient existed
— never a fabricated orientation_ritual_completed receipt. The orient/
acknowledge route shares the same completion resolver so the panel and the
stepper never disagree.

JourneyRunSurface now anchors the Consequence Fork trident to the end of the
spine in the same horizontal strip (Ratify up, Ingest straight, Stand down
from one junction) instead of a detached block underneath. Stage labels are
verbs (Operate/Ingest/Stand) with internal ids unchanged.

Added the Consequence Fork projection (services/journey/consequenceForkProjection.ts)
— a pure, agent-generic classifier deriving PROVEN/PENDING/UNRESOLVED per
prong exclusively from existing stage state and activity_receipts.receipt_status,
preserving submitted-vs-confirmed and evidence-present-vs-DVN-final distinctions
without a fabricated pending-as-failure treatment.

Also closes a pre-existing gap: orientation_ritual_completed was missing from
the assistant receipts route's display allowlist.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/receipts/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/orient/acknowledge/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/OrientationPanel.tsx` |
| Added | `services/journey/consequenceForkProjection.ts` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/orientationContext.ts` |
| Modified | `services/journey/resolveJourneyState.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `tests/consequence-fork-projection.test.ts` |
| Added | `tests/journey-orient-legacy-regression.test.ts` |
| Modified | `tests/journey-orient-stage.test.ts` |

## Stats

 13 files changed, 1108 insertions(+), 105 deletions(-)
