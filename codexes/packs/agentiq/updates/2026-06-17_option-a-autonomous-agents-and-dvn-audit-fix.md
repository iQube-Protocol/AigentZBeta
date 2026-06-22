# Option A autonomous agents + DVN audit-log fix + Autodrive publish endpoint

**Date:** 2026-06-17
**Branch:** `claude/optimistic-davinci-exiykx`

## 1. DVN audit log fix (reported: "delegated but no DVN receipt in the audit log")

`/api/codex/chat/agentiq-os/delegation` emitted its lifecycle events
**fire-and-forget** (`void emitDelegationEvent(...)`, which itself did `void
emitOrchestrationEvent(...)`). On serverless the function returns and freezes
before the Supabase insert lands, so `z_delegated` / `control_returned_to_metame`
never persisted and the audit log read back empty. Fixed by **awaiting** the
emit on grant, revoke, and TTL-expiry paths so the `orchestration_events` row is
written before the response returns.

## 2. Option A — admin-only autonomous agent deployment

Builds on the Polity Core constitutional framework. Autonomous agents are
delegated instruments, never sovereign.

- **Migration** `20260617100000_agent_constitutional_binding.sql`: adds
  `constitution_version`, `agent_charter_version`, `delegation_framework_version`,
  `revocation_authority_persona_id`, `revocation_state` (active/paused/suspended/
  revoked/quarantined/destroyed), `revocation_state_at`, `revocation_reason` to
  `agent_root_identity`.
- **`sponsorPolityAgent`** extended: `isAutonomous` + `callerIsAdmin`. Autonomous
  is **admin-only**, stamps the constitutional binding from
  `getAgentPassportBinding()`, sets the sponsor as revocation authority, and
  enforces `checkAgentClassConstraints` (no kybe DID, never human, never a
  citizen passport). Reads its rules from `services/polity/constitution.ts`.
- **`POST /api/agents/autonomous`** — admin-gated deploy. Requires a sponsor
  passport (no orphaned agents).
- **`POST /api/agents/[id]/revoke`** — lifecycle control (pause/suspend/revoke/
  quarantine/destroy), immediate effect, admin or recorded revocation authority;
  terminal states (revoked/destroyed) are final. Each transition emits an
  **awaited DVN-anchorable receipt** (`agent_revocation_state_changed`, added to
  `ActivityActionType` + `ANCHORABLE_ACTION_TYPES`) so the lifecycle is fully
  receipted per the Agent Charter §Receipts. Identifiers stay agent-scoped (no
  raw sponsor persona id in the receipt).
- **Apply tab** Option A control is now functional (admin-only) — deploys the
  autonomous agent and shows its Agent Card + bound constitution version.

## 3. Autodrive publish endpoint

`POST /api/polity-core/publish` (admin-only) uploads the machine-readable
frameworks to Autodrive (Autonomys) server-side, where `AUTONOMYS_API_KEY` +
network exist, and returns the CIDs to record. (The sandbox has neither the key
loaded nor egress to Autonomys, so `scripts/publish-polity-core.mjs` can't run
there — this endpoint runs the publish on the deployed app instead.) `GET`
returns the currently-recorded CIDs.

## Files

- `app/api/codex/chat/agentiq-os/delegation/route.ts` (await emits)
- `supabase/migrations/20260617100000_agent_constitutional_binding.sql`
- `services/agents/sponsorPolityAgent.ts` (autonomous + binding + constraints)
- `app/api/agents/autonomous/route.ts`, `app/api/agents/[id]/revoke/route.ts`
- `app/api/polity-core/publish/route.ts`
- `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` (functional Option A)

## Migration to run

```sql
-- supabase/migrations/20260617100000_agent_constitutional_binding.sql
```

All autonomous paths soft-fail with a clear "pending migration" message until it
is applied.
