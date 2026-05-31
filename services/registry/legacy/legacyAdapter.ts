/**
 * Legacy /registry → canonical SoT adapter.
 *
 * Phase A of the legacy /registry integration plan (2026-05-31). Maps
 * canonical RegistryCartridgeView / RegistryAdminView shapes to the
 * legacy IQubeTemplate shape that components/registry/RegistryHome.tsx
 * and IQubeDetailModal.tsx consume.
 *
 * Strategy: thin shape-map. Optional legacy fields that don't exist on
 * the canonical record (businessModel, price, parentTemplateId,
 * blakqubeLabels, metaExtras for non-LiquidUI sources, identity_state)
 * surface as undefined; legacy components already handle undefined
 * optional fields.
 *
 * Score fields (sensitivityScore / accuracyScore / verifiabilityScore /
 * riskScore) come from the canonical scores block (Stage 2 + score
 * backfill subsystem). When the canonical record has no scores row,
 * these are also undefined — legacy components render placeholder dots.
 *
 * The /api/registry/templates legacy route stays alive as a fallback
 * during Phase A observation window. After Phase C, those routes
 * retire.
 */

import type { IQubeTemplate, IQubeType } from '@/types/registry';

// ── Canonical → Legacy shape map ─────────────────────────────────────────

interface CanonicalCartridgeEntry {
  iqube_id: string;
  primitive_type: string;
  tool_subtype?: string;
  display_name?: string;
  display_description?: string;
  cover_url?: string;
  surface_lifecycle?: string;
  mint_status?: string;
  visibility_state?: string;
  gating?: string[];
  cartridge_bindings?: string[];
  caller_owns?: boolean;
  caller_can_read?: boolean;
  scores?: {
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
  };
}

interface CanonicalAdminEntry extends CanonicalCartridgeEntry {
  internal_lifecycle?: string;
  creator?: { identity_state?: string; alias_commitment?: string };
  steward?: { identity_state?: string; alias_commitment?: string };
  chain_anchor?: unknown;
  mint_saga_id?: string;
  edition_supply?: unknown;
  dvn_receipt_index?: { receipt_count?: number };
  version?: string;
  created_at?: string;
  updated_at?: string;
}

function isValidIQubeType(value: unknown): value is IQubeType {
  return (
    typeof value === 'string' &&
    ['DataQube', 'ContentQube', 'ToolQube', 'ModelQube', 'AigentQube', 'ClusterQube'].includes(value)
  );
}

/**
 * Map a canonical cartridge entry to the legacy IQubeTemplate shape.
 * Used by list views. Fields the canonical record doesn't carry
 * (businessModel, price, etc.) surface as undefined.
 */
export function cartridgeViewToLegacyTemplate(entry: CanonicalCartridgeEntry): IQubeTemplate {
  return {
    id: entry.iqube_id,
    name: entry.display_name ?? entry.iqube_id.slice(0, 8),
    description: entry.display_description ?? '',
    createdAt: new Date().toISOString(), // canonical cartridge view doesn't carry; admin does
    iQubeType: isValidIQubeType(entry.primitive_type) ? entry.primitive_type : undefined,
    iQubeInstanceType: 'instance', // canonical doesn't distinguish at the cartridge view layer
    businessModel: undefined, // Phase B writes will populate
    price: undefined,
    version: undefined,
    provenance: undefined,
    parentTemplateId: undefined,
    blakqubeLabels: undefined,
    metaExtras: undefined,
    sensitivityScore: entry.scores?.sensitivity ?? undefined,
    accuracyScore: entry.scores?.accuracy ?? 0,
    verifiabilityScore: entry.scores?.verifiability ?? 0,
    riskScore: entry.scores?.risk ?? 0,
    identity_state: undefined,
    min_reputation_bucket: undefined,
    require_human_proof: undefined,
    require_agent_declare: undefined,
  };
}

/**
 * Map a canonical admin entry to the legacy IQubeTemplate shape.
 * Used by detail views. Richer than cartridge map — includes created_at,
 * version, identity_state from the creator block.
 */
export function adminViewToLegacyTemplate(entry: CanonicalAdminEntry): IQubeTemplate {
  return {
    ...cartridgeViewToLegacyTemplate(entry),
    createdAt: entry.created_at ?? new Date().toISOString(),
    version: entry.version,
    identity_state: entry.creator?.identity_state as IQubeTemplate['identity_state'],
  };
}

// ── Legacy filter → canonical query params ────────────────────────────────

export interface LegacyFilterState {
  search?: string;
  type?: string;
  instance?: string;
  businessModel?: string;
  sort?: string;
  persona?: string;
  reputation?: string;
}

/**
 * Translate legacy filter state to canonical resolver query string.
 *
 * Notes:
 *   - `type` maps directly to `primitive_type`
 *   - `instance` is canonical-view-agnostic; ignored for now (every
 *     canonical record is an instance from the resolver's perspective)
 *   - `businessModel` doesn't exist canonically; ignored for now (Phase B
 *     writes populate; A3 surfaces a deprecation tooltip)
 *   - `search` is client-side filtered post-fetch (the resolver list
 *     endpoint doesn't support text search; Phase A scope is read-path
 *     only — server-side search is Phase B+)
 *   - `persona` / `reputation` — Phase A A3 wires these
 */
export function legacyFiltersToCanonicalParams(
  filters: LegacyFilterState,
  page: number,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('expand', 'cartridge');
  // Resolver list cap is 500; page+limit translate to a single fetch
  // (full client-side pagination at this size). Phase B may add real
  // server-side pagination to the resolver.
  params.set('limit', String(Math.min(Math.max(page * limit, 50), 500)));
  if (filters.type && isValidIQubeType(filters.type)) {
    params.set('primitive_type', filters.type);
  }
  return params;
}

// ── Pagination + client-side filter (resolver doesn't paginate yet) ──────

export interface LegacyPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface LegacyListResponse {
  data: IQubeTemplate[];
  pagination: LegacyPagination;
  error?: string;
}

/**
 * Client-side slice + pagination over the canonical resolver response.
 * Applies search + sort filters that the resolver doesn't support yet.
 */
export function buildLegacyListResponse(
  allTemplates: IQubeTemplate[],
  filters: LegacyFilterState,
  page: number,
  limit: number,
): LegacyListResponse {
  let filtered = allTemplates;

  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s),
    );
  }

  // Phase A C3 — Persona filter: no-op today. Server-side ownership
  // filter (caller_owns true for a passed persona context) is Phase B
  // work. The selection is tracked so Phase B can wire it without UI
  // changes; the UI tooltip explains the current limitation.

  // Phase A C3 — Reputation filter: applies to AigentQubes only per
  // operator decision (integration plan §5 item 4). Other primitives
  // don't carry a trust_band field; they pass through. The cartridge
  // projection doesn't yet surface trust_band, so this remains best-
  // effort until Stage 7 governance block surfaces on the view. When
  // it does, the filter becomes:
  //   filtered = filtered.filter(t =>
  //     t.iQubeType !== 'AigentQube' || (t.trust_band ?? 0) >= filters.reputation
  //   );

  if (filters.sort) {
    filtered = [...filtered].sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return filters.sort === 'oldest' ? ta - tb : tb - ta;
    });
  }

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * limit;
  const slice = filtered.slice(start, start + limit);

  return {
    data: slice,
    pagination: {
      currentPage: safePage,
      totalPages,
      totalCount,
      limit,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
      nextPage: safePage < totalPages ? safePage + 1 : null,
      prevPage: safePage > 1 ? safePage - 1 : null,
    },
  };
}

// ── Public fetch helpers ─────────────────────────────────────────────────

/**
 * Fetch a single iQube detail via the canonical resolver (admin
 * projection), return legacy IQubeTemplate shape. Drop-in replacement
 * for the legacy GET /api/registry/templates/[id] pattern.
 *
 * Phase A C2. Admin projection carries the richer fields (created_at,
 * version, creator identity) the detail modal needs. Falls back to
 * legacy template route on canonical miss for the observation window.
 *
 * Returns null when neither path returns a record.
 */
export async function fetchTemplateDetailAsLegacyShape(
  templateId: string,
): Promise<IQubeTemplate | null> {
  try {
    const res = await fetch(`/api/registry/iqube/${encodeURIComponent(templateId)}?projection=admin`);
    if (res.ok) {
      const entry = (await res.json()) as CanonicalAdminEntry;
      return adminViewToLegacyTemplate(entry);
    }
  } catch {
    // Fall through to legacy fallback
  }
  try {
    const legacy = await fetch(`/api/registry/templates/${encodeURIComponent(templateId)}`);
    if (!legacy.ok) return null;
    return (await legacy.json()) as IQubeTemplate;
  } catch {
    return null;
  }
}

/**
 * Fetch the registry list via the canonical resolver, return legacy
 * shape. Drop-in replacement for the legacy
 * GET /api/registry/templates pattern.
 *
 * If the canonical fetch fails (network, 503, etc.), falls back to the
 * legacy /api/registry/templates endpoint for one observation window
 * to keep operator UX intact. Phase C retires the legacy endpoint.
 */
export async function fetchRegistryAsLegacyShape(
  filters: LegacyFilterState,
  page: number,
  limit: number,
): Promise<LegacyListResponse> {
  const params = legacyFiltersToCanonicalParams(filters, page, limit);
  try {
    const res = await fetch(`/api/registry/iqube?${params.toString()}`);
    if (res.ok) {
      const body = await res.json() as { entries?: CanonicalCartridgeEntry[] };
      const all = (body.entries ?? []).map(cartridgeViewToLegacyTemplate);
      return buildLegacyListResponse(all, filters, page, limit);
    }
    // Fall through to legacy fallback on non-2xx
  } catch {
    // Fall through to legacy fallback on network error
  }

  // Legacy fallback
  const legacyParams = new URLSearchParams();
  if (filters.search) legacyParams.set('search', filters.search);
  if (filters.type) legacyParams.set('type', filters.type);
  if (filters.instance) legacyParams.set('instance', filters.instance);
  if (filters.businessModel) legacyParams.set('businessModel', filters.businessModel);
  if (filters.sort) legacyParams.set('sort', filters.sort);
  legacyParams.set('page', String(page));
  legacyParams.set('limit', String(limit));

  const legacyRes = await fetch(`/api/registry/templates?${legacyParams.toString()}`);
  const legacyData = await legacyRes.json();
  if (!legacyRes.ok) {
    return {
      data: [],
      pagination: {
        currentPage: page,
        totalPages: 1,
        totalCount: 0,
        limit,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: null,
        prevPage: null,
      },
      error: legacyData?.error || 'Failed to load templates',
    };
  }
  // Legacy returns either { data, pagination } envelope OR raw array
  if (legacyData?.data && legacyData?.pagination) {
    return legacyData as LegacyListResponse;
  }
  return buildLegacyListResponse(
    Array.isArray(legacyData) ? (legacyData as IQubeTemplate[]) : [],
    filters,
    page,
    limit,
  );
}
