# metaMe Threshold — Gateway Increment 2a (Constitutional Handshake session model)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · **Increment:** 2a of 4 (auth infrastructure)

## What shipped

The **additive, non-behavioural** first half of the Constitutional Handshake — the
scoped-session model that a Threshold Companion's bearer will resolve against once
the interactive crossing (Increment 2b) is wired. Nothing an unauthenticated
Companion can do changes; this is the plumbing the authenticated tools will gate on.

- **`supabase/migrations/20260806000000_agent_gateway_sessions.sql`** — the
  `agent_gateway_sessions` table. A row is a scoped agent bearer bound to an
  **authorized Constitutional Agreement**. Stores only T2-safe references
  (`principal_public_ref`, `agent_alias`), the `agreement_id`, the `granted_scope`,
  and the **sha256 hash** of the issued bearer — never the raw bearer, never a T0
  id. Lifecycle `pending → active → revoked`; deny-all RLS (service-role gateway
  routes only).
- **`services/threshold/gatewaySession.ts`** — the lifecycle:
  `createPendingHandshake` (begin_handshake inserts the `pending` row),
  `getHandshake` (the authorize page reads what's asked), `activateHandshake`
  (mints the `ths_…` bearer once, stores its hash, records the T2 principal +
  agent + agreement + granted scope, flips to `active` — guarded so only a
  `pending` row activates), `resolveBearer` (**defensive**: any error, including an
  unmigrated table, degrades to `null` / unauthenticated — never a 500),
  `revokeByHandshake`, and the pure `hasScope` check (exact grant or `prefix.*`
  wildcard).
- **`services/threshold/gateway.ts`** — `GatewayContext` gains an optional
  `session?: ScopedSession | null`. Increment 1's read-only tools ignore it; its
  presence NEVER widens the read-only surface. The authenticated crossing tools
  (later increments) will gate on it + `requireAuthorizedAgreement`.
- **`app/api/threshold/mcp/route.ts`** — reads `Authorization: Bearer`, resolves it
  via `resolveBearer` (defensively), and attaches the resolved `session` to the
  context. Absent/invalid/expired bearer ⇒ read-only surface, unchanged.
- **`tests/threshold-gateway-session.test.ts`** — canary for the pure scope logic:
  null session grants nothing (fail-closed); exact grants match only themselves;
  `prefix.*` wildcards stay inside their prefix.

## Constitutional guardrails (held)

- **No T0 ever persisted** — only the sha256 of the bearer + T2 refs + the
  agreement FK. The principal is the Polity Public Reference; the agent is a T2
  alias.
- **Authority lives in the agreement, not the session** — the session is a scoped
  handle; `requireAuthorizedAgreement` remains the enforcement switch, and revoke =
  status flip / TTL lapse / the agreement's own `maxActions`.
- **Fail-closed + fail-safe** — `hasScope(null, …)` is `false`; `resolveBearer`
  degrades to unauthenticated on any error rather than 500-ing the gateway.
- **Principal–Delegate Separation preserved** — this increment adds no tool that
  lets the agent authorize; activation is only reachable from the human's browser
  crossing (Increment 2b).

## Operator action required

Run the migration in Supabase (service-role / SQL editor):

```sql
-- supabase/migrations/20260806000000_agent_gateway_sessions.sql
-- (paste the file contents; it is idempotent — CREATE TABLE IF NOT EXISTS + deny-all RLS)
```

Until it is applied, `resolveBearer` simply returns `null` for every bearer (the
gateway stays on its read-only surface) — so this deploy is safe to ship before the
migration runs.

## Next

2b — the interactive crossing: the authorize page + completion endpoint that drives
guided-onboarding + `authorizeAgreement` (the human act) + `activateHandshake`, plus
the OAuth discovery documents and wiring `begin_handshake` → `createPendingHandshake`.
Flagged security-sensitive; lands as its own reviewable increment.
