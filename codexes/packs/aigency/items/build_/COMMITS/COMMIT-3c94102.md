# Commit Brief: `3c94102` — Provision Factor/Aegis canonical identity: secure owner-wallet path, Agent Cards, registry seed

| Field | Value |
|-------|-------|
| SHA | [`3c94102`](https://github.com/iQube-Protocol/AigentZBeta/commit/3c94102e196afced428b8341031a6cb608c061c0) |
| Author | Claude |
| Date | 2026-09-05T02:35:05Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Provision Factor/Aegis canonical identity: secure owner-wallet path, Agent Cards, registry seed

Fixes the flagged security defect (register-agent-keys had no real auth check)
by extending the already-secure CRON_TRIGGER_TOKEN-gated ops pattern instead:
AgentPurposeWalletService gains provisionOwnerWallet/getOwnerWalletAddress
(fail-closed on missing/insecure encryption secret, never rotates, never
returns a private key) and a new protected route
/api/ops/wallet/provision-owner-wallet.

Fixes a real bug found while building this: provisionAgentWalletPersona
generated a random placeholder EVM address unconditionally; it now resolves
the real agent_keys custodied address first, falling back (loudly, not
silently) only when no wallet exists yet.

Seeds registry_assets/iqube_id_map for aigentqube-factor/aigentqube-aegis
(applied live), adds their Agent Card + health routes, registers Factor in
registrableAgents.ts (Aegis deliberately excluded — not a Horizen
pilot-journey participant), and extends RUNTIME_AGENT_IDS/AGENT_ALIASES/
ACTIVE_IQUBES + the AigentQube profile map for aigent-factor.

Wallet generation, FIO registration, and agent_root_identity/agent_persona
provisioning are BLOCKED from this session (no service-role/encryption/cron
secrets locally; sponsor capacity already exhausted at base=3/used=6) and are
documented as such rather than skipped silently — see the dated update doc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Fixes the flagged security defect (register-agent-keys had no real auth check)
by extending the already-secure CRON_TRIGGER_TOKEN-gated ops pattern instead:
AgentPurposeWalletService gains provisionOwnerWallet/getOwnerWalletAddress
(fail-closed on missing/insecure encryption secret, never rotates, never
returns a private key) and a new protected route
/api/ops/wallet/provision-owner-wallet.

Fixes a real bug found while building this: provisionAgentWalletPersona
generated a random placeholder EVM address unconditionally; it now resolves
the real agent_keys custodied address first, falling back (loudly, not
silently) only when no wallet exists yet.

Seeds registry_assets/iqube_id_map for aigentqube-factor/aigentqube-aegis
(applied live), adds their Agent Card + health routes, registers Factor in
registrableAgents.ts (Aegis deliberately excluded — not a Horizen
pilot-journey participant), and extends RUNTIME_AGENT_IDS/AGENT_ALIASES/
ACTIVE_IQUBES + the AigentQube profile map for aigent-factor.

Wallet generation, FIO registration, and agent_root_identity/agent_persona
provisioning are BLOCKED from this session (no service-role/encryption/cron
secrets locally; sponsor capacity already exhausted at base=3/used=6) and are
documented as such rather than skipped silently — see the dated update doc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/agents/aegis/agent-card.json/route.ts` |
| Added | `app/api/agents/aegis/health/route.ts` |
| Added | `app/api/agents/factor/agent-card.json/route.ts` |
| Added | `app/api/agents/factor/health/route.ts` |
| Added | `app/api/ops/wallet/provision-owner-wallet/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_factor-aegis-canonical-identity-and-wallet-provisioning.md` |
| Modified | `services/agents/provisionAgentWalletPersona.ts` |
| Modified | `services/horizen/registrableAgents.ts` |
| Modified | `services/identity/agentKeyService.ts` |
| Modified | `services/iqube/legibility/sources/aigentQubeSource.ts` |
| Modified | `services/metame/agentLlmOrchestra.ts` |
| Modified | `services/wallet/agentPurposeWalletService.ts` |
| Added | `supabase/migrations/20260905030000_aigentqube_factor_aegis_registry_assets.sql` |
| Modified | `tests/agent-purpose-wallet-service.test.ts` |
| Modified | `tests/homecoming-phase-ii-provision-agent-wallet-persona.test.ts` |
| Added | `tests/provision-owner-wallet-route.test.ts` |

## Stats

 17 files changed, 1297 insertions(+), 12 deletions(-)
