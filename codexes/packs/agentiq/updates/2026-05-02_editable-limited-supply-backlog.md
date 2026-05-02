# Editable Limited-Edition Supply on Store SKUs (Backlog)

**Date raised:** 2026-05-02
**Status:** backlog — not yet implemented
**Operator request:** "In the store I also notice the ltd edition volumes may need to be editable, as in the number of volumes available — though of course once sales begin. Add this to the backlog."

## Scope

Some store SKUs are flagged with `isLimited: true` and a fixed `limitedSupply`
number in `types/knyt-store.ts`. The operator wants to be able to edit
`limitedSupply` from an admin UI **before any sales of that SKU have closed**,
and have it lock-in once the first sale is recorded.

### Examples (current values)

| SKU | `limitedSupply` |
|---|---|
| `zero-knyt-investor` | 21 |
| `satoshi-knyt-investor` | 21 (corrected from 7 in commit attached to this update) |

## Suggested implementation

1. **DB**: introduce `store_sku_supply` table (or extend an existing config
   table) keyed by `bundle_id`, with columns `limited_supply INT`,
   `first_sale_at TIMESTAMPTZ NULL`, `updated_at TIMESTAMPTZ`.
2. **API**: `PATCH /api/admin/store/sku-supply` accepts `{bundleId, limitedSupply}`
   and refuses if `first_sale_at IS NOT NULL`. Reads on the storefront prefer
   the DB row over the static `BUNDLE_PRICING` value.
3. **Admin UI**: add a "Limited supply" cell to the bundle row in the Codex
   Manager admin tab (or a new Store admin tab). Show as locked-with-tooltip
   ("Locked: first sale recorded YYYY-MM-DD") once `first_sale_at` is set.
4. **First-sale hook**: in the existing cart/checkout completion code, set
   `first_sale_at = NOW()` for every SKU on the receipt the first time.

## Why this matters

Pricing/contents catalog is in the source code today. Supply numbers are a
go-to-market parameter that the operator may need to tune late in pre-launch.
Bracketing the editable window to "until first sale" prevents accidental
oversell and protects collector-tier rarity guarantees.

## Related files

- `types/knyt-store.ts` — current `BundlePricing` definitions with `limitedSupply`
- `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` — investor surface
- `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` — retail surface
- `app/api/cart/complete/route.ts` — first-sale hook target
- `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` — likely admin host
