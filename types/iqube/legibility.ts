/**
 * iQube Agent Legibility Profile v0.1 — types
 *
 * Read-only descriptor surface that lets agents discover and reason
 * about iQubes WITHOUT exposing BlakQube payloads or tokenQube
 * secrets. The iQube Registry remains canonical; this layer is a
 * legibility envelope.
 *
 * Spine-safety: these types describe what is allowed to land in
 * agent-readable JSON. T0 identifiers (personaId, authProfileId,
 * rootDid, kybeAttestation, cross-persona fioHandle) MUST NEVER
 * appear in an IQubeCard or IQubeCatalog. The card and catalog are
 * T1-surface only (browser- and agent-safe); receipts referenced by
 * the card are T2 commitments only.
 *
 * Source PRD: "iQube Agent Legibility Profile" — Phase 1.
 */

// ── Primitive enumerations ───────────────────────────────────────────────

/**
 * Primitive iQube types. Mirrors the PRD's enumeration. The repo's
 * existing ContentQube infrastructure (`content_qubes` table) maps to
 * the 'ContentQube' member; the other members are populated either
 * via hand-seeded registry entries (Phase 1) or live source adapters
 * (fast follow-up).
 */
export type IQubePrimitiveType =
  | 'DataQube'
  | 'ContentQube'
  | 'ToolQube'
  | 'ModelQube'
  | 'AigentQube'
  | 'ClusterQube';

/**
 * Lifecycle states from the PRD. The internal `content_qubes` schema
 * uses a richer set (draft/semi_minted/review_ready/canon_pending/
 * canonized/chain_minted/superseded/archived) that the card builder
 * collapses into this surface enum.
 */
export type IQubeLifecycleState =
  | 'draft'
  | 'wip'
  | 'canonized'
  | 'deprecated'
  | 'archived';

/**
 * Visibility states from the PRD. Derived server-side from the
 * combination of the iQube's access policy + ownership state +
 * explicit unlisted opt-in. Never trusted from a client.
 *
 * - 'private': not in the public catalog; card route returns 404.
 * - 'public_meta_private_payload': metadata visible, payload gated.
 * - 'public': fully open.
 * - 'unlisted': accessible by id but not enumerated in the catalog.
 */
export type IQubeVisibilityState =
  | 'private'
  | 'public_meta_private_payload'
  | 'public'
  | 'unlisted';

/**
 * Access-gating mechanisms. Maps to `content_qube_access_policies.
 * gating_kind` plus PRD additions ('did', 'allowlist', 'role',
 * 'custom') reserved for the non-content primitive types.
 */
export type IQubeAccessGating =
  | 'open'
  | 'token'
  | 'payment'
  | 'persona'
  | 'did'
  | 'allowlist'
  | 'role'
  | 'custom';

/**
 * Identity-disclosure tier for the creator / owner. T1-safe labels
 * only — never the raw persona or DID. The card builder derives
 * these from the source row plus the active access policy.
 *
 * - 'anonymous': no identity surface exposed.
 * - 'pseudonymous': stable handle, not linkable to a real person.
 * - 'identifiable': real-world identity exposed by policy.
 * - 'delegated': controlled by a separate delegate principal.
 */
export type IQubeIdentityState =
  | 'anonymous'
  | 'pseudonymous'
  | 'identifiable'
  | 'delegated';

/**
 * Agent-readable action verbs. Drives both the `agent_permissions`
 * block on the card AND the `/actions` route. Each verb maps to an
 * RFC-style "method + href + auth requirements" entry. Verbs that
 * mutate state are flagged DVN-required in the policy block.
 */
export type IQubeAgentAction =
  | 'discover'
  | 'read_meta'
  | 'read_summary'
  | 'request_access'
  | 'read_payload'
  | 'derive_summary'
  | 'transform'
  | 'cite'
  | 'propose_update'
  | 'mint_derivative'
  | 'fork'
  | 'record_receipt'
  | 'revoke_access'
  | 'audit_state';

// ── Composite shapes ─────────────────────────────────────────────────────

/**
 * Registry pointer — every card MUST link back to the canonical
 * Registry record. The card is descriptive, not authoritative.
 */
export interface IQubeRegistryRef {
  /** Absolute URL of the canonical Registry record for this iQube. */
  canonical_url: string;
  /** Internal registry id — usually the same UUID as `iqube_id`. */
  registry_id?: string;
  /** Optional sha256 of the canonical content artefact. */
  content_hash?: string;
  /** Optional sha256 of the canonical metadata artefact. */
  metadata_hash?: string;
  /**
   * T2 DVN receipt aliases anchoring provenance events for this
   * iQube. NEVER T0 personaIds — these are commitments.
   */
  provenance_receipts?: string[];
}

/**
 * Public metadata slice — what an agent can read about an iQube
 * regardless of payload access. Maps to the iQube's MetaQube layer.
 */
export interface IQubeMetaSummary {
  title?: string;
  summary?: string;
  tags?: string[];
  /** T1-safe identity tier of the creator. */
  creator_identity_state: IQubeIdentityState;
  /** T1-safe identity tier of the current owner (often == creator). */
  owner_identity_state?: IQubeIdentityState;
  created_at?: string;
  updated_at?: string;
  canonicalized_at?: string;
}

export interface IQubeAccessSummary {
  gating: IQubeAccessGating[];
  requires_authentication: boolean;
  requires_payment: boolean;
  requires_token: boolean;
  /** True iff a non-empty private BlakQube payload exists. Does not
   *  imply the requester can READ it — see `payload_disclosure`. */
  private_payload_available: boolean;
  /**
   * What the agent can EXPECT to receive about the payload:
   * - 'none': no payload bytes ever via this surface.
   * - 'summary_only': server-side-derived summary, no raw bytes.
   * - 'policy_mediated': payload accessible after policy gate.
   * - 'open': raw payload directly accessible.
   */
  payload_disclosure: 'none' | 'summary_only' | 'policy_mediated' | 'open';
}

export interface IQubeAgentPermissions {
  allowed_actions: IQubeAgentAction[];
  disallowed_actions?: IQubeAgentAction[];
  requires_policy_check?: IQubeAgentAction[];
  requires_dvn_receipt?: IQubeAgentAction[];
}

export interface IQubePolicyRef {
  /** Absolute URL of the human-readable policy describing this iQube's
   *  access + lifecycle rules. */
  policy_url: string;
  policy_id?: string;
  /** True iff any verb in `state_change_verbs` requires a DVN receipt
   *  to take effect. Almost always true for canonized iQubes. */
  dvn_required_for_state_change: boolean;
  state_change_verbs: IQubeAgentAction[];
}

export interface IQubeSupportedInterfaces {
  /** A2A (agent-to-agent) endpoint base URL. */
  a2a?: string;
  /** MCP (Model Context Protocol) endpoint base URL. */
  mcp?: string;
  /** REST API catalog URL. */
  api_catalog?: string;
  /** Runtime UI for human interaction. */
  runtime_url?: string;
  /** Studio (authoring) URL. */
  studio_url?: string;
}

export interface IQubeCardLinks {
  /** This card's own URL (`/api/iqubes/[id]/card`). */
  self: string;
  /** Action menu route. */
  actions?: string;
  /** Policy summary route. */
  policy?: string;
  /** Endpoint for requesting access when the iQube is gated. */
  request_access?: string;
  /** Public payload URL when `payload_disclosure === 'open'`. */
  canonical_content?: string;
}

// ── Top-level card ───────────────────────────────────────────────────────

/**
 * Agent-readable manifest for a single iQube. Returned by
 * `GET /api/iqubes/[id]/card`. Validated against
 * `IQubeCardSchema` (see services/iqube/legibility/schemas.ts)
 * before serialisation.
 */
/**
 * AigentQube governance block — surfaces the KNYT framework §10/11/12/14
 * three-layer identity + rights/constraints/obligations on AigentQube
 * cards. Stage 7 addition.
 *
 * All identifiers here are T1/T2-safe:
 *   - root_agent_id is the public agent identifier (not a personaId)
 *   - persona_alias_commitment is the T2 cohort alias (not a personaId)
 *   - charter_accepted + charter_version are public commitments
 *   - trust_band is the 0..4 KNYT progression (§14)
 *
 * Optional: only present when primitive_type === 'AigentQube' AND the
 * source adapter populates the block. ContentQube/ToolQube/etc cards
 * omit this field entirely.
 *
 * payment_authority defaults to NULL per PRD v1.1 §B.6 — non-null
 * requires explicit operator approval at canonization time. Period
 * counter enforcement lives in a future runtime payment service, not
 * here; the card just declares the policy.
 */
export interface IQubeAgentGovernance {
  /** KNYT framework §10.1 — durable trust anchor across deployments + personas. */
  root_agent_id: string;
  /** KNYT framework §10.2 — running instance identity. */
  deployment_id?: string;
  /** T2 — public-network safe handle for the mission-facing persona. */
  persona_alias_commitment?: string;

  rights: {
    allowed_actions: IQubeAgentAction[];
    cartridge_scopes: string[];
    tool_scopes: string[];
    data_scopes: string[];
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
    requires_human_approval: IQubeAgentAction[];
  };

  obligations: {
    receipt_required_for: IQubeAgentAction[];
    charter_accepted: boolean;
    charter_version: string;
    /** KNYT framework §14 — five-band trust progression. */
    trust_band: 0 | 1 | 2 | 3 | 4;
  };

  revocation: {
    revocable_by: Array<'root_owner' | 'cartridge_admin' | 'platform_admin'>;
    revocation_receipt_required: boolean;
  };
}

export interface IQubeCard {
  type: 'iQubeCard';
  version: '0.1';

  iqube_id: string;
  name: string;
  description?: string;

  primitive_type: IQubePrimitiveType;
  lifecycle_state: IQubeLifecycleState;
  visibility_state: IQubeVisibilityState;

  registry: IQubeRegistryRef;
  metaqube: IQubeMetaSummary;
  access: IQubeAccessSummary;
  agent_permissions: IQubeAgentPermissions;
  policy: IQubePolicyRef;
  supported_interfaces?: IQubeSupportedInterfaces;
  links?: IQubeCardLinks;
  /**
   * AigentQube governance — only populated when primitive_type='AigentQube'.
   * Other primitives omit. Stage 7 addition.
   */
  agent_governance?: IQubeAgentGovernance;
}

// ── Catalog ──────────────────────────────────────────────────────────────

/**
 * Entry in the public catalog. Subset of the full card — only the
 * fields needed for agent discovery + pivot to the per-iQube routes.
 */
export interface IQubeCatalogEntry {
  iqube_id: string;
  name: string;
  primitive_type: IQubePrimitiveType;
  lifecycle_state: IQubeLifecycleState;
  visibility_state: IQubeVisibilityState;
  card_url: string;
  registry_url: string;
}

/**
 * Public catalog returned by `GET /.well-known/iqube-catalog`.
 * MUST include only iQubes whose visibility is 'public',
 * 'public_meta_private_payload', or 'unlisted'-with-discoverable
 * opt-in. Private iQubes MUST be excluded.
 */
export interface IQubeCatalog {
  type: 'iQubeCatalog';
  version: '0.1';
  generated_at: string;

  registry: {
    name: string;
    canonical_url: string;
    description?: string;
  };

  supported_profiles: string[];
  iqubes: IQubeCatalogEntry[];
}

// ── Action / policy route shapes ─────────────────────────────────────────

/**
 * Single agent action surfaced by `GET /api/iqubes/[id]/actions`.
 * The href may point at a route that doesn't yet exist — this is
 * intentional per PRD §8.4 (descriptive in Phase 1).
 */
export interface IQubeAction {
  verb: IQubeAgentAction;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  href: string;
  requires_authentication?: boolean;
  requires_policy_check?: boolean;
  requires_dvn_receipt?: boolean;
}

export interface IQubeActionsResponse {
  iqube_id: string;
  actions: IQubeAction[];
}

export interface IQubePolicyResponse {
  iqube_id: string;
  policy_id?: string;
  visibility_state: IQubeVisibilityState;
  allowed_actions: IQubeAgentAction[];
  requires_policy_check: IQubeAgentAction[];
  requires_dvn_receipt: IQubeAgentAction[];
  private_payload_exposed: false;
}
