# Commit Brief: `194414c` — feat: constitute EXP-P1 and EXP-P2 as ClusterQubes

| Field | Value |
|-------|-------|
| SHA | [`194414c`](https://github.com/iQube-Protocol/AigentZBeta/commit/194414cdc48a0becd53bc9e98ebc1c9ed9ebaa4b) |
| Author | Kn0w1 |
| Date | 2026-09-09T20:18:53-04:00 |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: constitute EXP-P1 and EXP-P2 as ClusterQubes
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/registry/adapters/index.ts` |
| Added | `services/registry/adapters/researchClusterQubeAdapter.ts` |
| Added | `services/registry/adapters/researchContentQubeAdapter.ts` |
| Added | `services/registry/adapters/researchDataQubeAdapter.ts` |
| Modified | `services/registry/backfill/runBackfill.ts` |
| Modified | `services/registry/projections/cartridge.ts` |
| Modified | `services/registry/resolver.ts` |
| Added | `services/research/experimentIQubeAccess.ts` |
| Added | `services/research/experimentIQubeSources.ts` |
| Modified | `services/threshold/personaIQubeProjection.ts` |
| Added | `supabase/migrations/20260909232830_exp_p1_p2_clusterqubes.sql` |
| Added | `tests/experiment-iqube-access.test.ts` |
| Added | `tests/experiment-iqube-constitution.test.ts` |
| Modified | `types/registry-canonical.ts` |

## Stats

 14 files changed, 732 insertions(+), 4 deletions(-)
