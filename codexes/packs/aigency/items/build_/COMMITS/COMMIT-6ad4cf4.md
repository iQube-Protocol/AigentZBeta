# Commit Brief: `6ad4cf4` — Correct Horizen PnL onboarding contract + wire production Onboard action

| Field | Value |
|-------|-------|
| SHA | [`6ad4cf4`](https://github.com/iQube-Protocol/AigentZBeta/commit/6ad4cf41dca44899f26e129bdebc0ac46e02b456) |
| Author | Claude |
| Date | 2026-08-09T09:55:10Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Correct Horizen PnL onboarding contract + wire production Onboard action

A second, more careful fetch of Horizen's live AGENTS.md runbook proved the
first pass stale: existing-mode registration does not use ownerSiwe +
tradingLinkWallet (EIP-712, undocumented schema) — it uses owner session auth
(POST /v1/auth/siwe) plus a plain SIWE consent message from the TRADING
wallet itself (tradingSiwe: {message, signature}), with agentCard/ownerWallet
/tradingWallet as plain fields in the POST /v1/register body. No EIP-712
appears anywhere in this flow; that's reserved for the separate /v1/prove
performance-proof step. Rewrote registerExistingAgent to the real ceremony
(owner SIWE session -> trading-wallet SIWE consent -> register with the
session cookie forwarded), removed the now-incorrect
TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED refusal, and added
TRADING_KEY_NOT_CONFIGURED for the one genuine remaining gap: no resolver
exists for a trading wallet's own private key, because this codebase has no
dedicated trading-wallet custody path yet (confirmed: Horizen requires,
not merely recommends, tradingWallet !== ownerWallet).

Also wires the corrected client into production for the first time via
/api/journey/moneypenny-horizen/pnl/onboard (GET status check, POST
onboard) — checks existing correlation first (never re-registers an
onboarded agent), surfaces TRADING_WALLET_DECISION_REQUIRED when no trading
wallet is supplied, and receipts pnl_service_registered only on a genuine
Horizen 200.
```

## Body

A second, more careful fetch of Horizen's live AGENTS.md runbook proved the
first pass stale: existing-mode registration does not use ownerSiwe +
tradingLinkWallet (EIP-712, undocumented schema) — it uses owner session auth
(POST /v1/auth/siwe) plus a plain SIWE consent message from the TRADING
wallet itself (tradingSiwe: {message, signature}), with agentCard/ownerWallet
/tradingWallet as plain fields in the POST /v1/register body. No EIP-712
appears anywhere in this flow; that's reserved for the separate /v1/prove
performance-proof step. Rewrote registerExistingAgent to the real ceremony
(owner SIWE session -> trading-wallet SIWE consent -> register with the
session cookie forwarded), removed the now-incorrect
TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED refusal, and added
TRADING_KEY_NOT_CONFIGURED for the one genuine remaining gap: no resolver
exists for a trading wallet's own private key, because this codebase has no
dedicated trading-wallet custody path yet (confirmed: Horizen requires,
not merely recommends, tradingWallet !== ownerWallet).

Also wires the corrected client into production for the first time via
/api/journey/moneypenny-horizen/pnl/onboard (GET status check, POST
onboard) — checks existing correlation first (never re-registers an
onboarded agent), surfaces TRADING_WALLET_DECISION_REQUIRED when no trading
wallet is supplied, and receipts pnl_service_registered only on a genuine
Horizen 200.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/journey/moneypenny-horizen/pnl/onboard/route.ts` |
| Modified | `services/horizen/pnlOnboardingClient.ts` |
| Modified | `tests/pnl-onboarding-client.test.ts` |

## Stats

 4 files changed, 411 insertions(+), 100 deletions(-)
