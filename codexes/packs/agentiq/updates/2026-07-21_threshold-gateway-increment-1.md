# metaMe Threshold — Gateway Increment 1 (read-only MCP + signed manifest)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · **Increment:** 1 of 4

## What shipped

The first, zero-auth-risk slice of the **Threshold Gateway** — the MCP surface the
user's existing agent (the "Threshold Companion") speaks to. A Companion can now
connect and **discover + inspect a crossing** end-to-end, before any authenticated
mutation exists.

- **`app/api/threshold/mcp/route.ts`** — a minimal, spec-correct MCP server over
  Streamable HTTP (JSON-RPC 2.0, hand-rolled — no SDK, keeps the SSR bundle lean).
  Handles `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`,
  `resources/read`, `prompts/list`, `prompts/get`. Stateless, CORS-open, `no-store`.
- **`services/threshold/gateway.ts`** — the catalogue + read-only dispatch. Tools:
  `list_services`, `inspect_threshold_link`. Resources: `metame://services`,
  `metame://institution/charter`, `metame://onboarding/current`. Prompts:
  `cross_the_threshold`, `get_polity_passport`, `explain_delegation_request` (so
  the Companion narrates the crossing conversationally).
- **`services/threshold/serviceRegistry.ts`** — the post-crossing service registry
  (`polity-passport` = constitutional root; `irl`, `devon`, `founder-office`, …
  each with a `requiredCapabilities` scope).
- **`services/threshold/thresholdLink.ts`** — the signed `metame-threshold-link/v1`
  manifest (HMAC stub over canonical JSON via `THRESHOLD_LINK_SIGNING_SECRET`,
  falling back to the Bureau secret; unsigned-stub marker when absent). No secrets,
  no T0 ids.
- **`services/threshold/resolveInvitation.ts`** — resolves a capability-URL code
  (`pinv-`/`x409-`) to T2-safe metadata (mirrors `/api/public/irl/accession`);
  the id is a sha256 commitment, never the raw code.
- **`app/api/threshold/link/[code]/route.ts`** — the machine twin of the human
  "Cross the Threshold" page: returns the signed manifest.
- **`tests/threshold-gateway.test.ts`** — canary: manifest round-trip + no-T0;
  tools/list has no authorize path; handshake tools gated with an honest
  "handshake required"; `list_services`/`inspect_threshold_link` behaviour.

## Constitutional guardrails (held from day one)

- **Read-only + unauthenticated** — only public capability-URL invitation metadata
  and the static service registry are exposed. No spine auth, no persona resolution,
  no T0 data.
- **Principal–Delegate Separation** — the authenticated crossing tools (the
  Constitutional Handshake, Agent Card, delegation, service entry) are declared in
  the PRD but **not listed** yet; calling one returns an honest "handshake required"
  rather than acting. There is, and will be, no agent-authorize tool path.

## Try it

Connect an MCP client (Claude remote connector, or `curl`) to
`<origin>/api/threshold/mcp`:
- `initialize` → server info + capabilities.
- `tools/list` → `list_services`, `inspect_threshold_link`.
- `tools/call list_services` → the service registry.
- `tools/call inspect_threshold_link {code:"pinv-…"}` → the crossing + signed manifest.

## Next increments

2 — the **Constitutional Handshake** (OAuth façade over Passport + scoped session
bound to an authorized Constitutional Agreement). 3 — persona tools (Agent Card,
`propose_delegation`) driving guided-onboarding + agreement. 4 — the IRL service
adapter (accept invitation, locker docs, submit review, QubeTalk).

**Operator note:** set `THRESHOLD_LINK_SIGNING_SECRET` in the environment to sign
manifests (else they emit as unsigned stubs).
