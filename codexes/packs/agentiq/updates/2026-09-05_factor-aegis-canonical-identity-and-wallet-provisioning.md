# Factor/Aegis canonical identity and wallet provisioning (2026-09-05)

Operator-directed session. Extends Factor/Aegis (already reconciled onto `spec/moneypenny-mpy2-3`
per the 2026-09-04 Phase 1/Phase 2 docs) with canonical runtime identity, wallet custody, Agent
Cards, and orchestration wiring. Follows the operator's 13-step provisioning order; several steps
are BLOCKED from this local session and are named as such, not silently skipped.

## Security correction applied first

`/api/admin/register-agent-keys` was confirmed to have NO actual authorization check despite its
header comment claiming admin auth. It is **not extended** — flagged as a pre-existing defect,
left untouched (out of scope to fix retroactively without separate operator sign-off).

The secure path is `services/wallet/agentPurposeWalletService.ts`, extended this session with:
- `assertEncryptionSecretConfigured()` — fails closed if `AGENT_KEY_ENCRYPTION_SECRET` is missing
  or equals the known insecure default; never falls back to `AgentKeyService`'s silent default.
- Constructor now requires `SUPABASE_SERVICE_ROLE_KEY` only — the prior anon-key fallback (itself
  an instance of the same insecure pattern) is removed.
- `provisionOwnerWallet({runtimeAgentId, agentName, fioHandle?})` / `getOwnerWalletAddress()` — the
  canonical owner/control wallet path, idempotent, never rotates on rerun, never returns a private
  key. Writes to `agent_keys` directly (never `agent_wallet_bindings`), per the operator's
  provisioning doctrine.
- `app/api/ops/wallet/provision-owner-wallet/route.ts` — new, `CRON_TRIGGER_TOKEN`-gated (fail
  closed if unconfigured; the same pattern as the existing `provision-agent-wallet` route).

## Real bug fixed: fabricated wallet-persona addresses

`services/agents/provisionAgentWalletPersona.ts` previously generated a random placeholder EVM
address unconditionally. Live query confirmed MoneyPenny/Nakamoto/Kn0w1's existing `personas` rows
all carry addresses that do NOT match their real `agent_keys.evm_address`. Fixed to resolve the
real custodied address via `AgentKeyService.getAgentAddresses` first, falling back to the
placeholder (now logged via `console.warn`, never silent) only when no `agent_keys` row exists.
**The three existing agents' already-wrong persona rows are NOT retroactively corrected this
session** — that needs its own explicit operator sign-off, flagged here rather than silently done.
A parallel copy of the same bug exists in `services/standing/agentStandingPersona.ts`'s
`resolveCanonicalAgentPersonaId` — flagged only, not fixed (out of scope).

## Applied live (via the Supabase MCP tool's separately-credentialed channel)

`supabase/migrations/20260905030000_aigentqube_factor_aegis_registry_assets.sql` — seeds
`registry_assets` + `iqube_id_map` for `aigentqube-factor` and `aigentqube-aegis`, mirroring
MoneyPenny's own seed migration exactly. Confirmed live: both rows exist,
`trust_band: 'L1_EXPERIMENTAL'`, `publication_status: 'draft'`. No wallet addresses are stored in
`registry_assets` metadata — Agent Card hydration resolves public addresses from
`AgentKeyService`/`AgentPurposeWalletService` at request time.

## Code shipped this session

- `app/api/agents/factor/agent-card.json/route.ts`, `app/api/agents/factor/health/route.ts` (new)
- `app/api/agents/aegis/agent-card.json/route.ts`, `app/api/agents/aegis/health/route.ts` (new)
- `services/horizen/registrableAgents.ts` — added `factor`. **Aegis deliberately excluded** — it is
  not a Register/Verify/Claim pilot-journey participant.
- `services/metame/agentLlmOrchestra.ts` — added `aigent-factor` to `RUNTIME_AGENT_IDS`,
  `AGENT_ALIASES` (`aigent-factor`, `factor`), and two `ACTIVE_IQUBES` entries (gpt-4o-mini,
  claude-3-5-sonnet). Aegis NOT added here — the operator's Aegis identifier set did not request
  runtime-orchestration roster inclusion.
- `services/iqube/legibility/sources/aigentQubeSource.ts` — added `PROFILES['aigent-factor']`
  (this file's `PROFILES` map has a **pre-existing** gap for `aigent-z`/`aigent-community-concierge`
  — confirmed via `tsc`, produces the same TS2739 error before and after this change; not fixed,
  out of scope, flagged only).

Factor's Agent Card resolves, live per request: Horizen binding (via
`resolveHorizenRegistrationBinding`), runtime descriptor, owner wallet address (`agent_keys` via
`AgentKeyService`), settlement wallet address (`agent_wallet_bindings` via
`AgentPurposeWalletService`). Aegis's card omits the Horizen and settlement blocks entirely (per
operator: Aegis is not a pilot-journey participant and receives no purpose-bound wallet by symmetry
with Factor) and resolves only its runtime descriptor and owner wallet address.

## Verified

- `npx tsc --noEmit -p .` — 680 errors before and after every change in this session (baseline
  unchanged; the one PROFILES-map error present both before and after, message text only extended
  by the new key name).
- Full `npx vitest run` — same 62 pre-existing failures across 15 files before and after this
  session's changes (verified via `git stash`/`git stash pop` A/B comparison of the exact same 15
  files); zero new failures. New/updated tests for this session's own code (owner-wallet
  provisioning, its route, the wallet-persona real-address fix) all pass.

## BLOCKED — cannot be executed from this local session (report, not silently skipped)

1. **Real wallet generation** (owner wallet for Factor + Aegis, settlement wallet for Factor).
   This session's `.env.local` has neither `SUPABASE_SERVICE_ROLE_KEY`,
   `AGENT_KEY_ENCRYPTION_SECRET`, nor `CRON_TRIGGER_TOKEN` — confirmed via `env | grep` and the
   `.env.local`/`.env.example` file listing. The provisioning code is built, tested, and ready;
   executing it requires the deployed environment's real secrets, or the operator running the
   ops route directly against a configured deployment.
2. **FIO handle availability/registration** for `factor@aigent` / `aegis@aigent`. Confirmed
   `fioService.ts`'s `isHandleAvailable` calls a relative Next.js API route
   (`/api/identity/fio/check-database`), which requires a running server with real network reach
   to the FIO chain — unavailable from this sandboxed session (outbound HTTPS is blocked here per
   this repo's own documented sandbox limitation). Both handles are recorded in each Agent Card as
   `requestedHandle` with `registrationStatus: 'pending'` — never claimed as registered.
3. **`agent_root_identity` / `agent_persona` provisioning for Factor and Aegis.** Live query
   confirmed the established sponsor (`sponsor_persona_id: f1fafe54-be66-41e5-950a-3722e2fa93ed`,
   shared by MoneyPenny/Nakamoto/Kn0w1) has **`sponsorship_capacity_base: 3`,
   `sponsorship_capacity_earned: 0`, and 6 existing `agent_root_identity` rows already counted
   against it** — ordinary capacity is already exhausted (`remaining: 3 - 6 = -3`) BEFORE Factor or
   Aegis. `sponsorPolityAgent()`'s own logic requires either headroom or a recorded, audited
   administrator override (`capacityOverride`, requiring a live authenticated persona with
   `cartridgeFlags.isAdmin`) to proceed past that. This session has no live authenticated
   persona/admin session — only the Supabase MCP tool's elevated SQL channel, which is NOT the
   same as a legitimate, audited administrator authorization in the application's own trail.
   Inserting directly via SQL would fabricate an unaudited capacity override, which the operator's
   own no-guessing/no-bypass doctrine forbids. **This step needs either an explicit administrator
   act through the real route/service in a deployed environment, or an explicit operator
   instruction to override capacity with the reason recorded.** Not attempted.
4. **Horizen preflight / on-chain broadcast** — per the operator's explicit boundary (step 12: "do
   not broadcast on-chain registration without a separate explicit operator act"), no broadcast was
   attempted or would be attempted regardless of blockers above.
5. **Trading wallet** — deferred per the operator's own instruction (step 13), not needed for this
   session's rehearsal.

## No on-chain transaction was broadcast this session.
