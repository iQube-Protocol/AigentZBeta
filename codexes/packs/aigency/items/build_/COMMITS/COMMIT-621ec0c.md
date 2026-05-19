# Commit Brief: `621ec0c` — knyt pricing: align store UI + server debit with live KNYT→USD rate

| Field | Value |
|-------|-------|
| SHA | [`621ec0c`](https://github.com/iQube-Protocol/AigentZBeta/commit/621ec0cc4e332123ea5f71b957661cd52fd20325) |
| Author | Claude |
| Date | 2026-05-19T03:58:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
knyt pricing: align store UI + server debit with live KNYT→USD rate

Root cause: three separate hardcoded \$1.40 KNYT→USD fallbacks were drifting
from the live ethPriceUsd × 0.0005 rate that the BuyKnytModal uses
(~\$1.0643 today). Store UI rendered \$168 as 120 KNYT (168/1.40) when the
correct figure is 157.85 KNYT (168/1.0643). The server-side debit had the
same drift, causing "Insufficient KNYT" errors when buyers had enough
balance for the displayed price but the actual debit went through a
different conversion.

Changes:

(1) types/knyt-store.ts — usdToKnyt(usd, rate?) now accepts an optional
    live rate parameter. KNYT_USD_RATE = 1.40 remains as fallback only.

(2) Four store tabs (Bundles / Cards / Episodes / Investor) — import
    useEthPrice, derive liveKnytRate = knytPriceUsd, pass through to
    every usdToKnyt() call and to the new knytUsdRate prop on
    ContentPurchaseModal.

(3) ContentPurchaseModal — new optional knytUsdRate prop; calculatePricing
    accepts it and uses live rate for the USD-fallback derivation and the
    KNYT-rail discount math. Display of "(\$X USD)" next to the KNYT line
    also uses the live rate.

(4) services/wallet/knyt/knytPricingService.getMultiRailPricing — new
    optional knytUsdRate parameter, threaded through usdBasePrice and
    knytPriceTokens calculations. Static rate stays as fallback.

(5) services/wallet/knyt/knytSkuQuoteService.quoteSkuOffers — fetches
    live rate via getKnytUsdPrice() and overrides the env-derived knob
    before passing knobs to quoteFromUsdBase. Live debit math.

(6) services/rewards/purchaseHandler.processPurchase — awaits
    getKnytUsdPrice() once at the top, passes through to the
    bundle-SKU branch (via usdToKnyt) and to getMultiRailPricing. The
    server's debit now matches what the buyer sees in the modal.

Result: \$168 bundle now shows ~158 KNYT (live) instead of 120 KNYT
(static), and the wallet debits the same amount on confirmation.
Bring-A-Knight and PayPal/USDC paths inherit the live USD base price
through the same path.
```

## Body

Root cause: three separate hardcoded \$1.40 KNYT→USD fallbacks were drifting
from the live ethPriceUsd × 0.0005 rate that the BuyKnytModal uses
(~\$1.0643 today). Store UI rendered \$168 as 120 KNYT (168/1.40) when the
correct figure is 157.85 KNYT (168/1.0643). The server-side debit had the
same drift, causing "Insufficient KNYT" errors when buyers had enough
balance for the displayed price but the actual debit went through a
different conversion.

Changes:

(1) types/knyt-store.ts — usdToKnyt(usd, rate?) now accepts an optional
    live rate parameter. KNYT_USD_RATE = 1.40 remains as fallback only.

(2) Four store tabs (Bundles / Cards / Episodes / Investor) — import
    useEthPrice, derive liveKnytRate = knytPriceUsd, pass through to
    every usdToKnyt() call and to the new knytUsdRate prop on
    ContentPurchaseModal.

(3) ContentPurchaseModal — new optional knytUsdRate prop; calculatePricing
    accepts it and uses live rate for the USD-fallback derivation and the
    KNYT-rail discount math. Display of "(\$X USD)" next to the KNYT line
    also uses the live rate.

(4) services/wallet/knyt/knytPricingService.getMultiRailPricing — new
    optional knytUsdRate parameter, threaded through usdBasePrice and
    knytPriceTokens calculations. Static rate stays as fallback.

(5) services/wallet/knyt/knytSkuQuoteService.quoteSkuOffers — fetches
    live rate via getKnytUsdPrice() and overrides the env-derived knob
    before passing knobs to quoteFromUsdBase. Live debit math.

(6) services/rewards/purchaseHandler.processPurchase — awaits
    getKnytUsdPrice() once at the top, passes through to the
    bundle-SKU branch (via usdToKnyt) and to getMultiRailPricing. The
    server's debit now matches what the buyer sees in the modal.

Result: \$168 bundle now shows ~158 KNYT (live) instead of 120 KNYT
(static), and the wallet debits the same amount on confirmation.
Bring-A-Knight and PayPal/USDC paths inherit the live USD base price
through the same path.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `app/triad/components/content/ContentPurchaseModal.tsx` |
| Modified | `services/rewards/purchaseHandler.ts` |
| Modified | `services/wallet/knyt/knytPricingService.ts` |
| Modified | `services/wallet/knyt/knytSkuQuoteService.ts` |
| Modified | `types/knyt-store.ts` |

## Stats

 10 files changed, 115 insertions(+), 36 deletions(-)
