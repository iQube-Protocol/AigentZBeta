# Commit Brief: `8edc1f8` — Simplify DVN/BTC receipt badges to terse vocabulary + give the activity-receipts finalizer independent liveness

| Field | Value |
|-------|-------|
| SHA | [`8edc1f8`](https://github.com/iQube-Protocol/AigentZBeta/commit/8edc1f890160b7fe16d47cc8e64a01172a5204b5) |
| Author | Claude |
| Date | 2026-08-08T23:08:47Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Simplify DVN/BTC receipt badges to terse vocabulary + give the activity-receipts finalizer independent liveness

Receipt badges now read DVN Pending/Minted/Failed and BTC Pending/Anchored/Failed
as two compact, non-conflated badges (local -> "Receipt Created", never "DVN
Bitcoin Anchored"); precise underlying receiptStatus/dvnStatus/posStatus stay in
the tooltip and JSON, never dropped.

Also closes discrepancy-register finding O-2: finalizeReadyActivityReceipts
(dvn_pending -> dvn_recorded) had exactly one caller repo-wide, a manual admin
button, so DVN-minted evidence for Horizen/ActivityReceiptCard receipts could
sit pending indefinitely. Adds a cron-token-gated route + scheduled workflow
that drives the SAME existing finalizer every 5 minutes, mirroring
dvn-reconciler.yml's pattern. No changes to the protected DVN pipeline file
itself — only new callers of its already-exported function.
```

## Body

Receipt badges now read DVN Pending/Minted/Failed and BTC Pending/Anchored/Failed
as two compact, non-conflated badges (local -> "Receipt Created", never "DVN
Bitcoin Anchored"); precise underlying receiptStatus/dvnStatus/posStatus stay in
the tooltip and JSON, never dropped.

Also closes discrepancy-register finding O-2: finalizeReadyActivityReceipts
(dvn_pending -> dvn_recorded) had exactly one caller repo-wide, a manual admin
button, so DVN-minted evidence for Horizen/ActivityReceiptCard receipts could
sit pending indefinitely. Adds a cron-token-gated route + scheduled workflow
that drives the SAME existing finalizer every 5 minutes, mirroring
dvn-reconciler.yml's pattern. No changes to the protected DVN pipeline file
itself — only new callers of its already-exported function.

## Files Changed

| Change | File |
|--------|------|
| Added | `.github/workflows/activity-receipts-finalizer.yml` |
| Added | `app/api/ops/dvn/finalize-activity-receipts/route.ts` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Added | `tests/activity-receipt-card-badge-vocabulary.test.ts` |
| Added | `tests/activity-receipts-finalizer-liveness.test.ts` |

## Stats

 5 files changed, 385 insertions(+), 16 deletions(-)
