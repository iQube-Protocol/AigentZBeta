# Commit Brief: `73f4581` — KNYT cart Phase 3b — buy-more-KNYT panel when KNYT rail is short

| Field | Value |
|-------|-------|
| SHA | [`73f4581`](https://github.com/iQube-Protocol/AigentZBeta/commit/73f458158c5a80667aa1ec7593eb51edf622c07e) |
| Author | Claude |
| Date | 2026-04-30T23:01:48Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT cart Phase 3b — buy-more-KNYT panel when KNYT rail is short

Closes the loop on the user's "let users top up KNYT mid-checkout and
keep going with the same cart" ask. When the user picks KNYT as the
payment rail and their spendable balance is below the cart's KNYT
total, the modal surfaces a topup panel directly inline — they don't
have to leave checkout.

KnytCartCheckoutModal (extended):
- New balance fetch on open / persona change / rail switch:
  GET /api/wallet/knyt/balance?personaId=… → spendableKnyt (Tier 0
  off-chain DVN ledger, the same balance processPurchase debits).
- Computes knytShortfall = quote.rails.knyt.total - spendableKnyt.
- When shortfall > 0, lazy-loads /api/wallet/knyt/purchase to fetch
  the topup tiers (10 / 50 / 100 / 500 KNYT with bonus from
  getKnytPackages) and renders an amber inline panel:
    "You need X.XX more KNYT"
    [tiers list — smallest covering the shortfall pre-selected,
     "covers shortfall" hint on qualifying tiers]
    "Buy more KNYT via PayPal" button.
- buyMoreKnyt() reuses the existing /api/wallet/knyt/paypal/
  {create-order, capture} flow that BuyKnytModal already uses:
  open approvalUrl in a popup, poll capture every 3s, on success
  refresh balance + re-quote so the Pay button becomes valid.
- Pay button now disabled when KNYT rail is selected and there's a
  shortfall — the topup panel is the only way forward, which is the
  intended UX.

End-to-end after this commit:
  add to cart → checkout → pick KNYT rail → balance short → topup
  panel appears with smallest sufficient tier auto-selected →
  click "Buy more KNYT via PayPal" → popup → authorise → polling
  captures → balance refreshes → quote re-validates → Pay button
  re-enables → settle cart with KNYT (20% off).

Phase 3 is complete. Phase 4 promotes the cart hook + UI to
packages/smarttriad as a reusable primitive, and Phase 5 wires the
codex single-item callsites + Qriptopian stub.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Closes the loop on the user's "let users top up KNYT mid-checkout and
keep going with the same cart" ask. When the user picks KNYT as the
payment rail and their spendable balance is below the cart's KNYT
total, the modal surfaces a topup panel directly inline — they don't
have to leave checkout.

KnytCartCheckoutModal (extended):
- New balance fetch on open / persona change / rail switch:
  GET /api/wallet/knyt/balance?personaId=… → spendableKnyt (Tier 0
  off-chain DVN ledger, the same balance processPurchase debits).
- Computes knytShortfall = quote.rails.knyt.total - spendableKnyt.
- When shortfall > 0, lazy-loads /api/wallet/knyt/purchase to fetch
  the topup tiers (10 / 50 / 100 / 500 KNYT with bonus from
  getKnytPackages) and renders an amber inline panel:
    "You need X.XX more KNYT"
    [tiers list — smallest covering the shortfall pre-selected,
     "covers shortfall" hint on qualifying tiers]
    "Buy more KNYT via PayPal" button.
- buyMoreKnyt() reuses the existing /api/wallet/knyt/paypal/
  {create-order, capture} flow that BuyKnytModal already uses:
  open approvalUrl in a popup, poll capture every 3s, on success
  refresh balance + re-quote so the Pay button becomes valid.
- Pay button now disabled when KNYT rail is selected and there's a
  shortfall — the topup panel is the only way forward, which is the
  intended UX.

End-to-end after this commit:
  add to cart → checkout → pick KNYT rail → balance short → topup
  panel appears with smallest sufficient tier auto-selected →
  click "Buy more KNYT via PayPal" → popup → authorise → polling
  captures → balance refreshes → quote re-validates → Pay button
  re-enables → settle cart with KNYT (20% off).

Phase 3 is complete. Phase 4 promotes the cart hook + UI to
packages/smarttriad as a reusable primitive, and Phase 5 wires the
codex single-item callsites + Qriptopian stub.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytCartCheckoutModal.tsx` |

## Stats

 1 file changed, 229 insertions(+), 1 deletion(-)
