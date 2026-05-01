# Commit Brief: `10bf19a` — KNYT cart Phase 1 — qty stepper, count badge, drawer mounted across all 4 store tabs

| Field | Value |
|-------|-------|
| SHA | [`10bf19a`](https://github.com/iQube-Protocol/AigentZBeta/commit/10bf19ab4be31721f1d937ebf20e2f373725de19) |
| Author | Claude |
| Date | 2026-04-30T19:21:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 1 — qty stepper, count badge, drawer mounted across all 4 store tabs

Foundation pass for the proper cart feature. Layers on top of the
existing useKnytCart + KnytCartDrawer (which were only wired into the
Bundles tab) — adds qty support, fixes the count badge, and surfaces
the cart in Episodes / Cards / Investor.

types/knyt-store.ts:
- CartItem gains optional qty field (defaults to 1, back-compat for
  any persisted cart from before this change).
- cartTotal + cartTotalWithKnyt now multiply by qty per line.
- New cartItemCount() — sum of qty across lines (used by the badge so
  the count reflects actual items, not just unique SKUs).

useKnytCart.ts:
- addToCart() — if a line with the same id exists, increment qty
  instead of appending a duplicate row. Multi-purchase by repeated
  clicks; qty UI stays clean.
- New setQty(id, qty) — qty <= 0 removes the line.
- Reads back-compat: any persisted line missing qty is normalised to 1
  on load.
- Returns count (sum of qty) alongside total / totalWithKnyt.

KnytCartDrawer.tsx:
- Header count uses cartItemCount() (was items.length — wrong with qty).
- Each line renders a +/- stepper bound to onSetQty (host-passed).
  Falls back to a read-only "qty: N" tag when the host doesn't wire
  setQty (back-compat).
- Line total = unit price × qty; "× $unit" sub-line shown when qty>1.

Wired the cart into the three missing tabs:
- KnytStoreEpisodesTab: cart badge in toolbar, addPendingToCart()
  helper, drawer mounted at root.
- KnytStoreCardsTab: same.
- KnytStoreInvestorTab: same; toolbar restructured to always render
  (was conditional on sub-view) so the cart badge is visible from
  the landing page too. addBundleToCart() helper.
- KnytStoreBundlesTab: badge + drawer now use cart.count and pass
  onSetQty (was already cart-aware, just upgraded).

Express buy via the existing CartButton onClick (which opens
ContentPurchaseModal) is unchanged everywhere — no UX regression.

Phase 1.1 (next): add explicit Add-to-Cart buttons on Episodes /
Cards / Investor cards alongside the existing express-buy buttons.
Phase 2: server-side /api/cart/{quote,complete} for atomic multi-item
settlement. Phase 3: KNYT-topup-at-checkout. Phase 4: promote to
SmartTriad primitive. Phase 5: codex content + Qriptopian wiring.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Foundation pass for the proper cart feature. Layers on top of the
existing useKnytCart + KnytCartDrawer (which were only wired into the
Bundles tab) — adds qty support, fixes the count badge, and surfaces
the cart in Episodes / Cards / Investor.

types/knyt-store.ts:
- CartItem gains optional qty field (defaults to 1, back-compat for
  any persisted cart from before this change).
- cartTotal + cartTotalWithKnyt now multiply by qty per line.
- New cartItemCount() — sum of qty across lines (used by the badge so
  the count reflects actual items, not just unique SKUs).

useKnytCart.ts:
- addToCart() — if a line with the same id exists, increment qty
  instead of appending a duplicate row. Multi-purchase by repeated
  clicks; qty UI stays clean.
- New setQty(id, qty) — qty <= 0 removes the line.
- Reads back-compat: any persisted line missing qty is normalised to 1
  on load.
- Returns count (sum of qty) alongside total / totalWithKnyt.

KnytCartDrawer.tsx:
- Header count uses cartItemCount() (was items.length — wrong with qty).
- Each line renders a +/- stepper bound to onSetQty (host-passed).
  Falls back to a read-only "qty: N" tag when the host doesn't wire
  setQty (back-compat).
- Line total = unit price × qty; "× $unit" sub-line shown when qty>1.

Wired the cart into the three missing tabs:
- KnytStoreEpisodesTab: cart badge in toolbar, addPendingToCart()
  helper, drawer mounted at root.
- KnytStoreCardsTab: same.
- KnytStoreInvestorTab: same; toolbar restructured to always render
  (was conditional on sub-view) so the cart badge is visible from
  the landing page too. addBundleToCart() helper.
- KnytStoreBundlesTab: badge + drawer now use cart.count and pass
  onSetQty (was already cart-aware, just upgraded).

Express buy via the existing CartButton onClick (which opens
ContentPurchaseModal) is unchanged everywhere — no UX regression.

Phase 1.1 (next): add explicit Add-to-Cart buttons on Episodes /
Cards / Investor cards alongside the existing express-buy buttons.
Phase 2: server-side /api/cart/{quote,complete} for atomic multi-item
settlement. Phase 3: KNYT-topup-at-checkout. Phase 4: promote to
SmartTriad primitive. Phase 5: codex content + Qriptopian wiring.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytCartDrawer.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `app/triad/components/codex/tabs/useKnytCart.ts` |
| Modified | `types/knyt-store.ts` |

## Stats

 7 files changed, 276 insertions(+), 23 deletions(-)
