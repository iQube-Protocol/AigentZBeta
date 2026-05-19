# Commit Brief: `3e039bb` — knyt pricing: last-derived fallback + indicative-pricing badge

| Field | Value |
|-------|-------|
| SHA | [`3e039bb`](https://github.com/iQube-Protocol/AigentZBeta/commit/3e039bb94a2780120b670cbcb1c6240ce0e72d53) |
| Author | Claude |
| Date | 2026-05-19T04:16:20Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
knyt pricing: last-derived fallback + indicative-pricing badge

Operator request: the static $1.40 fallback drifts too far from the live
~$1.0643. Replace with the last successful live rate so the worst-case
delta is bounded by how stale the cache is, not by how long ago the static
constant was set. Add a UI badge so buyers can see when the rate is
cached/static rather than live and decide whether to proceed.

Server (services/wallet/knyt/knytPricingService.ts):
  - getKnytUsdPrice now caches last successful live rate at module scope.
    On a failed live fetch, returns the cached rate. Only falls back to
    KNYT_USD_RATE = $1.40 when no successful fetch has landed in this
    Lambda instance.
  - New getKnytUsdPriceMeta() accessor reports { rate, fetchedAt, stale,
    source: 'live' | 'cached' | 'static' } for diagnostic consumers.

Client (app/hooks/useEthPrice.ts):
  - useEthPrice persists ethPriceUsd to localStorage under
    knyt:ethPriceUsd:v1 with timestamp on each successful CoinGecko fetch.
  - Initial render reads from localStorage if available (source: 'cached')
    so the first paint shows a value close to current price instead of the
    static $3500. Once live fetch returns, source flips to 'live'.
  - Returns { stale, source, fetchedAt } in addition to the rate. stale
    is true when source !== 'live' OR fetchedAt > 1 hour old.

UI (ContentPurchaseModal):
  - New optional knytUsdRateIsStale prop. When true, renders an amber
    'Indicative pricing — KNYT/USD rate is from cache (live ETH feed
    unavailable). KNYT amount may shift slightly when the live rate
    refreshes.' badge directly under the Base Price row. Visible
    indicator that the rate isn't fully live; non-blocking.

All four store tabs (Bundles / Cards / Episodes / Investor) destructure
stale from useEthPrice and pass it through as knytUsdRateIsStale.

Result: worst-case fallback delta is the cached value's age (cap 1 hour
for the 'stale' threshold; actual rate is whatever was last live), not
the 30%+ drift between live and the $1.40 static. Buyer is informed when
the rate isn't fully live.
```

## Body

Operator request: the static $1.40 fallback drifts too far from the live
~$1.0643. Replace with the last successful live rate so the worst-case
delta is bounded by how stale the cache is, not by how long ago the static
constant was set. Add a UI badge so buyers can see when the rate is
cached/static rather than live and decide whether to proceed.

Server (services/wallet/knyt/knytPricingService.ts):
  - getKnytUsdPrice now caches last successful live rate at module scope.
    On a failed live fetch, returns the cached rate. Only falls back to
    KNYT_USD_RATE = $1.40 when no successful fetch has landed in this
    Lambda instance.
  - New getKnytUsdPriceMeta() accessor reports { rate, fetchedAt, stale,
    source: 'live' | 'cached' | 'static' } for diagnostic consumers.

Client (app/hooks/useEthPrice.ts):
  - useEthPrice persists ethPriceUsd to localStorage under
    knyt:ethPriceUsd:v1 with timestamp on each successful CoinGecko fetch.
  - Initial render reads from localStorage if available (source: 'cached')
    so the first paint shows a value close to current price instead of the
    static $3500. Once live fetch returns, source flips to 'live'.
  - Returns { stale, source, fetchedAt } in addition to the rate. stale
    is true when source !== 'live' OR fetchedAt > 1 hour old.

UI (ContentPurchaseModal):
  - New optional knytUsdRateIsStale prop. When true, renders an amber
    'Indicative pricing — KNYT/USD rate is from cache (live ETH feed
    unavailable). KNYT amount may shift slightly when the live rate
    refreshes.' badge directly under the Base Price row. Visible
    indicator that the rate isn't fully live; non-blocking.

All four store tabs (Bundles / Cards / Episodes / Investor) destructure
stale from useEthPrice and pass it through as knytUsdRateIsStale.

Result: worst-case fallback delta is the cached value's age (cap 1 hour
for the 'stale' threshold; actual rate is whatever was last live), not
the 30%+ drift between live and the $1.40 static. Buyer is informed when
the rate isn't fully live.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/hooks/useEthPrice.ts` |
| Modified | `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `app/triad/components/content/ContentPurchaseModal.tsx` |
| Modified | `services/wallet/knyt/knytPricingService.ts` |

## Stats

 8 files changed, 162 insertions(+), 16 deletions(-)
