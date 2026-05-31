# PRD: Canonical iQube Registry Operating Plane v1.0

**Status:** Consolidated. Supersedes v0.1 + v0.2 addendum + v0.3 alignment as the implementation-ready PRD for the **remaining** registry-plane work. The shipped iQube Agent Legibility Profile v0.1 (`docs/iqube-agent-legibility-profile.md`) is the canonical contract for the agent-facing surface and is **not redefined here** — this PRD specifies the broader registry plane around it.

**Date:** 2026-05-30
**Predecessors (review trail, retained):**
- `2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.1.md`
- `2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.2-addendum.md`
- `2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.3-alignment.md`

**Primary external contracts (read first):**
- `docs/iqube-agent-legibility-profile.md` — agent-facing legibility surface (shipped)
- `CLAUDE.md` § Identity & Access Spine — identity / access authority (canonical, read-only)
- `codexes/packs/agentiq/updates/2026-05-13_qripto-spine-contentqube-protocol-alignment.md` — Qripto Spine ledger
- `codexes/packs/agentiq/updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md` — ContentQube SoT consolidation
- `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md` — three-layer agent identity model

**Do not begin implementation until this PRD has operator sign-off on §3 (Source-of-Authority Matrix), §6 (Lifecycle State Machine), and §10 (Implementation Plan).**

---

## 1. Executive Summary

The iQube Registry is the canonical orientation layer of the metaMe / AgentiQ ecosystem. Two halves of the registry plane already work:

- **The ContentQube spine** — `getActivePersona → evaluateAccess → claimEditionForPurchase → content_qube_dvn_receipts` — is load-bearing and audited end-to-end. ContentQube editions mint via `services/chain/baseTokenMint.ts`. KNYT cartridge surfaces (Shelf, Tab, Scrolls, Characters) read through the registry. (Phases 2 → 9.2 + A/B shipped 2026-05-13 / 2026-05-14.)
- **The agent-facing legibility layer** — `GET /.well-known/iqube-catalog`, `GET /api/iqubes/[id]/{card,policy,actions}` — is live with Zod structural locks, T0 redaction at source adapters, 404-not-403 for private iQubes, mandatory DVN-receipt requirement for canonized state changes, and `private_payload_exposed: z.literal(false)`. (Shipped at `357fbbfe`, 2026-05-28.)

What remains is **the canonical registry plane around these two halves**: a single source-of-truth resolver for non-ContentQube primitives, an authority matrix that prevents the resolver from becoming a parallel access / ownership / receipt authority, an internal lifecycle state machine that maps to the shipped surface enums, a DVN block model for receipt analysis, mint-saga integrity, agent-rights/constraints/obligations on AigentQube cards, and consolidation of the stubbed `app/api/registry/iqube/route.ts` plus the parallel receipt writers.

Phase 2 work (intent capture, calibration, risk/value/pricing/exchange) is stubbed only — interfaces reserved, no runtime in scope.

---

## 2. Scope

**In scope (Phase 1, this PRD):**

1. A canonical internal record (`CanonicalIQubeInternalRecord`) unifying triad CRUD, ingestion factory, ContentQube schema, AigentQube + ToolQube source adapters under one stable `iqube_id`.
2. A single canonical resolver `services/registry/resolver.ts` for in-app (cartridge / Studio / runtime) callers — separate from the legibility resolver, sharing the source adapters.
3. Source-of-authority matrix codified across the registry, identity, access, ownership, receipt, and chain subsystems.
4. Internal lifecycle state machine (9 states) with explicit transition rules, mapping to the shipped 5-state legibility surface enum.
5. DVN block model (`dvn_receipt_blocks` + `dvn_receipt_block_items`) for ledger-style receipt analysis, independent of future Bitcoin ordinal inscription.
6. Mint saga (`services/registry/mintSaga.ts`) — idempotency, outbox, retry, compensation.
7. AigentQube governance block (rights / constraints / obligations) on cards, aligned with the KNYT three-layer identity model.
8. Replace the mock stub at `app/api/registry/iqube/route.ts` with the real write path.
9. Receipt convergence: `services/registry/receiptEmitter.ts` (ingestion) and `clawhack-group-agents/bridge-core/dvnReceiptService.ts` (QubeTalk relay) consolidate onto `orchestrationEvents` for non-content primitives. `content_qube_dvn_receipts` stays as the per-qube audit surface (deliberate Phase 5 design).
10. Migrate the remaining non-KNYT-shelf cartridge surfaces off the deprecated `useOwnedEntitlements` / `/api/codex/owned` path.
11. Persona ↔ TokenQube ownership link table (becomes a read substrate for `userOwnsAsset`, not a parallel API).

**Out of scope (Phase 2, stubbed only):**

- Intent-based iQube creation, curation, calibration
- Risk / value / price / exchange analysis
- Marketplace / Q¢ payment intelligence beyond what `evaluateAccess` already supports
- IANA submission of `application/iqube-card+json` / `application/iqube-catalog+json` (deferred per legibility v0.1 fast-follow #5)
- ToolQube DB-table promotion (deferred per legibility v0.1 fast-follow #3) — but resolver design must not block it

**Explicitly NOT redefined (already canonical):**

- Anything in `docs/iqube-agent-legibility-profile.md`
- The identity/access spine files listed in CLAUDE.md § "Files you MUST NOT modify"
- `services/rewards/assetOwnership.ts::userOwnsAsset()` — sole ownership API
- `services/chain/baseTokenMint.ts` — ContentQube edition mint
- The shipped legibility enums (see §4) — these are the authoritative agent-facing vocabulary

---

## 3. Source-of-Authority Matrix

The single most important rule in this PRD. State at the top of every implementer's session.

| Domain | Authority | Notes |
|---|---|---|
| iQube canonical identity (`iqube_id`) | Registry | UUID v4; immutable once assigned |
| metaQube metadata | Registry | Resolver returns; legibility card derives from |
| BlakQube ciphertext | Encrypted storage (Autonomys / IPFS / payload-cms) | Registry holds reference only — provider + locator + content-hash. **Never the bytes.** |
| BlakQube payload **access decision** | `services/access/evaluateAccess.ts` | Sole gate. Registry never decides allow/deny. |
| Token ownership check | `services/rewards/assetOwnership.ts::userOwnsAsset()` | Sole ownership API. Backed by entitlements + SKU expansion + (new) persona ↔ TokenQube link + (future) chain index. |
| Mint event proof | Chain (EVM `QubeAnchored` event) + DVN receipt | Chain is proof of fact; DVN receipt is audit anchor |
| Transfer event | Chain + DVN receipt | Same as mint |
| Current registry state | Registry | "What is this iQube right now" |
| Receipt trail (per-qube) | `content_qube_dvn_receipts` | Privacy-by-construction (no `persona_id` column). Authoritative for ContentQube audit. |
| Receipt trail (platform-wide) | `orchestration_events` | T2-safe metadata. Authoritative for cross-primitive decisions. |
| Identity (T0 caller) | `services/identity/getActivePersona.ts` | Sole resolver |
| Identifiability (T2 alias) | `services/identity/cohortAliasService.computeAliasCommitment` | Used by receipt handles |
| Public agent descriptors | Derived from registry via legibility-source adapters | Cards = projection. Registry record is canonical. |
| Connector / Tool secrets | External vault / env / service | **Never the registry.** Cards never expose. |

**Architectural rule** (state explicitly in `services/registry/resolver.ts` doc-comment):

> The registry resolver `resolveIQube()` must not be an access authority, an ownership authority, or a receipt authority. It composes over the spine. Callers asking "can I read this iQube's BlakQube?" call `evaluateAccess()`. Callers asking "do I own this iQube?" call `userOwnsAsset()`. The resolver may surface `caller_owns?: boolean` or `caller_can_read?: boolean` projected fields when a persona context is passed — but it derives them by **calling** the spine, never by reimplementing it.

**Verification gate** (codified in `tests/registry-authority.test.ts`, new):

- Property test asserts resolver returns no allow/deny decision absent calling `evaluateAccess`.
- Property test asserts every ownership decision in registry paths traces to `userOwnsAsset`.
- Property test asserts resolver never writes to `orchestration_events` directly — receipt emission is via the canonical emitter.

---

## 4. Surface vs. Internal enums

The legibility surface enums (shipped in `types/iqube/legibility.ts`) are **canonical for agent-facing JSON**. The internal model (this PRD §5) is richer and maps DOWN to the surface enums. Both vocabularies stay; they serve different layers.

### 4.1 Surface enums (canonical, from shipped legibility v0.1)

```ts
type IQubePrimitiveType =
  | 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'ClusterQube';

type IQubeLifecycleState =
  | 'draft' | 'wip' | 'canonized' | 'deprecated' | 'archived';

type IQubeVisibilityState =
  | 'private' | 'public_meta_private_payload' | 'public' | 'unlisted';

type IQubeAccessGating =
  | 'open' | 'token' | 'payment' | 'persona' | 'did' | 'allowlist' | 'role' | 'custom';

type IQubeIdentityState =
  | 'anonymous' | 'pseudonymous' | 'identifiable' | 'delegated';

type IQubeAgentAction =
  | 'discover' | 'read_meta' | 'read_summary' | 'request_access' | 'read_payload'
  | 'derive_summary' | 'transform' | 'cite' | 'propose_update' | 'mint_derivative'
  | 'fork' | 'record_receipt' | 'revoke_access' | 'audit_state';
```

### 4.2 Internal enums (this PRD; mapped DOWN to surface by `services/iqube/legibility/cardBuilder.ts`)

```ts
type IQubeInternalLifecycleState =
  | 'draft' | 'wip' | 'review_pending' | 'published' | 'canonized'
  | 'deprecated' | 'revoked' | 'new_version_pending' | 'abandoned';

type IQubeInternalActionVocabulary = AccessAction;  // from types/access.ts
  // 'read' | 'watch' | 'listen' | 'invoke' | 'connect' | 'remix' | 'mint'
  // | 'transfer' | 'payment-settle' | 'policy-escalation' | 'disclosure'
```

### 4.3 Mapping tables (canonical)

**Internal lifecycle → surface lifecycle** (deterministic):

| Internal | Surface | Notes |
|---|---|---|
| `draft` | `draft` | |
| `wip` | `wip` | |
| `review_pending` | `wip` | Not yet a separate surface state |
| `published` | `canonized` | Surface treats `published` as canonized for agent purposes |
| `canonized` | `canonized` | |
| `deprecated` | `deprecated` | |
| `revoked` | `archived` | Surface signals "no longer authoritative" |
| `new_version_pending` | `wip` | Until the new version is published, surface treats as WIP |
| `abandoned` | `archived` | |

**Internal action → surface action** (mapping table in `cardBuilder.ts`, REQUIRED before extending either vocabulary):

| Internal `AccessAction` | Surface `IQubeAgentAction` |
|---|---|
| `read` | `read_payload` |
| `watch` | `read_payload` |
| `listen` | `read_payload` |
| `invoke` | `transform` (for ToolQube) / `derive_summary` (for ContentQube) |
| `connect` | `request_access` |
| `remix` | `mint_derivative` |
| `mint` | `mint_derivative` |
| `transfer` | (no surface verb; internal-only) |
| `payment-settle` | (no surface verb; internal-only) |
| `policy-escalation` | `revoke_access` |
| `disclosure` | `audit_state` |
| — | `discover` (surface-only; no internal action — passive) |
| — | `read_meta` (surface-only; ungated; corresponds to fetching the card itself) |
| — | `read_summary` (surface-only; routes to a summary-generation handler) |
| — | `cite` (surface-only; passive reference) |
| — | `propose_update` (surface-only; routes to suggestion queue) |
| — | `fork` (surface-only; routes to ingestion-factory fork) |
| — | `record_receipt` (surface-only; passive — receipt already emitted by mutating handler) |

Surface verbs without internal equivalents are **passive** (no mutation, no policy check) OR **route to existing internal handlers** (e.g. `fork` → ingestion factory's intake route). Code review gate: any new surface verb must declare its internal mapping or its passive nature.

### 4.4 Two identity-tier enums (intentionally distinct)

| Spine (`types/access.ts::Identifiability`) | Card surface (`IQubeIdentityState`) |
|---|---|
| `anonymous` | `anonymous` |
| `semi_anonymous` | `pseudonymous` |
| `semi_identifiable` | `pseudonymous` |
| `identifiable` | `identifiable` |
| — | `delegated` (new surface tier — "controlled by separate principal") |

Mapping lives in `services/iqube/legibility/cardBuilder.ts`. **Do not collapse.** The spine enum is the persona-state input; the card enum is the public-facing tier label. `delegated` is a card-only tier — surfaces the case where an AigentQube acts under a separate root principal (per KNYT framework §10).

---

## 5. Canonical Internal Record

The internal record unifies triad + ingestion + content + AigentQube + ToolQube under one `iqube_id`. Lives in `types/registry.ts` (extension of existing `IQubeTemplate`) and `services/registry/resolver.ts` (composition logic).

```ts
interface CanonicalIQubeInternalRecord {
  // ── Identity ──────────────────────────────────────
  iqube_id: string;                              // UUID v4 — canonical, immutable
  primitive_type: IQubePrimitiveType;            // surface enum
  instance_type: 'template' | 'instance';
  template_lineage?: Array<{ parent_id: string; version: string }>;

  // ── Triad (the cryptographic spine) ───────────────
  meta_qube_id: string;                          // → iq_meta_qubes.id
  blak_qube_id?: string;                         // → iq_blak_qubes.id (REFERENCE only)
  token_qube_id?: string;                        // → iq_token_qubes.id

  // ── Provenance ────────────────────────────────────
  creator_persona_id?: string;                   // T0 — server-only, NEVER in cards
  steward_persona_id?: string;                   // T0
  creator_identity_state: IQubeIdentityState;    // card-tier (derived from persona.default_identity_state)
  creator_alias_commitment?: string;             // T2 — public-network safe
  origin: 'ingested' | 'native' | 'minted' | 'forked' | 'imported';
  ingestion_intake_id?: string;                  // → registry_intakes.intake_id

  // ── State ────────────────────────────────────────
  internal_lifecycle: IQubeInternalLifecycleState;     // 9-state, this PRD
  surface_lifecycle: IQubeLifecycleState;              // 5-state, derived; cached for query
  canonicalization_status: 'wip' | 'finalized' | 'canonized';
  wip_supabase_only: boolean;
  visibility_state: IQubeVisibilityState;              // shipped surface enum

  // ── Access ───────────────────────────────────────
  gating: IQubeAccessGating[];                         // shipped surface enum (8 kinds)
  access_policy_id?: string;                           // → content_qube_access_policies.id or equivalent
  required_credentials?: string[];                     // 'cohort:*' | 'token:*' | 'role:*' | 'did:*'

  // ── Minting / chain ──────────────────────────────
  mint_status: 'unminted' | 'minting' | 'minted' | 'transfer_pending' | 'transferred' | 'revoked'
              | 'mint_failed' | 'anchor_pending' | 'receipt_pending' | 'card_publish_pending';
  chain_anchor?: { chain_id: number; contract: string; token_id: string; tx_hash: string };
  mint_saga_id?: string;                               // → mint_sagas.saga_id (§7)

  // ── Asset instance model ─────────────────────────
  instance_model: 'singleton' | 'editioned' | 'multi_edition_1155' | 'sharded' | 'fractional';
  edition_supply?: {
    total_planned: number;
    canonical_minted: number;
    common_appended: number;
    rarity_distribution?: Record<string, number>;
  };
  shard?: { total_shards: number; distribution_mode: 'equal' | 'weighted' | 'auction' };
  hierarchy?: { collection_id?: string; series_id?: string; episode_id?: string; page_id?: string; panel_id?: string };

  // ── ToolQube extension (when primitive_type='ToolQube') ──
  tool?: {
    wrapper_strategy?: 'mcp' | 'skill' | 'workflow' | 'browser';
    endpoint_url?: string;
    transport?: 'stdio' | 'sse' | 'http' | 'websocket';
    protocol?: 'mcp' | 'rest' | 'graphql' | 'grpc';
    discovered_tools?: Array<{ id: string; name: string; description?: string }>;
    auth_scheme?: 'none' | 'bearer' | 'oauth2' | 'api_key';
    secret_ref?: string;                               // OPAQUE handle; resolved at invocation only
  };

  // ── AigentQube extension (when primitive_type='AigentQube') ──
  aigent?: {
    root_agent_id: string;                             // per KNYT framework §10.1 — durable trust anchor
    deployment_id?: string;                            // per KNYT framework §10.2 — running instance
    persona_alias_commitment?: string;                 // T2 — mission-facing persona
    charter_accepted: boolean;
    charter_version: string;
    trust_band: 0 | 1 | 2 | 3 | 4;                     // per KNYT framework §14
    governance: AigentQubeGovernance;                  // §B.10 / shipped on cards via legibility extension
    supported_interfaces?: { a2a?: string; mcp?: string; api_catalog?: string; runtime_url?: string; studio_url?: string };
  };

  // ── ClusterQube extension (when primitive_type='ClusterQube') ──
  cluster?: {
    member_iqubes: Array<{ iqube_id: string; role: 'primary' | 'dependency' | 'optional'; version_constraint?: string }>;
    dependency_graph: { nodes: string[]; edges: Array<{ from: string; to: string; relation: 'depends_on' | 'invokes' | 'composes' }> };
    policy_aggregation: 'union' | 'intersection' | 'strictest' | 'explicit';
    receipt_aggregation: 'flatten' | 'nested' | 'cluster_only';
    version_compatibility_strategy: 'pin' | 'caret' | 'tilde' | 'any';
    access_propagation: 'cluster_grants_members' | 'members_grant_cluster' | 'independent';
    revocation_propagation: 'propagate_to_members' | 'cluster_only';
  };

  // ── Content (when primitive_type='ContentQube') ──
  content_qube_id?: string;                            // → content_qubes.id

  // ── Receipts + descriptors ───────────────────────
  dvn_receipt_index: { last_receipt_id?: string; receipt_count: number };
  cartridge_bindings: string[];                        // codex slugs / cartridge IDs
  card_url?: string;                                   // /api/iqubes/[id]/card

  // ── Version + audit ──────────────────────────────
  version: string;
  version_history_id?: string;
  created_at: string;
  updated_at: string;
}
```

### 5.1 AigentQubeGovernance

Surfaces on the AigentQube card via a new `governance` block (legibility fast-follow + this PRD's §B.10 work):

```ts
interface AigentQubeGovernance {
  rights: {
    allowed_actions: IQubeAgentAction[];
    cartridge_scopes: string[];
    tool_scopes: string[];                              // iqube_ids of allowed ToolQubes
    data_scopes: string[];                              // iqube_ids of allowed DataQubes / ContentQubes
    payment_authority?: {
      currency: 'qc' | 'usdc' | 'usd';
      max_amount_per_tx: number;                        // integer cents for qc (CLAUDE.md Q¢ rule)
      max_amount_per_period?: { amount: number; period: 'day' | 'week' | 'month' };
    };
  };
  constraints: {
    prohibited_actions: IQubeAgentAction[];
    prohibited_cartridges: string[];
    must_disclose_as_agent: boolean;
    identifiability_floor: Identifiability;
    requires_human_approval: IQubeAgentAction[];
  };
  obligations: {
    receipt_required_for: IQubeAgentAction[];
    charter_accepted: boolean;
    charter_version: string;
    trust_band: 0 | 1 | 2 | 3 | 4;
  };
  revocation: {
    revocable_by: Array<'root_owner' | 'cartridge_admin' | 'platform_admin'>;
    revocation_receipt_required: boolean;
  };
}
```

### 5.2 View projection (redaction)

Internal record never leaves the server. Four projections:

- **`RegistryAdminView`** — for operator console; persona IDs exposed as `{ display_label, identifiability, alias_commitment }` only.
- **`RegistryCartridgeView`** — in-app cartridge rendering; T1 only; optional `caller_owns` / `caller_can_read` populated by calling `userOwnsAsset` / `evaluateAccess`.
- **`RegistryPublicView`** — public catalog; T2 only; only `visibility_state ∈ {public, public_meta_private_payload}` records exposed.
- **`IQubeCard` (legibility surface)** — already shipped per `types/iqube/legibility.ts`. The legibility card IS the agent view; the canonical resolver delegates to the shipped `services/iqube/legibility/cardBuilder.ts`.

Projection builders live in `services/registry/projections/` with property-based no-T0-leakage tests.

---

## 6. Lifecycle State Machine

Internal 9-state machine (per §4.2). Per-transition rules codified in `services/registry/lifecycle.ts`.

```
States:
  draft, wip, review_pending, published, canonized,
  deprecated, revoked, new_version_pending, abandoned

Transitions:
  draft               → wip | abandoned
  wip                 → review_pending | abandoned
  review_pending      → published | wip                       (resubmit on rejection)
  published           → canonized | deprecated | revoked | new_version_pending
  canonized           → deprecated | revoked | new_version_pending
  deprecated          → revoked
  new_version_pending → canonized                              (when new version published)
  revoked             → (terminal)
  abandoned           → (terminal)
```

### 6.1 Per-transition rules

For each transition, the lifecycle table specifies:

| Field | Example: `published → canonized` |
|---|---|
| Initiator role | Operator (admin) OR creator-persona-with-partner-flag |
| Human approval required | Yes — operator approval queue |
| DVN receipt emitted | Yes — `action='mint'` (canonize semantically maps to mint) or new `'canonize'` action in `AccessAction` enum |
| Receipt mode | `'sync'` |
| Chain interaction | Optional — if unminted canonical editions exist, fires `mintCanonicalEdition` |
| Descriptor side-effect | Card `policy.dvn_required_for_state_change=true` persists; card `updated_at` bumped; previous version card marked `superseded_by` (cross-card relations land in legibility v0.2 fast-follow) |
| Payload access change | None — canonization does not unlock payload |
| Surface lifecycle | `canonized` (already) — no change visible to agent |

Build this table for every transition. Reviewed in code review for completeness.

### 6.2 Canonization as governance act

> Canonization is a governance act, not a status flip. It requires explicit operator (or delegated partner) approval, emits a sync DVN receipt, and refreshes the agent card. Reversing canonization requires `deprecate` or `revoke` — there is no "uncanonize".

### 6.3 Surface mapping

Each transition writes both `internal_lifecycle` (9-state) AND `surface_lifecycle` (5-state) per the mapping table in §4.3. Card builder reads `surface_lifecycle` directly; no recomputation at card-render time.

---

## 7. Mint Saga

Mint is multi-step. State machine in `services/registry/mintSaga.ts` with idempotency, outbox, retry, compensation.

### 7.1 States

```
unminted
  → registry_draft_created
  → payload_encrypted
  → payload_uploaded                  [retry: yes; failure → payload_upload_failed]
  → token_qube_created
  → chain_minting                     [retry: bounded; failure → mint_failed]
  → chain_minted
  → anchor_persisted                  [retry: yes; failure → anchor_persist_failed]
  → receipt_emitting                  [retry: yes; failure → receipt_pending]
  → receipt_emitted
  → card_publishing                   [retry: yes; failure → card_publish_pending]
  → card_published
  → MINT_COMPLETE
```

### 7.2 Rules

- Every step has an idempotency key (`mint_saga_id` + step name).
- External-system steps (chain, storage, ICP) have bounded retries.
- Registry writes use an outbox: write intent → ack on completion.
- `mint_failed` / `payload_upload_failed` are recoverable via operator console.
- `anchor_pending` / `receipt_pending` / `card_publish_pending` are transient — background worker drives them to terminal state.
- **Chain success + DB failure means the chain mint stands.** Saga re-runs DB persistence. No chain rollback. Document loudly in code comments.
- Compensation table for each non-terminal failure documents recovery path.

### 7.3 State table

```sql
CREATE TABLE mint_sagas (
  saga_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iqube_id       TEXT NOT NULL,
  current_state  TEXT NOT NULL,
  last_error     TEXT,
  retry_count    INTEGER NOT NULL DEFAULT 0,
  idempotency_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mint_sagas_iqube ON mint_sagas(iqube_id);
CREATE INDEX idx_mint_sagas_pending ON mint_sagas(current_state)
  WHERE current_state IN ('anchor_pending', 'receipt_pending', 'card_publish_pending');
```

Background worker reconciles `*_pending` states every minute.

### 7.4 Existing wiring to integrate

- ContentQube edition mint via `services/chain/baseTokenMint.ts` (Phase 7B) already has graceful pre-deploy fallback. Saga wraps it for non-content primitives via `app/api/core/mint-tokenqube/route.ts`.
- `claimEditionForPurchase` (Phase 9 + 9.2) is fire-and-forget post-grant — saga model does NOT replace it for ContentQube editions (which have their own simpler atomic two-path flow). Saga applies to triad mints for non-content primitives.

---

## 8. DVN Receipt Index + Block Model

The `orchestration_events` and `content_qube_dvn_receipts` separation stays (per Phase 5 design). This PRD adds a logical block layer on top.

### 8.1 Per-primitive query API

Extend `orchestration_events` with composite indexes and an `iqube_id` column. Backfill from `metadata.asset_id`.

```sql
ALTER TABLE orchestration_events ADD COLUMN iqube_id TEXT;
CREATE INDEX idx_orch_events_iqube ON orchestration_events(iqube_id, created_at DESC);
CREATE INDEX idx_orch_events_alias ON orchestration_events(actor_alias_commitment, created_at DESC);
```

Query API endpoints (all GET):

- `GET /api/registry/receipts?iqube_id=<id>`
- `GET /api/registry/receipts?cartridge=<slug>`
- `GET /api/registry/receipts?tx_hash=<hash>`
- `GET /api/registry/receipts?primitive_type=<type>`
- `GET /api/registry/receipts?block=<n>`
- `GET /api/registry/receipts/chain?iqube_id=<id>&action=<verb>`

Query joins `orchestration_events` UNION `content_qube_dvn_receipts` (via canonical `iqube_id` map) when primitive is ContentQube.

### 8.2 Logical block model — Phase 1, not waiting on ordinals

```sql
CREATE TABLE dvn_receipt_blocks (
  block_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_number       BIGINT NOT NULL,
  cartridge_scope    TEXT NOT NULL,                       -- 'platform' | <cartridge-id>
  epoch              INTEGER NOT NULL,                    -- UTC day index
  status             TEXT NOT NULL DEFAULT 'open',        -- open | sealed | anchored | failed
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at          TIMESTAMPTZ,
  anchored_at        TIMESTAMPTZ,
  receipt_count      INTEGER NOT NULL DEFAULT 0,
  batch_hash         TEXT,                                -- SHA-256 over sealed item set
  merkle_root        TEXT,
  inscription_id     TEXT,                                -- populated post-ordinal inscription (future)
  inscription_chain  TEXT,                                -- 'bitcoin-ordinal' | future
  failure_reason     TEXT,
  UNIQUE (cartridge_scope, block_number)
);

CREATE TABLE dvn_receipt_block_items (
  block_id           UUID NOT NULL REFERENCES dvn_receipt_blocks(block_id),
  receipt_source     TEXT NOT NULL,                       -- 'orchestration_events' | 'content_qube_dvn_receipts'
  receipt_id         TEXT NOT NULL,
  sequence_in_block  INTEGER NOT NULL,
  item_hash          TEXT NOT NULL,
  PRIMARY KEY (block_id, sequence_in_block)
);
```

**Block lifecycle:** `open → sealed → anchored | failed`. One open block per cartridge scope. Sealer triggers on size or time threshold (configurable). Ordinal inscription becomes the anchoring layer — block analysis works without it.

### 8.3 Receipt convergence

- `services/registry/receiptEmitter.ts` (ingestion-asset receipts) → writes to `orchestration_events` with `iqube_id` + `action='ingest'`.
- `clawhack-group-agents/bridge-core/dvnReceiptService.ts` → continues as the QubeTalk relay buffer; underlying writes go to `orchestration_events`.
- `content_qube_dvn_receipts` → unchanged. Stays as the per-qube audit surface (deliberate Phase 5 design).
- `app/api/core/mint-tokenqube/route.ts` → adds canonical DVN receipt emission via `orchestrationEvents.emitDecisionReceipt({ iqube_id, action: 'mint', ... })`. Existing ICP Proof-of-State call remains as a secondary signal.

### 8.4 UI

`RegistryDVNTab` new tab inside `RegistryHome` and inside the AgentiQ OS Registry tab. Re-uses `components/composer/DVNReceiptsPanel.tsx`. Supports filter chips matching the query API.

---

## 9. Canonical Resolver

### 9.1 Contract

```ts
// services/registry/resolver.ts (new)

export async function resolveIQube(
  iqube_id: string,
  opts: {
    persona?: ActivePersonaContext;
    expand?: ('meta' | 'blak_ref' | 'token' | 'content' | 'tool' | 'aigent' | 'cluster' | 'receipts')[];
    project?: 'admin' | 'cartridge' | 'public' | 'internal';      // default 'cartridge'
  }
): Promise<RegistryAdminView | RegistryCartridgeView | RegistryPublicView | CanonicalIQubeInternalRecord>;

export async function resolveIQubeByChainAnchor(
  chain_id: number, contract: string, token_id: string
): Promise<CanonicalIQubeInternalRecord | null>;

export async function listIQubes(
  filter: RegistryFilter,
  opts: PaginationOpts & { project?: 'admin' | 'cartridge' | 'public' }
): Promise<Array<RegistryCartridgeView>>;
```

### 9.2 Composition

The resolver dispatches to source adapters via a map keyed on `(primitive_type, instance_model)`. Adapters already exist for the legibility surface in `services/iqube/legibility/sources/`. The canonical resolver **reuses these adapters** — does not fork them.

```
services/registry/resolver.ts
  → reads from iqube_id_map join table to find primitive type
  → composes via adapter (services/iqube/legibility/sources/* for shared shape;
                          plus services/registry/adapters/* for non-legibility fields like
                          mint_saga_id, internal_lifecycle, ownership history)
  → applies projection (admin / cartridge / public / internal)
  → returns
```

### 9.3 The legibility resolver vs. the canonical resolver

| Resolver | Purpose | Output shape |
|---|---|---|
| `services/iqube/legibility/registry.ts::resolveLegibilityCard()` (shipped) | Agent-facing card | `IQubeCard` |
| `services/registry/resolver.ts::resolveIQube()` (new) | Cartridge / Studio / runtime callers | `RegistryAdminView` / `CartridgeView` / `PublicView` / internal |

They share the underlying source adapters. They produce different shapes for different callers. The canonical resolver internally calls the legibility resolver when a caller asks for `project: 'public'` and the iQube's `visibility_state ∈ {public, public_meta_private_payload, unlisted}`.

### 9.4 Replacing the stub

`app/api/registry/iqube/route.ts` — mock response removed. POST creates a draft via `services/registry/createDraft.ts` (new). GET delegates to the canonical resolver.

---

## 10. Implementation Plan

### Stage 0: Audit (1–2 days)

- Final pre-implementation audit. Confirm every existing read surface that should migrate to the canonical resolver. Per-cartridge table of current shape vs. resolver shape.
- Verify the action-vocabulary mapping table in `cardBuilder.ts` is current (per §4.3).
- Verify the two-enum identity mapping is documented (per §4.4).

### Stage 1: Canonical schema + map (2–3 days)

- Extend `types/registry.ts` with `CanonicalIQubeInternalRecord` and all extension blocks.
- Add `iqube_id` UUID column + `iqube_id_map(iqube_id, source, source_id)` join table.
- Add `tool_subtype` migration to `registry_assets.asset_class` (per v0.2 §A.1).
- Migration: `internal_lifecycle` + `surface_lifecycle` columns; backfill `surface_lifecycle` via mapping.
- All migrations behind feature flag `REGISTRY_CANONICAL_PLANE_V1_0`.

### Stage 2: Canonical resolver + projections (4–5 days)

- Implement `services/registry/resolver.ts` with read path covering all eight source surfaces via the map.
- Implement `services/registry/projections/{admin,cartridge,public}.ts`.
- Add property-based no-T0-leakage tests (`tests/registry-projections.test.ts`).
- Implement `app/api/registry/iqube/[id]/route.ts` GET.
- Replace mock in `app/api/registry/iqube/route.ts` with real POST creating a draft.

### Stage 2.5: Source-of-authority tests (1–2 days)

- `tests/registry-authority.test.ts` — property tests asserting resolver never decides access, never decides ownership, never writes receipts.
- CI gate: any PR touching `services/registry/*` runs these tests.

### Stage 3: Internal lifecycle state machine (2–3 days)

- `services/registry/lifecycle.ts` — typed state machine.
- Per-transition rules table (§6.1) codified.
- Surface-mapping function `internalToSurface(IQubeInternalLifecycleState): IQubeLifecycleState`.
- `tests/registry-lifecycle.test.ts` — every transition tested for: receipt emission, chain interaction, descriptor side-effect, surface mapping.

### Stage 4: ContentQube migration completion (2–3 days)

- Migrate `KnytStoreEpisodesTab`, `KnytStoreCardsTab`, bundle wizard, admin tools off `useOwnedEntitlements` / `/api/codex/owned` (per `2026-05-14` doc backlog).
- Schedule legacy table decommission ticket (post-observation window).
- Phase C per-rarity ownership stays a separate PRD (per `2026-05-14` doc).

### Stage 5: Minting + saga (3–4 days)

- `services/registry/mintSaga.ts` — state machine + idempotency.
- `mint_sagas` table.
- Wire `app/api/core/mint-tokenqube/route.ts` to emit canonical DVN receipt via `orchestrationEvents`.
- Background worker for `*_pending` reconciliation.
- Persona ↔ TokenQube link table (becomes read substrate for `userOwnsAsset`, never a parallel API).
- Autonomys upload — currently TODO in `/app/api/iqube/persona/knyt/mint/route.ts`.

### Stage 6: DVN receipt index + block model (3–4 days)

- `iqube_id` column + composite indexes on `orchestration_events`. Backfill.
- `dvn_receipt_blocks` + `dvn_receipt_block_items` tables.
- Block sealer worker (size + time thresholds).
- `GET /api/registry/receipts` query API.
- `RegistryDVNTab` UI re-using `DVNReceiptsPanel`.
- Converge `services/registry/receiptEmitter.ts` + `bridge-core/dvnReceiptService.ts` writes onto `orchestration_events`.

### Stage 7: AigentQube governance + legibility extension (2–3 days)

- Extend `aigentQubeSource.ts` to surface a `governance` block on AigentQube cards (rights / constraints / obligations / charter / trust band / root_agent_id / deployment_id).
- Aligned with KNYT framework §10 + §11 + §12.
- Update Zod schemas for the AigentQube card variant.
- Tests for: no T0 leak, governance block round-trip.

### Stage 8: Cartridge migration (2–3 days)

- Wire `RegistrySupplyTab` + AgentiQ OS Registry tab to use `services/registry/resolver.ts`.
- Decide registry-cartridge slug + nav position (operator question, §11).
- Update CLAUDE.md to name the canonical resolver as required entry point.

### Stage 9: Phase 2 stubs (1–2 days)

Interfaces only (no runtime):

- `services/registry/phase2/intent.ts`
- `services/registry/phase2/calibration.ts`
- `services/registry/phase2/risk.ts`
- `services/registry/phase2/value.ts`
- `services/registry/phase2/pricing.ts`
- `services/registry/phase2/exchange.ts`

**Total estimate:** ~22–32 working days for a single engineer. Parallelisable across stages 4, 5, 6, 7.

---

## 11. Acceptance Criteria

- [ ] `CanonicalIQubeInternalRecord` defined in `types/registry.ts`; surface vs. internal enums clearly separated.
- [ ] `services/registry/resolver.ts` exists with `resolveIQube`, `resolveIQubeByChainAnchor`, `listIQubes` — all delegate to legibility source adapters where applicable.
- [ ] `app/api/registry/iqube/route.ts` no longer returns a mock.
- [ ] Source-of-authority tests (`tests/registry-authority.test.ts`) pass: resolver never decides access / ownership / receipts.
- [ ] Internal lifecycle state machine (`services/registry/lifecycle.ts`) implemented with per-transition rules table; surface mapping is deterministic.
- [ ] `dvn_receipt_blocks` + `dvn_receipt_block_items` tables exist with block sealer worker running; receipts queryable by iQube / block / cartridge / tx_hash / primitive_type.
- [ ] Mint saga (`services/registry/mintSaga.ts`) implemented; mint route emits canonical DVN receipt; persona ↔ TokenQube link backfilled.
- [ ] AigentQube cards expose governance block; KNYT three-layer identity surfaced.
- [ ] Non-KNYT-shelf cartridge surfaces (`KnytStoreEpisodesTab`, `KnytStoreCardsTab`, bundle wizard, admin tools) migrated off legacy paths.
- [ ] All four registry view models pass property-based no-T0-leakage tests; legibility surface continues to pass shipped `tests/iqube-legibility.test.ts`.
- [ ] `userOwnsAsset()` is the only ownership call from any registry path (CI grep gate).
- [ ] `evaluateAccess()` is the only access gate from any registry path (CI grep gate).
- [ ] No private BlakQube payload appears in any registry-bound JSON (canary test extended).
- [ ] No T0 identifier appears in any registry-bound JSON (canary test extended).
- [ ] Phase 2 stub files exist at `services/registry/phase2/*` — types only, no runtime.
- [ ] CLAUDE.md updated: canonical resolver named, source-of-authority matrix referenced.

---

## 12. Risks + Dependencies

### Risks

- **Resolver bottleneck.** Mitigation: stateless; cache by `iqube_id`; parallel fan-out reads.
- **Receipt convergence data loss.** Mitigation: dual-write during feature-flagged observation window.
- **BlakQube payload exposure during refactor.** Highest severity. Mitigation: canary tests for every projection surface added; extend `tests/iqube-legibility.test.ts` pattern to all four view models.
- **Identity-spine bypass.** Mitigation: §2.5 authority tests in CI.
- **Lifecycle state-machine drift from surface enums.** Mitigation: mapping table (§4.3) is single source of truth; tested explicitly.
- **Mint saga chain success + DB failure.** Mitigation: documented loudly; saga re-runs DB step on next pass; chain rollback never attempted.
- **Two-resolver divergence (legibility vs. canonical).** Mitigation: shared source adapters; canonical resolver internally calls legibility for public projection; CI test asserts consistency.

### Dependencies

- CLAUDE.md identity-spine policy (in force; do not modify).
- ContentQube Phase 3 VIEW migration (`20260513020000`) — already activated.
- Shipped legibility surface (`docs/iqube-agent-legibility-profile.md`) — primary contract; don't redefine.
- Autonomys storage adapter completion (currently TODO).
- ICP Proof-of-State canister remains as secondary signal — no change.
- Supabase RLS extension for new tables (`iqube_id_map`, `persona_token_qube_ownership`, `mint_sagas`, `dvn_receipt_blocks`).

---

## 13. Phase 2 Stub Scope (out of Phase 1)

Reserved interfaces; no runtime:

- Intent-based iQube creation (`services/registry/phase2/intent.ts`)
- iQube curation (operator-led; no code yet)
- iQube calibration (`services/registry/phase2/calibration.ts`)
- iQube risk analysis (`services/registry/phase2/risk.ts`)
- iQube value analysis (`services/registry/phase2/value.ts`)
- iQube price / exchange analysis (`services/registry/phase2/pricing.ts`, `exchange.ts`)
- Proof of Work Potential / Proof of Time Saved valuation loops
- Q¢ payment intelligence beyond `evaluateAccess` (CLAUDE.md Q¢ rules in force)

---

## 14. Open Questions (for operator sign-off)

1. **Registry cartridge slug + nav.** Recommend standalone `iqube-registry` cartridge AND deep-link from AgentiQ OS Registry tab. Confirm.
2. **`LiquidUITemplateArchetypeQube`.** Present in `types/registry.ts::IQubeType` but not in the shipped legibility surface enum. Recommend dropping (vestigial). Confirm.
3. **Persona ↔ TokenQube link table — own table or extend `personas`.** Recommend new join table for clean ownership history.
4. **Receipt-writer deprecation timeline.** `services/registry/receiptEmitter.ts` + `bridge-core/dvnReceiptService.ts` — observe-then-deprecate window. Recommend 30 days.
5. **Block sealer cadence.** Default: size threshold 1000 items OR time threshold 1 hour, per cartridge scope. Confirm.
6. **Action-vocabulary additions.** Any new `IQubeAgentAction` requires updating the §4.3 mapping table. Confirm review gate.
7. **Operator approval queue for canonization.** Recommend surface in registry cartridge admin tab. Confirm.
8. **Legibility v0.1 fast-follow ordering vs. this PRD.** Legibility fast-follow items #1 (retrofit cards), #2 (auth-aware route), #3 (ToolQube/AigentQube DB tables), #4 (cross-card relations), #6 (test coverage) overlap with this PRD. Recommend: this PRD's Stage 7 covers fast-follow #1 + #2 (auth-aware AigentQube cards); fast-follow #3 + #4 handled in a separate ticket post-Stage 7; fast-follow #6 extended into Stages 2/3/5/6 tests. Confirm.

---

## Appendix A — Files NOT to modify

Per CLAUDE.md identity-spine policy:

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

Per shipped legibility surface (do not redefine; extend via additions):

- `types/iqube/legibility.ts` — extension allowed; existing types frozen.
- `services/iqube/legibility/schemas.ts` — Zod schemas frozen; extensions via new schemas.
- `services/iqube/legibility/cardBuilder.ts` — extension allowed; existing mappers frozen.
- `services/iqube/legibility/sources/contentQubeSource.ts` — extension allowed.
- `services/iqube/legibility/registry.ts` — extension allowed.
- `app/.well-known/iqube-catalog/route.ts` — frozen.
- `app/api/iqubes/[id]/{card,policy,actions}/route.ts` — frozen response shapes; internal composition may evolve.

Per ContentQube spine (already shipped, do not redefine):

- `services/chain/baseTokenMint.ts`
- `services/rewards/assetOwnership.ts`
- `content_qubes`, `content_qube_editions`, `content_qube_dvn_receipts` schemas (extension via additions only)

---

## Appendix B — Required reading before implementation

1. `docs/iqube-agent-legibility-profile.md` — the agent-facing contract
2. `CLAUDE.md` § "Identity & Access Spine — CANONICAL SoT"
3. `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
4. `codexes/packs/agentiq/updates/2026-05-13_qripto-spine-contentqube-protocol-alignment.md`
5. `codexes/packs/agentiq/updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md`
6. `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_DISCOVERY_AND_IDENTITY_FRAMEWORK.md`
7. `types/access.ts`
8. `types/iqube/legibility.ts`
9. `services/identity/getActivePersona.ts`
10. `services/access/evaluateAccess.ts`
11. `services/content/getContentDescriptor.ts`
12. `services/rewards/assetOwnership.ts`
13. `services/chain/baseTokenMint.ts`
14. `services/iqube/legibility/registry.ts`
15. `supabase/migrations/20260513010000_content_qubes_schema.sql`
16. `supabase/migrations/20260402010000_registry_ingestion_factory_v1.sql`
17. v0.1 + v0.2 + v0.3 of this PRD (review trail context)

---

## Appendix C — What changed from v0.1 → v0.2 → v0.3 → v1.0

| Topic | v0.1 | v0.2 | v0.3 | v1.0 (this) |
|---|---|---|---|---|
| Resolver scope | Single resolver for everything | Adapter pattern proposed | Confirmed legibility resolver is half of it | Two resolvers, shared adapters, explicit contracts |
| `.well-known` path | `/.well-known/iqube-protocol/...` | Vendor-prefixed RFC 8615 | Superseded by shipped `/.well-known/iqube-catalog` + `/api/iqubes/[id]/...` + media-type IANA | Adopts shipped paths; appendix lists frozen routes |
| Lifecycle | 5–6 statuses | 9-state machine | Surface is 5-state; internal is 9 | Both kept; mapping table is canonical (§4.3) |
| Gating enum | 5 kinds | 5 kinds | Shipped 8 kinds | Adopts shipped 8 kinds |
| Identity enum | Spine `Identifiability` (4) | Spine `Identifiability` (4) | Card `IQubeIdentityState` (4 with `delegated`) | Both kept; mapping table is canonical (§4.4) |
| Action vocabulary | Spine `AccessAction` (11) | Spine `AccessAction` (11) | Card `IQubeAgentAction` (14) | Both kept; mapping table is canonical (§4.3) |
| Tool subtypes | Implicit via ingestion classifier | First-class `tool_subtype` field | Deferred to fast-follow #1 + #3 | Internal field present; surface uses `supported_interfaces.mcp` until DB-table promotion |
| `ClusterQube` | Not in `IQubeType` | Added | Confirmed present in legibility enum | Confirmed in both surface + internal |
| Authority matrix | Implicit | Explicit § B.1 | Open | Codified at §3, tested at Stage 2.5 |
| DVN block model | Tied to ordinal inscription | Phase 1 block model proposed (§B.5) | Open | Adopted at §8.2 |
| Mint saga | Mentioned in §7 | Full saga model (§B.12) | Open | Adopted at §7 |
| AigentQube governance | Not specified | Full rights/constraints/obligations (§B.10) | Open | Adopted at §5.1 |
| Connector secrets | Mentioned | Opaque `secret_ref` only (§B.11) | Confirmed shipped surface holds no secrets | Codified at §5 |
| Stub at `iqube/route.ts` | Identified | Replace specified | Open | Replace planned at Stage 2 |

---

**Status:** v1.0 ready for operator sign-off. On approval, implementation begins at Stage 0 (audit), then linearly through Stage 9. Sub-agents working on this PRD must announce their cartridge / file scope via QubeTalk before editing (per CLAUDE.md multi-agent coordination).
