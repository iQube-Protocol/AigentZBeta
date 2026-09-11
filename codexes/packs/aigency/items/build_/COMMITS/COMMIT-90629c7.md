# Commit Brief: `90629c7` — Stop double-counting the Standing seed and make supersession consequential

| Field | Value |
|-------|-------|
| SHA | [`90629c7`](https://github.com/iQube-Protocol/AigentZBeta/commit/90629c7b459bf0280238f63cfebb1cf63cc696f4) |
| Author | Claude |
| Date | 2026-08-09T19:34:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Stop double-counting the Standing seed and make supersession consequential

resolveAgentStateAxes always correctly documented standingReceipts as "NOT
the ingestion receipt", but the journey state route violated that contract:
it passed every standing_accrued receipt (including the nominal seed's own)
into the contribution set while ALSO reporting the seed via
initialStandingAwarded from the same settled fact, double-counting one
accrual as both initial and contribution Standing.

Separately, the forensic correction route already preserved a premature
standing_accrued receipt as immutable history while invalidating its
settled fact and removing deploy/standing from the canonical-stage ratchet
— but standingGatewayEnabled still read bare receipt presence, so the
preserved-but-superseded receipt immediately re-completed Stand on the next
read. Constitutional history stayed immutable; its present consequence did
not actually stop.

Adds services/journey/standingEvidenceProjection.ts as the one canonical,
correction-aware Standing projection: classifies each standing_accrued
receipt as initial-tier (by its own structured action_input.basis/tier,
never amount/timing/text) or contribution, excludes receipts a
reconciliation_discrepancy_recorded receipt names as superseded, and
excludes any seed receipt that predates a genuine capability_registered
receipt (closing the same evidence-precedes-prerequisite loophole
previously fixed for Ingest, now for Stand). standingGatewayEnabled, the
axis's standingReceipts/initialStandingAwarded, and the consequence fork's
receipt-status set all now read this same projection instead of three
independent, inconsistent reads. The two ops routes (agent-forensics,
correct-premature-standing-seed) delegate to it too rather than
re-implementing the ordering check a third way.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

resolveAgentStateAxes always correctly documented standingReceipts as "NOT
the ingestion receipt", but the journey state route violated that contract:
it passed every standing_accrued receipt (including the nominal seed's own)
into the contribution set while ALSO reporting the seed via
initialStandingAwarded from the same settled fact, double-counting one
accrual as both initial and contribution Standing.

Separately, the forensic correction route already preserved a premature
standing_accrued receipt as immutable history while invalidating its
settled fact and removing deploy/standing from the canonical-stage ratchet
— but standingGatewayEnabled still read bare receipt presence, so the
preserved-but-superseded receipt immediately re-completed Stand on the next
read. Constitutional history stayed immutable; its present consequence did
not actually stop.

Adds services/journey/standingEvidenceProjection.ts as the one canonical,
correction-aware Standing projection: classifies each standing_accrued
receipt as initial-tier (by its own structured action_input.basis/tier,
never amount/timing/text) or contribution, excludes receipts a
reconciliation_discrepancy_recorded receipt names as superseded, and
excludes any seed receipt that predates a genuine capability_registered
receipt (closing the same evidence-precedes-prerequisite loophole
previously fixed for Ingest, now for Stand). standingGatewayEnabled, the
axis's standingReceipts/initialStandingAwarded, and the consequence fork's
receipt-status set all now read this same projection instead of three
independent, inconsistent reads. The two ops routes (agent-forensics,
correct-premature-standing-seed) delegate to it too rather than
re-implementing the ordering check a third way.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/api/ops/journey/agent-forensics/route.ts` |
| Modified | `app/api/ops/journey/correct-premature-standing-seed/route.ts` |
| Added | `services/journey/standingEvidenceProjection.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `tests/standing-double-count-wiring.test.ts` |
| Added | `tests/standing-evidence-projection.test.ts` |

## Stats

 8 files changed, 556 insertions(+), 103 deletions(-)
