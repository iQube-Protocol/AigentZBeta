# Commit Brief: `7879a00` — feat: codex cover fixes + preorder pricing + modal scroll + stub preorder fulfillment API

| Field | Value |
|-------|-------|
| SHA | [`7879a00`](https://github.com/iQube-Protocol/AigentZBeta/commit/7879a00bebdbb0a101021e1e205664f2098bc391) |
| Author | Kn0w-1 |
| Date | 2026-01-21T23:01:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: codex cover fixes + preorder pricing + modal scroll + stub preorder fulfillment API

- Backend: remove blank Episode 0; fix displayNumber fallback; synthesize preorder episodes (-1..-4) with purchaseId/price
- Frontend: KnytCodexTab uses episode.priceKnyt/priceUsd; ContentPurchaseModal adds  shipping for preorders
- UI: make ContentPurchaseModal scrollable (max-h + overflow-y-auto)
- Add stub API: /api/purchase/preorder/fulfillment for shipping address capture (to be completed)
- Misc: bridge utilities and main.tsx updates for Vite servers
```

## Files Changed

_File details not available in backfill — see commit link above._
