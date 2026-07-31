# PRD Addendum v0.2: Canonical iQube Registry Operating Plane

**Status:** Pre-implementation revision of PRD v0.1.
**Date:** 2026-05-30
**Reads with:** `2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.1.md`
**Verdict on v0.1:** Approved for revision, not implementation. Core direction holds; this addendum adds authority-boundary, security, lifecycle, and non-content-primitive coverage that v0.1 underspecified.

---

## How to read this doc

- §A — three operator clarifications received with the v0.1 review: **taxonomy (SkillQube/ConnectorQube as ToolQube subtypes)**, **well-known surface as IANA-ready local**, **MCP resources as ConnectorQube sources, not separate primitives**.
- §B — 14 addendum items the reviewer required before implementation.
- §C — corrections to v0.1.
- §D — what changes for the implementation plan when v0.2 is folded back into a single PRD.

When v0.2 is folded into a single PRD, this addendum's §A and §B become numbered sections inside the main PRD's §4 (Canonical Model), §5 (Supabase/Registry/Ledger), §6 (DVN Receipts), §7 (Minting), and §8 (Agent Legibility). The split here keeps the review trail visible.

---

## A. Operator clarifications

### A.1 Taxonomy correction — SkillQube, ConnectorQube, WorkflowQube are sub-types of ToolQube

**Operator instruction:** *"SkillQube, ConnectorQubes, etc. can be types of ToolQubes."*

This collapses the v0.1 primitive enum and resolves the ingestion-factory / `IQubeType` enum drift identified in v0.1 §3.1.

**Revised primitive taxonomy:**

```
Root primitive types (closed set):
  DataQube
  ContentQube
  ToolQube
  ModelQube
  AigentQube
  ClusterQube
  LiquidUITemplateArchetypeQube  (operator decision pending — see v0.1 §17 Q3)

ToolQube sub-types (open set, extensible):
  ToolQube.skill        (was SkillQube)
  ToolQube.connector    (was ConnectorQube — wraps MCP endpoints, API integrations)
  ToolQube.workflow     (was WorkflowQube — orchestrated multi-step flow)
  ToolQube.browser      (was inferred from wrapperStrategy='browser')
  ToolQube.<future>     (extensible without primitive-enum changes)
```

**Schema implication:**

```ts
interface CanonicalIQubeRecord {
  primitive_type: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube'
                 | 'AigentQube' | 'ClusterQube' | 'LiquidUITemplateArchetypeQube';
  tool_subtype?: 'skill' | 'connector' | 'workflow' | 'browser' | string; // ToolQube only
  wrapper_strategy?: 'mcp' | 'skill' | 'workflow' | 'browser' | string;   // ToolQube only
  // ...
}
```

**Migration of existing `registry_assets.asset_class`:**

| Current `asset_class` | Becomes |
|---|---|
| `ToolQube` | `primitive_type='ToolQube'`, `tool_subtype=null` (generic) |
| `SkillQube` | `primitive_type='ToolQube'`, `tool_subtype='skill'` |
| `WorkflowQube` | `primitive_type='ToolQube'`, `tool_subtype='workflow'` |
| `ConnectorQube` | `primitive_type='ToolQube'`, `tool_subtype='connector'` |
| `DataQube` | `primitive_type='DataQube'` |

Backfill is a single migration on `registry_assets`. The classifier in `services/registry/classifierService.ts` already discriminates via `wrapperStrategy` — that field maps cleanly onto `tool_subtype`. The `RegistryAssetClass` type in `types/registryIngestion.ts` should be replaced by `{ primitive_type, tool_subtype?, wrapper_strategy? }`.

**Why this matters for the resolver:** §A.4 of v0.1 (`buildCodexUrl` cross-cartridge propagation, agent-legibility cards) becomes simpler — the agent card's `kind` field uses the closed root primitive enum; sub-type discrimination is a secondary field that consumers can ignore or use.

### A.2 Well-known surface is an IANA-ready local prototype — not yet executed

**Operator instruction:** *"The well-known work should surface as an IANA-ready (not executed) local version of this which should use the well-known framework, ready to be published to the IANA library when it has stabilised operationally. It was recently committed so please find and ensure it is aligned with this plan."*

**Audit result — what exists today:**

| Surface | Status | Path |
|---|---|---|
| `/.well-known` directory | **Does not exist** — middleware bypasses it (`middleware.ts:matcher` excludes `.well-known`) but no route handlers respond | n/a |
| MCP endpoint as ingestion source | **Exists** — `services/registry/classifierService.ts:88` maps `source_type='mcp_endpoint'` to `ConnectorQube + wrapperStrategy='mcp'` | `services/registry/classifierService.ts`, `types/registryIngestion.ts:15` |
| MCP invocation gateway | **Exists** — `clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts` invokes registered MCP tools, `services/registry/invocationGateway.ts` is the registry-side entry | `services/registry/invocationGateway.ts`, `clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts` |
| Agent identity / discovery framework | **Recently committed** — `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` (touched 2026-05-23, `2e9ca9d`). Section 4.3 names "machine-readable mission endpoint / MCP server or equivalent / agent-card style metadata / registry presence / API connector layer". Section 10 defines the **three-layer agent identity model (Root Agent ID, Deployment ID, Persona/Mission ID)** which the agent card must surface. | `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` |

**Conclusion:** The "recently committed" work is the **KNYT Wheel Agent Discovery + Identity Framework** doc + the **MCP/ConnectorQube classifier wiring**, not a `.well-known` directory. There is no `.well-known` surface yet. The PRD must produce the local IANA-ready prototype.

**Revised v0.1 §8 (Agent-Legibility Layer) — IANA-ready posture:**

The `.well-known` surface in this codebase is a **local prototype** of a future IANA-registered well-known URI suffix family. It must:

1. **Use the well-known URI framework as specified.** Path layout follows RFC 8615 (`/.well-known/<suffix>/<resource>.json`) so the surface is publishable to IANA without restructuring.
2. **Not assume the suffix is yet IANA-registered.** Use a vendor-prefixed suffix until stabilisation: e.g. `/.well-known/iqube-protocol/registry.json` (the `iqube-protocol/` segment is a vendor namespace, IANA-conformant per RFC 8615 §3.1 "registered vs. unregistered URI suffixes"). When the suffix is submitted to IANA, the registration removes the vendor prefix.
3. **Document the future IANA submission.** Carry a `Schema Versioning` block (§B.12) that includes `iana_status: 'unregistered'`, with a placeholder for `iana_registration_id` once submitted.
4. **Align with the KNYT agent identity model.** Cards expose Root Agent ID + Deployment ID + Persona/Mission ID (per `KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` §10). Persona-ID surface uses the existing T1 `personaSessionToken` envelope.
5. **Align with the MCP/ConnectorQube wiring.** ConnectorQube cards expose the MCP endpoint + invocation gateway URL (already in `services/registry/invocationGateway.ts`); cards never expose secrets (see §B.10).

**Proposed local surface layout (vendor-prefixed, IANA-ready):**

```
/.well-known/iqube-protocol/
  registry.json                       # catalog descriptor + endpoint list + schema version
  schema/
    iqube-card.v1.schema.json         # JSON Schema for individual iQube card
    agent-card.v1.schema.json         # JSON Schema for AigentQube cards
    a2a.v1.schema.json                # JSON Schema for A2A descriptors
    connector-card.v1.schema.json     # JSON Schema for ConnectorQube (MCP) cards
  iqube-cards/<iqube_id>.json         # per-iQube card
  agent-cards/<aigent_id>.json        # per-AigentQube card
  a2a/<aigent_id>.json                # A2A handshake descriptor
  connectors/<connector_id>.json      # MCP connector descriptor
```

**Action for implementation:**

- The `IngestionFactoryPanel.tsx` / `services/registry/classifierService.ts` MCP path is the source of truth for ConnectorQube metadata. The well-known card for a ConnectorQube is derived from that record; do not duplicate.
- The `KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` Section 10 identity model defines what AigentQube cards must surface. The card builder reads `getActivePersona` + the AigentQube's three-layer identity descriptors.
- The well-known suffix vendor-prefix (`iqube-protocol/`) is the operator-visible commitment that this surface is **not yet IANA-registered** but is structured to be.

### A.3 MCP resources are surfaced via ConnectorQube — not as a separate primitive

**Operator question:** *"How are MCP resources surfaced in the registry? As inputs within an iQube schema? i.e. as part of an iQube e.g. tool qube therefore not requiring separate consideration?"*

**Answer: Confirmed by code. MCP resources are already first-class registry citizens as ConnectorQube — which per §A.1 is a ToolQube sub-type. No separate primitive is needed.**

Evidence:

- `types/registryIngestion.ts:15` — `source_type` enum includes `'mcp_endpoint'`.
- `services/registry/classifierService.ts:88-95` — classification rule:
  ```
  if (sourceType === "mcp_endpoint") {
    assetClass: "ConnectorQube",
    wrapperStrategy: "mcp",
    rationale: "MCP endpoint source type maps to ConnectorQube + mcp wrapper"
  }
  ```
- `services/registry/classifierService.ts:166` — `if (assetClass === "ConnectorQube") return "mcp"` (default wrapper strategy).
- `clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts` — MCP invocation runtime.
- `services/registry/invocationGateway.ts` — registry-side invocation entry point.

**What this means for v0.2:**

- MCP servers, MCP tools, and any future MCP-protocol resource are surfaced as `primitive_type='ToolQube', tool_subtype='connector', wrapper_strategy='mcp'`.
- An MCP server has one ConnectorQube record. Each MCP tool exposed by that server is either (a) a child ToolQube referencing the parent ConnectorQube via `cluster_member_of` (§B.8 ClusterQube composition), or (b) flat metadata fields on the ConnectorQube record (`tools: ToolDescriptor[]`). Operator decision — recommend (a) for tools that are independently invocable / discoverable / gated; (b) for tools that only make sense in the context of the parent server.
- The agent-legibility card for an MCP ConnectorQube exposes: endpoint URL, transport (stdio/sse/websocket), discovered tools list, policy (gating, required credentials), invocation gateway URL, schema version.
- **Secrets stay out** (per §B.10). The ConnectorQube card holds metadata + policy + invocation route; bearer tokens / API keys / OAuth credentials resolve through the existing env / vault path at invocation time.

**Schema additions to the canonical record (additive, ToolQube-scoped):**

```ts
interface CanonicalIQubeRecord {
  // ...
  tool_subtype?: 'skill' | 'connector' | 'workflow' | 'browser';
  wrapper_strategy?: 'mcp' | 'skill' | 'workflow' | 'browser';

  // ConnectorQube-specific (when tool_subtype='connector')
  connector?: {
    endpoint_url: string;
    transport: 'stdio' | 'sse' | 'http' | 'websocket';
    protocol: 'mcp' | 'rest' | 'graphql' | 'grpc';
    discovered_tools?: Array<{ id: string; name: string; description?: string }>;
    auth_scheme?: 'none' | 'bearer' | 'oauth2' | 'api_key';
    secret_ref?: string;  // OPAQUE handle — resolved at invocation via vault; never the secret itself
  };
}
```

**Implication for the implementation plan:** v0.1 Stage 7 (Agent-Legibility Layer) gains a `connectors/<id>.json` card type for ConnectorQube records, derived directly from the existing ingestion-factory output. No new ingestion path needed.

---

## B. Reviewer addendum items — required before implementation

### B.1 Source-of-Authority Matrix

Add to v0.2 §4 (Canonical Model) as the first sub-section:

| Domain | Authority | Notes |
|---|---|---|
| iQube canonical identity (`iqube_id`) | Registry | UUID; immutable once assigned |
| metaQube metadata | Registry | Resolver returns; cards derive from |
| BlakQube ciphertext | Encrypted storage (Autonomys / IPFS / payload-cms) | Registry holds reference only — provider + locator + content-hash |
| BlakQube payload **access** | `services/access/evaluateAccess.ts` | Sole gate. Registry never decides allow/deny. |
| Token ownership | `services/rewards/assetOwnership.ts::userOwnsAsset()` | Sole ownership API. Backed by entitlements + SKU expansion + (future) persona ↔ TokenQube link + chain index. |
| Mint event | Chain (EVM contract `QubeAnchored` event) + DVN receipt | Chain is proof; DVN receipt is audit anchor |
| Transfer event | Chain + DVN receipt | Same as mint |
| Current registry state | Registry | The "what is this iQube right now" answer |
| Audit trail | DVN receipts (`orchestration_events` + `content_qube_dvn_receipts`) | Registry exposes query API but is not the authority |
| Identity (T0 caller) | `services/identity/getActivePersona.ts` | Sole resolver |
| Identifiability (T2 alias) | `services/identity/cohortAliasService.computeAliasCommitment` | Used by receipt handles |
| Public agent descriptors | Derived from registry, never authoritative | Cards = projection; registry record is canonical |
| Connector secrets | External vault / env / service | **Never the registry** — see §B.10 |

**Architectural rule** (state explicitly in v0.2 §4):

> The registry resolver `resolveIQube()` must not be an access authority, an ownership authority, or a receipt authority. It composes over the spine. If a caller wants to know "can I read this iQube's BlakQube?" they call `evaluateAccess()`, not the resolver. If a caller wants to know "do I own this iQube?" they call `userOwnsAsset()`, not the resolver. The resolver returns the canonical record + optional projected fields (e.g. `caller_owns?: boolean` populated by calling `userOwnsAsset` if the caller passed a persona context); it never derives them itself.

### B.2 Redaction / View Models

Replace v0.1 §4's single `CanonicalIQubeRecord` with a base record + four projected views. No API route or `.well-known` descriptor ever returns the internal record.

```ts
// Internal — server-only, includes T0
interface CanonicalIQubeInternalRecord {
  iqube_id: string;
  primitive_type: IQubePrimitive;
  tool_subtype?: ToolSubtype;
  meta_qube_id: string;
  blak_qube_id?: string;
  token_qube_id?: string;
  creator_persona_id?: string;       // T0
  steward_persona_id?: string;       // T0
  // ... full shape
}

// Admin — for operator console (admins/partners; gated by cartridgeFlags)
interface RegistryAdminView {
  // All internal fields EXCEPT raw persona IDs
  // Personas exposed as { display_label, identifiability, alias_commitment }
}

// Cartridge — for in-app cartridge rendering (persona-aware, no T0)
interface RegistryCartridgeView {
  iqube_id: string;
  primitive_type: IQubePrimitive;
  tool_subtype?: ToolSubtype;
  display_name: string;
  display_description?: string;
  cover_url?: string;
  status: IQubeStatus;
  mint_status: MintStatus;
  visibility: Visibility;
  gating: GatingKind;
  caller_owns?: boolean;             // populated only if caller persona passed
  caller_can_read?: boolean;         // populated only if caller persona passed (calls evaluateAccess)
  cartridge_bindings: string[];
  // T1 fields only
}

// Public — published catalog, no caller context
interface RegistryPublicView {
  iqube_id: string;
  primitive_type: IQubePrimitive;
  tool_subtype?: ToolSubtype;
  display_name: string;
  display_description?: string;
  cover_url?: string;
  visibility: 'public';              // only public-visible records exposed
  gating: GatingKind;                // hints only
  required_credentials?: string[];   // hint
  // No caller_owns, no caller_can_read, no T1 caller-specific fields
}

// Agent — IANA-ready well-known card
interface AgentIQubeCardView {
  schema_version: string;            // e.g. '1.0.0'
  iana_status: 'unregistered' | 'registered';
  iqube_id: string;
  kind: IQubePrimitive;
  subkind?: ToolSubtype;
  name: string;
  description?: string;
  policy: {
    gating: GatingKind;
    actions: AccessAction[];
    receipt_modes: Record<AccessAction, ReceiptMode>;
    required_credentials?: string[];
  };
  links: {
    detail?: string;                 // human-facing URL
    invoke?: string;                 // invocation gateway URL (for ToolQube)
    receipts?: string;               // public receipt feed
  };
  agent_identity?: {                 // only for AigentQube (per KNYT framework §10)
    root_agent_id: string;
    deployment_id?: string;
    persona_alias_commitment?: string;
  };
  updated_at: string;
}
```

**Projection contract:** Every view is built by a deterministic pure function from the internal record + (optional) caller context. Builders live in `services/registry/projections/` and are tested with property-based tests that assert no T0 leakage.

### B.3 Ownership-check conflict — resolve

**v0.1 conflict:** v0.1 §13 acceptance criteria said `userOwnsAsset()` is the only ownership check; v0.1 §5 said "tokenQube mediates entitlement"; v0.1 §7 introduced a `Persona ↔ TokenQube link table`.

**Resolution to fold in:**

- `userOwnsAsset(personaId, assetId)` remains the **sole application-level ownership API**. No caller ever consults the persona ↔ TokenQube link table directly.
- The new persona ↔ TokenQube link table is a **data substrate for `userOwnsAsset`** — same way the entitlements table and SKU expansion already are. When `userOwnsAsset` is extended to include on-chain proof of TokenQube possession (Phase 4 per CLAUDE.md), the link table is one of the read paths it consults.
- The chain index is a **secondary read path** for `userOwnsAsset` — same authority hierarchy as the link table.
- Registry access flows that need ownership call `userOwnsAsset`. Period.

State explicitly in v0.2:

> `services/rewards/assetOwnership.ts::userOwnsAsset()` is the sole ownership API. Any new data substrate (persona ↔ TokenQube link table, on-chain TokenQube index, etc.) becomes a read path inside `userOwnsAsset`, never a parallel API. Registry access flows must not bypass `userOwnsAsset`.

### B.4 Lifecycle state machine

Replace v0.1's enum list with an explicit transition graph. Add to v0.2 §4.

```
States:
  draft
  wip
  review_pending
  published
  canonized
  deprecated
  revoked
  new_version_pending
  abandoned

Allowed transitions:
  draft               → wip | abandoned
  wip                 → review_pending | abandoned
  review_pending      → published | wip            (resubmit on rejection)
  published           → canonized | deprecated | revoked | new_version_pending
  canonized           → deprecated | revoked | new_version_pending
  deprecated          → revoked
  new_version_pending → canonized                  (when new version published, parent reaches canonized of new version chain)
  revoked             → (terminal)
  abandoned           → (terminal)
```

Per transition, the lifecycle table specifies:

| Field | Example for `published → canonized` |
|---|---|
| Initiator role | Operator (admin) OR creator-persona-with-partner-flag |
| Human approval required | Yes — operator approval queue |
| DVN receipt emitted | Yes — `action='canonize'`, `receipt_mode='sync'` |
| Chain interaction | Optional — if asset has unminted canonical editions, fires mint per `mintCanonicalEdition` |
| Descriptor side-effect | Agent card `policy.canonized = true` published; card `updated_at` bumped; old version card marked `supersedes`/`superseded_by` |
| Payload access change | None — canonization does not unlock payload |
| Reversibility | One-way (deprecate/revoke is the path out, not "uncanonize") |

Table is built for every transition. Lives in `services/registry/lifecycle.ts` as a typed state machine; reviewed in code review for completeness.

**Special rule for canonization:**

> Canonization is a governance act, not a status flip. It requires explicit operator (or delegated partner) approval, emits a sync DVN receipt, and publishes/refreshes the agent card. Reversing canonization requires a separate `deprecate` or `revoke` transition with its own receipt — there is no "uncanonize".

### B.5 DVN logical block model — Phase 1, not waiting on ordinals

Replace v0.1 §6's "block analysis post-Phase 3.4" framing. Add to v0.2:

**New tables (Phase 1):**

```sql
CREATE TABLE dvn_receipt_blocks (
  block_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_number       BIGINT NOT NULL,                              -- monotonic per cartridge scope
  cartridge_scope    TEXT NOT NULL,                                -- 'platform' | <cartridge-id>
  epoch              INTEGER NOT NULL,                             -- e.g. UTC day index
  status             TEXT NOT NULL DEFAULT 'open',                 -- open | sealed | anchored | failed
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at          TIMESTAMPTZ,
  anchored_at        TIMESTAMPTZ,
  receipt_count      INTEGER NOT NULL DEFAULT 0,
  batch_hash         TEXT,                                         -- SHA-256 over sealed item set
  merkle_root        TEXT,                                         -- optional
  inscription_id     TEXT,                                         -- populated post-Phase 3.4 ordinal inscription
  inscription_chain  TEXT,                                         -- 'bitcoin-ordinal' | future
  failure_reason     TEXT,
  UNIQUE (cartridge_scope, block_number)
);

CREATE TABLE dvn_receipt_block_items (
  block_id           UUID NOT NULL REFERENCES dvn_receipt_blocks(block_id),
  receipt_source     TEXT NOT NULL,                                -- 'orchestration_events' | 'content_qube_dvn_receipts'
  receipt_id         TEXT NOT NULL,                                -- FK into source table
  sequence_in_block  INTEGER NOT NULL,
  item_hash          TEXT NOT NULL,
  PRIMARY KEY (block_id, sequence_in_block)
);
```

**Lifecycle:**

- `open` — new receipts append to this block (one open block per cartridge scope).
- `sealed` — block closed by batch sealer (size threshold, time threshold, or operator force). `batch_hash` computed. No more items added.
- `anchored` — `inscription_id` populated when Phase 3.4 ordinal inscription succeeds.
- `failed` — batch sealing or anchoring failed; block retained for audit; retry via sibling block.

**Query API gains:**

- `GET /api/registry/receipts/blocks?cartridge=X&from=N&to=M` — block range.
- `GET /api/registry/receipts/blocks/[block_id]` — block detail + items.
- `GET /api/registry/receipts/blocks/[block_id]/anchor` — anchoring status.

**Why this matters:** v0.1 made block-level analysis contingent on ordinal inscription landing. The operator's ask was stronger: the registry needs ledger-style block analysis **now**, with ordinals as a later anchoring layer. This model gives that.

### B.6 Payment gating in Phase 1

Update v0.1 §16 (Phase 2 stub):

**Phase 1 scope:** Payment-gated access policies + Qc / QriptoCENT entitlement checks are first-class in Phase 1 wherever existing payment flows already exist. The canonical record's `gating: 'payment'` is a valid Phase 1 state, fully integrated with `evaluateAccess()` and `userOwnsAsset()`.

**Phase 2 scope:** Pricing intelligence, value/risk analysis, calibration, exchange optimisation, risk-adjusted pricing. These remain stubbed in v0.2.

**Concrete Phase 1 work this adds:**

- Canonical record exposes `gating: GatingKind` where `GatingKind ∈ { 'free' | 'credential' | 'payment' | 'token' | 'identity' }`. Already in v0.1 §4.
- For `gating='payment'`, the record exposes `payment_policy_id` → `content_qube_payment_gates` (or equivalent). Already exists per `2026-05-13_qripto-spine` Phase 2 schema.
- `evaluateAccess()` for payment-gated descriptors already runs `userOwnsAsset` (Phase 1 spine). No new gate logic.
- Q¢ pricing follows CLAUDE.md canonical conversion (`$1 = 100 Q¢`, integer cents storage). Registry stores `amount_qc` as integer cents.

### B.7 Edition / shard / ERC-1155 support

v0.1's minting model was too NFT-singular. Replace with a typed asset-instance model.

**Schema additions:**

```ts
interface CanonicalIQubeRecord {
  // ...
  instance_model: 'singleton' | 'editioned' | 'multi_edition_1155' | 'sharded' | 'fractional';
  edition_supply?: {
    total_planned: number;             // e.g. 1860 for canonical KNYT editions
    canonical_minted: number;          // how many canonical-rarity editions issued
    common_appended: number;           // commons issued (open supply)
    rarity_distribution?: Record<string, number>;  // legendary/epic/rare/etc.
  };
  shard?: {
    total_shards: number;
    shard_distribution_mode: 'equal' | 'weighted' | 'auction';
  };
  hierarchy?: {
    collection_id?: string;
    series_id?: string;
    episode_id?: string;
    page_id?: string;
    panel_id?: string;
  };
}
```

**Gating extension:** access can be granted at the collection / series / episode / page / panel level, at a rarity level, at an edition-number level, or at a shard level. The `access_policy` record carries a `scope` field with these granularities. Existing `content_qube_editions` already supports edition-number scoping; this extends to other granularities for non-content primitives.

**Note:** This is already partially in place for ContentQubes via Phases 7 + 7B (`baseTokenMint.ts`, `claimEditionForPurchase`, 1,860 canonical editions per qube + open commons). v0.2 generalises the **schema and resolver shape** so non-content primitives can adopt the same model when they need it.

### B.8 ClusterQube composition semantics

Add a `cluster` block to the canonical record:

```ts
interface CanonicalIQubeRecord {
  // ...
  // For primitive_type='ClusterQube' only
  cluster?: {
    member_iqubes: Array<{
      iqube_id: string;
      role: 'primary' | 'dependency' | 'optional';
      version_constraint?: string;             // e.g. '^1.2.0'
    }>;
    dependency_graph: {
      nodes: string[];                          // iqube_ids
      edges: Array<{ from: string; to: string; relation: 'depends_on' | 'invokes' | 'composes' }>;
    };
    policy_aggregation: 'union' | 'intersection' | 'strictest' | 'explicit';
    receipt_aggregation: 'flatten' | 'nested' | 'cluster_only';
    version_compatibility_strategy: 'pin' | 'caret' | 'tilde' | 'any';
    access_propagation: 'cluster_grants_members' | 'members_grant_cluster' | 'independent';
    revocation_propagation: 'propagate_to_members' | 'cluster_only';
  };
}
```

**Behavioural rules** (state in v0.2):

- `policy_aggregation='strictest'` means access to the cluster requires meeting the strictest gate of any member. `'union'` means meeting any one. Operator decision per cluster.
- `access_propagation='cluster_grants_members'` means owning the cluster entitlement grants access to all members. `'members_grant_cluster'` means access to the cluster requires owning all members. `'independent'` means cluster access is a separate entitlement that does not propagate.
- Receipts for cluster-level actions emit the cluster receipt; `receipt_aggregation='nested'` additionally emits per-member receipts.
- Revocation of a cluster with `revocation_propagation='propagate_to_members'` marks all member iQubes revoked (each emits its own receipt). Otherwise the cluster is revoked but members remain valid.

### B.9 Primitive adapter pattern

Replace v0.1's "one resolver fits all" with a primitive-specific adapter pattern, all composing under the canonical resolver.

```ts
// services/registry/adapters/types.ts
interface IQubePrimitiveAdapter {
  primitiveType: IQubePrimitive;
  toolSubtype?: ToolSubtype;

  // Fetch the primitive-specific data for the canonical record
  hydrate(internal: CanonicalIQubeInternalRecord): Promise<Partial<CanonicalIQubeInternalRecord>>;

  // Project to view shapes
  projectAdmin(internal: CanonicalIQubeInternalRecord): RegistryAdminView;
  projectCartridge(internal: CanonicalIQubeInternalRecord, persona?: ActivePersonaContext): Promise<RegistryCartridgeView>;
  projectPublic(internal: CanonicalIQubeInternalRecord): RegistryPublicView;
  projectAgentCard(internal: CanonicalIQubeInternalRecord): AgentIQubeCardView;

  // Lifecycle hooks
  onTransition(internal: CanonicalIQubeInternalRecord, transition: LifecycleTransition): Promise<void>;

  // UI hint
  detailPanelComponent: string; // path to React component for detail panel
}

// Adapters to implement:
// services/registry/adapters/contentQubeAdapter.ts
// services/registry/adapters/toolQubeAdapter.ts            (handles all tool subtypes by default)
// services/registry/adapters/toolQubeConnectorAdapter.ts   (MCP-specific overrides for subtype='connector')
// services/registry/adapters/modelQubeAdapter.ts
// services/registry/adapters/aigentQubeAdapter.ts
// services/registry/adapters/clusterQubeAdapter.ts
// services/registry/adapters/dataQubeAdapter.ts
```

The canonical resolver picks the adapter from a registry of adapters keyed on `(primitive_type, tool_subtype?)`. ContentQubeAdapter wraps the existing `resolveContentQube` + `buildDisplayManifest`. Other adapters are new but small.

### B.10 AigentQube rights, constraints, obligations

AigentQube cards (and A2A descriptors) must expose the governance shape from the KNYT framework (`KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` §10, §11, §12).

```ts
interface AigentQubeGovernance {
  rights: {
    allowed_actions: AccessAction[];                  // closed enum from types/access.ts
    cartridge_scopes: string[];                       // cartridges this agent may operate within
    tool_scopes: string[];                            // iqube_ids of tools this agent may invoke
    data_scopes: string[];                            // iqube_ids of data this agent may read
    payment_authority?: {                             // optional, scoped spend
      currency: 'qc' | 'usdc' | 'usd';
      max_amount_per_tx: number;                      // integer cents for qc
      max_amount_per_period?: { amount: number; period: 'day' | 'week' | 'month' };
    };
  };
  constraints: {
    prohibited_actions: AccessAction[];
    prohibited_cartridges: string[];
    must_disclose_as_agent: boolean;
    identifiability_floor: Identifiability;
    requires_human_approval: AccessAction[];          // actions that cannot proceed without operator/owner sign-off
  };
  obligations: {
    receipt_required_for: AccessAction[];             // actions that MUST emit a sync DVN receipt
    charter_accepted: boolean;                        // per KNYT framework Agent Charter
    charter_version: string;
    trust_band: 0 | 1 | 2 | 3 | 4;                    // per KNYT framework §14
    root_agent_id: string;                            // per KNYT framework §10.1
    deployment_id?: string;                           // per KNYT framework §10.2
    persona_id_alias_commitment?: string;             // T2 alias for the working persona
  };
  revocation: {
    revocable_by: ('root_owner' | 'cartridge_admin' | 'platform_admin')[];
    revocation_receipt_required: boolean;
  };
}
```

The `AigentQubeAdapter.projectAgentCard()` surfaces this governance block in the card. The KNYT framework's three-layer identity (root / deployment / persona) maps directly.

### B.11 Connector / Tool secret safety

Add explicit non-storage rule:

> **The registry must never store secrets, API keys, bearer tokens, OAuth refresh tokens, or any other credential material.** ConnectorQube and ToolQube records carry an opaque `secret_ref` (string handle) that resolves through the approved vault / env / service at invocation time. The `secret_ref` is itself non-sensitive (it does not embed the secret); it is the locator. The `services/registry/invocationGateway.ts` is the only code path that dereferences `secret_ref` → secret, and it does so via the vault/env service — never via the registry tables.

**Schema:**

```ts
interface CanonicalIQubeRecord {
  // ...
  connector?: {
    // ...
    auth_scheme?: 'none' | 'bearer' | 'oauth2' | 'api_key';
    secret_ref?: string;                              // OPAQUE handle: 'env:GOOGLE_API_KEY' or 'vault:knyt/mcp/foo'
    secret_scope?: string[];                          // OAuth-style scopes if applicable
  };
}
```

**Invocation contract:**

- All side-effecting invocations go through `services/registry/invocationGateway.ts`.
- The gateway:
  1. Validates the caller via `getActivePersona`.
  2. Runs `evaluateAccess` against the ToolQube's policy.
  3. Checks `AigentQubeGovernance` if caller is an Aigent (rights/constraints/obligations).
  4. Resolves `secret_ref` via vault/env at the last moment.
  5. Invokes (MCP / HTTP / other).
  6. Emits DVN receipt for the action.
  7. Returns redacted result (no secrets in response).
- Tests assert no `secret_ref` resolves to its secret value anywhere in registry-bound JSON.

### B.12 Transactional integrity / saga handling

Mint and canonization are multi-step. Add explicit saga handling.

**States for the mint saga:**

```
unminted
  → registry_draft_created
  → payload_encrypted
  → payload_uploaded (Autonomys/IPFS)        [retry: yes; failure: payload_upload_failed]
  → token_qube_created
  → chain_minting                            [retry: bounded; failure: mint_failed]
  → chain_minted
  → anchor_persisted                         [retry: yes; failure: anchor_persist_failed]
  → receipt_emitting                         [retry: yes; failure: receipt_pending]
  → receipt_emitted
  → card_publishing                          [retry: yes; failure: card_publish_pending]
  → card_published
  → MINT_COMPLETE
```

**Rules:**

- Every step has an idempotency key (`mint_saga_id` + step name).
- Steps that hit external systems (chain, storage, ICP) are retryable with bounded retries.
- Steps that write to the registry use an outbox pattern: write intent first, ack on completion.
- `mint_failed` / `payload_upload_failed` are recoverable through operator console.
- `anchor_pending` / `receipt_pending` / `card_publish_pending` are transient — a background worker drives them to completion or to terminal failure.
- Compensation: chain success + DB failure means the on-chain mint stands; the saga re-runs the DB persistence step. No chain rollback. This is documented loudly in code comments.

Implement as a state machine in `services/registry/mintSaga.ts`. A small DB table `mint_sagas(saga_id, iqube_id, current_state, last_error, retry_count, updated_at)` tracks state. Background worker reconciles `*_pending` states.

### B.13 Descriptor versioning + JSON Schema validation

All `.well-known` and agent-readable descriptors carry:

```ts
{
  "$schema": "https://aigentz.example/.well-known/iqube-protocol/schema/iqube-card.v1.schema.json",
  "schema_version": "1.0.0",
  "iana_status": "unregistered",
  "iana_registration_id": null,
  "generated_at": "2026-05-30T...",
  "etag": "...",
  // ... payload
}
```

**Operational requirements:**

- Every well-known route returns `ETag` + `Last-Modified` headers.
- CORS policy: read-only `Access-Control-Allow-Origin: *` for `.well-known/*` paths only.
- A signed manifest at `/.well-known/iqube-protocol/registry.json` lists all card endpoints + their current schema versions.
- JSON Schema files committed alongside route handlers under `app/.well-known/iqube-protocol/schema/`.
- CI test: every descriptor route handler produces output that validates against its declared schema (use ajv or similar).
- Canary test (extending the pattern from `tests/persona-broadcast-handshake.test.ts`): assert no T0 field, no `secret_ref` value, no BlakQube payload ever appears in any descriptor output across all schemas.

### B.14 Type-inventory inconsistency in v0.1 — corrected

**Reviewer caught:** v0.1 §2.1 said `IQubeType` is missing both `AigentQube` and `ClusterQube`. v0.1 §4 said it includes `AigentQube` and adds `ClusterQube`.

**Code reality:** `types/registry.ts:1`:

```ts
export type IQubeType = 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'LiquidUITemplateArchetypeQube';
```

`AigentQube` **is** in the enum. `ClusterQube` is not. `SkillQube`, `WorkflowQube`, and `ConnectorQube` are not in `IQubeType` — they live as `RegistryAssetClass` values per `types/registryIngestion.ts` (and per §A.1 above become ToolQube sub-types).

**Correction to v0.1 §2.1:** Replace *"`IQubeType` is missing `AigentQube` and `ClusterQube`"* with *"`IQubeType` is missing `ClusterQube`. The ingestion factory's `RegistryAssetClass` (`SkillQube | WorkflowQube | ConnectorQube`) is a parallel enum that does not appear in `IQubeType` — per §A.1 these collapse to ToolQube sub-types in v0.2."*

---

## C. Other v0.1 corrections discovered during review

### C.1 v0.1 §2.9 — IANA / well-known not just "absent"

Replace *"No `.well-known` directory at repo root, `app/`, or `public/` — no canonical agent-legibility descriptor surface exists."* with:

> No `.well-known` directory exists; the `middleware.ts:matcher` excludes the path but no route handlers respond. The KNYT Wheel Agent Discovery + Identity Framework doc (`codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md`, last touched `2e9ca9d` on 2026-05-23) is the canonical reference for what the surface must expose. The ConnectorQube + MCP wiring in `services/registry/classifierService.ts` is the source of truth for ConnectorQube card content. v0.2 implements the surface as an **IANA-ready local prototype** (vendor-prefixed suffix per §A.2) aligned with both.

### C.2 v0.1 §3.1 — ingestion-factory enum drift

Per §A.1 the apparent enum drift is resolved: `SkillQube`, `WorkflowQube`, `ConnectorQube` are ToolQube sub-types in v0.2. The drift was a v0.1 framing error, not an actual design conflict.

### C.3 v0.1 §11.2 — endpoint paths for connectors

Add to the endpoint table:

| Path | Method | Role |
|---|---|---|
| `GET /.well-known/iqube-protocol/registry.json` | GET | Catalog descriptor (IANA-ready, vendor-prefixed) |
| `GET /.well-known/iqube-protocol/schema/[name].json` | GET | JSON Schema for descriptor type |
| `GET /.well-known/iqube-protocol/iqube-cards/[id].json` | GET | iQube card |
| `GET /.well-known/iqube-protocol/agent-cards/[id].json` | GET | AigentQube card |
| `GET /.well-known/iqube-protocol/a2a/[id].json` | GET | A2A descriptor |
| `GET /.well-known/iqube-protocol/connectors/[id].json` | GET | ConnectorQube descriptor (MCP-aware) |
| `POST /api/registry/iqube/[id]/invoke` | POST | Invocation gateway (ToolQube — proxies `services/registry/invocationGateway.ts`) |

---

## D. Implementation plan changes when v0.2 is folded in

When v0.2 is folded into a unified PRD, the implementation plan stages change as follows:

| Stage | v0.1 scope | v0.2 changes |
|---|---|---|
| Stage 1 (Schema) | Define `CanonicalIQubeRecord`, extend `IQubeType` | + Add `tool_subtype`, `wrapper_strategy`, `connector`, `instance_model`, `edition_supply`, `shard`, `hierarchy`, `cluster` fields. Migrate `registry_assets.asset_class` to `(primitive_type, tool_subtype)`. Fix `ClusterQube` enum. |
| Stage 2 (Resolver) | Implement `services/registry/resolver.ts` | + Add `services/registry/adapters/*` per-primitive. + Add four projection builders (`projectAdmin`/`projectCartridge`/`projectPublic`/`projectAgentCard`). + Property-based tests for T0 leakage. |
| Stage 2.5 NEW (Lifecycle) | n/a | Implement `services/registry/lifecycle.ts` state machine with per-transition rules. Lifecycle table reviewed for completeness. |
| Stage 4 (Minting) | Wire mint route to emit DVN receipt + persona link | + Implement mint saga (`services/registry/mintSaga.ts`) with idempotency, outbox, retry, compensation. + Background worker reconciles `*_pending` states. |
| Stage 5 (DVN Receipt Index) | Add `iqube_id` column + composite indexes | + Land `dvn_receipt_blocks` + `dvn_receipt_block_items` tables in Phase 1 (not contingent on ordinals). + Block query API. |
| Stage 5.5 NEW (Source-of-Authority) | n/a | Implement authority matrix tests: assert resolver never decides access, never decides ownership, never writes receipts; assert `userOwnsAsset` is the sole ownership API; assert no resolver fallback bypasses `evaluateAccess`. |
| Stage 7 (Agent-Legibility Layer) | Implement `.well-known` routes | + Vendor-prefixed suffix per IANA RFC 8615. + Schema files committed + ajv validation in CI. + Canary tests for no-secret / no-T0 / no-BlakQube leakage. + ConnectorQube cards (MCP-aware). + AigentQube cards with rights/constraints/obligations from KNYT framework. + ETags + CORS. + Documented IANA submission posture. |
| Stage 8 (Migration) | Backfill `iqube_id` map | + Backfill `tool_subtype` from `registry_assets.asset_class`. + Backfill `instance_model` from existing ContentQube edition data. |

**Estimated additional days vs v0.1:** ~8–12 working days (Stage 2 projections + Stage 2.5 lifecycle + Stage 4 saga + Stage 5 block model + Stage 5.5 authority tests + Stage 7 schemas/canaries). v0.2 total estimate: ~31–45 working days.

---

## E. Cross-references

- v0.1: `codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.1.md`
- KNYT agent identity framework: `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md`
- Qripto Spine alignment: `codexes/packs/agentiq/updates/2026-05-13_qripto-spine-contentqube-protocol-alignment.md`
- ContentQube SoT canonicalization: `codexes/packs/agentiq/updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md`
- Identity-spine integration brief: `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
- ContentQube schema: `supabase/migrations/20260513010000_content_qubes_schema.sql`
- Registry ingestion factory: `supabase/migrations/20260402010000_registry_ingestion_factory_v1.sql`
- Classifier (ToolQube subtype source of truth): `services/registry/classifierService.ts`
- MCP invoker: `clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts`
- Identity spine (read-only): `services/identity/getActivePersona.ts`, `services/access/evaluateAccess.ts`, `services/rewards/assetOwnership.ts`
- ContentQube edition mint: `services/chain/baseTokenMint.ts`

---

**Approval status:** With §A + §B + §C folded in, v0.2 is ready for implementation review. Recommend producing a single consolidated v0.2 document that replaces v0.1 after operator sign-off on the points above.
