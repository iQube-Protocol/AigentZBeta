/**
 * Canonical registry — primitive-specific adapter contract.
 *
 * PRD v1.0 §9 / v1.0 §5.1 / v0.2 §B.9. Each iQube primitive type has an
 * adapter that:
 *   1. Hydrates a CanonicalIQubeInternalRecord from its source surface.
 *   2. Enumerates available iqube_ids (catalog + backfill).
 *
 * Adapters REUSE the shipped legibility source adapters where applicable
 * (services/iqube/legibility/sources/*) — they do not fork them. The
 * legibility surface ships a 'public projection' of each source; this
 * canonical layer adds the internal fields legibility doesn't track
 * (meta_qube_id / blak_qube_id / token_qube_id / internal_lifecycle /
 * mint_status / etc.) by joining iqube_id_map + the source's native
 * tables.
 *
 * The resolver (services/registry/resolver.ts) picks an adapter from
 * services/registry/adapters/index.ts::REGISTRY_ADAPTERS keyed by
 * primitive_type. Adding a new primitive is two lines in that registry
 * plus a new adapter file.
 *
 * Authority rule (PRD v1.0 §3): adapters NEVER decide access, never
 * decide ownership, never write receipts. They compose data shapes. The
 * resolver's projection layer calls userOwnsAsset() / evaluateAccess()
 * for caller-aware fields (caller_owns / caller_can_read).
 */

import type {
  IQubePrimitiveType,
  CanonicalIQubeInternalRecord,
  IQubeIdMapEntry,
  IQubeIdMapSource,
} from '@/types/registry-canonical';

// ── Adapter hydration options ─────────────────────────────────────────────

export interface AdapterHydrateOpts {
  /**
   * When true, the adapter returns records even when the underlying
   * source resolves to visibility='private'. Caller is responsible for
   * not leaking. Used by admin-projection callers.
   */
  allowPrivate?: boolean;
}

// ── Listing filter (for catalog + backfill enumeration) ───────────────────

export interface AdapterListFilter {
  /** Optional cartridge slug filter (matches cartridge_bindings membership). */
  cartridge?: string;
  /** Limit number of results. Adapters default to 200 if unspecified. */
  limit?: number;
  /** Pagination cursor (adapter-defined). */
  cursor?: string;
}

export interface AdapterListResult {
  entries: IQubeIdMapEntry[];
  next_cursor?: string;
}

// ── Adapter contract ──────────────────────────────────────────────────────

export interface RegistryPrimitiveAdapter {
  /** Which primitive this adapter handles. */
  readonly primitive_type: IQubePrimitiveType;

  /**
   * Source values this adapter consumes (matches iqube_id_map.source).
   * One adapter may consume multiple sources (e.g. ContentQubeAdapter
   * reads content_qube + master_content_qube + codex_media_asset).
   */
  readonly sources: ReadonlyArray<IQubeIdMapSource>;

  /**
   * Build a CanonicalIQubeInternalRecord for one iQube. Returns null
   * if the source row does not exist OR if visibility resolves to
   * 'private' and opts.allowPrivate is false (route returns 404 per
   * PRD v0.1 §8.2 default).
   *
   * The entry parameter carries the source + source_id; the adapter
   * fetches the actual row from its native table.
   */
  hydrate(
    entry: IQubeIdMapEntry,
    opts?: AdapterHydrateOpts,
  ): Promise<CanonicalIQubeInternalRecord | null>;

  /**
   * Enumerate iqube_id_map entries known to this adapter. Used by:
   *   - the catalog endpoint (filters by visibility post-hydrate)
   *   - the backfill driver (Stage 2 C13) to discover unmapped rows
   *
   * Adapters that wrap code-only sources (AigentQube from
   * RUNTIME_AGENT_IDS, ToolQube from openclawCore) synthesise entries
   * deterministically — see syntheticIQubeId() helper below.
   */
  list(filter?: AdapterListFilter): Promise<AdapterListResult>;
}

// ── Synthetic UUID derivation for code-only sources ───────────────────────

/**
 * Deterministic UUID v4-shaped identifier for code-only iQube sources.
 * Same (source, runtime_id) input ALWAYS produces the same UUID — idempotent
 * across deploys, identical across environments.
 *
 * Used by AigentQube + ToolQube adapters whose source-of-record lives in
 * code constants (RUNTIME_AGENT_IDS, openclawCore.tools[]) until the
 * legibility fast-follow #3 promotes them to DB tables.
 *
 * Stage 0 audit Cross-cutting Finding C — unblocks the resolver to serve
 * these primitives via iqube_id before DB promotion lands.
 */
import { createHash } from 'crypto';

export function syntheticIQubeId(source: IQubeIdMapSource, runtime_id: string): string {
  const hash = createHash('sha256').update(`${source}:${runtime_id}`).digest('hex');
  // Format as RFC 4122 UUID with variant bits set
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    // Version nibble: 4 (random/synthetic)
    '4' + hash.substring(13, 16),
    // Variant bits: 10xx (RFC 4122)
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}
