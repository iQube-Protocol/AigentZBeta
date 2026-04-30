# Commit Brief: `dcb38e6` — KNYT cart Phase 2a — carry contentType + productType-mapper on cart lines

| Field | Value |
|-------|-------|
| SHA | [`dcb38e6`](https://github.com/iQube-Protocol/AigentZBeta/commit/dcb38e631287046eaa3fa7fe5b00b03d04366412) |
| Author | Claude |
| Date | 2026-04-30T22:45:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 2a — carry contentType + productType-mapper on cart lines

Foundation for server-side cart settlement (Phase 2b adds the endpoints).
Each cart line now carries the metadata needed to translate into a
processPurchase() request without the server having to re-derive it
from the line id or label.

types/knyt-store.ts:
- CartItem gains optional `contentType` field — the same union the
  ContentPurchaseModal already uses (scroll_still | scroll_motion |
  character_card | character_card_motion | bundle_3_still |
  bundle_5_still | bundle_3_motion | bundle_5_motion |
  season_codex_still | season_codex_motion). Declared inline rather
  than imported from the modal to avoid circular deps between the
  data-only types module and the React component.
- Optional for back-compat — cart entries persisted before this
  change still load fine; they just won't be settleable via the
  Phase 2b multi-item endpoints until the user re-adds them. Express
  buy via the single-item modal continues to work for them.
- New cartContentTypeToProductType() helper — mirrors the
  productTypeMap inside ContentPurchaseModal so the cart-quote /
  cart-complete endpoints can resolve productType server-side.

addToCart helpers updated to populate contentType:
- KnytStoreEpisodesTab.addPendingToCart    — passes p.contentType
- KnytStoreCardsTab.addPendingToCart        — passes p.contentType
- KnytStoreBundlesTab.addBundleToCart       — uses getBundleContentType()
- KnytStoreBundlesTab.addPackToCart         — 'character_card'
- KnytStoreInvestorTab.addBundleToCart      — 'season_codex_still'

No behaviour change for users — cart still iterates per-item through
ContentPurchaseModal at checkout. Phase 2b adds /api/cart/quote and
/api/cart/complete; Phase 2c builds the KnytCartCheckoutModal that
consumes them.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Foundation for server-side cart settlement (Phase 2b adds the endpoints).
Each cart line now carries the metadata needed to translate into a
processPurchase() request without the server having to re-derive it
from the line id or label.

types/knyt-store.ts:
- CartItem gains optional `contentType` field — the same union the
  ContentPurchaseModal already uses (scroll_still | scroll_motion |
  character_card | character_card_motion | bundle_3_still |
  bundle_5_still | bundle_3_motion | bundle_5_motion |
  season_codex_still | season_codex_motion). Declared inline rather
  than imported from the modal to avoid circular deps between the
  data-only types module and the React component.
- Optional for back-compat — cart entries persisted before this
  change still load fine; they just won't be settleable via the
  Phase 2b multi-item endpoints until the user re-adds them. Express
  buy via the single-item modal continues to work for them.
- New cartContentTypeToProductType() helper — mirrors the
  productTypeMap inside ContentPurchaseModal so the cart-quote /
  cart-complete endpoints can resolve productType server-side.

addToCart helpers updated to populate contentType:
- KnytStoreEpisodesTab.addPendingToCart    — passes p.contentType
- KnytStoreCardsTab.addPendingToCart        — passes p.contentType
- KnytStoreBundlesTab.addBundleToCart       — uses getBundleContentType()
- KnytStoreBundlesTab.addPackToCart         — 'character_card'
- KnytStoreInvestorTab.addBundleToCart      — 'season_codex_still'

No behaviour change for users — cart still iterates per-item through
ContentPurchaseModal at checkout. Phase 2b adds /api/cart/quote and
/api/cart/complete; Phase 2c builds the KnytCartCheckoutModal that
consumes them.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `types/knyt-store.ts` |

## Stats

 5 files changed, 73 insertions(+), 28 deletions(-)
