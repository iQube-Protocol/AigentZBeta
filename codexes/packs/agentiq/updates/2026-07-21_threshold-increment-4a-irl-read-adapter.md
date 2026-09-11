# metaMe Threshold — Increment 4a (IRL read adapter)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · Increment 4a of the IRL service adapter

## What shipped

The first **service adapter** — the READ surface of the Invariant Research Lab, so a crossed
agent that holds `research.read` can navigate and read IRL's shared research. This is the first
proof of the sovereignty ladder in motion: a capability the base crossing does NOT grant, gated
behind the Researcher journey.

- **`services/threshold/irlAdapter.ts`** — `makeIrlAdapter(origin)` with `listDocuments()` +
  `readDocument(path)`, thin server-to-server fetches against IRL's **public, persona-free** open
  corpus (`/api/public/irl/research-overview`, `/api/public/irl/doc?path=…`). No T0, no persona
  Bearer — T2-safe by construction (the IRL pack carries no persona data). Injected into the
  gateway context so the gateway module stays I/O-light + testable.
- **`gateway.ts`** — two authenticated tools: `list_shared_documents`, `read_shared_document`,
  each **gated on the `research.read` capability**. A base (root-only) crossing gets an honest
  "needs research.read — enter the Researcher journey first"; a session that holds it reaches the
  corpus. `read_shared_document` rejects path traversal.
- **`app/api/threshold/mcp/route.ts`** — injects `makeIrlAdapter(origin)` into the context.
- Canary: read tools gated without `research.read`; served once the session holds it.

## The constitutional line this increment draws (crossing ≠ entering a service)

The CFS-042 submission endpoint requires a capability-specific agreement
(`capabilityRef = irl:experiment-result:submit`) — the Threshold **crossing** agreement
(`threshold:crossing:*`) does not satisfy it. That is the constitution working as designed:
crossing the Threshold, choosing a journey, and acting in a service are distinct events with
distinct authority. The read surface rides IRL's public corpus (no agreement needed beyond the
`research.read` capability); the **write** surface (submit result, QubeTalk) needs the separate
incremental IRL delegation and lands in 4b.

## Guardrails (held)

- Read-only + scope-gated: only `research.read` sessions reach the corpus; base crossings can't.
- No T0, no persona Bearer — the public IRL corpus is persona-free.
- The gateway module stays pure (adapter injected), so the scope gate is unit-tested.

## Next — Increment 4b (the write surface + the incremental IRL crossing)

1. The **incremental service crossing**: `request_service_capabilities('irl')` → a real authorize
   link that forms the IRL delegation (capabilityRef `irl:experiment-result:submit`, `research.*`
   allowedActions) the human authorizes — the journey-driven step that grants the scope 4a gates on.
2. **`submit_review`** → the CFS-042 delegated submit endpoint using that IRL agreement (re-passing
   the x409 gate + TTL + maxActions), and **`send_qubetalk_message`** → `peerChannel`.
