/**
 * Canonical iQube Registry resolver.
 *
 * The single entry point for cartridge / Studio / runtime callers that
 * need to resolve an iqube_id to a structured record. The shipped
 * legibility resolver (services/iqube/legibility/registry.ts) remains
 * the agent-facing card resolver; this resolver wraps the same source
 * adapters and produces in-app projections (admin / cartridge / public)
 * with optional caller-aware fields.
 *
 * ── Authority rule (PRD v1.0 §3) ─────────────────────────────────────
 * This resolver MUST NOT:
 *   - decide access (delegate to services/access/evaluateAccess)
 *   - decide ownership (delegate to services/rewards/assetOwnership::userOwnsAsset)
 *   - write receipts (the spine emits via orchestrationEvents)
 *   - read secrets (secret_ref values are opaque; vault dereference happens
 *     in services/registry/invocationGateway)
 *
 * The caller_owns / caller_can_read projection fields are populated by
 * CALLING the spine — never reimplementing it. CI test
 * tests/registry-authority.test.ts asserts these rules.
 *
 * ── Two-path resolution ──────────────────────────────────────────────
 *   1. iqube_id_map lookup → adapter dispatch (the canonical path)
 *   2. Legacy-id pattern dispatch (matches the legibility resolver's
 *      pattern: UUID → content; 'tool-*'/'tool_*' → tool; 'aigent-*' →
 *      aigent) — used as a fallback when iqube_id_map doesn't have the
 *      row yet. Backfill (Stage 2 C13) closes this gap.
 */

import { createClient } from '@supabase/supabase-js';

import type {
  CanonicalIQubeInternalRecord,
  RegistryAdminView,
  RegistryCartridgeView,
  RegistryPublicView,
  IQubeIdMapEntry,
  IQubeIdMapSource,
} from '@/types/registry-canonical';
import type { ActivePersonaContext } from '@/types/access';

import { adapterForPrimitive, adapterForSource, syntheticIQubeId } from './adapters';
import { projectAdmin } from './projections/admin';
import { projectCartridge } from './projections/cartridge';
import { projectPublic } from './projections/public';

// ── Lookups ───────────────────────────────────────────────────────────────

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Look up iqube_id_map by canonical iqube_id (UUID). Returns null when
 * the row doesn't exist — caller decides whether to attempt a legacy-id
 * fallback dispatch.
 */
async function lookupById(iqubeId: string): Promise<IQubeIdMapEntry | null> {
  if (!UUID_RE.test(iqubeId)) return null;
  const sb = client();
  const { data } = await sb
    .from('iqube_id_map')
    .select('*')
    .eq('iqube_id', iqubeId)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  return {
    iqube_id: row.iqube_id,
    source: row.source,
    source_id: row.source_id,
    primitive_type: row.primitive_type,
    legacy_primitive_type: row.legacy_primitive_type ?? undefined,
    synthetic: row.synthetic,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Legacy-id fallback dispatch. Mirrors the legibility resolver pattern.
 * Used when iqube_id_map doesn't have the row yet (pre-backfill or
 * synthetic-only sources). The synthetic UUID derivation is stable so
 * the same legacy id always resolves to the same iqube_id.
 */
function legacyDispatchEntry(legacyId: string): IQubeIdMapEntry | null {
  if (UUID_RE.test(legacyId)) {
    // UUIDs without iqube_id_map rows usually mean content_qube rows
    // pre-backfill; assume content source.
    return {
      iqube_id: legacyId,
      source: 'content_qube',
      source_id: legacyId,
      primitive_type: 'ContentQube',
      synthetic: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  if (legacyId.startsWith('tool-') || legacyId.startsWith('tool_')) {
    return {
      iqube_id: syntheticIQubeId('code:toolQubeSource', legacyId),
      source: 'code:toolQubeSource',
      source_id: legacyId,
      primitive_type: 'ToolQube',
      synthetic: true,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  if (legacyId.startsWith('aigent-')) {
    return {
      iqube_id: syntheticIQubeId('code:aigentQubeSource', legacyId),
      source: 'code:aigentQubeSource',
      source_id: legacyId,
      primitive_type: 'AigentQube',
      synthetic: true,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  if (legacyId.startsWith('liquidui-template-')) {
    return {
      iqube_id: syntheticIQubeId('code:liquidui-template', legacyId),
      source: 'code:liquidui-template',
      source_id: legacyId,
      primitive_type: 'DataQube',
      legacy_primitive_type: 'LiquidUITemplateArchetypeQube',
      synthetic: true,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  return null;
}

// ── Public resolver API ───────────────────────────────────────────────────

export type ResolverProjection = 'admin' | 'cartridge' | 'public' | 'internal';

export interface ResolveOpts {
  /**
   * Caller persona context. When provided, the cartridge projection
   * populates caller_owns + caller_can_read by calling userOwnsAsset()
   * and evaluateAccess() respectively. The resolver NEVER decides these
   * itself — it composes over the spine.
   */
  persona?: ActivePersonaContext;

  /**
   * Which projection shape to return. Defaults to 'cartridge'.
   * 'internal' returns the raw CanonicalIQubeInternalRecord — only for
   * server-side callers that own subsequent redaction.
   */
  projection?: ResolverProjection;

  /**
   * When true, allow private/wip records through (admin path). Default
   * false — private records return null (caller emits 404, per legibility
   * v0.1 convention).
   */
  allowPrivate?: boolean;
}

export type ResolverResult =
  | RegistryAdminView
  | RegistryCartridgeView
  | RegistryPublicView
  | CanonicalIQubeInternalRecord
  | null;

/**
 * Resolve any iqube_id to a projected view. Returns null when the iQube
 * doesn't exist OR when the record is private and allowPrivate=false.
 */
export async function resolveIQube(
  iqubeId: string,
  opts: ResolveOpts = {},
): Promise<ResolverResult> {
  // 1. Try iqube_id_map lookup
  let entry = await lookupById(iqubeId);

  // 2. Fall back to legacy-id pattern dispatch
  if (!entry) {
    entry = legacyDispatchEntry(iqubeId);
    if (!entry) return null;
  }

  // 3. Dispatch to adapter
  const adapter = adapterForSource(entry.source);
  if (!adapter) return null;

  const record = await adapter.hydrate(entry, { allowPrivate: opts.allowPrivate });
  if (!record) return null;

  // 4. Project per requested shape
  return projectRecord(record, opts);
}

/**
 * Resolve by chain anchor (chain_id + contract + token_id). Used by mint
 * tx observers and chain-listener pipelines.
 */
export async function resolveIQubeByChainAnchor(
  chainId: number,
  contract: string,
  tokenId: string,
  opts: ResolveOpts = {},
): Promise<ResolverResult> {
  const sb = client();
  const { data } = await sb
    .from('iq_token_qubes')
    .select('iqube_id')
    .eq('chain_id', chainId)
    .eq('chain_token_id', tokenId)
    .maybeSingle();
  if (!data) return null;
  // chain anchor lookup currently keys on iq_token_qubes; future
  // persona_token_qube_ownership.chain_anchor lookup adds richer mapping.
  // We resolve via the token_qube's owning master_content / codex_media
  // → content_qubes path. For Stage 2 we return null when the lookup
  // doesn't immediately match; Stage 5 wires the chain-anchor backfill.
  const _contract = contract; // referenced for future signature parity
  void _contract;
  const tokenIqubeId = (data as any).iqube_id;
  if (!tokenIqubeId) return null;
  return resolveIQube(tokenIqubeId, opts);
}

// ── List API (catalog + backfill enumeration) ─────────────────────────────

export interface ListIQubesFilter {
  primitive_type?: string;
  source?: IQubeIdMapSource;
  cartridge?: string;
  limit?: number;
}

export interface ListIQubesResult {
  entries: IQubeIdMapEntry[];
}

export async function listIQubes(filter: ListIQubesFilter = {}): Promise<ListIQubesResult> {
  // For Stage 2 we enumerate via the iqube_id_map table directly. Per-
  // primitive enumeration delegates to adapter.list() for richer filters
  // (cartridge scope, visibility).
  if (filter.primitive_type) {
    const adapter = adapterForPrimitive(filter.primitive_type as any);
    if (adapter) {
      const result = await adapter.list({
        cartridge: filter.cartridge,
        limit: filter.limit,
      });
      return { entries: result.entries };
    }
  }

  const sb = client();
  let query = sb.from('iqube_id_map').select('*').limit(filter.limit ?? 200);
  if (filter.source) query = query.eq('source', filter.source);

  const { data } = await query;
  const entries: IQubeIdMapEntry[] = (data ?? []).map((row) => ({
    iqube_id: (row as any).iqube_id,
    source: (row as any).source,
    source_id: (row as any).source_id,
    primitive_type: (row as any).primitive_type,
    legacy_primitive_type: (row as any).legacy_primitive_type ?? undefined,
    synthetic: (row as any).synthetic,
    notes: (row as any).notes ?? undefined,
    created_at: (row as any).created_at,
    updated_at: (row as any).updated_at,
  }));
  return { entries };
}

// ── Projection driver ─────────────────────────────────────────────────────

async function loadScoreBlock(iqube_id: string) {
  try {
    const sb = client();
    const { data } = await sb
      .from('iqube_scores')
      .select('*')
      .eq('iqube_id', iqube_id)
      .maybeSingle();
    if (!data) return undefined;
    const r = data as Record<string, unknown>;
    return {
      sensitivity: (r.sensitivity as number | null) ?? null,
      accuracy: (r.accuracy as number | null) ?? null,
      verifiability: (r.verifiability as number | null) ?? null,
      risk: (r.risk as number | null) ?? null,
      derived_reliability: (r.derived_reliability as number | null) ?? null,
      derived_trust: (r.derived_trust as number | null) ?? null,
      sensitivity_source: r.sensitivity_source as 'derived' | 'operator_override',
      accuracy_source: r.accuracy_source as 'derived' | 'operator_override',
      verifiability_source: r.verifiability_source as 'derived' | 'operator_override',
      risk_source: r.risk_source as 'derived' | 'operator_override',
      derivation_strategy: (r.derivation_strategy as string | null) ?? null,
      updated_at: r.updated_at as string,
    };
  } catch {
    return undefined; // best-effort — projection is fine without scores
  }
}

async function projectRecord(
  record: CanonicalIQubeInternalRecord,
  opts: ResolveOpts,
): Promise<ResolverResult> {
  const projection = opts.projection ?? 'cartridge';

  if (projection === 'internal') return record;

  // Score block applies to admin + cartridge views (not public — scores
  // are operator-facing). Best-effort fetch; undefined surfaces as
  // placeholder UX in the consumer.
  const scores = projection === 'admin' || projection === 'cartridge'
    ? await loadScoreBlock(record.iqube_id)
    : undefined;

  if (projection === 'admin') {
    const view = projectAdmin(record);
    if (scores) view.scores = scores;
    return view;
  }

  if (projection === 'public') {
    if (
      record.visibility_state !== 'public' &&
      record.visibility_state !== 'public_meta_private_payload'
    ) {
      // Public projection refuses non-public visibility. Caller treats
      // as not-found, per legibility v0.1 convention.
      return null;
    }
    return projectPublic(record);
  }

  // cartridge — the default. Populate caller-aware fields by CALLING
  // the spine (PRD v1.0 §3 authority matrix; resolver never decides).
  let callerOwns: boolean | undefined;
  let callerCanRead: boolean | undefined;

  if (opts.persona) {
    callerOwns = await callerOwnsViaSpine(opts.persona, record);
    callerCanRead = await callerCanReadViaSpine(opts.persona, record);
  }

  const view = projectCartridge(record, callerOwns, callerCanRead);
  if (scores) view.scores = scores;
  return view;
}

// ── Spine delegation (never reimplement; always call) ─────────────────────

async function callerOwnsViaSpine(
  persona: ActivePersonaContext,
  record: CanonicalIQubeInternalRecord,
): Promise<boolean | undefined> {
  try {
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    const result = await userOwnsAsset(persona.personaId, record.iqube_id);
    return result.owned;
  } catch {
    // Fail-closed: undefined ('unknown'), not false (which UI may treat as 'denied').
    return undefined;
  }
}

async function callerCanReadViaSpine(
  persona: ActivePersonaContext,
  record: CanonicalIQubeInternalRecord,
): Promise<boolean | undefined> {
  // For Stage 2 we approximate with an ownership check. Stage 4 wires the
  // full evaluateAccess() path with a synthesised ContentAccessDescriptor
  // for the iqube_id. Until then 'caller_can_read' is an alias for
  // 'caller_owns' OR free-gated.
  if (record.gating.includes('open')) return true;
  return callerOwnsViaSpine(persona, record);
}
