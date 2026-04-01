# Commit Brief: `1bd9550` — fix: Complete PricingModel with all required fields and valid types

| Field | Value |
|-------|-------|
| SHA | [`1bd9550`](https://github.com/iQube-Protocol/AigentZBeta/commit/1bd95507e3d079e557102f05bccbc38884f985ee) |
| Author | Kn0w-1 |
| Date | 2025-12-06T18:26:32Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Complete PricingModel with all required fields and valid types

- Replace 'Q¢' with 'QCT' (valid PaymentCurrency)
- Replace 'premium' with 'subscription' and 'payPerArticle' (valid PricingKind)
- Add primaryCurrency field to PricingModel
- Add freePreview field with different strategies per sample
- Add creatorWalletAddress field (placeholder address)
- Add platformFeePercentage field (10-15%)
- Add covers field to PricingTier

Valid PaymentCurrency: QCT, QOYN, KNYT, USDC, ETH, BTC, sats
Valid PricingKind: payPerPanel, payPerEpisode, payPerStream, payPerArticle, payPerIssue, payPerSeries, subscription, bundle, free

Fixes TypeScript compilation error in production build:
'Type "Q¢" is not assignable to type PaymentCurrency' error at line 42
```

## Files Changed

_File details not available in backfill — see commit link above._
