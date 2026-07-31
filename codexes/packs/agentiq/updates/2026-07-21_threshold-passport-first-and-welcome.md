# metaMe Threshold — passport-first re-sequencing + Constitutional Welcome

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · after the first live crossing

## Context

The first live crossing succeeded end-to-end (Claude connected via OAuth, `get_crossing_status`
returned the scope). Operator + Aletheon review then flagged that the base crossing was
conflating **three separate constitutional events** — crossing the Threshold, choosing a
journey, entering a service — by granting IRL's `research.*` scope merely because the crossing
happened. This increment re-sequences to the correct constitutional order and adds the
Constitutional Welcome.

## What shipped

### 1. Token repair frozen (regression-proof)

- `services/threshold/oauthBody.ts` — a pure, unit-tested `parseOAuthBody(contentType, raw)`;
  the token route delegates to it instead of `request.formData()` (which silently returned
  nothing for urlencoded bodies and 400'd the first crossing's token exchange).
- `tests/threshold-oauth-body.test.ts` — locks the form-encoded + JSON paths so that exact
  failure cannot recur.

### 2. Passport-first re-sequencing (constitutional-root authority, not empty scope)

A base crossing now grants **constitutional-root navigation authority only** — never
service-operating authority. Root capabilities (`serviceRegistry.CONSTITUTIONAL_ROOT_CAPABILITIES`):
`passport.status.read`, `crossing.status.read`, `journeys.list`, `journey.select`,
`delegation.propose`, `delegation.status.read`, `services.list`, `agent-card.self.read`,
`agent-passport.self.read`.

- `grantableCapabilities(serviceId)` — root set + (a service's capabilities **only** for a
  service-initiated crossing). `polity-passport` (the constitutional root) adds nothing.
- `authorize-init` grants root authority to every crossing and adds service capabilities only
  for a service-initiated one — **enforced server-side**, so a client requesting "the union of
  everything" still gets root-only at a base crossing.
- The `oauth-authorization-server` discovery doc now advertises **only** the root class in
  `scopes_supported`, plus an `x-metame-capability-classes` map distinguishing
  `constitutional_root` vs `service` — so clients stop over-asking at sign-up.
- `Passport ≠ delegation`: the Passport establishes the principal; this minimal root delegation
  authorizes the agent to navigate. Service authority is a separate, journey-driven crossing.

### 3. Constitutional Welcome & Citizenship Orientation

`services/threshold/welcome.ts` — canonical (operator/Aletheon-authored) copy, served identically
to any Companion:

- `constitutional_welcome` prompt + `metame://welcome` resource — congratulate the principal,
  state they are now a **citizen of the Polity**, offer the two plain-language explanations
  ("What is the Constitutional Internet?", "What does citizenship mean?"), make the LIMIT explicit
  (citizenship ≠ broad agent authority), and lead into the five journeys.
- `crossingReceipt(session)` — the machine-readable receipt now folded into `get_crossing_status`:
  `Threshold crossed · Passport active · Citizenship active · Agent connection active ·
  Service authority: none yet · Next step: choose a journey`. `serviceAuthority` reads "none yet"
  for a base crossing and lists the actual capabilities once a service crossing grants them —
  so the celebration can never imply the agent received broad service permissions.
- `get_crossing_status` renames `grantedScope → currentAuthority` (authority is the constitutional
  term; scope is implementation).

Canaries: `tests/threshold-gateway.test.ts` — base crossing grants no service capability;
service crossing adds only that service's; receipt reads "none yet" vs lists granted authority.

## Constitutional guardrails (held / strengthened)

- Crossing, journey selection, and service entry are now three **distinct constitutional events**.
- Base crossing carries navigation authority only — no research/DevOn/workspace/Studio/peer/money.
- No T0 anywhere; the receipt + welcome carry only T2 refs.

## Operator note

No migration or SQL for this increment. Existing crossings keep whatever scope they were granted;
new base crossings get the passport-first root-only authority. To see it: re-add the connector and
run "get my crossing status" — a fresh base crossing now shows **Service authority: none yet** with
`irl` under "Still gated" until you choose the Researcher journey.

## Next

The incremental service crossing (journey-driven `request_service_capabilities` → an authorize
link that grants just that service's scope) + the IRL action adapter (accept invitation, read
shared docs, submit review, QubeTalk) — the first true demonstration of progressive delegation.
