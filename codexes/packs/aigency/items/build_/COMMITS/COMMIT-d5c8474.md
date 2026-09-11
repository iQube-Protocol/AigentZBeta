# Commit Brief: `d5c8474` — Add Verifiable-PnL onboarding boundary, verified against Horizen's live contract

| Field | Value |
|-------|-------|
| SHA | [`d5c8474`](https://github.com/iQube-Protocol/AigentZBeta/commit/d5c84747d50ca207fcabd5fe70b651a1a86218dd) |
| Author | Claude |
| Date | 2026-08-09T07:48:39Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Verifiable-PnL onboarding boundary, verified against Horizen's live contract

Adds a dedicated mutating boundary (pnlOnboardingClient.ts, distinct
from the read-only pnlServiceVerification.ts) for Horizen's Verifiable
PnL existing-token registration, built against endpoints and field
names fetched live from Horizen's own currently-published runbook and
OpenAPI spec (agent-registry.horizenlabs.io/verifiable-pnl/AGENTS.md
and openapi.json) - never guessed or carried forward from the older
partner brief.

Two genuine, undocumented blockers are surfaced as explicit refusals
rather than worked around: this codebase's wallet topology has exactly
one wallet per agent, but existing-mode registration requires a
trading wallet distinct from the owner wallet (Horizen rejects a
match); and the openapi.json names but never defines the
tradingLinkWallet EIP-712 schema the mutation would need to sign. Both
refuse with named codes instead of fabricating a wallet or a typed-data
shape Horizen hasn't published.

Adds the read-only terms/nonce/token-owner endpoints to client.ts
(same read-only scope as its existing PnL correlation reads), a new
pnl_service_registered receipt type distinct from both the existing
disclosure-authorization and independently-verified-evidence types,
and clarifies (comment-only) that pnlServiceVerification.ts's chain
comparison is already an identity-chain-to-identity-chain comparison,
never conflated with the separate P&L proof/trade chain.
```

## Body

Adds a dedicated mutating boundary (pnlOnboardingClient.ts, distinct
from the read-only pnlServiceVerification.ts) for Horizen's Verifiable
PnL existing-token registration, built against endpoints and field
names fetched live from Horizen's own currently-published runbook and
OpenAPI spec (agent-registry.horizenlabs.io/verifiable-pnl/AGENTS.md
and openapi.json) - never guessed or carried forward from the older
partner brief.

Two genuine, undocumented blockers are surfaced as explicit refusals
rather than worked around: this codebase's wallet topology has exactly
one wallet per agent, but existing-mode registration requires a
trading wallet distinct from the owner wallet (Horizen rejects a
match); and the openapi.json names but never defines the
tradingLinkWallet EIP-712 schema the mutation would need to sign. Both
refuse with named codes instead of fabricating a wallet or a typed-data
shape Horizen hasn't published.

Adds the read-only terms/nonce/token-owner endpoints to client.ts
(same read-only scope as its existing PnL correlation reads), a new
pnl_service_registered receipt type distinct from both the existing
disclosure-authorization and independently-verified-evidence types,
and clarifies (comment-only) that pnlServiceVerification.ts's chain
comparison is already an identity-chain-to-identity-chain comparison,
never conflated with the separate P&L proof/trade chain.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/horizen/client.ts` |
| Added | `services/horizen/pnlOnboardingClient.ts` |
| Modified | `services/horizen/pnlServiceVerification.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260930002500_pnl_service_registered_receipt_type.sql` |
| Added | `tests/pnl-onboarding-client.test.ts` |

## Stats

 7 files changed, 758 insertions(+), 1 deletion(-)
