# Comprehensive Token Gating — Backlog (post-launch)

**Date raised:** 2026-05-02
**Status:** backlog — deferred until after the investor-launch golden path is live
**Operator request:** "Now we want to return to token gating content KNYT Cartridge content. If a persona does not have access to a content item then they should be directed to the purchase modal for that content item. … This must happen wherever these assets are surfaced, in the codex, in the store, in Terra, in Digiterra, in community pages etc. The content and its access rights are independent of where it is surfaced."

## Mental model

Three surface types, each with a clear role:

- **Codex** — canonical library; every viewable asset (episode-still, episode-motion, character card, GN, lore doc) is defined here
- **Store** — commercial wrapper; assets get bundled into SKUs that can be sold
- **Cartridge surfaces** — where assets are shown to users (Scrolls, Characters, Terra, Digiterra, Community, Order, 21 Sats, GN reader, etc.)

**Critical principle**: token-gating travels with the **asset**, not the surface. Same asset shown in Terra and in Scrolls uses identical access logic — checked once, applied everywhere.

## Data model to build

| Entity | What it is | Example |
|---|---|---|
| **Asset** | A canonical content item with a unique `asset_id` | `gn-episode--1`, `episode-3-still`, `character-card-XYZ`, `lore-21-sats` |
| **SKU** | A sellable bundle that grants access to N assets | `sku-knyt-codex` grants {GN, all 13 episodes still+motion, all 13 character cards} |
| **Entitlement** | A persona owns an asset (granted by purchasing a SKU) | `(persona_id, asset_id, source_sku)` |
| **Access resolver** | Single server function `userOwnsAsset(personaId, assetId)` | Returns true if any entitlement covers the asset |

## What to build

1. **DB migrations**: `store_skus` + `sku_asset_grants` tables (SKU → list of asset_ids it grants)
2. **Admin SKU table** in Codex Admin section with operator-editable SKU IDs and grant coverage
3. **Single source of truth for ownership**: server route `/api/entitlements/owns-asset` + `useAssetOwnership(personaId, assetId)` hook
4. **All surfaces use the hook**: Scrolls, Characters, GN reader, Terra, Digiterra, Community — same gate logic regardless of surface
5. **Locked-state UI is consistent**: thumbnail + lock overlay + "Purchase" CTA opens `ContentPurchaseModal` with the appropriate SKU
6. **SmartTriad quick actions are gated**: Read/Watch/Listen buttons only render and become active when the asset is owned; clicking routes to the right viewer (PDF / video / audio)
7. **Lore stays admin-only**: existing gate untouched
8. **Investor SKUs stay CRM-gated**: existing gate untouched

## KNYT Codex SKU concrete coverage

`sku-knyt-codex` grants entitlement to:

- 1× `gn-episode--1` (graphic novel)
- 13× `episode-N-still` (N = 0..12)
- 13× `episode-N-motion` (N = 0..12)
- 13× `character-card-N`

Anyone with this SKU can read/watch/view any of the above on any surface.

## Stub-to-full unpack path (referenced in the launch decision)

Today's launch grants **one bundle entitlement** per purchase (e.g. `(persona_id, asset_id='knyt-codex-investor')`). The library uses the existing virtual-unpack logic in `/api/entitlements/list` to render the 27 contained items.

When this comprehensive backlog ships, the bundle-purchase handler can additionally fan out 27 individual `user_entitlements` rows at distribution time so each asset has its own grant trail. This is the "claim individual items at distribution time" model the operator wants.

## Build sequence

- **Cycle 1**: Foundation
  - Migrations for `store_skus` + `sku_asset_grants`
  - Admin SKU table UI
  - Seed the catalog with `sku-knyt-codex` and individual-asset SKUs
  - Server resolver + client hook
- **Cycle 2**: Gating wiring
  - Wire all surfaces (Scrolls, Characters, GN reader, Terra, Digiterra, Community) to the hook
  - Locked-state UI + ContentPurchaseModal CTA
  - SmartTriad quick action wiring (read/watch/listen buttons appear only when owned)
- **Cycle 3**: Purchase → fan-out flow
  - Bundle SKU purchase optionally writes individual entitlements at distribution time
  - Operator can configure SKU coverage from the admin UI

## Related files

- `services/rewards/purchaseHandler.ts` — extend to call SKU-asset-fan-out on bundle purchase
- `services/rewards/entitlementService.ts` — extend with `userOwnsAsset(personaId, assetId)`
- `app/api/entitlements/list/route.ts` — replace virtual-unpack with real fan-out lookup
- `app/triad/components/codex/tabs/KnytTab.tsx` — surface-side gating wiring
- `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` — admin SKU table host
- `app/triad/components/content/ContentPurchaseModal.tsx` — locked-CTA target
- `app/components/content/SmartContentActions.tsx` — Read/Watch/Listen quick-actions
