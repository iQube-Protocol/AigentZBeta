# Commit Brief: `1df879d` — KNYT cart Phase 1.1 — split Buy/+Cart buttons across all 4 store tabs

| Field | Value |
|-------|-------|
| SHA | [`1df879d`](https://github.com/iQube-Protocol/AigentZBeta/commit/1df879d82d14367f421511c5051f8a99a05cb356) |
| Author | Claude |
| Date | 2026-04-30T21:43:10Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 1.1 — split Buy/+Cart buttons across all 4 store tabs

Each card now offers both express "Buy now" and explicit "Add to Cart"
actions side-by-side. Phase 1 wired the cart provider + drawer + qty
stepper across all four tabs but the cards themselves still went
single-item-only. This pass adds the cart-add affordance.

CartButton (Episodes / Cards / Bundles tabs):
- Added optional `onAddToCart` prop. When provided, the component
  renders as a split button: main pill on the left (express buy via
  ContentPurchaseModal), small "+" pill on the right (cart add via
  useKnytCart.addToCart). When omitted, renders the original single-
  click button — back-compat for existing callsites.

Investor tab:
- New `InvestorBuyRow` component (the equivalent of CartButton for the
  yellow investor-themed buttons).
- `InvestorBundleCard` and `InvestorBundleDetail` accept `onAddToCart`
  and render the +cart split.

Wiring through inner components:
- Episodes: GNGridCard, EpisodeGridCard, EpisodeDetail (3 inner
  CartButtons), GNSkuDetail — each takes onAddToCart, passed through
  from the root via addPendingToCart.
- Cards: CharacterCardItem, CharacterCardDetail (3 inner buttons:
  Still / Motion / Bundle). buildPendingPurchase() helper extracted
  so express-buy and add-to-cart use the same SKU shape.
- Bundles: BundleGridCard, CardPackCard, BundleDetail, PackDetail.
  Fixed mislabeled "Add to Cart" buttons in BundleDetail/PackDetail
  that were actually doing express-buy — now correctly named
  "Buy Bundle"/"Buy Pack" with a +cart split.
- Investor: InvestorBundleCard + InvestorBundleDetail.

End-to-end behaviour after this commit:
- Click main button on any card → opens single-item ContentPurchase
  modal (express buy, unchanged from before).
- Click + on any card → adds to cart, opens drawer, qty stackable.
- Cart drawer's Checkout still iterates per-item via single-item
  modal (Phase 2 will replace with /api/cart/quote+complete).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Each card now offers both express "Buy now" and explicit "Add to Cart"
actions side-by-side. Phase 1 wired the cart provider + drawer + qty
stepper across all four tabs but the cards themselves still went
single-item-only. This pass adds the cart-add affordance.

CartButton (Episodes / Cards / Bundles tabs):
- Added optional `onAddToCart` prop. When provided, the component
  renders as a split button: main pill on the left (express buy via
  ContentPurchaseModal), small "+" pill on the right (cart add via
  useKnytCart.addToCart). When omitted, renders the original single-
  click button — back-compat for existing callsites.

Investor tab:
- New `InvestorBuyRow` component (the equivalent of CartButton for the
  yellow investor-themed buttons).
- `InvestorBundleCard` and `InvestorBundleDetail` accept `onAddToCart`
  and render the +cart split.

Wiring through inner components:
- Episodes: GNGridCard, EpisodeGridCard, EpisodeDetail (3 inner
  CartButtons), GNSkuDetail — each takes onAddToCart, passed through
  from the root via addPendingToCart.
- Cards: CharacterCardItem, CharacterCardDetail (3 inner buttons:
  Still / Motion / Bundle). buildPendingPurchase() helper extracted
  so express-buy and add-to-cart use the same SKU shape.
- Bundles: BundleGridCard, CardPackCard, BundleDetail, PackDetail.
  Fixed mislabeled "Add to Cart" buttons in BundleDetail/PackDetail
  that were actually doing express-buy — now correctly named
  "Buy Bundle"/"Buy Pack" with a +cart split.
- Investor: InvestorBundleCard + InvestorBundleDetail.

End-to-end behaviour after this commit:
- Click main button on any card → opens single-item ContentPurchase
  modal (express buy, unchanged from before).
- Click + on any card → adds to cart, opens drawer, qty stackable.
- Cart drawer's Checkout still iterates per-item via single-item
  modal (Phase 2 will replace with /api/cart/quote+complete).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |

## Stats

 4 files changed, 289 insertions(+), 71 deletions(-)
