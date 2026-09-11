# Factor/Aegis live provisioning execution (2026-09-05)

Executed the operator's provisioning sequence against the deployed environment (`dev-beta.aigentz.me`,
project `bsjhfvctmduxhohtllly`), using the GitHub Actions workflows built in the capacity-remediation
follow-up commit. No secrets were available or used from the local session — every write below ran
through the deployed protected routes, authenticated by the repo's `CRON_TRIGGER_TOKEN` GitHub secret.

## Deployment

Merged `8a6152b42` (capacity fix) and `476d941e9` (platform-agent provisioning route/workflows) to
`dev` as `1ec3d44be`. Confirmed the Amplify build went live (`/api/agents/factor/health` transitioned
404 → 200 after ~11 minutes). Both new workflows (`provision-owner-wallet`, `provision-platform-agent`)
registered in GitHub Actions immediately on push.

## Wallets provisioned (via `provision-owner-wallet.yml` / existing `provision-agent-wallet.yml`)

| Agent | Role | Address |
|---|---|---|
| Factor | owner/control | `0xF67299Ad3CB85f3A788CE38012C99Df7213E2734` |
| Factor | settlement/x402 (base-mainnet) | `0xE478E454b8c97682CACabe0345bb01AF30900ac1` |
| Aegis | owner/control | `0xdb7a9015da6ca60609BD3b064B1a1EA5C8FD69AF` |

All three addresses are distinct. Re-ran Factor's owner-wallet provisioning a second time —
`agent_keys.key_version` stayed `1` (never rotated), confirming idempotency.

## Identity chain provisioned (via `provision-platform-agent.yml`)

For both `factor` and `aegis`: `agent_root_identity` (sponsor: the same established platform sponsor
MoneyPenny/Nakamoto/Kn0w1 share) → `agent_persona` (`persona_role: polity_bound_delegate`) → the
canonical wallet-visible Standing persona (`personas`, `app_origin: aigent-canonical-standing`).

Verified live: the Standing persona's `evm_key.address` for both agents matches their real
`agent_keys.evm_address` EXACTLY — the placeholder-address bug (fixed this session in
`resolveCanonicalAgentPersonaId`) is confirmed working correctly in production, not just in tests.

Re-ran Factor's platform-agent provisioning a second time — row counts stayed at exactly 1 for
`agent_root_identity`, `agent_persona`, and the Standing `personas` row. No duplicates.

## FIO (checked, not registered)

`POST /api/identity/fio/check-availability` against the live host: both `factor@aigent` and
`aegis@aigent` report `available: true` (not present in our database, not registered on the FIO
chain). Per the operator's instruction, registration was NOT attempted — status recorded as
requested/configured, not registered.

## Horizen preflight (read-only, no broadcast)

`GET /api/journey/moneypenny-horizen/preflight?agentSlug=factor` against the live host. Confirms,
against real production state: runtimeAgentId, Agent Card, `registry_assets` row, `agent_root_identity`
row, and the agent's custodied wallet (`agent_keys`) are all `ALREADY_COMPLETE`. Overall `goNoGo:
BLOCKED` — correctly, since no on-chain registration has been broadcast and Factor has not yet been
through Factory ingestion (`capability_registered` receipt absent). **No broadcast was made or
attempted.**

One real, minor gap the preflight itself surfaced: `registry_assets.metadata.runtime.endpoint` was
never seeded for `aigentqube-factor` (the migration that seeded the row this session did not include
this field — MoneyPenny's own seed migration is the template for adding it,
`20260930002300_moneypenny_runtime_endpoint.sql`). Flagged, not fixed — outside this sequence's scope
unless the operator asks for it next.

## Public identifiers (final)

| | Factor | Aegis |
|---|---|---|
| runtimeAgentId | `aigent-factor` | `aigent-aegis` |
| Root DID | `did:agent:root:aigent-factor` | `did:agent:root:aigent-aegis` |
| Owner/control EVM address | `0xF67299Ad3CB85f3A788CE38012C99Df7213E2734` | `0xdb7a9015da6ca60609BD3b064B1a1EA5C8FD69AF` |
| Settlement/x402 EVM address | `0xE478E454b8c97682CACabe0345bb01AF30900ac1` | not provisioned (not applicable — Aegis is not a financial-execution agent) |
| Trading address | not provisioned | not applicable |
| BTC/Solana | not provisioned | not provisioned |
| FIO handle | `factor@aigent` — available, not registered | `aegis@aigent` — available, not registered |
| Agent Card | `/api/agents/factor/agent-card.json` (live) | `/api/agents/aegis/agent-card.json` (live) |
| Health | `/api/agents/factor/health` (live) | `/api/agents/aegis/health` (live) |
| Horizen state | pending-registration, base-sepolia — no broadcast | not a pilot-journey participant |

No on-chain transaction was broadcast. No secrets, encrypted keys, custody refs, auth-profile ids, or
sponsor-persona ids appear above or were logged during this execution.
