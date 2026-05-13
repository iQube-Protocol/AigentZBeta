/**
 * ContentQube — iQube Protocol type contract for content objects.
 *
 * ContentQube is the authoritative object model for content in the iQube
 * Protocol. It bridges existing master_content_qubes + codex_media_assets
 * rows and will supersede them as the canonical registry in Phase 3+.
 *
 * Privacy contract (CLAUDE.md identity-spine rules):
 *   - persona_id / author_persona_id are T0 — server-internal only.
 *     These fields exist in the DB schema but MUST NOT appear in any
 *     browser-bound JSON. Server services use them; routes emit
 *     ContentQubeDisplayManifest to the browser instead.
 *   - t2_alias_commitment (T2) is the only persona handle allowed in
 *     DVN receipts and chain-bound payloads.
 *
 * See: supabase/migrations/20260513010000_content_qubes_schema.sql
 */

// ─────────────────────────────────────────────────────────────────────────
// Enum types
// ─────────────────────────────────────────────────────────────────────────

export type ContentQubeLifecycle =
  | 'draft'
  | 'semi_minted'
  | 'review_ready'
  | 'canon_pending'
  | 'canonized'
  | 'chain_minted'
  | 'superseded'
  | 'archived';

export type ContentQubeKind =
  | 'episode'
  | 'character'
  | 'gn'
  | 'lore_scroll'
  | 'powers_sheet'
  | 'bundle'
  | 'other';

export type ContentQubeContentType =
  | 'episode_still'
  | 'episode_motion'
  | 'episode_print'
  | 'character_poster'
  | 'powers_sheet'
  | 'gn_still';

export type ContentQubeStorageKind = 'supabase' | 'auto_drive' | 'ipfs' | 'arweave';

export type ContentQubeGatingKind = 'free' | 'owned' | 'subscription' | 'sku_required';

export type ContentQubeRelationshipType =
  | 'sequence_prev'
  | 'sequence_next'
  | 'related'
  | 'branch'
  | 'bundle_member';

/**
 * ContentQube rarity classes.
 *
 * Canonical-mintable (limited, pre-seeded; eligible for Base TokenQube minting):
 *   - legendary, epic, rare, secret_black_rare
 *
 * Streaming-access (unlimited, NOT pre-seeded; appended on each sale):
 *   - common
 *
 * Commons share the canonical cyphertext payload (no per-holder mint), are
 * served via the streaming decrypt proxy under remote custody, and have
 * base_token_id / chain_minted_at permanently NULL. Editions ledger rows
 * are still written per sale for audit and revenue tracking.
 */
export type ContentQubeRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'secret_black_rare';

/** Subset that participates in canonical non-fungible minting. */
export type ContentQubeCanonicalRarity = Exclude<ContentQubeRarity, 'common'>;

export function isCanonicalRarity(r: ContentQubeRarity): r is ContentQubeCanonicalRarity {
  return r !== 'common';
}

export type ContentQubeDvnReceiptKind = 'creation' | 'access' | 'transfer' | 'mint' | 'burn';

export type ContentQubeContentState = 'A' | 'B' | 'C' | 'D' | 'E';

// ─────────────────────────────────────────────────────────────────────────
// Rarity distribution constants (KNYT pilot: 1,860 editions)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Canonical-mintable rarity distribution per content_qube (1,860 total).
 * Commons are unlimited and intentionally absent from this constant —
 * they are appended on sale and tracked via common_count, not pre-seeded.
 */
export const CONTENT_QUBE_RARITY_COUNTS = {
  legendary: 18,
  epic: 186,
  rare: 1654,
  secret_black_rare: 2,
  total: 1860,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// DB row types (server-internal; never serialised to browser JSON directly)
// ─────────────────────────────────────────────────────────────────────────

/** Server-internal ContentQube row (T0 fields included). */
export interface ContentQubeRow {
  id: string;
  series: string;
  content_kind: ContentQubeKind;
  content_type: ContentQubeContentType | string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: ContentQubeLifecycle;
  master_qube_id: string | null;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Server-internal storage row. */
export interface ContentQubeStorageRow {
  id: string;
  content_qube_id: string;
  storage_kind: ContentQubeStorageKind;
  storage_url: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  is_primary: boolean;
  content_state: ContentQubeContentState | null;
  encryption_iv: Uint8Array | null;
  encryption_auth_tag: Uint8Array | null;
  encryption_key_id: string | null;
  created_at: string;
}

/** Server-internal access policy row. price_qc is integer Q¢ cents ($1 = 100 Q¢). */
export interface ContentQubeAccessPolicyRow {
  id: string;
  content_qube_id: string;
  gating_kind: ContentQubeGatingKind;
  required_sku: string[];
  price_qc: number | null;
  min_identity_level: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable' | null;
  created_at: string;
  updated_at: string;
}

/** Directed edge between two content_qubes. */
export interface ContentQubeRelationshipRow {
  id: string;
  source_qube_id: string;
  target_qube_id: string;
  relationship_type: ContentQubeRelationshipType;
  relationship_meta: Record<string, unknown> | null;
  created_at: string;
}

/** Cartridge/tab surface binding. */
export interface ContentQubeCartridgeBindingRow {
  id: string;
  content_qube_id: string;
  codex_slug: string;
  tab_slug: string | null;
  display_order: number | null;
  context_meta: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Edition ledger row.
 * persona_id is T0 — NEVER included in browser-bound JSON.
 * base_token_id / chain_tx_hash set by Phase 7B TokenQube mint service.
 */
export interface ContentQubeEditionRow {
  id: string;
  content_qube_id: string;
  edition_number: number;
  rarity: ContentQubeRarity;
  /** T0 — server-internal only. Null = unissued edition. */
  persona_id: string | null;
  issued_at: string | null;
  base_token_id: string | null;
  chain_tx_hash: string | null;
  chain_minted_at: string | null;
  created_at: string;
}

/**
 * Version history row.
 * author_persona_id is T0 — NEVER included in browser-bound JSON.
 */
export interface ContentQubeVersionRow {
  id: string;
  content_qube_id: string;
  version: number;
  change_summary: string | null;
  snapshot_meta: Record<string, unknown> | null;
  /** T0 — server-internal only. */
  author_persona_id: string | null;
  created_at: string;
}

/**
 * DVN receipt row.
 * t2_alias_commitment is the only persona handle allowed here (T2 — public-network safe).
 * persona_id NEVER appears in this table.
 */
export interface ContentQubeDvnReceiptRow {
  id: string;
  content_qube_id: string;
  receipt_kind: ContentQubeDvnReceiptKind;
  /** T2 — hash(personaId + cohortId + salt). The only persona handle in receipts. */
  t2_alias_commitment: string | null;
  receipt_payload: Record<string, unknown>;
  anchored_at: string;
  icp_receipt_id: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Browser-safe types (T1-safe; no T0 fields)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Browser-safe display manifest emitted by resolveContentQube().
 * Contains no T0 fields (no personaId, authProfileId, rootDid).
 * Storage URLs are intentionally omitted — delivery routes provide signed
 * short-lived URLs on demand (Phase 2.3+).
 */
export interface ContentQubeDisplayManifest {
  id: string;
  series: string;
  content_kind: ContentQubeKind;
  content_type: ContentQubeContentType | string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: ContentQubeLifecycle;
  gating_kind: ContentQubeGatingKind;
  /** Price in Q¢ cents. Divide by 100 to get USD display value. */
  price_qc: number | null;
  storage_kinds: ContentQubeStorageKind[];
  rarity_counts: typeof CONTENT_QUBE_RARITY_COUNTS | null;
  /** True when this persona owns at least one edition. Resolved server-side. */
  persona_owns: boolean;
}

/**
 * Lightweight edition summary for display (no persona_id exposed).
 * Shows rarity distribution and mint status without identifying the holder.
 */
export interface ContentQubeEditionSummary {
  content_qube_id: string;
  total_editions: number;
  issued_count: number;
  available_count: number;
  rarity_breakdown: Record<ContentQubeRarity, { total: number; issued: number }>;
  chain_minted_count: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Input types for service layer
// ─────────────────────────────────────────────────────────────────────────

export interface CreateContentQubeInput {
  series: string;
  content_kind: ContentQubeKind;
  content_type: ContentQubeContentType | string;
  display_number?: number;
  title?: string;
  description?: string;
  lifecycle_state?: ContentQubeLifecycle;
  master_qube_id?: string;
  media_asset_id?: string;
}

export interface BindContentQubeToCartridgeInput {
  content_qube_id: string;
  codex_slug: string;
  tab_slug?: string;
  display_order?: number;
  context_meta?: Record<string, unknown>;
}

export interface ContentQubeAccessPolicyInput {
  content_qube_id: string;
  gating_kind: ContentQubeGatingKind;
  required_sku?: string[];
  price_qc?: number;
  min_identity_level?: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
}
