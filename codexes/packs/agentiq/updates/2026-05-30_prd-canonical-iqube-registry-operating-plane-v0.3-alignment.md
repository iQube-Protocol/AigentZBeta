# PRD Alignment Note v0.3: iQube Card Legibility Profile v0.1 SHIPPED — Updates to v0.1/v0.2 References

**Status:** Alignment note. Records that the IANA / well-known / agent-legibility work the operator referred to is the **iQube Agent Legibility Profile v0.1** that shipped end-to-end at `357fbbfe` (6 commits, 2026-05-28). Corrects path/enum references in v0.1 + v0.2 against the shipped surface.
**Date:** 2026-05-30
**Reads with:** v0.1 + v0.2 addendum.
**Verdict:** v0.2 addendum §A.2's `/.well-known/iqube-protocol/...` vendor-prefixed suffix proposal is **superseded**. The shipped design is cleaner — IANA registration targets the **media types** (`application/iqube-card+json` and `application/iqube-catalog+json`), not the URI suffix; the well-known surface is `/.well-known/iqube-catalog` only, and per-iQube cards live under `/api/iqubes/[id]/...`.

---

## A. What shipped (the canonical surface to align against)

**Commits (in order):**

| # | Commit | What landed |
|---|---|---|
| 1 | `2acbc587` | `types/iqube/legibility.ts` (314 lines), `services/iqube/legibility/schemas.ts` (232 lines Zod) |
| 2 | `d5b2194a` | `services/iqube/legibility/cardBuilder.ts` (460 lines pure builder + mappers) |
| 3 | `bb0e7c08` | `services/iqube/legibility/sources/{contentQubeSource,toolQubeSource,aigentQubeSource}.ts` + `registry.ts` |
| 4 | `1ade8dc2` | `app/api/iqubes/[id]/card/route.ts` |
| 5 | `1e657ab9` | `app/api/iqubes/[id]/policy/route.ts` + `app/api/iqubes/[id]/actions/route.ts` |
| 6 | `9754fe68` | `app/.well-known/iqube-catalog/route.ts`, `docs/iqube-agent-legibility-profile.md`, `tests/iqube-legibility.test.ts` |

Merge to dev: `357fbbfe` (2026-05-28).

**Routes (all GET-only, never mutating):**

| Route | Returns | Content-Type |
|---|---|---|
| `GET /.well-known/iqube-catalog` | `IQubeCatalog` — public discovery index | `application/iqube-catalog+json` |
| `GET /api/iqubes/[id]/card` | `IQubeCard` for one iQube | `application/iqube-card+json` |
| `GET /api/iqubes/[id]/policy` | Public policy summary | (json) |
| `GET /api/iqubes/[id]/actions` | Agent action menu | (json) |

**Canonical doc shipped:** `docs/iqube-agent-legibility-profile.md` — read this before extending. It is the source PRD now; my v0.1/v0.2 docs become its consolidation context.

---

## B. Shipped surface enums vs. v0.1/v0.2 proposals

### B.1 `IQubePrimitiveType`

**Shipped:**

```ts
'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'ClusterQube'
```

- v0.1 §2.1 said `ClusterQube` was missing. **Now present** in the legibility surface. v0.1's IQubeType in `types/registry.ts` is still the older 6-member set (with `LiquidUITemplateArchetypeQube`, without `ClusterQube`); the legibility layer added `ClusterQube` to its own primitive enum.
- v0.2 §A.1 proposed `tool_subtype ∈ { skill | connector | workflow | browser }`. **Shipped surface is flat** — ToolQube has no subtype field. The fast-follow #1 ("retrofit cards onto every aigentMe specialist + every ingestion-factory tool") implies sub-typing arrives via the source adapter (e.g. a connector ToolQube can populate `supported_interfaces.mcp`), not via a `tool_subtype` field on the card. **Conclusion:** v0.2 §A.1's typed subtype field is **deferred to fast-follow**; the v0.1 surface uses tags + `supported_interfaces` instead.

### B.2 `IQubeLifecycleState`

**Shipped (5-state surface):**

```ts
'draft' | 'wip' | 'canonized' | 'deprecated' | 'archived'
```

vs. v0.2 §B.4 proposal (9-state machine):

```
draft → wip → review_pending → published → canonized → deprecated → revoked → new_version_pending → abandoned
```

**Resolution per shipped docs (verbatim):**

> "The internal `content_qubes` schema uses a richer set (`draft/semi_minted/review_ready/canon_pending/canonized/chain_minted/superseded/archived`) that the card builder collapses into this surface enum."

So:

- **Surface (T1, agent-facing) lifecycle = 5 states.** This is what cards expose.
- **Internal (T0, registry-internal) lifecycle = the v0.2 §B.4 9-state machine.** This is what `services/registry/lifecycle.ts` (future) must enforce.
- **The mapper collapses internal → surface.** v0.2 §B.4 is still required for the internal state machine, but it must include an explicit surface-mapping table consistent with the shipped 5-state enum.

### B.3 `IQubeVisibilityState`

**Shipped (4 states):**

```ts
'private' | 'public_meta_private_payload' | 'public' | 'unlisted'
```

v0.1/v0.2 had `private | semi_public | public | token_gated`. The shipped enum is cleaner — `public_meta_private_payload` is the precise term for "metaQube public, BlakQube gated" which is the dominant state of canonized-but-paid ContentQubes. `unlisted` is a proper "by id, not enumerated" state.

**Resolution:** Adopt the shipped 4-state enum as the canonical visibility surface. Update v0.1 §4 + v0.2 §B.2 view-model definitions to use these strings.

### B.4 `IQubeAccessGating`

**Shipped (8 kinds):**

```ts
'open' | 'token' | 'payment' | 'persona' | 'did' | 'allowlist' | 'role' | 'custom'
```

vs. v0.2 §B.1 proposal: `free | credential | payment | token | identity`.

**Resolution:** Shipped enum is the canonical surface. `did`, `allowlist`, `role`, `custom` cover credential cases v0.2 had bundled under `credential`. `persona` is a new explicit gating axis (cohort/persona-flag based). Update v0.1 §4 + v0.2 §B.1 accordingly.

### B.5 `IQubeAgentAction`

**Shipped (14 verbs):**

```ts
'discover' | 'read_meta' | 'read_summary' | 'request_access' | 'read_payload'
| 'derive_summary' | 'transform' | 'cite' | 'propose_update' | 'mint_derivative'
| 'fork' | 'record_receipt' | 'revoke_access' | 'audit_state'
```

vs. v0.2 §B.1 / `types/access.ts` actions: `read | watch | listen | invoke | connect | remix | mint | transfer | payment-settle | policy-escalation | disclosure`.

**Reconciliation needed (v0.4 work):** Two action vocabularies exist:

- `IQubeAgentAction` (legibility surface) — verbs an agent sees on a card.
- `AccessAction` (`types/access.ts`) — actions `evaluateAccess()` decides on.

These overlap but use different names (`read_payload` ↔ `read`, `mint_derivative` ↔ `mint`, `revoke_access` ↔ `policy-escalation`, etc.). The two vocabularies must remain mapped, not unified — they serve different layers (presentation vs. policy). Add a mapping table in `services/iqube/legibility/cardBuilder.ts` (and verify it exists; this is fast-follow risk).

### B.6 `IQubeIdentityState`

**Shipped (4 tiers):**

```ts
'anonymous' | 'pseudonymous' | 'identifiable' | 'delegated'
```

vs. `types/access.ts` `Identifiability` enum (used by the access spine):

```ts
'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable'
```

**Two-enum reality:** Like B.5, these are different surfaces. `Identifiability` is the persona-spine input; `IQubeIdentityState` is the card-output tier. A mapping exists in `services/iqube/legibility/cardBuilder.ts`. The shipped surface introduces `delegated` as a tier — important: it captures "this iQube's identity is controlled by a separate principal" which the spine enum does not. **Action:** Document the two-enum mapping explicitly. Do not collapse them.

### B.7 Structural locks — confirmed in code

Verified by reading `services/iqube/legibility/schemas.ts`:

- Line 149: `type: z.literal('iQubeCard')`
- Line 150: `version: z.literal('0.1')`
- Line 177: `type: z.literal('iQubeCatalog')`
- Line 178: `version: z.literal('0.1')`
- Line 210: `private_payload_exposed: z.literal(false)` — the policy response cannot serialise `true` without Zod failure.

These match exactly what v0.2 §B.13 required (descriptor versioning + JSON Schema validation + Zod structural locks). **Item B.13 is effectively shipped at the legibility-surface level.** It remains open for non-legibility registry surfaces (i.e. the broader `RegistryAdminView`, `RegistryCartridgeView`, etc.).

### B.8 IANA posture

**Shipped (correct):**

- Media type registration target: `application/iqube-card+json` + `application/iqube-catalog+json`.
- Well-known URI: `/.well-known/iqube-catalog` (no vendor prefix needed because the catalog isn't claiming a URI suffix family — the content type carries the contract).
- Status: media types are stabilised in code; IANA submission is fast-follow #5.

**Supersedes v0.2 §A.2's `/.well-known/iqube-protocol/...` proposal.** The shipped design is cleaner: IANA registration of content types (per RFC 6838) is the canonical mechanism for cross-organisation interoperability of JSON resource shapes. The well-known URI suffix `iqube-catalog` is already conformant with RFC 8615 — submission requires no vendor prefix; the catalog itself is what's registered.

**Action on v0.2:** Drop §A.2's vendor-prefix proposal. Replace with: "IANA registration targets `application/iqube-card+json` and `application/iqube-catalog+json` content types. Well-known URI suffix is `iqube-catalog`. v0.1 ships with the strings stable; registration is fast-follow."

---

## C. v0.2 addendum items: now done vs. still open

| v0.2 item | Status post-legibility-v0.1 | Notes |
|---|---|---|
| §A.1 ToolQube sub-types | **Deferred** | Shipped surface is flat ToolQube; subtype info surfaces via tags + `supported_interfaces`. Fast-follow #1 + #3 will address when ToolQubes promote to a DB table. |
| §A.2 IANA-ready well-known | **Done (better than proposed)** | Media-type registration path; well-known catalog only. v0.2's vendor-prefix proposal superseded. |
| §A.3 MCP via ConnectorQube | **Done at surface level** | MCP endpoints surface via `IQubeSupportedInterfaces.mcp` on ToolQube cards. Source still flows through `openclawCore` + `services/registry/classifierService.ts`. |
| §B.1 Source-of-Authority matrix | **Open** | Legibility v0.1 surface respects the matrix (card builder is purely derivative; never decides allow/deny/ownership). But the matrix itself is not yet codified across `services/registry/*`. v0.4 must land it. |
| §B.2 Four redacted view models | **Partially done** | `IQubeCard` IS the public/agent view model. `RegistryAdminView` / `RegistryCartridgeView` / `RegistryPublicView` distinct from the card are still needed for in-app rendering (the card is JSON for agents; cartridges need richer in-process shapes). |
| §B.3 `userOwnsAsset` as sole ownership API | **Open (uninvolved)** | Legibility surface doesn't perform ownership checks (deferred via fast-follow #2 "auth-aware card route"). When that lands, must call `userOwnsAsset`, not parallel. |
| §B.4 Lifecycle state machine | **Surface mapped, internal open** | Surface enum (5 states) shipped. Internal 9-state machine + transition rules (`services/registry/lifecycle.ts`) is still v0.2 work. Surface mapping table required. |
| §B.5 DVN block model | **Open** | No `dvn_receipt_blocks` table yet. Legibility cards expose `provenance_receipts` (T2 aliases) but the block index is unbuilt. |
| §B.6 Payment gating Phase 1 | **Done at surface** | `IQubeAccessGating='payment'` is first-class in v0.1. Q¢ specifics still need wiring in the action handlers (fast-follow #2). |
| §B.7 Edition / shard / ERC-1155 | **Open** | Card doesn't expose `instance_model` / `edition_supply` / `shard` / `hierarchy` fields yet. ContentQube editions exist (Phase 7) but aren't surfaced through the card. |
| §B.8 ClusterQube composition | **Open** | Primitive type now in enum but no `cluster` block on the card. |
| §B.9 Primitive adapter pattern | **Done** | `services/iqube/legibility/sources/*` IS this pattern: `contentQubeSource`, `toolQubeSource`, `aigentQubeSource`. Adding `modelQubeSource` / `clusterQubeSource` / `dataQubeSource` is two-line additions per the shipped docs. |
| §B.10 AigentQube rights/constraints/obligations | **Open** | Card has `agent_permissions` (allowed / disallowed / requires-policy-check / requires-dvn-receipt) but not the full KNYT-framework governance block (rights / constraints / obligations / trust band / root_agent_id / deployment_id / charter_version). Needs an `agent_identity` + `governance` block on AigentQube cards. |
| §B.11 Connector secret safety | **Done structurally** | No `secret_ref` field on the card; secrets remain at the openclawCore / invocation-gateway layer, never card-visible. Verified by Zod schema. |
| §B.12 Mint saga | **Open** | Not in scope of the legibility surface. Still required for the broader registry. |
| §B.13 Descriptor versioning + JSON Schema + canaries | **Done at legibility layer** | `z.literal('0.1')` version; Zod is the structural validator; `tests/iqube-legibility.test.ts` covers structural locks. JSON Schema export is not done (Zod is the validator, but Zod → JSON Schema export is fast-follow). ETag/CORS headers — verify in route handlers; may need a follow-up. |
| §B.14 Type-inventory fix | **Confirmed** | Legibility primitive enum includes `AigentQube` AND `ClusterQube`. The older `types/registry.ts::IQubeType` is still drift — it has `LiquidUITemplateArchetypeQube` and lacks `ClusterQube`. These are two enums for two different surfaces; unification is open. |

---

## D. Updated v0.1/v0.2 path references

Wherever v0.1 / v0.2 reference `/.well-known/iqube-protocol/...`, the actual paths are:

| v0.1 / v0.2 reference | Shipped reality |
|---|---|
| `/.well-known/iqube-protocol/registry.json` | `/.well-known/iqube-catalog` |
| `/.well-known/iqube-protocol/iqube-cards/<id>.json` | `/api/iqubes/[id]/card` |
| `/.well-known/iqube-protocol/agent-cards/<id>.json` | `/api/iqubes/[id]/card` (AigentQube primitive, single endpoint) |
| `/.well-known/iqube-protocol/a2a/<id>.json` | (n/a — `supported_interfaces.a2a` field on AigentQube card) |
| `/.well-known/iqube-protocol/connectors/<id>.json` | `/api/iqubes/[id]/card` (ToolQube primitive, single endpoint, `supported_interfaces.mcp` field) |
| `/.well-known/iqube-protocol/schema/iqube-card.v1.schema.json` | (n/a — Zod is the validator; JSON Schema export deferred) |
| v0.1 §11.2 `/api/registry/iqube/[id]/card?format=agent` | Replaced by `/api/iqubes/[id]/card` |
| v0.1 §11.2 `/api/registry/iqube/[id]/access` | Replaced by `/api/iqubes/[id]/policy` |
| v0.1 §11.2 `/api/registry/catalog?format=agent` | Replaced by `/.well-known/iqube-catalog` |

**Key insight:** The shipped surface uses a **single card route per primitive** (`/api/iqubes/[id]/card`) with `primitive_type` discriminating, rather than per-primitive paths (`/agent-cards/`, `/connectors/`, etc.). This is cleaner — one route handler, one Zod schema, primitive-specific fields are optional on the card shape. Adopt this pattern in v0.4.

---

## E. Source-adapter alignment with v0.1 inventory

`contentQubeSource.ts` reads live `content_qubes` table — aligns with v0.1 §2.8 + §2.9 ContentQube infrastructure.

`toolQubeSource.ts` reads `openclawCore` in-process registry — confirms v0.2 §A.3 finding that MCP/Connector wiring already exists at the registry/classifier layer. The legibility layer reads through that, not around it.

`aigentQubeSource.ts` reads `RUNTIME_AGENT_IDS` + a hand-curated profile map for 5 canonical aigents (`aigent-me`, `aigent-marketa`, `aigent-kn0w1`, `aigent-moneypenny`, `aigent-nakamoto`). Marketa already references its ToolQubes via tags/description — pre-figuring v0.2 §B.8 ClusterQube composition without using the cluster primitive yet.

`services/iqube/legibility/registry.ts` is the unified resolver — dispatches by primitive type to the right source adapter. This is the **practical implementation** of v0.1's proposed `services/registry/resolver.ts::resolveIQube()`, scoped to the legibility surface. The v0.1 resolver still needs to land for cartridge-internal (non-agent) callers.

---

## F. Fast-follow list (shipped doc + v0.2 alignment)

The shipped `docs/iqube-agent-legibility-profile.md` names these explicitly. Mapped to v0.2 items:

| # | Shipped fast-follow | v0.2 item | Priority |
|---|---|---|---|
| 1 | Retrofit cards onto every aigentMe specialist + every ingestion-factory tool | §A.1 (tool subtypes via richer sources) | High |
| 2 | Auth-aware path for tools / aigents / private content (PRD §8.2 Path b) | §B.3 (userOwnsAsset call), §B.6 (payment gating) | High |
| 3 | Promote ToolQubes + AigentQubes into DB tables for versioning + provenance | §A.1 (subtype field), §B.10 (AigentQube governance) | High |
| 4 | Cross-card relations bag (aigent → tools, tool → models) | §B.8 (ClusterQube composition surfaced on card) | Medium |
| 5 | IANA registration of `application/iqube-card+json` + `application/iqube-catalog+json` | §A.2 (corrected — content type, not URI prefix) | Low (post-stabilisation) |
| 6 | Full PRD §12 test coverage (route integration tests) | §B.13 (canary tests) | Medium |

Items in v0.2 not on the legibility fast-follow that still need separate work:

- §B.1 Authority matrix (codified across `services/registry/*`)
- §B.4 Internal lifecycle state machine + transition rules
- §B.5 DVN block model (`dvn_receipt_blocks` + items table)
- §B.7 Edition / shard / ERC-1155 fields on the canonical (non-card) record
- §B.12 Mint saga
- v0.1's `services/registry/resolver.ts` for in-app (cartridge) callers (separate from the legibility resolver)

---

## G. Recommendation

1. **Accept the shipped surface as the canonical legibility contract.** `docs/iqube-agent-legibility-profile.md` is now the primary doc for this layer; v0.1 / v0.2 become its consolidation/extension context.
2. **Fold this v0.3 alignment note into the consolidated PRD before implementation begins on the items still open.** Concretely: update v0.1 §11.2 + v0.2 §A.2 / §B.1 / §B.4 / §B.6 path + enum references to match shipped reality.
3. **Treat v0.2 §B.1 / §B.4 / §B.5 / §B.7 / §B.8 / §B.10 / §B.12 as the next-stage scope.** These extend the canonical (non-agent) registry record beyond what the legibility surface exposes; they are NOT contradicted by what shipped, just not addressed by it.
4. **Confirm the two-enum reality is documented**: surface-facing legibility enums (`IQubeAgentAction`, `IQubeIdentityState`) vs. internal access-spine enums (`AccessAction`, `Identifiability`). The mapping lives in `services/iqube/legibility/cardBuilder.ts` — verify it covers all current + planned actions before extending.
5. **Phase 2 KNYT framework integration** (root agent id + deployment id + persona alias commitment + trust band + charter version) requires extending `aigentQubeSource.ts` to surface a `governance` block on AigentQube cards. This is v0.2 §B.10 work but should land on the legibility surface, not in a separate `agent-cards/` route.

---

## H. Files (shipped — for reference)

| Path | Purpose |
|---|---|
| `types/iqube/legibility.ts` | Type contract for `IQubeCard`, `IQubeCatalog`, action shapes (314 lines) |
| `services/iqube/legibility/schemas.ts` | Zod runtime validators — structural lock (232 lines) |
| `services/iqube/legibility/cardBuilder.ts` | Pure builder + lifecycle/visibility/permission mappers (460 lines) |
| `services/iqube/legibility/sources/contentQubeSource.ts` | Live `content_qubes` adapter (192 lines) |
| `services/iqube/legibility/sources/toolQubeSource.ts` | Live `openclawCore` adapter (91 lines) |
| `services/iqube/legibility/sources/aigentQubeSource.ts` | Hand-seeded aigent adapter (154 lines) |
| `services/iqube/legibility/registry.ts` | Unified resolver (66 lines) |
| `app/.well-known/iqube-catalog/route.ts` | Catalog endpoint (91 lines) |
| `app/api/iqubes/[id]/card/route.ts` | Card endpoint (74 lines) |
| `app/api/iqubes/[id]/policy/route.ts` | Policy endpoint (77 lines) |
| `app/api/iqubes/[id]/actions/route.ts` | Actions endpoint (69 lines) |
| `docs/iqube-agent-legibility-profile.md` | Shipped PRD (155 lines) — primary doc |
| `tests/iqube-legibility.test.ts` | Vitest coverage (294 lines) |

---

**Closure note:** The "recently committed" work the operator referred to is identified, audited, and shown to **strongly align** with the v0.1 / v0.2 trajectory — with three concrete improvements over my v0.2 proposal (single card route per primitive instead of per-primitive paths; media-type IANA registration instead of vendor-prefixed URI suffix; structural Zod locks already in place). v0.2's remaining open items extend rather than contradict what shipped.
