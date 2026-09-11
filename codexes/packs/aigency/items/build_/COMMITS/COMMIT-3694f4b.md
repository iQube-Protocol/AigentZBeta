# Commit Brief: `3694f4b` — Add durable local-to-DVN-pending reconciler, closing the receipt lifecycle

| Field | Value |
|-------|-------|
| SHA | [`3694f4b`](https://github.com/iQube-Protocol/AigentZBeta/commit/3694f4b00c5f336c36935ce1ec59ce56c85de4ea) |
| Author | Claude |
| Date | 2026-08-09T07:32:48Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add durable local-to-DVN-pending reconciler, closing the receipt lifecycle

createActivityReceipt() persists receipt_status='local' then submits to
DVN through an un-awaited background promise - latency-friendly, but
not durable in a request/serverless environment. A receipt whose
request ends before that background work runs is stranded at 'local'
with nothing left checking on it, exactly what the reconciler-generated
MoneyPenny registration receipts demonstrated.

Adds reconcileLocalReceiptsToDvn(), scheduled independently (same
5-minute cadence as the finalizer it feeds), draining a bounded batch
of stranded 'local' receipts through the existing, unmodified
enqueueReceiptLeg primitive - never a second submit_dvn_message
implementation, never a replacement receipt, never a non-anchorable
submission. One receipt's failure is isolated from the rest of the
batch. The durable lifecycle is now: createActivityReceipt() -> hot-path
submission when it survives OR this scheduled recovery when it doesn't
-> dvn_pending -> targeted finalizer -> dvn_recorded.
```

## Body

createActivityReceipt() persists receipt_status='local' then submits to
DVN through an un-awaited background promise - latency-friendly, but
not durable in a request/serverless environment. A receipt whose
request ends before that background work runs is stranded at 'local'
with nothing left checking on it, exactly what the reconciler-generated
MoneyPenny registration receipts demonstrated.

Adds reconcileLocalReceiptsToDvn(), scheduled independently (same
5-minute cadence as the finalizer it feeds), draining a bounded batch
of stranded 'local' receipts through the existing, unmodified
enqueueReceiptLeg primitive - never a second submit_dvn_message
implementation, never a replacement receipt, never a non-anchorable
submission. One receipt's failure is isolated from the rest of the
batch. The durable lifecycle is now: createActivityReceipt() -> hot-path
submission when it survives OR this scheduled recovery when it doesn't
-> dvn_pending -> targeted finalizer -> dvn_recorded.

## Files Changed

| Change | File |
|--------|------|
| Added | `.github/workflows/local-receipts-dvn-reconciler.yml` |
| Added | `app/api/ops/dvn/reconcile-local-receipts/route.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `tests/dvn-local-receipts-reconciler.test.ts` |
| Added | `tests/local-receipts-dvn-reconciler-liveness.test.ts` |

## Stats

 6 files changed, 556 insertions(+)
