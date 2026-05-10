# Backlog — Pricing audit follow-ups

**Date filed:** 2026-05-10
**Workstream:** Storefront / pricing integrity
**Severity:** medium (none are blocking new sales after `37d46d56`'s
unit-price reconciliation, but each closes a future-leak class)
**Discovered by:** end-to-end SKU pricing audit, see commits `dd7093cd`
(server-side BUNDLE_PRICING lookup), `35acdb49` (cart-flow), `37d46d56`
(unit-price metadata reconciliation), `4f79fc11` (Satoshi override)

---

## Context

A full SKU-by-SKU audit was run against the four pricing surfaces (modal
display, cart display, server debit, entitlement grant). All 16
`BUNDLE_PRICING` entries are now correct end-to-end after the SKU-aware
server lookup landed. Unit purchases (single episodes, character cards)
were the remaining gap — server fell through to a static `BASE_PRICES`
placeholder that didn't track per-episode pricing. `37d46d56` closed
the immediate leak by reconciling against the client-supplied
`metadata.amount` with currency + cap guards (`max(static, validated
metadata)` so the server can only ever increase the debit, never
decrease).

Three follow-ups remain. They are not blocking — production sales settle
correctly today — but each is worth scheduling.

---

## 1. Per-episode / per-card SKU IDs server-side

**Today's pattern (`37d46d56`):** server uses `metadata.amount` as the
canonical debit when the asset isn't in `BUNDLE_PRICING`, with
guardrails:
- amount must be GREATER than the static fallback (no undercharging)
- currency must match the rail
- amount must fall under a sanity cap (5000 KNYT / $10000 USD)

This works but trusts the client to send the right number. The cap
prevents catastrophic abuse but doesn't enforce *correct* pricing per
episode. A buyer with a tampered client could send any amount in
`[static_price + 1, cap]` and the server would honour it.

**Proposed:** extend `BUNDLE_PRICING` (or a parallel `EPISODE_SKU_PRICING`
table in `types/knyt-store.ts`) with explicit per-episode SKU rows whose
`id` flows as `assetIds[0]` from the modal. `purchaseHandler` picks up
each episode's actual price the same way it picks up bundle prices today
(deterministic, no client trust). The reconciliation step in
`purchaseHandler` becomes a redundancy check rather than the primary
authority.

**Scope:**
- Define one SKU id per (episode, layer) tuple, e.g.
  `ks-ep-7-still-qripto`, `ks-ep-7-motion-digital`.
- Wire the modal & cart to send those ids as `assetIds[0]` instead of
  free-form content ids.
- Server's existing `BUNDLE_PRICING.find(b => b.id === assetIds[0])`
  becomes a multi-table lookup that also covers episode SKUs.
- Update `store_skus` seed to include episode SKU rows with appropriate
  category grants (single-episode purchases map to `episode_numbers
  ARRAY[<n>]`).

**Acceptance:**
- [ ] Every unit purchase resolves a deterministic price from a
  server-side SKU table; client `metadata.amount` becomes a redundancy
  check that logs an alert if it disagrees.
- [ ] Tamper test: a forged `metadata.amount = 1` for an episode whose
  canonical price is 5 KNYT correctly debits 5 KNYT (or rejects).
- [ ] No regression on existing `BUNDLE_PRICING` flows.

---

## 2. Character card unit pricing — verify single-card vs pack-only

`types/knyt-store.ts:KNYT_CARDS_PRICING` defines only **per-pack** prices
($26 Qripto / $26 Digital / $26 Physical). The audit didn't determine
whether single-card buys exist as a separate flow.

**Possibilities:**
- All card sales go through pack-level entitlements (one purchase grants
  all 13 cards). In that case the existing pack pricing is canonical and
  no further work is needed beyond confirming it.
- Single-card buys exist as their own flow (e.g. via a card-detail modal
  triggering `processPurchase` with `productType=knyt_character_card_still`
  and a single asset id). In that case the static `BASE_PRICES` of 1 KNYT
  per card is what the audit found applying — likely understated against
  the intended per-card economics.

**Action:**
- [ ] Trace every call site that opens `ContentPurchaseModal` with
  `contentType=character_card`. Document whether the path supports
  single-card purchase or always wraps a pack.
- [ ] If single-card flows exist, file a sub-task to define
  per-card SKU pricing (same shape as item 1) and seed `store_skus`
  accordingly.
- [ ] If only pack-level sales exist, confirm `KNYT_CARDS_PRICING` is the
  canonical price and the static 1-KNYT `BASE_PRICES.knyt_character_card_still`
  is dead code; update or remove it to prevent future confusion.

---

## 3. Audit logs review — historical leak detection

`37d46d56` added a `[PurchaseHandler] Unit-price reconciled:` log entry
on every sale that triggered the metadata.amount override. Once the
deploy lands, scanning the Amplify Lambda logs surfaces:

- **Sales that triggered the override:** these are now correctly priced.
  No action needed — they are the intended behaviour.
- **Sales that DIDN'T trigger the override but whose static debit was
  below the actual price:** these are confirmed historical leaks. The
  log will help estimate the magnitude.

**Action:**
- [ ] Once the unit-price-reconciliation deploy is live for at least 24h,
  pull Amplify CloudWatch logs filtered to
  `[PurchaseHandler] Unit-price reconciled:` for the last 30 days.
- [ ] Cross-reference with `purchases` table rows in the same window
  whose `amount` matches the static `BASE_PRICES` for their
  `product_type` (3 KNYT × 0.8 = 2.4 for `knyt_scroll_still`, 1 × 0.8 =
  0.8 for `knyt_character_card_still`, 10 × 0.8 = 8 for
  `knyt_scroll_motion`). Those rows are confirmed pre-fix leaks.
- [ ] If the leak count is non-trivial, compute the cumulative KNYT
  delta and decide whether to retroactively top-up the treasury (or
  log the gap as a known historical accounting variance).

**SQL helper to find suspect historical rows:**

```sql
SELECT id, persona_id, product_type, amount, currency, created_at, metadata
FROM purchases
WHERE status = 'completed'
  AND payment_rail = 'knyt'
  AND (
    (product_type = 'knyt_scroll_still'         AND amount <= 2.4) OR
    (product_type = 'knyt_scroll_motion'        AND amount <= 8)   OR
    (product_type = 'knyt_character_card_still' AND amount <= 0.8)
  )
  AND created_at >= '2026-04-01'  -- adjust based on when this rail went live
ORDER BY created_at DESC;
```

Each row in this output is a candidate historical leak — the buyer paid
the static placeholder rather than the per-episode price. Cross-check
against the corresponding `metadata.contentTitle` to estimate what they
were actually buying.

---

## References

- `services/rewards/purchaseHandler.ts` — current pricing reconciliation
- `types/knyt-store.ts` — `BUNDLE_PRICING`, `EPISODE_PRICING`, `KNYT_CARDS_PRICING`
- `services/wallet/knyt/knytPricingService.ts` — `BASE_PRICES`, `getMultiRailPricing`
- Audit summary in chat session: see commits referenced above
- `codexes/packs/agentiq/updates/2026-05-10_legacy-persona-migration-backlog.md` — sibling backlog item from the same firefighting session
