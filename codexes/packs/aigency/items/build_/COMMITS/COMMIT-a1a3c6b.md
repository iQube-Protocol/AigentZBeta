# Commit Brief: `a1a3c6b` — Add manual financial-profile entry (MPY2-2c); close MPY2-0b reconciliation

| Field | Value |
|-------|-------|
| SHA | [`a1a3c6b`](https://github.com/iQube-Protocol/AigentZBeta/commit/a1a3c6be9380829c0b44b1fb79c56755ced6dbdb) |
| Author | Claude |
| Date | 2026-09-02T03:22:54Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add manual financial-profile entry (MPY2-2c); close MPY2-0b reconciliation

Manual entry: computeManualFinancialProfile shares buildCandidateEnvelope
with the upload path (no second envelope policy), honestly nulls/empties
what a single self-report can't supply (volatility, recurring
commitments, concentration). New POST /manual route + inputSource
disclosure on FinancialProfileQubeBlak + FinancialProfilePanel form.
hasPreparedFinancialProfile needed no change — it already covers either
input path once has_profile is true.

MPY2-0b closure: corrected the CoinGecko/HFTConsole mismatch is now
reconciled against the platform's own real adapter (useEthPrice.ts /
knytPricingService.ts) as the reuse path for a future Markets asset-price
item; six-gap table now names the existing primitive each gap should
extend (riskEnvelope.ts and the DVN pipeline already do most of the
structural work for two of the six).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Manual entry: computeManualFinancialProfile shares buildCandidateEnvelope
with the upload path (no second envelope policy), honestly nulls/empties
what a single self-report can't supply (volatility, recurring
commitments, concentration). New POST /manual route + inputSource
disclosure on FinancialProfileQubeBlak + FinancialProfilePanel form.
hasPreparedFinancialProfile needed no change — it already covers either
input path once has_profile is true.

MPY2-0b closure: corrected the CoinGecko/HFTConsole mismatch is now
reconciled against the platform's own real adapter (useEthPrice.ts /
knytPricingService.ts) as the reuse path for a future Markets asset-price
item; six-gap table now names the existing primitive each gap should
extend (riskEnvelope.ts and the DVN pipeline already do most of the
structural work for two of the six).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/FinancialProfilePanel.tsx` |
| Modified | `app/api/moneypenny/financial-profile/compute/route.ts` |
| Added | `app/api/moneypenny/financial-profile/manual/route.ts` |
| Modified | `app/api/moneypenny/financial-profile/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_mpy2-0b-moneypenny002-real-source-audit.md` |
| Modified | `services/financialServices/financialProfileAggregation.ts` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Added | `tests/financial-profile-manual-entry.test.ts` |

## Stats

 8 files changed, 528 insertions(+), 22 deletions(-)
