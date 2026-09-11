# Commit Brief: `9ddf15d` — KNYT store: surface-scoped includes + initialClaimed in sku-supply + retail X-of-Y badge

| Field | Value |
|-------|-------|
| SHA | [`9ddf15d`](https://github.com/iQube-Protocol/AigentZBeta/commit/9ddf15d9dbe5ed9097b2c057462735aa23748e18) |
| Author | Claude |
| Date | 2026-05-28T21:14:28Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT store: surface-scoped includes + initialClaimed in sku-supply + retail X-of-Y badge

Three fixes for the operator's badge / bundle reports:

1) Investor-only includes override
   Add BundlePricing.investorIncludes optional override. The Investor
   tab renders investorIncludes when defined, else falls through to
   includes. First KNYT bundle's "Author Signed available to current
   ZeroKNYTs ONLY" gate now lives in investorIncludes only — the
   retail Bundles tab keeps the unsuffixed Hardcover AGN line.

2) sku-supply honours initialClaimed
   /api/wallet/knyt/sku-supply was computing
     remaining = limitedSupply - sold
   ignoring the static initialClaimed counter that records off-platform
   allocations (e.g. the 6 Franchisee PoA slots already hand-allocated).
   Once the bundle id was included in the /sku-supply fetch the FE
   preferred the live remaining over the static initialClaimed math and
   the badge silently reverted to "21 of 21 Left". Fix: subtract
   bundle.initialClaimed alongside sold in the route. Franchisee PoA
   now returns remaining=15, matching the operator-set count.

3) Retail Bundles tab gets X-of-Y left badge
   Zero KNYT + Satoshi KNYT Collection share their inventory pool with
   the Investor tab versions (same isLimited SKU), but the Bundles tab
   was only showing a static "Limited N" pill. Add the same /sku-supply
   fetch + supplyMap that the Investor tab uses, thread remainingSupply
   into BundleGridCard + BundleDetail, and render the live "X of Y Left"
   badge with identical math (remainingSupply ?? limitedSupply -
   initialClaimed ?? limitedSupply). Grid card places the badge below
   the "eps" pill at top-6 right-1 to avoid stacking conflict.
```

## Body

Three fixes for the operator's badge / bundle reports:

1) Investor-only includes override
   Add BundlePricing.investorIncludes optional override. The Investor
   tab renders investorIncludes when defined, else falls through to
   includes. First KNYT bundle's "Author Signed available to current
   ZeroKNYTs ONLY" gate now lives in investorIncludes only — the
   retail Bundles tab keeps the unsuffixed Hardcover AGN line.

2) sku-supply honours initialClaimed
   /api/wallet/knyt/sku-supply was computing
     remaining = limitedSupply - sold
   ignoring the static initialClaimed counter that records off-platform
   allocations (e.g. the 6 Franchisee PoA slots already hand-allocated).
   Once the bundle id was included in the /sku-supply fetch the FE
   preferred the live remaining over the static initialClaimed math and
   the badge silently reverted to "21 of 21 Left". Fix: subtract
   bundle.initialClaimed alongside sold in the route. Franchisee PoA
   now returns remaining=15, matching the operator-set count.

3) Retail Bundles tab gets X-of-Y left badge
   Zero KNYT + Satoshi KNYT Collection share their inventory pool with
   the Investor tab versions (same isLimited SKU), but the Bundles tab
   was only showing a static "Limited N" pill. Add the same /sku-supply
   fetch + supplyMap that the Investor tab uses, thread remainingSupply
   into BundleGridCard + BundleDetail, and render the live "X of Y Left"
   badge with identical math (remainingSupply ?? limitedSupply -
   initialClaimed ?? limitedSupply). Grid card places the badge below
   the "eps" pill at top-6 right-1 to avoid stacking conflict.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/wallet/knyt/sku-supply/route.ts` |
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `types/knyt-store.ts` |

## Stats

 4 files changed, 96 insertions(+), 16 deletions(-)
