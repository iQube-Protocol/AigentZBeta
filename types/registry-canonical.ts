/**
 * Canonical iQube registry plane — internal record + projections.
 *
 * Source: PRD v1.0 §5 + v1.1 §A/§B + Stage 0 audit.
 * Consumes (does NOT redefine): types/iqube/legibility.ts (shipped surface
 * enums), types/access.ts (spine internal enums).
 *
 * INTERNAL shape — never serialised to client-bound JSON. The resolver
 * (services/registry/resolver.ts, Stage 2) projects to RegistryAdminView /
 * RegistryCartridgeView / RegistryPublicView / IQubeCard before returning.
 *
 * T0 fields (creator_persona_id, steward_persona_id, etc) are explicitly
 * marked. Property-based tests at tests/registry-projections.test.ts
 * (Stage 2) assert no T0 field appears in any projected view.
 *
 * Mapping tables (T0/internal ↔ T1/surface):
 *   - lifecycle: services/registry/lifecycle.ts (Stage 3) — internal 9-state
 *     → surface 5-state per PRD v1.0 §4.3
 *   - action vocabulary: services/iqube/legibility/actionMap.ts (Stage 1
 *     C2 — landed) — AccessAction ↔ IQubeAgentAction
 *   - identity tier: services/iqube/legibility/cardBuilder.ts — Identifiability
 *     → IQubeIdentityState (existing in shipped legibility v0.1)
 */

import type {
  IQubePrimitiveType,
  IQubeLifecycleState,
  IQubeVisibilityState,
  IQubeAccessGating,
  IQubeIdentityState,
  IQubeAgentAction,
} from './iqube/legibility';
import type { Identifiability, AccessAction } from './access';

// ── Internal lifecycle (universal 9-state) ────────────────────────────────

/**
 * Universal internal lifecycle (PRD v1.0 §4.2). Richer than the surface
 * 5-state enum (IQubeLifecycleState from legibility). Mapped DOWN to
 * surface via services/registry/lifecycle.ts (Stage 3).
 *
 * Note: ContentQube has its own table-level lifecycle_state with extra
 * substates (semi_minted / review_ready / canon_pending / chain_minted /
 * superseded / archived). Stage 3 collapses those into this enum:
 *   semi_minted / review_ready / canon_pending → 'review_pending'
 *   chain_minted → 'canonized'
 *   superseded → 'deprecated'
 *   archived → 'archived' (terminal — maps to surface 'archived')
 */
export type IQubeInternalLifecycleState =
  | 'draft'
  | 'wip'
  | 'review_pending'
  | 'published'
  | 'canonized'
  | 'deprecated'
  | 'revoked'
  | 'new_version_pending'
  | 'abandoned';

// ── ToolQube subtype (PRD v0.2 §A.1 taxonomy collapse) ────────────────────

export type ToolSubtype = 'skill' | 'connector' | 'workflow' | 'browser';

export type WrapperStrategy = 'mcp' | 'skill' | 'workflow' | 'browser';

// ── Instance model (PRD v1.0 §5 / v0.2 §B.7) ──────────────────────────────

export type IQubeInstanceModel =
  | 'singleton'
  | 'editioned'
  | 'multi_edition_1155'
  | 'sharded'
  | 'fractional';

// ── Mint saga state (mirror of mint_sagas.current_state CHECK values) ─────

export type MintSagaState =
  | 'unminted'
  | 'registry_draft_created'
  | 'payload_encrypted'
  | 'payload_uploaded'
  | 'token_qube_created'
  | 'chain_minting'
  | 'chain_minted'
  | 'anchor_persisted'
  | 'receipt_emitting'
  | 'receipt_emitted'
  | 'card_publishing'
  | 'card_published'
  | 'MINT_COMPLETE'
  // failure / recovery states
  | 'mint_failed'
  | 'payload_upload_failed'
  | 'anchor_persist_failed'
  | 'anchor_pending'
  | 'receipt_pending'
  | 'card_publish_pending';

export type MintStatus =
  | 'unminted'
  | 'minting'
  | 'minted'
  | 'transfer_pending'
  | 'transferred'
  | 'revoked'
  | 'mint_failed'
  | 'anchor_pending'
  | 'receipt_pending'
  | 'card_publish_pending';

// ── ToolQube / ConnectorQube extension block (PRD v0.2 §A.3) ──────────────

export interface CanonicalToolBlock {
  /** Subtype within ToolQube. NULL for generic ToolQube. */
  tool_subtype?: ToolSubtype;
  /** Wrapper strategy used by the invocation gateway. Typically mirrors tool_subtype. */
  wrapper_strategy?: WrapperStrategy;

  /** Connector-specific (tool_subtype='connector') */
  endpoint_url?: string;
  transport?: 'stdio' | 'sse' | 'http' | 'websocket';
  protocol?: 'mcp' | 'rest' | 'graphql' | 'grpc';
  discovered_tools?: Array<{ id: string; name: string; description?: string }>;
  auth_scheme?: 'none' | 'bearer' | 'oauth2' | 'api_key';

  /**
   * OPAQUE handle for secret lookup (e.g. 'env:GOOGLE_API_KEY' or
   * 'vault:knyt/mcp/foo'). NEVER the secret itself. Resolved at
   * invocation time by services/registry/invocationGateway.ts; never
   * present in projected views (RLS + projection layer redact).
   * (PRD v0.2 §B.11)
   */
  secret_ref?: string;
  secret_scope?: string[];
}

// ── AigentQube governance (PRD v1.0 §5.1 / v0.2 §B.10) ────────────────────

export interface AigentQubeGovernance {
  rights: {
    allowed_actions: IQubeAgentAction[];
    cartridge_scopes: string[];
    tool_scopes: string[];
    data_scopes: string[];
    /**
     * Defaults to null (no spend authority). Non-null requires explicit
     * operator approval via the canonization queue (v1.1 §B.6). Period
     * counters enforced by runtime payment policy service (Phase 2 dep),
     * not by registry or card. While that service is unbuilt, cards
     * defensively populate requires_human_approval on every mutating
     * verb when payment_authority is non-null.
     */
    payment_authority?: {
      currency: 'qc' | 'usdc' | 'usd';
      max_amount_per_tx: number;
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
    /** Per KNYT framework §14 — five-band trust progression. */
    trust_band: 0 | 1 | 2 | 3 | 4;
  };
  revocation: {
    revocable_by: Array<'root_owner' | 'cartridge_admin' | 'platform_admin'>;
    revocation_receipt_required: boolean;
  };
}

export interface CanonicalAigentBlock {
  /** Per KNYT framework §10.1 — durable trust anchor across deployments + personas. */
  root_agent_id: string;
  /** Per KNYT framework §10.2 — running instance identity. */
  deployment_id?: string;
  /** T2 — public-network safe handle for the mission-facing persona. */
  persona_alias_commitment?: string;

  governance: AigentQubeGovernance;

  /** Per KNYT framework §11 + Charter acceptance. */
  charter_accepted: boolean;
  charter_version: string;
  trust_band: 0 | 1 | 2 | 3 | 4;

  /** Interfaces this aigent exposes. Mirrors IQubeSupportedInterfaces on the card. */
  supported_interfaces?: {
    a2a?: string;
    mcp?: string;
    api_catalog?: string;
    runtime_url?: string;
    studio_url?: string;
  };
}

// ── ClusterQube composition (PRD v1.0 §5 / v0.2 §B.8) ─────────────────────

export interface CanonicalClusterBlock {
  member_iqubes: Array<{
    iqube_id: string;
    role: 'primary' | 'dependency' | 'optional';
    version_constraint?: string;
  }>;
  dependency_graph: {
    nodes: string[];
    edges: Array<{
      from: string;
      to: string;
      relation: 'depends_on' | 'invokes' | 'composes';
    }>;
  };
  policy_aggregation: 'union' | 'intersection' | 'strictest' | 'explicit';
  receipt_aggregation: 'flatten' | 'nested' | 'cluster_only';
  version_compatibility_strategy: 'pin' | 'caret' | 'tilde' | 'any';
  access_propagation:
    | 'cluster_grants_members'
    | 'members_grant_cluster'
    | 'independent';
  revocation_propagation: 'propagate_to_members' | 'cluster_only';
}

// ── Chain anchor + edition supply + shard + hierarchy ─────────────────────

export interface ChainAnchor {
  chain_id: number;
  contract: string;
  token_id: string;
  tx_hash: string;
}

export interface EditionSupply {
  total_planned: number;
  canonical_minted: number;
  common_appended: number;
  rarity_distribution?: Record<string, number>;
}

export interface ShardSpec {
  total_shards: number;
  distribution_mode: 'equal' | 'weighted' | 'auction';
}

export interface ContentHierarchy {
  collection_id?: string;
  series_id?: string;
  episode_id?: string;
  page_id?: string;
  panel_id?: string;
}

// ── Canonical Internal Record ─────────────────────────────────────────────

/**
 * Server-only internal record. NEVER serialised to client-bound JSON.
 * Projected via services/registry/projections/* (Stage 2) into one of:
 *   - RegistryAdminView    — operator console (no raw persona IDs)
 *   - RegistryCartridgeView — in-app cartridge rendering (T1-only)
 *   - RegistryPublicView   — public catalog (T2-only)
 *   - IQubeCard (shipped)  — agent-facing legibility card
 *
 * All persona-bearing fields below are T0 — must be redacted in every
 * projection. Property-based tests at tests/registry-projections.test.ts
 * (Stage 2.5) enforce no T0 leakage.
 */
export interface CanonicalIQubeInternalRecord {
  // ── Identity ─────────────────────────────────────────────────────────
  /** Canonical UUID v4. Stable across all source surfaces. Immutable once assigned. */
  iqube_id: string;
  primitive_type: IQubePrimitiveType;
  instance_type: 'template' | 'instance';
  template_lineage?: Array<{ parent_id: string; version: string }>;

  // ── Triad references (the cryptographic spine — ID references only) ──
  meta_qube_id: string;
  /**
   * BlakQube REFERENCE only — never the ciphertext, never the storage
   * URL. Projection layer surfaces the existence + locator type, not
   * the bytes (PRD §3 authority matrix — bytes live in encrypted
   * storage; access is mediated by evaluateAccess + streamStateCPlaintext).
   */
  blak_qube_id?: string;
  token_qube_id?: string;

  // ── Provenance (T0 + T2) ─────────────────────────────────────────────
  /** T0 — server-internal only. NEVER in any projection. */
  creator_persona_id?: string;
  /** T0 — server-internal only. NEVER in any projection. */
  steward_persona_id?: string;
  /** Card-tier (T1-safe). Derived from persona.default_identity_state. */
  creator_identity_state: IQubeIdentityState;
  /** T2 — public-network safe (cohortAliasService.computeAliasCommitment). */
  creator_alias_commitment?: string;
  origin: 'ingested' | 'native' | 'minted' | 'forked' | 'imported';
  ingestion_intake_id?: string;

  // ── State (internal + surface; both stored, surface is denormalised) ─
  /** Universal 9-state. Sole source of truth for state machine logic. */
  internal_lifecycle: IQubeInternalLifecycleState;
  /** Surface 5-state. Derived from internal via §4.3 mapping; cached for query. */
  surface_lifecycle: IQubeLifecycleState;
  canonicalization_status: 'wip' | 'finalized' | 'canonized';
  /** True while in Supabase WIP; false once registry-canonical. */
  wip_supabase_only: boolean;
  visibility_state: IQubeVisibilityState;

  // ── Access (gating mediated by evaluateAccess, never the resolver) ───
  gating: IQubeAccessGating[];
  access_policy_id?: string;
  required_credentials?: string[];

  // ── Minting / chain ──────────────────────────────────────────────────
  mint_status: MintStatus;
  chain_anchor?: ChainAnchor;
  mint_saga_id?: string;

  // ── Asset instance model (PRD v0.2 §B.7) ─────────────────────────────
  instance_model: IQubeInstanceModel;
  edition_supply?: EditionSupply;
  shard?: ShardSpec;
  hierarchy?: ContentHierarchy;

  // ── ToolQube extension (primitive_type='ToolQube') ───────────────────
  tool?: CanonicalToolBlock;

  // ── AigentQube extension (primitive_type='AigentQube') ───────────────
  aigent?: CanonicalAigentBlock;

  // ── ClusterQube extension (primitive_type='ClusterQube') ─────────────
  cluster?: CanonicalClusterBlock;

  // ── ContentQube extension (primitive_type='ContentQube') ─────────────
  content_qube_id?: string;

  // ── Receipts + descriptors ───────────────────────────────────────────
  dvn_receipt_index: { last_receipt_id?: string; receipt_count: number };
  cartridge_bindings: string[];
  card_url?: string;

  // ── Version + audit ──────────────────────────────────────────────────
  version: string;
  version_history_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Projections (server-side; NEVER mix shapes) ───────────────────────────

/**
 * Admin / operator console view. Persona IDs exposed only as the T1-safe
 * tier label, never the raw UUID.
 */
export interface RegistryAdminView {
  iqube_id: string;
  primitive_type: IQubePrimitiveType;
  tool_subtype?: ToolSubtype;
  display_name: string;
  display_description?: string;
  cover_url?: string;

  internal_lifecycle: IQubeInternalLifecycleState;
  surface_lifecycle: IQubeLifecycleState;
  mint_status: MintStatus;
  visibility_state: IQubeVisibilityState;
  gating: IQubeAccessGating[];

  creator: { identity_state: IQubeIdentityState; alias_commitment?: string };
  steward?: { identity_state: IQubeIdentityState; alias_commitment?: string };

  chain_anchor?: ChainAnchor;
  mint_saga_id?: string;
  edition_supply?: EditionSupply;
  cartridge_bindings: string[];
  dvn_receipt_index: { last_receipt_id?: string; receipt_count: number };
  version: string;
  created_at: string;
  updated_at: string;

  /** Trust/Validation scores — same shape as cartridge view; admin sees
   *  derivation_strategy + per-axis _source flags for governance review. */
  scores?: IQubeScoreBlock;
}

/**
 * In-cartridge rendering view. T1-only. Optional caller-aware fields
 * populated by the resolver when a persona context is passed —
 * resolver calls userOwnsAsset() / evaluateAccess() (NEVER reimplements
 * them).
 */
/**
 * Score block — the 4 raw trust/validation axes + 2 derived scores.
 * Surfaced on RegistryCartridgeView + RegistryAdminView when present in
 * iqube_scores. Per the 2026-05-31 backfill backlog item; populated by
 * services/registry/scoreBackfill/runBackfill.ts. Per-axis _source flag
 * lets the UI distinguish derived defaults from operator overrides.
 */
export interface IQubeScoreBlock {
  sensitivity: number | null;
  accuracy: number | null;
  verifiability: number | null;
  risk: number | null;
  derived_reliability: number | null;
  derived_trust: number | null;
  sensitivity_source: 'derived' | 'operator_override';
  accuracy_source: 'derived' | 'operator_override';
  verifiability_source: 'derived' | 'operator_override';
  risk_source: 'derived' | 'operator_override';
  derivation_strategy: string | null;
  updated_at: string;
}

export interface RegistryCartridgeView {
  iqube_id: string;
  primitive_type: IQubePrimitiveType;
  tool_subtype?: ToolSubtype;
  display_name: string;
  display_description?: string;
  cover_url?: string;

  surface_lifecycle: IQubeLifecycleState;
  mint_status: MintStatus;
  visibility_state: IQubeVisibilityState;
  gating: IQubeAccessGating[];

  /** Populated only when caller persona passed to resolver. */
  caller_owns?: boolean;
  /** Populated only when caller persona passed to resolver. */
  caller_can_read?: boolean;

  cartridge_bindings: string[];

  /**
   * Trust/Validation scores. Undefined when iqube_scores has no row for
   * this iqube_id — UI renders placeholder dots. Per 2026-05-31 operator
   * decision: every iQube must surface this; backfill backlog populates.
   */
  scores?: IQubeScoreBlock;
}

/**
 * Public catalog view. T2-only. Only visibility_state ∈
 * {public, public_meta_private_payload} records are projected to this
 * shape. unlisted is queryable by id but does NOT appear in the catalog.
 */
export interface RegistryPublicView {
  iqube_id: string;
  primitive_type: IQubePrimitiveType;
  tool_subtype?: ToolSubtype;
  display_name: string;
  display_description?: string;
  cover_url?: string;
  visibility_state: 'public' | 'public_meta_private_payload';
  gating: IQubeAccessGating[];
  required_credentials?: string[];
}

// ── Resolver source enum (mirrors iqube_id_map.source CHECK values) ───────

export type IQubeIdMapSource =
  | 'triad_meta'
  | 'triad_blak'
  | 'triad_token'
  | 'content_qube'
  | 'registry_asset'
  | 'master_content_qube'
  | 'codex_media_asset'
  | 'identity_iqube'
  | 'memory_iqube'
  | 'code:aigentQubeSource'
  | 'code:toolQubeSource'
  | 'code:liquidui-template'
  // Intent Chain Orchestrator (2026-06-02) — chain templates registered
  // as synthetic ToolQube primitives so they appear in the registry plane.
  // Full canonization to WorkflowQube/ToolQube is deferred follow-on work.
  // See AGENTIQ_INTENT_CHAINS_SPEC.md §6.6.
  | 'code:chainTemplate';

export interface IQubeIdMapEntry {
  iqube_id: string;
  source: IQubeIdMapSource;
  source_id: string;
  primitive_type: IQubePrimitiveType;
  legacy_primitive_type?: string;
  synthetic: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Re-export the spine enums consumers commonly need ─────────────────────

export type { AccessAction, Identifiability };
