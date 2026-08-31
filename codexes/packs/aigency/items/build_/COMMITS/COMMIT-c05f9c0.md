# Commit Brief: `c05f9c0` — Deliver CTP foundation: constitutional runtime + first migrated OCSGA primitive [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`c05f9c0`](https://github.com/iQube-Protocol/AigentZBeta/commit/c05f9c041ea5e8696faa4a2115b5fb2f817fe83c) |
| Author | Claude |
| Date | 2026-08-31T21:53:14Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Deliver CTP foundation: constitutional runtime + first migrated OCSGA primitive [merge review/irl-scoped-restoration-2026-08-27]
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/exchanges/[exchangeId]/actions/route.ts` |
| Added | `services/ctp/constitutionalRuntime.ts` |
| Added | `services/ctp/evidence.ts` |
| Added | `services/ctp/primitives/exchangeArtifactConfirm.ts` |
| Added | `services/ctp/registry.ts` |
| Modified | `services/research/reciprocalExchange.ts` |
| Modified | `services/threshold/mcpConstitutionalActs.ts` |
| Added | `supabase/migrations/20260930140000_ctp_transition_evidence.sql` |
| Added | `tests/ctp-channel-singularity.test.ts` |
| Added | `tests/ctp-constitutional-runtime.test.ts` |
| Added | `tests/ctp-exchange-artifact-confirm-primitive.test.ts` |
| Modified | `tests/journey-spine-channel-convergence.test.ts` |
| Modified | `tests/ocsga-bridge-projection-fix.test.ts` |
| Modified | `tests/ocsga-exchange-actions-route.test.ts` |
| Modified | `tests/threshold-mcp-constitutional-rituals.test.ts` |
| Added | `types/ctp.ts` |

## Stats

 17 files changed, 1687 insertions(+), 33 deletions(-)
