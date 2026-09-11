# Commit Brief: `476d941` — Add platform-authority provisioning route + workflows for Factor/Aegis

| Field | Value |
|-------|-------|
| SHA | [`476d941`](https://github.com/iQube-Protocol/AigentZBeta/commit/476d941e9d0f8858c0a88b22d1a244b91d0732d5) |
| Author | Claude |
| Date | 2026-09-05T05:39:11Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add platform-authority provisioning route + workflows for Factor/Aegis

Builds the machine-to-machine path the operator's provisioning sequence
needs: /api/ops/agents/provision-platform-agent chains sponsorPolityAgent
(isPlatformAuthority: true, unbounded capacity) -> provisionAgentPersona ->
the canonical wallet-visible Standing persona, gated by CRON_TRIGGER_TOKEN,
for an ALLOWLISTED agent slug only (factor/aegis) — every identity field is
resolved server-side from a fixed internal spec, never accepted from the
request body. Adds the matching GitHub Actions workflows
(provision-platform-agent.yml, provision-owner-wallet.yml) mirroring the
existing provision-agent-wallet.yml pattern, so these can be dispatched
against the deployed environment where the real secrets live.

Fixes sponsorPolityAgent's slug-uniqueness gate, which previously refused
ANY repeat call for an existingIdentity agent with a 409 "already taken" —
correct for ordinary citizen genesis, wrong for a migrated/platform agent's
own idempotent re-run. Now returns the existing row (alreadyExisted: true)
only when the stored agent_id matches the caller's existingIdentity exactly;
a genuine slug collision with a different agent is still refused.

Fixes the same fabricated-wallet-address bug in
services/standing/agentStandingPersona.ts's resolveCanonicalAgentPersonaId
that was already fixed in provisionAgentWalletPersona.ts this session — this
is the ACTUAL mechanism that produced MoneyPenny/Nakamoto/Kn0w1's
wallet-visible personas (app_origin 'aigent-canonical-standing'), confirmed
live, and is what Factor/Aegis's own wallet-persona projection will run
through. Also fixes tests/agent-standing-persona.test.ts, which had no mock
for AgentKeyService and was making a real network call to production
Supabase via the anon key present in this environment.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Builds the machine-to-machine path the operator's provisioning sequence
needs: /api/ops/agents/provision-platform-agent chains sponsorPolityAgent
(isPlatformAuthority: true, unbounded capacity) -> provisionAgentPersona ->
the canonical wallet-visible Standing persona, gated by CRON_TRIGGER_TOKEN,
for an ALLOWLISTED agent slug only (factor/aegis) — every identity field is
resolved server-side from a fixed internal spec, never accepted from the
request body. Adds the matching GitHub Actions workflows
(provision-platform-agent.yml, provision-owner-wallet.yml) mirroring the
existing provision-agent-wallet.yml pattern, so these can be dispatched
against the deployed environment where the real secrets live.

Fixes sponsorPolityAgent's slug-uniqueness gate, which previously refused
ANY repeat call for an existingIdentity agent with a 409 "already taken" —
correct for ordinary citizen genesis, wrong for a migrated/platform agent's
own idempotent re-run. Now returns the existing row (alreadyExisted: true)
only when the stored agent_id matches the caller's existingIdentity exactly;
a genuine slug collision with a different agent is still refused.

Fixes the same fabricated-wallet-address bug in
services/standing/agentStandingPersona.ts's resolveCanonicalAgentPersonaId
that was already fixed in provisionAgentWalletPersona.ts this session — this
is the ACTUAL mechanism that produced MoneyPenny/Nakamoto/Kn0w1's
wallet-visible personas (app_origin 'aigent-canonical-standing'), confirmed
live, and is what Factor/Aegis's own wallet-persona projection will run
through. Also fixes tests/agent-standing-persona.test.ts, which had no mock
for AgentKeyService and was making a real network call to production
Supabase via the anon key present in this environment.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `.github/workflows/provision-owner-wallet.yml` |
| Added | `.github/workflows/provision-platform-agent.yml` |
| Added | `app/api/ops/agents/provision-platform-agent/route.ts` |
| Modified | `services/agents/sponsorPolityAgent.ts` |
| Modified | `services/standing/agentStandingPersona.ts` |
| Modified | `tests/agent-standing-persona.test.ts` |
| Added | `tests/provision-platform-agent-route.test.ts` |
| Added | `tests/sponsor-polity-agent-existing-identity-idempotency.test.ts` |

## Stats

 8 files changed, 806 insertions(+), 6 deletions(-)
