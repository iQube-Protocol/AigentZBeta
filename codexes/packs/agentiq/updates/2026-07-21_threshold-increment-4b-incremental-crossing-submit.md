# metaMe Threshold — Increment 4b (incremental IRL crossing + submit_review)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · closes the progressive-delegation loop

## What shipped

The **incremental service crossing** (the journey-driven step that *grants* the scope 4a gates
on) + the first delegated **write** tool. This closes the sovereignty ladder in motion:
**crossed → Researcher journey → IRL authority authorized → submit a receipted result.**

### The incremental service crossing (session upgrade)

Entering a service is a distinct constitutional event: the human authorizes an ADDITIONAL,
capability-specific delegation that **upgrades the agent's existing session** — "authorize one
more thing" — rather than minting a new bearer.

- `request_service_capabilities('irl')` now mints a real **authorize link** (`beginServiceUpgrade`
  → `createUpgradeHandshake`, pinned to the caller's session id) and returns it for the agent to
  hand the principal.
- `app/threshold/enter-service/page.tsx` — the human authorize page (slate house style): shows the
  requested capabilities, and on approval calls the completion endpoint.
- `POST /api/threshold/service/complete` — the human act: forms → agent-accepts → **human-authorizes**
  an agreement whose `capabilityRef` is the CFS-042 submission capability
  (`irl:experiment-result:submit`), then `applyUpgrade` unions the new scope into the parent
  session and records the service agreement. Idempotent across re-clicks.
- Migration `20260809000000_agent_gateway_session_upgrade.sql` — adds `upgrade_of` (pins an upgrade
  handshake to its parent session) + `service_agreements jsonb` (serviceId → authorized agreement id).
  `resolveBearer` returns it on `ScopedSession.serviceAgreements`.

### The delegated write tool

- `submit_review` (gated on **research.submit** AND an IRL submission agreement on the session) →
  `irlAdapter.submitResult` → `POST /api/public/irl/experiments/submit` using
  `session.serviceAgreements.irl`. Each submission re-passes the **x409 gate + delegated TTL +
  maxActions budget** (CFS-042) and issues a content-hashed receipt. No persona Bearer — the
  agreement IS the authorization.

Canaries: submit refused without research.submit; refused with the scope but no IRL agreement
(honest guidance); submits under the recorded agreement once present.

## Why the crossing agreement isn't reused (the constitutional line)

The CFS-042 door checks `capabilityRef === 'irl:experiment-result:submit'`. The base crossing
agreement (`threshold:crossing:*`) does not satisfy it — so entering IRL forms its OWN delegation.
Crossing, journey selection, and service action stay three distinct events with distinct authority.

## Deferred: send_qubetalk_message

QubeTalk `postMessage` requires a **personaId (T0)**, which the agent's T2-only session does not
carry. A delegated peer-channel path (the CFS-042 analogue for QubeTalk) does not yet exist, so
`send_qubetalk_message` is intentionally NOT shipped here — it needs that delegated door first.

## Operator action

Run the 4b migration in Supabase (additive, idempotent):

```sql
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS upgrade_of text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS service_agreements jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Security note: like 2b, this is delegation-path code that mints authority; it ships inert until the
migration is applied (`applyUpgrade`/`resolveBearer` soft-fail without the columns). Worth a review
of the upgrade flow before first external use.
