# iQube Agent Legibility Profile v0.1

> **TL;DR.** The well-known layer makes iQubes **discoverable**. The iQubeCard makes them **legible**. The iQube Registry remains **canonical**. DVN makes consequential state change **accountable**.

This document describes the agent-readable discovery and descriptor surface for iQubes. It is not the source of truth for any iQube — every card links back to the canonical Registry record. This layer is intended to be consumed by agents (A2A, MCP-aware, or vanilla HTTP) that need to understand what an iQube is, what it contains at the metaQube level, what actions are permitted, what policies apply, and how to request or perform state changes safely.

## Routes

| Route | Returns | Cache | Mutating? |
|---|---|---|---|
| `GET /.well-known/iqube-catalog` | `IQubeCatalog` — public discovery index | 60s | No |
| `GET /api/iqubes/[id]/card` | `IQubeCard` for one iQube | 60s | No |
| `GET /api/iqubes/[id]/policy` | Public policy summary | 60s | No |
| `GET /api/iqubes/[id]/actions` | Agent action menu | 60s | No |

All four are GET-only. The legibility surface never mutates state. Mutation happens via the routes the `actions` menu points at — those routes evaluate policy and emit DVN receipts (PRD §10).

### Content types

- Card responses set `Content-Type: application/iqube-card+json`.
- Catalog responses set `Content-Type: application/iqube-catalog+json`.

IANA registration of these media types is **not** in scope for v0.1; the strings stabilise the future contract.

## What you can read

For a **public canonized ContentQube** (e.g. a Qriptopian paper):

- Full `iQubeCard` including `metaqube.summary`, public payload URL, registry hashes, allowed actions.
- The action menu includes `read_summary`, `cite`, `derive_summary`, `request_access`.

For a **`public_meta_private_payload` ContentQube**:

- Card with metaQube only — payload bytes are never carried.
- The action menu includes `read_meta` and `request_access` but **not** `read_payload`.
- `access.payload_disclosure === 'policy_mediated'` advertises that the agent must go through the request-access flow.

For a **`ToolQube`** (e.g. `tool-web-search`, or the legacy form `tool_web_search` — both resolve):

- Card describing the tool's existence and invocation shape.
- `requires_policy_check` includes `audit_state` — agents must ask before introspecting a tool's runtime state.
- Tool execution itself is mediated by the capability gateway, not this surface.

For an **`AigentQube`** (e.g. `aigent-marketa`):

- Card describing the aigent's role, description, and `supported_interfaces` (runtime + API URLs).
- ToolQubes referenced by the aigent are listed via tags + description (cross-card relations land in v0.2).

For a **private** iQube:

- `GET /api/iqubes/[id]/card` returns **404** — not 403. PRD §8.2 specifies this default to avoid leaking existence.

## What you can NOT read

Hard rules, enforced both by the source adapters and by the Zod schemas:

- **BlakQube payloads** are never carried in a card or policy response.
- **TokenQube secrets** (encryption keys, decryption tokens) are never carried.
- **T0 identifiers** (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) are never serialised. The card builder only accepts T1-safe identity tier labels.
- **Private creator identity** is exposed only via the `creator_identity_state` tier (`anonymous` / `pseudonymous` / `identifiable` / `delegated`), never as a raw DID or persona handle.
- **Non-public state-change logs.** DVN receipt aliases (T2 commitments) can appear under `registry.provenance_receipts`; the underlying events do not.

The structural lock on the policy response is the Zod literal `private_payload_exposed: z.literal(false)`. Any code path that drifts the response to `true` will fail validation and surface as a 500 — never a leak.

## Visibility rules

| Source state | Visibility | Catalog? | Card route |
|---|---|---|---|
| `canonized` + gating `free` | `public` | Yes | Full card |
| `canonized` + gating non-`free` | `public_meta_private_payload` | Yes | Meta-only card |
| Any state, explicit unlisted opt-in | `unlisted` | No (by default) | Card by id |
| Anything else | `private` | No | 404 |

ContentQubes have these states derived from `content_qubes.lifecycle_state` + `content_qube_access_policies.gating_kind`. ToolQubes and AigentQubes are always `public` in v0.1 (their existence is canonical to the running system).

## Permission model

Every card carries an `agent_permissions` block with three lists:

- `allowed_actions` — verbs the agent can request. Surfaced through the `/actions` route as concrete endpoints.
- `requires_policy_check` — verbs whose handlers run a server-side policy gate before executing.
- `requires_dvn_receipt` — verbs that emit an auditable DVN receipt as a side effect of execution.

Canonized iQubes ALWAYS have a non-empty `requires_dvn_receipt` list. The policy block's `dvn_required_for_state_change` is the rolled-up flag.

Disallowed verbs are listed in `disallowed_actions` on the card, but **omitted** from the `/actions` route — agents see affordances, not denials.

## Relationship to the iQube Registry

The Registry is the canonical source of truth for every iQube. Every card carries:

- `registry.canonical_url` — absolute URL of the Registry's record for this iQube.
- `registry.registry_id` — usually the same UUID as `iqube_id`.
- `registry.content_hash` / `metadata_hash` — optional sha256s of the canonical artefacts.
- `registry.provenance_receipts` — T2 DVN receipt aliases anchoring provenance events.

The card may go stale; the registry is authoritative. Agents that need certainty should follow the canonical URL.

## Source adapters

The legibility layer is primitive-agnostic. Each primitive type has a source adapter that hydrates rows from its system of record:

| Adapter | System of record | Today | Fast-follow |
|---|---|---|---|
| `contentQubeSource` | `content_qubes` table | Live Supabase reads | — |
| `toolQubeSource` | `openclawCore` in-process registry | Live (auto-discovers every registered tool) | Promote to `tool_qubes` table for versioning + provenance |
| `aigentQubeSource` | `RUNTIME_AGENT_IDS` + hand-curated profile map | Live (5 canonical aigents) | Promote to `aigent_qubes` table; expand to every aigentMe specialist |

Adding a new primitive type (e.g. `ModelQube`, `ClusterQube`) is two lines in `services/iqube/legibility/registry.ts` plus a new adapter file. The card builder doesn't change.

## Phase 1 sample iQubes

The catalog returns three real working examples on dev-beta as soon as the sources are populated:

1. **Public canonized ContentQube** — e.g. the Qriptopian "Time Sovereignty" paper. Lives in `content_qubes` once canonized.
2. **`public_meta_private_payload` WIP ContentQube** — a draft paper. Will surface once an in-progress row is marked publicly discoverable.
3. **ToolQube** — `tool-web-search`, `tool-echo`, `tool-owned-content-scan` (and every other tool registered with openclawCore).
4. **AigentQube** — `aigent-marketa` (and the four other canonical runtime aigents).

## Spine guardrails (mandatory reading for any future contributor)

Before extending this layer, re-read `CLAUDE.md` §"Identity & Access Spine — CANONICAL SoT". Specifically:

- The card builder MUST NOT read T0 fields from any source. Source adapters are the chokepoint that redacts.
- The Registry remains canonical. The card is a descriptor, not a substitute.
- Mutating actions are policy-mediated AND DVN-receipt-aware. The legibility layer surfaces the requirement; the action handlers enforce it.
- IANA registration is deliberate future work, not v0.1.

## Files

| Path | Purpose |
|---|---|
| `types/iqube/legibility.ts` | TypeScript contract for `IQubeCard`, `IQubeCatalog`, action shapes |
| `services/iqube/legibility/schemas.ts` | Zod runtime validators (the structural lock) |
| `services/iqube/legibility/cardBuilder.ts` | Pure builder + mappers + action menu derivation |
| `services/iqube/legibility/sources/contentQubeSource.ts` | Live `content_qubes` adapter |
| `services/iqube/legibility/sources/toolQubeSource.ts` | Live openclawCore adapter |
| `services/iqube/legibility/sources/aigentQubeSource.ts` | Hand-seeded aigent adapter (live registry behind it) |
| `services/iqube/legibility/registry.ts` | Unified resolver — dispatches to the right adapter |
| `app/.well-known/iqube-catalog/route.ts` | Catalog endpoint |
| `app/api/iqubes/[id]/card/route.ts` | Card endpoint |
| `app/api/iqubes/[id]/policy/route.ts` | Policy endpoint |
| `app/api/iqubes/[id]/actions/route.ts` | Actions endpoint |
| `tests/iqube-legibility.test.ts` | Vitest coverage for the pure functions |

## Roadmap

Fast-follow (separate session):

1. Retrofit cards onto every aigentMe specialist and every ingestion-factory tool.
2. Auth-aware path for tools/aigents/private content (PRD §8.2 Path b).
3. Promote ToolQubes + AigentQubes into DB tables for versioning + provenance.
4. Cross-card relations bag (aigent → tools, tool → models, etc.).
5. IANA registration of `application/iqube-card+json` + `application/iqube-catalog+json`.
6. Full PRD §12 test coverage including the integration tests for the routes.
