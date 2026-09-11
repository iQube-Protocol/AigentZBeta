# Commit Brief: `efe5d1a` — Make receipt-status diagnostic column-schema-safe after discovering dvn_status missing in prod

| Field | Value |
|-------|-------|
| SHA | [`efe5d1a`](https://github.com/iQube-Protocol/AigentZBeta/commit/efe5d1a05332a6661b14f6b393263f0714b92e4e) |
| Author | Claude |
| Date | 2026-08-09T08:39:43Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Make receipt-status diagnostic column-schema-safe after discovering dvn_status missing in prod

Live probe against activity_receipts returned "column
activity_receipts.dvn_status does not exist" — the dual-leg anchoring
migration (20260930... 20260808010000_activity_receipt_dual_leg_anchoring.sql)
was apparently never applied to the deployed database, even though the DVN
submission code writes dvn_status in the same UPDATE statement as
receipt_status/dvn_receipt_id. The route now probes each candidate column
individually and selects only the ones present, reporting missingColumns
explicitly instead of failing outright.
```

## Body

Live probe against activity_receipts returned "column
activity_receipts.dvn_status does not exist" — the dual-leg anchoring
migration (20260930... 20260808010000_activity_receipt_dual_leg_anchoring.sql)
was apparently never applied to the deployed database, even though the DVN
submission code writes dvn_status in the same UPDATE statement as
receipt_status/dvn_receipt_id. The route now probes each candidate column
individually and selects only the ones present, reporting missingColumns
explicitly instead of failing outright.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/ops/dvn/receipt-status/route.ts` |

## Stats

 2 files changed, 40 insertions(+), 5 deletions(-)
