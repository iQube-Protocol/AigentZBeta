# Commit Brief: `21c278e` — Fix local-to-DVN reconciler starvation on non-anchorable backlog + add receipt-status diagnostic

| Field | Value |
|-------|-------|
| SHA | [`21c278e`](https://github.com/iQube-Protocol/AigentZBeta/commit/21c278e3daa51c115a957f4f0279f403fd542ad4) |
| Author | Claude |
| Date | 2026-08-09T08:06:03Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix local-to-DVN reconciler starvation on non-anchorable backlog + add receipt-status diagnostic

The reconciler's first live run (pendingChecked=50, submitted=0,
skippedNonAnchorable=50) showed the oldest-first LIMIT-50 query can get
permanently stuck re-fetching the same page of legitimately non-anchorable
local rows, never reaching stranded anchorable receipts behind them.
reconcileLocalReceiptsToDvn now pages forward (via a new afterCreatedAt
keyset cursor on findLocalReceiptsPendingDvnAnchor) up to 20 pages per
bounded run instead of reading one fixed page. Also adds a cron-token-gated
read-only /api/ops/dvn/receipt-status route (+ a manual-dispatch workflow)
to inspect the DVN lifecycle of specific receipt ids for diagnosis.
```

## Body

The reconciler's first live run (pendingChecked=50, submitted=0,
skippedNonAnchorable=50) showed the oldest-first LIMIT-50 query can get
permanently stuck re-fetching the same page of legitimately non-anchorable
local rows, never reaching stranded anchorable receipts behind them.
reconcileLocalReceiptsToDvn now pages forward (via a new afterCreatedAt
keyset cursor on findLocalReceiptsPendingDvnAnchor) up to 20 pages per
bounded run instead of reading one fixed page. Also adds a cron-token-gated
read-only /api/ops/dvn/receipt-status route (+ a manual-dispatch workflow)
to inspect the DVN lifecycle of specific receipt ids for diagnosis.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `.github/workflows/receipt-status-check.yml` |
| Added | `app/api/ops/dvn/receipt-status/route.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Modified | `tests/dvn-local-receipts-reconciler.test.ts` |

## Stats

 6 files changed, 178 insertions(+), 32 deletions(-)
