# Commit Brief: `473ad62` — KNYT cart Phase 1.2 — close drawer on checkout + cart context in payment modal

| Field | Value |
|-------|-------|
| SHA | [`473ad62`](https://github.com/iQube-Protocol/AigentZBeta/commit/473ad62a92c619967a12c7db4001cdf6513993f1) |
| Author | Claude |
| Date | 2026-04-30T22:25:33Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 1.2 — close drawer on checkout + cart context in payment modal

Two related fixes per user feedback ("payment modal hidden by overlay"
and "summary at the top needs to reflect what's being purchased from
the cart").

KnytCartDrawer:
- The drawer's z-[56] sat above ContentPurchaseModal's z-50, so the
  payment modal was visually buried after Checkout. Restructured so
  the drawer + backdrop are wrapped in `{open && (<>...</>)}` while
  the modal stays mounted outside that gate. The Checkout button
  now: setCheckoutItem(items[0]) → onClose() to close the drawer.
  When the per-item iteration completes (or the user closes the
  modal), the drawer stays closed; user re-opens it via the cart
  badge if they want to see what's left.
- Tracks the index of the line currently in checkout and computes
  the running "remainingUsd" for the lines not yet settled. Both
  flow into the new cartContext prop on ContentPurchaseModal.

ContentPurchaseModal:
- New optional `cartContext` prop:
    { itemIndex, totalItems, cartTotalUsd, remainingUsd?, useKnytDiscount? }
  When set, renders an amber banner between the hero and body:
    "Cart checkout · Item 2 of 3"
    "Cart total $42.00 · $28.00 remaining · KNYT 20% applied"
  Per-item product image / title / price still drive the rest of
  the modal — the existing single-item flow is untouched. Phase 2
  will replace the iteration with /api/cart/{quote,complete}.

End-to-end after this: click Checkout → drawer closes → modal
opens with "Cart checkout · Item 1 of 3" banner above the existing
purchase UI → settle item → modal advances to item 2 → repeat.
The user always knows where they are in the flow and what's left
to pay.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Two related fixes per user feedback ("payment modal hidden by overlay"
and "summary at the top needs to reflect what's being purchased from
the cart").

KnytCartDrawer:
- The drawer's z-[56] sat above ContentPurchaseModal's z-50, so the
  payment modal was visually buried after Checkout. Restructured so
  the drawer + backdrop are wrapped in `{open && (<>...</>)}` while
  the modal stays mounted outside that gate. The Checkout button
  now: setCheckoutItem(items[0]) → onClose() to close the drawer.
  When the per-item iteration completes (or the user closes the
  modal), the drawer stays closed; user re-opens it via the cart
  badge if they want to see what's left.
- Tracks the index of the line currently in checkout and computes
  the running "remainingUsd" for the lines not yet settled. Both
  flow into the new cartContext prop on ContentPurchaseModal.

ContentPurchaseModal:
- New optional `cartContext` prop:
    { itemIndex, totalItems, cartTotalUsd, remainingUsd?, useKnytDiscount? }
  When set, renders an amber banner between the hero and body:
    "Cart checkout · Item 2 of 3"
    "Cart total $42.00 · $28.00 remaining · KNYT 20% applied"
  Per-item product image / title / price still drive the rest of
  the modal — the existing single-item flow is untouched. Phase 2
  will replace the iteration with /api/cart/{quote,complete}.

End-to-end after this: click Checkout → drawer closes → modal
opens with "Cart checkout · Item 1 of 3" banner above the existing
purchase UI → settle item → modal advances to item 2 → repeat.
The user always knows where they are in the flow and what's left
to pay.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytCartDrawer.tsx` |
| Modified | `app/triad/components/content/ContentPurchaseModal.tsx` |

## Stats

 2 files changed, 73 insertions(+), 3 deletions(-)
