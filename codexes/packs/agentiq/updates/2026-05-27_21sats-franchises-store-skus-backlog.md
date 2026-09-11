# 21 Sats Franchises — store_skus seed + fulfilment wiring backlog

**Date:** 2026-05-27
**Branch:** `claude/review-session-setup-V82mB` → dev
**Scope:** KNYT cartridge → Investor KNYT → 21 Sats Franchises

## What shipped

Three new SKUs landed in `types/knyt-store.ts::BUNDLE_PRICING` and render in the **Investor KNYT** tab under a new **"21 Sats Franchises"** section beneath Collection Bundles:

| SKU ID | Label | Price | Cohort gate | Rails |
|---|---|---|---|---|
| `franchise-21sats-guild-zeroknyt` | 21 Sats Guild ZeroKNYT | $3,000 | `zero_knyt` | USDC / Q¢ / PayPal (KNYT suppressed) |
| `franchise-21sats-guild-triadknyt` | 21 Sats Guild TriadKNYT | $12,000 | `zero_knyt` | USDC / Q¢ / PayPal (KNYT suppressed) |
| `franchise-21sats-franchisee-poa` | 21 Sats Franchisee PoA | PoA | `zero_knyt` | n/a — Apply → mailto `info@metame.com` |

UI gates working:
- Tab visible to verified investors only (`investorOnly: true` on the codex tab).
- Buy buttons gated to `campaignCohort === 'zero_knyt'`; admins bypass.
- Franchise SKUs suppressed from retail Premium Bundles section.
- KNYT pay rail hidden in the purchase modal for SKUs flagged `noKnytRail`.
- `/api/purchase/complete` + `/api/purchase/paypal/create-order` switched to `personaFetch` so Q¢ / USDC / PayPal no longer 401.

## Pending — server-side wiring (PARAMOUNT before fulfilment)

The frontend can complete a payment for these SKUs, but the post-purchase pipeline doesn't yet know what to do with the order. Two backend tracks:

### 1. `store_skus` seed rows

`services/rewards/purchaseHandler.ts` joins purchases to `store_skus` for:
- Entitlement grants (`grants_episodes_*`, `grants_gn_*`, `grants_role_*`)
- Cohort / membership writes
- Partner attribution
- Fulfilment-tier metadata

Need to seed three rows. Open questions before writing the SQL:

- **`kind`** — `'bundle'` like other investor bundles, or a new `'franchise'` kind that the handler can branch on?
- **`grants_role_*`** — guild membership granted on Guild ZeroKNYT / Guild TriadKNYT purchases. Need a role slug (e.g. `'21sats-guild-zero'`, `'21sats-guild-triad'`) and corresponding `personas_roles` writes wired up.
- **`grants_franchise_position_*`** — Franchisee PoA, once allocated by Ops, should grant a `'21sats-franchisee'` slot. Likely a new column (`grants_franchise_slot`) plus a `franchise_slots` ledger table.
- **Fulfilment policy** — guild SKUs presumably collect off-platform email + crypto address; franchisee SKU is fully manual. Need a `fulfilment_handler` enum value (existing values: `'auto'`, `'signed-author'`, `'publisher'`; new value `'manual-investor-ops'` likely).

### 2. KNYT COYN 20% bonus payout

`bonusKnytCoynPct: 20` is already captured on the SKU. The fulfilment pipeline needs to:

1. Read `BUNDLE_PRICING.find(b => b.id === sku.id).bonusKnytCoynPct` when a purchase resolves.
2. Compute `bonusKnyt = priceUsd * (pct / 100) / liveKnytUsdRate`.
3. Credit the buyer's DVN KNYT balance via the existing rewards ledger (same write path that grants completion bonuses).
4. Emit a `bonus_grant` DVN receipt anchored to the SKU id (T2 alias only — no T0 personaId in the receipt).

This is a small add to `services/rewards/purchaseHandler.ts` once the `store_skus` rows exist.

### 3. PoA application capture (optional, low priority)

Currently the Apply button on the Franchisee PoA card opens a `mailto:info@metame.com?subject=Application: 21 Sats Franchisee PoA`. That's enough for v1.

Future improvement: replace the mailto with an in-app modal that:
- Captures the persona's preferred contact channel + investment context.
- Writes to a new `franchise_applications` table for Ops triage.
- Sends a templated email to `info@metame.com` server-side (no client-side mailto exposure).
- Emits a `franchise_application_received` receipt.

## Files for the next agent picking this up

- `types/knyt-store.ts` — three SKU definitions (search for `franchise-21sats-`); new fields `noKnytRail`, `priceOnApplication`, `purchaseCohort`, `bonusKnytCoynPct`, `initialClaimed`, `category`, `poaEmail`.
- `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` — UI section + cohort gate (`isZeroKnyt`, `isAdmin`).
- `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` — retail filter excluding `category === 'franchise'`.
- `app/triad/components/content/ContentPurchaseModal.tsx` — `disableKnytRail` prop + `personaFetch` for the spine routes.
- `services/rewards/purchaseHandler.ts` — where the store_skus join + entitlement grants happen (yet to extend for franchise kinds).
- `app/api/crm/campaign/investor-status/route.ts` — source of truth for `campaignCohort === 'zero_knyt'`.

## Operator decisions needed before SQL seeding

1. `store_skus.kind` value — `'bundle'` or `'franchise'`?
2. Role slugs for guild memberships.
3. Whether to introduce `franchise_slots` table or piggyback on `personas_roles`.
4. Fulfilment handler enum for manual investor-ops processing.
5. Bonus payout timing — at purchase confirmation, on KS-backed event, or on shipment?

Tell me the answers and I'll write the SQL + extend `purchaseHandler.ts`.
