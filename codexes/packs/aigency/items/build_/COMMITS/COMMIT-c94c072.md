# Commit Brief: `c94c072` — Add migration-drift diagnostic covering dual-leg anchoring + MoneyPenny AigentQube seed

| Field | Value |
|-------|-------|
| SHA | [`c94c072`](https://github.com/iQube-Protocol/AigentZBeta/commit/c94c0722bef720ea01cb7b64c897d6c7760dca08) |
| Author | Claude |
| Date | 2026-08-09T08:59:48Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add migration-drift diagnostic covering dual-leg anchoring + MoneyPenny AigentQube seed

Operator flagged that the missing dvn_status column and the live absence of
aigentqube-moneypenny both look like deploy-time migration drift rather than
independent bugs. This read-only route checks the canonical objects three
specific migrations should have produced directly against live tables
(activity_receipts dual-leg columns, registry_assets + iqube_id_map rows for
MoneyPenny's AigentQube, the runtime metadata update, plus Nakamoto's
AigentQube as a comparison point), and best-effort probes whether an exec_sql
RPC exists (the only path to apply DDL programmatically via PostgREST).
```

## Body

Operator flagged that the missing dvn_status column and the live absence of
aigentqube-moneypenny both look like deploy-time migration drift rather than
independent bugs. This read-only route checks the canonical objects three
specific migrations should have produced directly against live tables
(activity_receipts dual-leg columns, registry_assets + iqube_id_map rows for
MoneyPenny's AigentQube, the runtime metadata update, plus Nakamoto's
AigentQube as a comparison point), and best-effort probes whether an exec_sql
RPC exists (the only path to apply DDL programmatically via PostgREST).

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `.github/workflows/migration-ledger-check.yml` |
| Added | `app/api/ops/dvn/migration-ledger/route.ts` |

## Stats

 3 files changed, 178 insertions(+), 1 deletion(-)
