# Commit Brief: `52cfb3f` — Add wall-clock safety budget to DVN reconciler + targeted submit route + MoneyPenny AigentQube repair

| Field | Value |
|-------|-------|
| SHA | [`52cfb3f`](https://github.com/iQube-Protocol/AigentZBeta/commit/52cfb3f9e07472e62888311b961c80972b207b8e) |
| Author | Claude |
| Date | 2026-08-09T09:32:29Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add wall-clock safety budget to DVN reconciler + targeted submit route + MoneyPenny AigentQube repair

The first live reconciler run against the now-repaired dual-leg schema
returned an empty HTTP response — the platform's own request timeout almost
certainly killed it mid-run, since each enqueueReceiptLeg call can take up to
15s and the paging fix added last session could scan up to 1000 rows in one
invocation. reconcileLocalReceiptsToDvn now checks a 20s wall-clock budget
before every row (not just every page) and reports truncatedByTimeBudget so a
caller knows to call again rather than mistake a stop for completion.

Confirmed via /api/ops/dvn/receipt-status that the run touched none of
MoneyPenny's 3 still-stranded Horizen receipts (commitment_hash still null,
meaning enqueueReceiptLeg never even started on them) — so no
duplicate-submission risk exists for those three specifically. Added
/api/ops/dvn/submit-specific-receipts (+ findReceiptsByIds) as a bounded,
explicit-id-list counterpart to the backlog-scanning reconciler, so known
Horizen-pilot receipts can be recovered without scanning an unrelated
historical backlog first.

Also adds /api/ops/dvn/apply-moneypenny-aigentqube: applies the DML content
of the two existing, already-authored MoneyPenny AigentQube migrations
(20260930000400, 20260930002300) via the same PostgREST Data API — the
migration-ledger diagnostic proved these never materialized even after the
operator's schema-repair SQL run (Nakamoto's equivalent migration did land).
No exec_sql RPC exists on this project, so DML is applied via supabase-js
directly using the exact same values as the migration files, then reconciles
the registration binding via the existing resolveAgentRegistrationState
resolver rather than hand-authoring token 8872 into the metadata.
```

## Body

The first live reconciler run against the now-repaired dual-leg schema
returned an empty HTTP response — the platform's own request timeout almost
certainly killed it mid-run, since each enqueueReceiptLeg call can take up to
15s and the paging fix added last session could scan up to 1000 rows in one
invocation. reconcileLocalReceiptsToDvn now checks a 20s wall-clock budget
before every row (not just every page) and reports truncatedByTimeBudget so a
caller knows to call again rather than mistake a stop for completion.

Confirmed via /api/ops/dvn/receipt-status that the run touched none of
MoneyPenny's 3 still-stranded Horizen receipts (commitment_hash still null,
meaning enqueueReceiptLeg never even started on them) — so no
duplicate-submission risk exists for those three specifically. Added
/api/ops/dvn/submit-specific-receipts (+ findReceiptsByIds) as a bounded,
explicit-id-list counterpart to the backlog-scanning reconciler, so known
Horizen-pilot receipts can be recovered without scanning an unrelated
historical backlog first.

Also adds /api/ops/dvn/apply-moneypenny-aigentqube: applies the DML content
of the two existing, already-authored MoneyPenny AigentQube migrations
(20260930000400, 20260930002300) via the same PostgREST Data API — the
migration-ledger diagnostic proved these never materialized even after the
operator's schema-repair SQL run (Nakamoto's equivalent migration did land).
No exec_sql RPC exists on this project, so DML is applied via supabase-js
directly using the exact same values as the migration files, then reconciles
the registration binding via the existing resolveAgentRegistrationState
resolver rather than hand-authoring token 8872 into the metadata.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `.github/workflows/submit-specific-receipts.yml` |
| Added | `app/api/ops/dvn/apply-moneypenny-aigentqube/route.ts` |
| Added | `app/api/ops/dvn/submit-specific-receipts/route.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |

## Stats

 6 files changed, 379 insertions(+), 3 deletions(-)
