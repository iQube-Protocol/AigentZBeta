# Commit Brief: `e720dcd` — Fix DVN Pending fork pill + P&L three-state UI, add purpose-bound agent wallet binding

| Field | Value |
|-------|-------|
| SHA | [`e720dcd`](https://github.com/iQube-Protocol/AigentZBeta/commit/e720dcdb71d68ddde1a299150eb1c543f3588c04) |
| Author | Claude |
| Date | 2026-08-09T11:06:08Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix DVN Pending fork pill + P&L three-state UI, add purpose-bound agent wallet binding

Ratify's fork pill now says "DVN Pending" instead of a generic "Pending"
when the constitutional act is complete but DVN finality is still
observing (consequenceForkProjection.ts, JourneyRunSurface.tsx). The P&L
transparency block replaces the indefinite "Unknown" state with an
actionable "Onboarding required" and renders Authorized/Registered/
Verified with check/circle icons (PulseTransparencyToggle.tsx).

Adds the smallest generic structure for an agent to hold more than one
wallet: agent_wallet_bindings (one row per agent_runtime_id + wallet_role),
provisioned through the existing AgentKeyService custody mechanism under a
namespaced custody_ref that never touches an agent's canonical owner-wallet
row. Wires this into pnlOnboardingClient's trading-wallet resolver so
Nakamoto's Horizen Verifiable-PnL onboarding can use a wallet genuinely
distinct from its ERC-8004 owner wallet, per Horizen's server-enforced
requirement. Adds a cron-token-gated ops route to provision the wallet
live once the migration is applied, and a backlog note capturing the
wider wallet-model implication (one control wallet, multiple bounded
purpose wallets) for later SmartTriad/DVN Spine reconciliation.

Also wraps the P&L onboarding route's GET/POST in try/catch so an
unanticipated throw always answers with a body instead of nothing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Ratify's fork pill now says "DVN Pending" instead of a generic "Pending"
when the constitutional act is complete but DVN finality is still
observing (consequenceForkProjection.ts, JourneyRunSurface.tsx). The P&L
transparency block replaces the indefinite "Unknown" state with an
actionable "Onboarding required" and renders Authorized/Registered/
Verified with check/circle icons (PulseTransparencyToggle.tsx).

Adds the smallest generic structure for an agent to hold more than one
wallet: agent_wallet_bindings (one row per agent_runtime_id + wallet_role),
provisioned through the existing AgentKeyService custody mechanism under a
namespaced custody_ref that never touches an agent's canonical owner-wallet
row. Wires this into pnlOnboardingClient's trading-wallet resolver so
Nakamoto's Horizen Verifiable-PnL onboarding can use a wallet genuinely
distinct from its ERC-8004 owner wallet, per Horizen's server-enforced
requirement. Adds a cron-token-gated ops route to provision the wallet
live once the migration is applied, and a backlog note capturing the
wider wallet-model implication (one control wallet, multiple bounded
purpose wallets) for later SmartTriad/DVN Spine reconciliation.

Also wraps the P&L onboarding route's GET/POST in try/catch so an
unanticipated throw always answers with a body instead of nothing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/moneypenny-horizen/pnl/onboard/route.ts` |
| Added | `app/api/ops/wallet/provision-agent-wallet/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-08-09_agent-purpose-bound-wallet-model-backlog.md` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/PulseTransparencyToggle.tsx` |
| Modified | `services/journey/consequenceForkProjection.ts` |
| Added | `services/wallet/agentPurposeWalletService.ts` |
| Added | `supabase/migrations/20260930001300_agent_wallet_bindings.sql` |
| Added | `tests/agent-purpose-wallet-service.test.ts` |
| Modified | `tests/consequence-fork-projection.test.ts` |
| Modified | `tests/pulse-close-now-structured-projection.test.ts` |
| Modified | `tests/pulse-plnl-split-and-correlation-trace.test.ts` |

## Stats

 14 files changed, 716 insertions(+), 57 deletions(-)
