# Commit Brief: `86eb2e5` — Phase 5: CFS-008 measurement on receipt spine + CFS-010 plan-to-record

| Field | Value |
|-------|-------|
| SHA | [`86eb2e5`](https://github.com/iQube-Protocol/AigentZBeta/commit/86eb2e51c1ee6bb8c2d72a48e0cf6a203b934f56) |
| Author | Claude |
| Date | 2026-07-04T05:54:52Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Phase 5: CFS-008 measurement on receipt spine + CFS-010 plan-to-record

Instrument reuse-count on the existing receipt spine: additive
invariants_used column on activity_receipts (GIN-indexed), threaded
through activityReceiptService as an optional column with graceful
pre-migration degradation, and populated at every grounded act — the
consequence runner's curation/forecast/evolution receipts and the
specialist_consulted receipt (receipt-side only for consults; usage/
Reach stays reserved for executions per Law XII). New measurement
readout at GET /api/invariants/measurement: per-namespace reuse counts
and consequence accuracy as separate axes, receipt-spine count null
until the column exists (unmeasured, never fake-zero). CFS-010 is
rewritten from plan to record (v1.0) per its own completion criterion,
with commit receipts for every stage and the two open constitutional
gates named (7th-primitive canonization, value axis).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Instrument reuse-count on the existing receipt spine: additive
invariants_used column on activity_receipts (GIN-indexed), threaded
through activityReceiptService as an optional column with graceful
pre-migration degradation, and populated at every grounded act — the
consequence runner's curation/forecast/evolution receipts and the
specialist_consulted receipt (receipt-side only for consults; usage/
Reach stays reserved for executions per Law XII). New measurement
readout at GET /api/invariants/measurement: per-namespace reuse counts
and consequence accuracy as separate axes, receipt-spine count null
until the column exists (unmeasured, never fake-zero). CFS-010 is
rewritten from plan to record (v1.0) per its own completion criterion,
with commit receipts for every stage and the two open constitutional
gates named (7th-primitive canonization, value axis).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Added | `app/api/invariants/measurement/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Modified | `codexes/packs/agentiq/foundation/CFS-010_migration-strategy.md` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_phase-5-measurement-cfs010-record.md` |
| Modified | `services/consequence/operatingModel.ts` |
| Modified | `services/invariants/index.ts` |
| Added | `services/invariants/measurement.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260704100000_activity_receipts_invariants_used.sql` |

## Stats

 10 files changed, 441 insertions(+), 79 deletions(-)
