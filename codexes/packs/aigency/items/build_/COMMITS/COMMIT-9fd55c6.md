# Commit Brief: `9fd55c6` — feat: recover OCSGA artifacts through persona MCP

| Field | Value |
|-------|-------|
| SHA | [`9fd55c6`](https://github.com/iQube-Protocol/AigentZBeta/commit/9fd55c64cec374dca0ad1eadbc689f2ad8f890f4) |
| Author | Kn0w1 |
| Date | 2026-09-10T01:14:13-04:00 |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: recover OCSGA artifacts through persona MCP
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/exchanges/[exchangeId]/register-counterparty-artifact/route.ts` |
| Modified | `app/api/admin/registry/backfill/route.ts` |
| Modified | `app/api/threshold/mcp/route.ts` |
| Modified | `server/services/autonomysContentService.ts` |
| Added | `services/registry/adapters/exchangeArtifactQubeAdapter.ts` |
| Added | `services/registry/adapters/exchangeClusterQubeAdapter.ts` |
| Modified | `services/registry/adapters/index.ts` |
| Modified | `services/registry/backfill/runBackfill.ts` |
| Modified | `services/registry/resolver.ts` |
| Modified | `services/threshold/gateway.ts` |
| Modified | `services/threshold/personaIQubeProjection.ts` |
| Added | `supabase/migrations/20260930330000_exchange_iqubes_and_private_payloads.sql` |
| Added | `tests/ocsga-iqube-mcp-access.test.ts` |
| Modified | `types/registry-canonical.ts` |

## Stats

 14 files changed, 461 insertions(+), 13 deletions(-)
