/**
 * iQube Agent Legibility Profile v0.1 — card builder + mappers
 *
 * Pure functions only. No DB calls; no environment reads beyond
 * `legibilityHost()` (which is itself a pure read of an env var with
 * a deterministic fallback). Each source adapter (ContentQube,
 * ToolQube, AigentQube) hydrates its own row shape and hands a
 * normalised `LegibilitySource` blob to `buildIQubeCard()`.
 *
 * Why a single builder vs per-primitive builders: keeping all the
 * permission / visibility / DVN logic in one place is the only way
 * to guarantee that a ToolQube and a ContentQube emit
 * consistent action menus and DVN-required flags. The PRD
 * (§13 security rules + §10 policy rules) is written against the
 * envelope, not the source; the source just supplies the data.
 *
 * What this file MUST NOT do:
 * - read T0 fields (personaId, authProfileId, rootDid, kybeAttestation,
 *   cross-persona fioHandle) from any source
 * - emit a card with payload bytes, decryption keys, or pre-decrypt
 *   storage URLs for non-public iQubes
 * - mark an iQube `public` without an explicit policy decision; the
 *   default for ambiguous rows is `private` (→ 404 on the card route)
 */

import type {
  IQubeAccessGating,
  IQubeAccessSummary,
  IQubeAgentAction,
  IQubeAgentPermissions,
  IQubeCard,
  IQubeIdentityState,
  IQubeLifecycleState,
  IQubeMetaSummary,
  IQubePolicyRef,
  IQubePrimitiveType,
  IQubeRegistryRef,
  IQubeSupportedInterfaces,
  IQubeVisibilityState,
} from '@/types/iqube/legibility';

// ── Configuration ────────────────────────────────────────────────────────

/**
 * Host used as the prefix for absolute URLs in the card (registry
 * `canonical_url`, `policy_url`, `links.*`). Defaults to the live
 * dev host per operator direction; can be overridden by the
 * `NEXT_PUBLIC_LEGIBILITY_HOST` env var when serving from a
 * different deploy. Trailing slash trimmed.
 */
export function legibilityHost(): string {
  const raw = process.env.NEXT_PUBLIC_LEGIBILITY_HOST
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://dev-beta.aigentz.me';
  return raw.replace(/\/+$/, '');
}

// ── Source shape ─────────────────────────────────────────────────────────

/**
 * Normalised input shape that all source adapters hand to
 * `buildIQubeCard()`. Adapters are responsible for translating
 * their own row format into this shape (e.g. ContentQube source
 * collapses `content_qubes` + access policy + binding rows into
 * one of these).
 *
 * Anything T0 is OUT — adapters must redact before calling the
 * builder. The builder does not re-redact; it trusts the source
 * not to leak. That's why source adapters live next to the
 * builder and are reviewed against the spine rules.
 */
export interface LegibilitySource {
  /** Stable UUID for the iQube. Same value across versions. */
  iqube_id: string;
  /** Display name. */
  name: string;
  description?: string;

  primitive_type: IQubePrimitiveType;

  /**
   * Raw lifecycle from the source. May use richer enum than
   * `IQubeLifecycleState`; mapped via `mapLifecycleState()`.
   * Pass the source's own value (e.g. 'semi_minted',
   * 'canon_pending') verbatim.
   */
  raw_lifecycle_state: string;

  /**
   * Explicit visibility decision from the source. If the source
   * doesn't track visibility yet, pass 'private' — the safest
   * default. The builder honours this directly; it does not
   * second-guess.
   */
  visibility_state: IQubeVisibilityState;

  /** Gating array from the source (free → 'open'). */
  gating: IQubeAccessGating[];
  /** True iff a private payload exists for this iQube. */
  private_payload_available: boolean;

  /** Identity-tier disclosure for creator + (optional) owner. */
  creator_identity_state: IQubeIdentityState;
  owner_identity_state?: IQubeIdentityState;

  /** Optional meta fields surfaced into `metaqube`. */
  title?: string;
  summary?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  canonicalized_at?: string;

  /**
   * Optional override of the policy slug. When omitted the builder
   * synthesises one as
   * `${primitive_type.toLowerCase()}_${visibility_state}_${lifecycle}`.
   */
  policy_id?: string;

  /** Hashes + provenance receipt aliases (T2 only). */
  content_hash?: string;
  metadata_hash?: string;
  provenance_receipts?: string[];

  /** Interface URLs surfaced into `supported_interfaces`. */
  supported_interfaces?: IQubeSupportedInterfaces;

  /** Public payload URL when `payload_disclosure === 'open'`. */
  canonical_content_url?: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────

/**
 * Maps the repo's richer internal lifecycle enum onto the PRD's
 * five-state surface enum.
 *
 * Internal `content_qubes.lifecycle_state` values today:
 *   draft, semi_minted, review_ready, canon_pending,
 *   canonized, chain_minted, superseded, archived
 *
 * Surface PRD enum:
 *   draft, wip, canonized, deprecated, archived
 *
 * Unknown values fall through to 'draft' — never to 'canonized'
 * (would be a false claim of canonicity).
 */
export function mapLifecycleState(raw: string): IQubeLifecycleState {
  switch (raw) {
    case 'draft':
      return 'draft';
    case 'semi_minted':
    case 'review_ready':
    case 'canon_pending':
    case 'wip':
      return 'wip';
    case 'canonized':
    case 'chain_minted':
      return 'canonized';
    case 'superseded':
    case 'deprecated':
      return 'deprecated';
    case 'archived':
      return 'archived';
    default:
      return 'draft';
  }
}

// ── Access summary ──────────────────────────────────────────────────────

/**
 * Derives the `access` block from the source's gating + payload
 * flags. The shape encodes the "what should the agent expect"
 * contract that PRD §4 defines (what can I read / request / etc.).
 *
 * Rules:
 * - 'open' gating + public visibility → payload_disclosure 'open'.
 * - any gating beyond 'open' → payload_disclosure 'policy_mediated'
 *   (the agent must request access; we don't expose payload bytes).
 * - public_meta_private_payload → payload_disclosure
 *   'policy_mediated' regardless of gating.
 * - private → payload_disclosure 'none' (card route will 404 anyway,
 *   but if a card ever does emit, it advertises no payload).
 */
function buildAccessSummary(src: LegibilitySource): IQubeAccessSummary {
  const gating = src.gating.length > 0 ? src.gating : (['open'] as IQubeAccessGating[]);
  const requires_token = gating.includes('token');
  const requires_payment = gating.includes('payment');
  const requires_authentication = gating.some(
    (g) => g === 'persona' || g === 'did' || g === 'allowlist' || g === 'role',
  ) || requires_token || requires_payment;

  let payload_disclosure: IQubeAccessSummary['payload_disclosure'];
  if (src.visibility_state === 'private') {
    payload_disclosure = 'none';
  } else if (src.visibility_state === 'public_meta_private_payload') {
    payload_disclosure = 'policy_mediated';
  } else if (gating.length === 1 && gating[0] === 'open') {
    payload_disclosure = 'open';
  } else {
    payload_disclosure = 'policy_mediated';
  }

  return {
    gating,
    requires_authentication,
    requires_payment,
    requires_token,
    private_payload_available: src.private_payload_available,
    payload_disclosure,
  };
}

// ── Permissions ─────────────────────────────────────────────────────────

/**
 * Default action menu by primitive type. The catalog of verbs an
 * agent gets is partitioned into:
 *   - allowed_actions: callable now (subject to auth+gating)
 *   - requires_policy_check: callable but server runs policy first
 *   - requires_dvn_receipt: emits a receipt as a side effect of the
 *     mutation (canonized iQubes always require receipts on state
 *     change per PRD §10)
 *
 * These defaults can be tightened per-iQube by a source adapter
 * setting `visibility_state` to private (everything except
 * 'discover' drops off).
 */
function defaultPermissions(
  primitive: IQubePrimitiveType,
  lifecycle: IQubeLifecycleState,
  visibility: IQubeVisibilityState,
): IQubeAgentPermissions {
  // Common base every legible iQube exposes — even private ones
  // allow `discover` (its presence is auditable via the registry).
  const base: IQubeAgentAction[] = ['discover'];

  if (visibility === 'private') {
    return {
      allowed_actions: base,
      disallowed_actions: [
        'read_meta', 'read_summary', 'read_payload',
        'derive_summary', 'transform', 'cite',
        'mint_derivative', 'fork', 'propose_update',
      ],
    };
  }

  // public_meta_private_payload: meta visible, payload gated.
  if (visibility === 'public_meta_private_payload') {
    return {
      allowed_actions: [...base, 'read_meta', 'request_access'],
      disallowed_actions: ['read_payload', 'mint_derivative'],
      requires_policy_check: ['request_access', 'read_payload'],
      requires_dvn_receipt: ['request_access', 'read_payload', 'record_receipt'],
    };
  }

  // public + unlisted treat alike for permissions; the catalog
  // route is the place where unlisted is suppressed from listing.
  const allowed: IQubeAgentAction[] = [
    ...base,
    'read_meta',
    'read_summary',
    'cite',
    'derive_summary',
    'request_access',
  ];

  // Derivative / proposal verbs only apply to content-bearing
  // primitives. ToolQubes / AigentQubes don't get 'mint_derivative'
  // by default — they have their own bespoke versioning.
  const requires_policy_check: IQubeAgentAction[] = [];
  const requires_dvn_receipt: IQubeAgentAction[] = ['record_receipt'];

  if (primitive === 'ContentQube' || primitive === 'DataQube') {
    requires_policy_check.push('mint_derivative', 'propose_update');
    requires_dvn_receipt.push('mint_derivative', 'propose_update');
  }

  // ToolQube / AigentQube get audit_state by default — agents
  // should be able to ask "what is this tool doing right now?"
  // subject to policy.
  if (primitive === 'ToolQube' || primitive === 'AigentQube' || primitive === 'ModelQube') {
    requires_policy_check.push('audit_state');
  }

  // Canonized content is immutable — no direct propose_update.
  // Derivative / fork verbs remain available and produce a new
  // versioned card via DVN receipt.
  if (lifecycle === 'canonized') {
    requires_policy_check.push('fork');
    requires_dvn_receipt.push('fork');
  }

  return {
    allowed_actions: allowed,
    requires_policy_check: dedupe(requires_policy_check),
    requires_dvn_receipt: dedupe(requires_dvn_receipt),
  };
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

// ── Policy block ────────────────────────────────────────────────────────

function buildPolicyRef(
  src: LegibilitySource,
  permissions: IQubeAgentPermissions,
  host: string,
): IQubePolicyRef {
  const policy_id = src.policy_id
    || `${src.primitive_type.toLowerCase()}_${src.visibility_state}_${mapLifecycleState(src.raw_lifecycle_state)}_v1`;
  const policy_url = `${host}/api/iqubes/${src.iqube_id}/policy`;

  // Canonized iQubes (and any iQube whose source explicitly opted
  // into DVN-required state change) MUST emit receipts on mutation.
  const lifecycle = mapLifecycleState(src.raw_lifecycle_state);
  const dvn_required = lifecycle === 'canonized'
    || (permissions.requires_dvn_receipt?.length ?? 0) > 0;

  return {
    policy_url,
    policy_id,
    dvn_required_for_state_change: dvn_required,
    state_change_verbs: permissions.requires_dvn_receipt ?? [],
  };
}

// ── Builder ─────────────────────────────────────────────────────────────

/**
 * The single entry point. Adapters call this. The output is a
 * fully formed `IQubeCard` ready for Zod validation.
 *
 * Does NOT throw on malformed input — produces a best-effort card
 * and lets the Zod layer reject. This keeps the builder's failure
 * mode aligned with PRD §11 (validation failure → 500 with the
 * standard error body, not a panic).
 */
export function buildIQubeCard(src: LegibilitySource): IQubeCard {
  const host = legibilityHost();
  const lifecycle = mapLifecycleState(src.raw_lifecycle_state);
  const permissions = defaultPermissions(src.primitive_type, lifecycle, src.visibility_state);

  const registry: IQubeRegistryRef = {
    canonical_url: `${host}/api/registry/content-qube/${src.iqube_id}`,
    registry_id: src.iqube_id,
    content_hash: src.content_hash,
    metadata_hash: src.metadata_hash,
    provenance_receipts: src.provenance_receipts,
  };

  const metaqube: IQubeMetaSummary = {
    title: src.title ?? src.name,
    summary: src.summary ?? src.description,
    tags: src.tags,
    creator_identity_state: src.creator_identity_state,
    owner_identity_state: src.owner_identity_state,
    created_at: src.created_at,
    updated_at: src.updated_at,
    canonicalized_at: src.canonicalized_at,
  };

  const access = buildAccessSummary(src);
  const policy = buildPolicyRef(src, permissions, host);

  const card: IQubeCard = {
    type: 'iQubeCard',
    version: '0.1',
    iqube_id: src.iqube_id,
    name: src.name,
    description: src.description,
    primitive_type: src.primitive_type,
    lifecycle_state: lifecycle,
    visibility_state: src.visibility_state,
    registry,
    metaqube,
    access,
    agent_permissions: permissions,
    policy,
    supported_interfaces: src.supported_interfaces,
    links: {
      self: `${host}/api/iqubes/${src.iqube_id}/card`,
      actions: `${host}/api/iqubes/${src.iqube_id}/actions`,
      policy: `${host}/api/iqubes/${src.iqube_id}/policy`,
      request_access: access.requires_authentication
        ? `${host}/api/iqubes/${src.iqube_id}/request-access`
        : undefined,
      canonical_content: access.payload_disclosure === 'open'
        ? src.canonical_content_url
        : undefined,
    },
  };

  return card;
}

// ── Action menu derivation ──────────────────────────────────────────────

/**
 * Builds the `/actions` route's response from a card. Each verb
 * surfaced by `agent_permissions.allowed_actions` becomes an entry
 * with the correct method, href, and auth/policy/DVN flags. Verbs
 * the source has explicitly disallowed are omitted (not rendered
 * with `disabled: true` — agents should not see denials, only
 * affordances).
 */
export function buildActionMenu(card: IQubeCard): {
  iqube_id: string;
  actions: Array<{
    verb: IQubeAgentAction;
    method: 'GET' | 'POST';
    href: string;
    requires_authentication?: boolean;
    requires_policy_check?: boolean;
    requires_dvn_receipt?: boolean;
  }>;
} {
  const host = legibilityHost();
  const policyCheck = new Set(card.agent_permissions.requires_policy_check ?? []);
  const dvnReceipt = new Set(card.agent_permissions.requires_dvn_receipt ?? []);
  const reqAuth = card.access.requires_authentication;

  const isMutating = (verb: IQubeAgentAction): boolean =>
    verb === 'propose_update' || verb === 'mint_derivative' || verb === 'fork'
    || verb === 'record_receipt' || verb === 'revoke_access';

  const actions = card.agent_permissions.allowed_actions.map((verb) => {
    // Read verbs map to GET on the card itself; mutating verbs map
    // to POST on a verb-named sub-route. Phase 1 may not have the
    // POST handler wired — PRD §8.4 explicitly allows descriptive-
    // only entries here.
    const isRead = verb === 'discover'
      || verb === 'read_meta'
      || verb === 'read_summary'
      || verb === 'cite'
      || verb === 'audit_state';

    const method: 'GET' | 'POST' = isRead ? 'GET' : 'POST';
    const href = isRead
      ? `${host}/api/iqubes/${card.iqube_id}/card`
      : `${host}/api/iqubes/${card.iqube_id}/${verb.replace(/_/g, '-')}`;

    return {
      verb,
      method,
      href,
      requires_authentication: reqAuth || isMutating(verb) || undefined,
      requires_policy_check: policyCheck.has(verb) || undefined,
      requires_dvn_receipt: dvnReceipt.has(verb) || undefined,
    };
  });

  return { iqube_id: card.iqube_id, actions };
}
