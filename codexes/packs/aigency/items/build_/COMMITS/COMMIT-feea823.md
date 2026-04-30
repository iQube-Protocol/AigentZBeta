# Commit Brief: `feea823` — KNYT cart Phase 2b — server-side /api/cart/{quote,complete} endpoints

| Field | Value |
|-------|-------|
| SHA | [`feea823`](https://github.com/iQube-Protocol/AigentZBeta/commit/feea8234cd7c2690a3ede44c295d11456f456179) |
| Author | Claude |
| Date | 2026-04-30T22:48:41Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 2b — server-side /api/cart/{quote,complete} endpoints

Builds the server side that Phase 2c's KnytCartCheckoutModal will
consume. No UI changes in this commit — the existing per-item drawer
iteration still ships unchanged.

POST /api/cart/quote (read-only, anonymous-friendly):
- Body: { personaId?, lines: [{ id, contentType?, priceUsd, qty? }] }
- Loops getMultiRailPricing() per line (cart's priceUsd → baseKnyt
  via KNYT_USD_RATE; same canonical rail logic the existing
  ContentPurchaseModal uses).
- Returns per-rail totals (KNYT / Q¢ / USDC / PayPal) plus per-line
  breakdowns. Multipliers (knyt 20% discount, usdc 1% + premium,
  paypal 3% + premium) match existing single-item flow exactly so
  there are no surprises moving from express buy to cart checkout.
- Lines without contentType fall back to 'scroll_still' for pricing
  shape — rail multipliers apply uniformly to priceUsd regardless.

POST /api/cart/complete (KNYT / Q¢ / USDC; PayPal handled separately
in Phase 2c via /cart/paypal/{create-order, capture}):
- Body: { personaId, paymentRail, lines, paymentReference?, metadata? }
- Maps cart's rail name 'qcents' → processPurchase's 'qc'.
- Stamps a stable cartPurchaseId on every per-line metadata so the
  history view can group lines back together.
- Loops processPurchase() per (line × qty unit) — one purchase row +
  entitlement per unit, matching the existing single-item flow's
  semantics for multi-purchase support.
- On insufficient-balance error mid-loop: short-circuits remaining
  units and lines, returns ok:false with detailed per-unit results
  (the unsettled lines stay in cart for retry).
- On other per-line errors: continues, returns mixed-success result.

Atomicity caveat: this is loop-per-line, not a single DB transaction.
For v1 the pre-flight balance is whatever processPurchase enforces
(checks balance per call). Phase 2.5 can wrap in a Supabase RPC for
true rollback semantics. For now, the worst case is a partial
purchase the user can complete via retry.

Both routes:
- runtime = 'nodejs'
- dynamic = 'force-dynamic' (server-time pricing, no static cache)
- maxDuration = 30 on /complete (multi-line purchases can take a while
  on cold-Lambda starts; matches the single-item route's budget)

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Builds the server side that Phase 2c's KnytCartCheckoutModal will
consume. No UI changes in this commit — the existing per-item drawer
iteration still ships unchanged.

POST /api/cart/quote (read-only, anonymous-friendly):
- Body: { personaId?, lines: [{ id, contentType?, priceUsd, qty? }] }
- Loops getMultiRailPricing() per line (cart's priceUsd → baseKnyt
  via KNYT_USD_RATE; same canonical rail logic the existing
  ContentPurchaseModal uses).
- Returns per-rail totals (KNYT / Q¢ / USDC / PayPal) plus per-line
  breakdowns. Multipliers (knyt 20% discount, usdc 1% + premium,
  paypal 3% + premium) match existing single-item flow exactly so
  there are no surprises moving from express buy to cart checkout.
- Lines without contentType fall back to 'scroll_still' for pricing
  shape — rail multipliers apply uniformly to priceUsd regardless.

POST /api/cart/complete (KNYT / Q¢ / USDC; PayPal handled separately
in Phase 2c via /cart/paypal/{create-order, capture}):
- Body: { personaId, paymentRail, lines, paymentReference?, metadata? }
- Maps cart's rail name 'qcents' → processPurchase's 'qc'.
- Stamps a stable cartPurchaseId on every per-line metadata so the
  history view can group lines back together.
- Loops processPurchase() per (line × qty unit) — one purchase row +
  entitlement per unit, matching the existing single-item flow's
  semantics for multi-purchase support.
- On insufficient-balance error mid-loop: short-circuits remaining
  units and lines, returns ok:false with detailed per-unit results
  (the unsettled lines stay in cart for retry).
- On other per-line errors: continues, returns mixed-success result.

Atomicity caveat: this is loop-per-line, not a single DB transaction.
For v1 the pre-flight balance is whatever processPurchase enforces
(checks balance per call). Phase 2.5 can wrap in a Supabase RPC for
true rollback semantics. For now, the worst case is a partial
purchase the user can complete via retry.

Both routes:
- runtime = 'nodejs'
- dynamic = 'force-dynamic' (server-time pricing, no static cache)
- maxDuration = 30 on /complete (multi-line purchases can take a while
  on cold-Lambda starts; matches the single-item route's budget)

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/cart/complete/route.ts` |
| Added | `app/api/cart/quote/route.ts` |

## Stats

 2 files changed, 377 insertions(+)
