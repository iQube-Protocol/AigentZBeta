# Commit Brief: `4ab4c9d` — fix: Resolve payment flow for preorder episodes -1 to -4 in Qriptopian Codex Scrolls

| Field | Value |
|-------|-------|
| SHA | [`4ab4c9d`](https://github.com/iQube-Protocol/AigentZBeta/commit/4ab4c9d9b7412198f58d6910350e92362c529428) |
| Author | Kn0w-1 |
| Date | 2026-02-24T19:27:22Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Resolve payment flow for preorder episodes -1 to -4 in Qriptopian Codex Scrolls

🐛 Issue: Episodes -1 to -4 (preorder variants) not triggering payment flow

✅ Fix Applied:
• Updated openPurchaseForItem function to properly handle preorder variants
• Added correct pricing detection for metaKnyts_preorder_* items
• Applied specific KNYT pricing from PREORDER_CONTENT_VARIANTS:
  - Legendary (#-4): 1500 KNYT
  - Epic (#-3): 133 KNYT
  - Rare (#-2): 61 KNYT
  - Common (#-1): 49 KNYT
• Fixed baseKnyt and priceUsd calculation for preorder items
• Added PREORDER_CONTENT_VARIANTS to dependency array

🎯 Result: Purchase modal now opens with correct pricing for all preorder episodes
📁 File: app/triad/components/codex/tabs/KnytTab.tsx
```

## Files Changed

_File details not available in backfill — see commit link above._
