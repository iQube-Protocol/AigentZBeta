# Commit Brief: `0008bf6` — KNYT cart Phase 2c — multi-item KnytCartCheckoutModal replaces per-item iteration

| Field | Value |
|-------|-------|
| SHA | [`0008bf6`](https://github.com/iQube-Protocol/AigentZBeta/commit/0008bf684abd7b1416590185a3586f9fb45ec4bf) |
| Author | Claude |
| Date | 2026-04-30T22:51:53Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 2c — multi-item KnytCartCheckoutModal replaces per-item iteration

Final piece of the cart checkout pipeline. The drawer's Checkout button
now opens a single multi-item modal that settles every line in one
round-trip via /api/cart/{quote,complete} — no more iterating through
ContentPurchaseModal one item at a time.

KnytCartCheckoutModal (new):
- Calls /api/cart/quote on open + when items change to fetch
  authoritative per-rail totals (KNYT / Q¢ / USDC / PayPal).
- Shows a scrollable line list (image / label / qty / line total),
  rail picker (4 buttons with totals + per-rail notes), and a Pay
  button. Sign-in surfaced via onSignInRequest if no personaId.
- PayPal rail is rendered but disabled with note: "Single-cart PayPal
  coming in Phase 3 — for now use Buy now from any card for PayPal."
  Phase 3 will add /api/cart/paypal/{create-order,capture} to bundle
  all lines into one PayPal order.
- Pay → /api/cart/complete with the line list + selected rail.
  Shows results: "All N units settled" green, or "X of N settled · Y
  failed" amber with per-line error breakdown. Stable cart_purchase_id
  shown for audit.
- Settled lines are reported to the host via onSettled so the drawer
  can remove them; failed lines stay in cart for retry.

KnytCartDrawer (rewired):
- Replaced the checkoutItem state + ContentPurchaseModal iteration
  loop with a single checkoutOpen state + KnytCartCheckoutModal mount.
- Footer hint updated: "All items settled in a single transaction".
- onSettled handler removes settled lines via the existing onRemove
  callback. If everything settled, the modal auto-closes and the user
  lands back on the store. Mixed results keep the modal open so the
  user can read which lines failed (e.g. an asset they already own).
- Removed now-unused imports of ContentPurchaseModal + ContentType.

End-to-end after this commit:
  add to cart → drawer → Checkout → drawer closes, modal opens with
  cart line list and authoritative per-rail totals → pick rail → Pay
  → /api/cart/complete loops processPurchase per (line × qty unit)
  → modal shows results → settled lines removed from cart, failed
  lines remain for retry.

Express buy via single-item ContentPurchaseModal from any card is
unchanged. The single-item flow is parallel; cart checkout is the
new path.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Final piece of the cart checkout pipeline. The drawer's Checkout button
now opens a single multi-item modal that settles every line in one
round-trip via /api/cart/{quote,complete} — no more iterating through
ContentPurchaseModal one item at a time.

KnytCartCheckoutModal (new):
- Calls /api/cart/quote on open + when items change to fetch
  authoritative per-rail totals (KNYT / Q¢ / USDC / PayPal).
- Shows a scrollable line list (image / label / qty / line total),
  rail picker (4 buttons with totals + per-rail notes), and a Pay
  button. Sign-in surfaced via onSignInRequest if no personaId.
- PayPal rail is rendered but disabled with note: "Single-cart PayPal
  coming in Phase 3 — for now use Buy now from any card for PayPal."
  Phase 3 will add /api/cart/paypal/{create-order,capture} to bundle
  all lines into one PayPal order.
- Pay → /api/cart/complete with the line list + selected rail.
  Shows results: "All N units settled" green, or "X of N settled · Y
  failed" amber with per-line error breakdown. Stable cart_purchase_id
  shown for audit.
- Settled lines are reported to the host via onSettled so the drawer
  can remove them; failed lines stay in cart for retry.

KnytCartDrawer (rewired):
- Replaced the checkoutItem state + ContentPurchaseModal iteration
  loop with a single checkoutOpen state + KnytCartCheckoutModal mount.
- Footer hint updated: "All items settled in a single transaction".
- onSettled handler removes settled lines via the existing onRemove
  callback. If everything settled, the modal auto-closes and the user
  lands back on the store. Mixed results keep the modal open so the
  user can read which lines failed (e.g. an asset they already own).
- Removed now-unused imports of ContentPurchaseModal + ContentType.

End-to-end after this commit:
  add to cart → drawer → Checkout → drawer closes, modal opens with
  cart line list and authoritative per-rail totals → pick rail → Pay
  → /api/cart/complete loops processPurchase per (line × qty unit)
  → modal shows results → settled lines removed from cart, failed
  lines remain for retry.

Express buy via single-item ContentPurchaseModal from any card is
unchanged. The single-item flow is parallel; cart checkout is the
new path.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Added | `app/triad/components/codex/tabs/KnytCartCheckoutModal.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytCartDrawer.tsx` |

## Stats

 2 files changed, 469 insertions(+), 44 deletions(-)
