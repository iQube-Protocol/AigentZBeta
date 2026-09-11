# Commit Brief: `f294431` — Surface the dual-leg (DVN + Bitcoin) receipt state through to the UI

| Field | Value |
|-------|-------|
| SHA | [`f294431`](https://github.com/iQube-Protocol/AigentZBeta/commit/f294431c5fa3edf9f3660f7334a602a14fe7884f) |
| Author | Claude |
| Date | 2026-08-08T20:59:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Surface the dual-leg (DVN + Bitcoin) receipt state through to the UI

Horizen Pilot / DVN alignment (Phase A-D). Reconnaissance across both the
DVN pipeline and the Horizen Pilot journey found that the pilot already
writes every meaningful action (register, claim, passport, delegate,
aigentMe, ratify/Pulse, deploy/standing) through the generic, real
activity-receipt -> DVN pipeline -- there is no separate, mocked, or
legacy proof mechanism specific to Horizen. The alignment work needed is
therefore much smaller than "wire the pilot to DVN": the pilot is already
CONNECTED end-to-end. Full findings and the alignment matrix are in the
session report.

The one concrete gap found: this morning's dual-leg migration
(20260808010000) added commitment_hash/pos_status/dvn_status/
btc_anchor_txid/btc_batch_root to activity_receipts, and the pipeline
writes them -- but nothing read them back out. ActivityReceiptRecord (the
one type the receipts API, retry routes, and the UI card all consume) had
no such fields, so the Bitcoin leg's state was invisible past the write
itself. Exactly the observability gap the Horizen Pilot alignment brief
calls out: "the pilot must be capable of operating end-to-end against a
valid DVN receipt while Bitcoin anchoring is pending" was already true
structurally, but not visible to an operator inspecting a receipt.

- services/receipts/activityReceiptService.ts: project the five dual-leg
  columns onto ActivityReceiptRecord/DbRow/rowToRecord. The receipts API
  route needed no changes -- it already spreads the full record.
- components/metame/cards/ActivityReceiptCard.tsx: a secondary,
  non-blocking "Bitcoin anchor" status chip alongside the existing DVN
  status badge, using the migration's own canonical pos_status vocabulary
  (pending|batched|broadcast|anchored|failed) rather than inventing a
  parallel model. Null renders as "Bitcoin anchor pending", never as an
  error -- POS_LEG_SUBMISSION_ENABLED is false platform-wide today, so
  that is the correct current state for every receipt.
- tests/constitutional-receipt-dual-leg-commitment.test.ts: three new
  canaries proving the retrieval layer projects both legs (RED confirmed
  against the pre-fix service file, GREEN after).

Full suite: 316/316 files, 5831/5831 tests. No DVN pipeline logic touched;
POS_LEG_SUBMISSION_ENABLED untouched (false); no protected files modified.
```

## Body

Horizen Pilot / DVN alignment (Phase A-D). Reconnaissance across both the
DVN pipeline and the Horizen Pilot journey found that the pilot already
writes every meaningful action (register, claim, passport, delegate,
aigentMe, ratify/Pulse, deploy/standing) through the generic, real
activity-receipt -> DVN pipeline -- there is no separate, mocked, or
legacy proof mechanism specific to Horizen. The alignment work needed is
therefore much smaller than "wire the pilot to DVN": the pilot is already
CONNECTED end-to-end. Full findings and the alignment matrix are in the
session report.

The one concrete gap found: this morning's dual-leg migration
(20260808010000) added commitment_hash/pos_status/dvn_status/
btc_anchor_txid/btc_batch_root to activity_receipts, and the pipeline
writes them -- but nothing read them back out. ActivityReceiptRecord (the
one type the receipts API, retry routes, and the UI card all consume) had
no such fields, so the Bitcoin leg's state was invisible past the write
itself. Exactly the observability gap the Horizen Pilot alignment brief
calls out: "the pilot must be capable of operating end-to-end against a
valid DVN receipt while Bitcoin anchoring is pending" was already true
structurally, but not visible to an operator inspecting a receipt.

- services/receipts/activityReceiptService.ts: project the five dual-leg
  columns onto ActivityReceiptRecord/DbRow/rowToRecord. The receipts API
  route needed no changes -- it already spreads the full record.
- components/metame/cards/ActivityReceiptCard.tsx: a secondary,
  non-blocking "Bitcoin anchor" status chip alongside the existing DVN
  status badge, using the migration's own canonical pos_status vocabulary
  (pending|batched|broadcast|anchored|failed) rather than inventing a
  parallel model. Null renders as "Bitcoin anchor pending", never as an
  error -- POS_LEG_SUBMISSION_ENABLED is false platform-wide today, so
  that is the correct current state for every receipt.
- tests/constitutional-receipt-dual-leg-commitment.test.ts: three new
  canaries proving the retrieval layer projects both legs (RED confirmed
  against the pre-fix service file, GREEN after).

Full suite: 316/316 files, 5831/5831 tests. No DVN pipeline logic touched;
POS_LEG_SUBMISSION_ENABLED untouched (false); no protected files modified.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Modified | `tests/constitutional-receipt-dual-leg-commitment.test.ts` |

## Stats

 3 files changed, 117 insertions(+), 1 deletion(-)
