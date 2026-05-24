# Commit Brief: `77aff62` — Phase 2 B.1 (1/3): KPI source pipeline activation-bound — KpiRecord/KpiSource schema with ACTIVATION_METRIC_CATALOG; resolver only resolves KPIs whose source activation is active (else unresolvedReason=source-inactive); ventureProgress returns rich activeKpis; cockpit renders KpiChip with current/target/trend instead of empty count badges

| Field | Value |
|-------|-------|
| SHA | [`77aff62`](https://github.com/iQube-Protocol/AigentZBeta/commit/77aff62253e687c4ea001b037960342b337fb310) |
| Author | Claude |
| Date | 2026-05-24T02:16:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Phase 2 B.1 (1/3): KPI source pipeline activation-bound — KpiRecord/KpiSource schema with ACTIVATION_METRIC_CATALOG; resolver only resolves KPIs whose source activation is active (else unresolvedReason=source-inactive); ventureProgress returns rich activeKpis; cockpit renders KpiChip with current/target/trend instead of empty count badges
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/metame/cards/VentureProgressCard.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |
| Modified | `services/orchestration/ventureProgressBuilder.ts` |
| Added | `services/strategy/kpiResolver.ts` |
| Added | `services/strategy/kpiTypes.ts` |

## Stats

 6 files changed, 549 insertions(+), 4 deletions(-)
