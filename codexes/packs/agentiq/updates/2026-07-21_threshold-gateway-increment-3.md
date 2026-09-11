# metaMe Threshold — Gateway Increment 3 (session-gated persona tools)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · **Increment:** 3 of 4

## What shipped

The first **authenticated** MCP tools — the ones that consume the scoped session
minted by the 2b crossing. They are deliberately **read/prepare only**: they report
status, resolve which services the crossing can now enter, and *prepare* incremental
delegations — but they **never mutate the principal's state** and **never touch a T0
identifier** (the session carries only T2 references). Persona-state mutation
(creating an Agent Card, granting new scope) remains a human-authorized crossing, by
design — the agent proposes, the human authorizes.

- **`get_crossing_status`** — reports the active session: the exact capability scope
  the principal authorized, the T2 principal + agent references, and which services
  are now **reachable** vs still **pending** more scope. No persona identifiers.
- **`request_service_capabilities(service)`** — checks whether the crossing already
  holds the scope for a named service; if not, returns the precise
  `missingCapabilities` and explains that they require an **incremental crossing**
  the human authorizes in the browser.
- **`propose_delegation(capabilities)`** — drafts a proposal (recognized vs
  unrecognized capabilities, already-held vs would-request), with the read/participate
  boundary and an explicit "you cannot authorize on their behalf" human step.

### How the gating works (three consistent layers)

1. All three are in `HANDSHAKE_TOOLS`, so the MCP route answers a **bearer-less**
   call with `401 + WWW-Authenticate` → the OAuth crossing (the client's trigger to
   authenticate).
2. With a valid bearer, `resolveBearer` attaches the `ScopedSession`; `callTool`
   dispatches them from the new `AUTHENTICATED_TOOLS` branch.
3. Eligibility uses `hasScope(session, capability)` — exact or `prefix.*` — against
   the service registry's `requiredCapabilities`. Requested/ proposed capabilities
   are always filtered through `knownCapabilities()`.

## Constitutional guardrails (held)

- **Principal–Delegate Separation** — no tool here mutates persona state or grants
  authority. `propose_delegation` and `request_service_capabilities` return a human
  authorize path; the agent only prepares and explains.
- **No T0** — every response carries only the T2 `principalPublicRef` + agent alias
  from the session; the canary asserts no `personaId`/`authProfileId`/`rootDid`/`kybe`.
- **Read/participate only** — the crossing's scope ceiling (Domain 3) still holds;
  nothing here can move funds, publish, disclose identity, or delegate onward.

## Files

- `services/threshold/gateway.ts` — three authenticated tools advertised in
  `listTools()`, the `AUTHENTICATED_TOOLS` dispatch branch, the `handshakeRequired`
  helper, and `get_crossing_status` added to the 401-challenge set.
- `services/threshold/serviceRegistry.ts` — `knownCapabilities()` (also the 2b
  scope allowlist).
- `tests/threshold-gateway.test.ts` — canary: gated without a session; with a
  session, status reachability + no-T0, reachable-vs-incremental, prepare-not-grant.

## Next

4 — the **IRL service adapter**: the authenticated *action* tools (accept invitation,
list/read shared locker documents, submit review, QubeTalk send), each mutating call
re-passing the 409 authorization gate against the crossing's agreement, with receipts.
