/**
 * buildDisplayManifest — pure function that converts a v_content_qube_registry
 * VIEW row into a browser-safe ContentQubeDisplayManifest.
 *
 * No DB access. No identity reads. Just type mapping.
 * Callers (resolveContentQube, the registry API route) supply the row and
 * the already-resolved persona_owns flag.
 *
 * Privacy contract: the view row never carries persona_id or author_persona_id.
 * The manifest output is T1-safe by construction — no T0 fields are present.
 */

import {
  CONTENT_QUBE_RARITY_COUNTS,
  type ContentQubeContentType,
  type ContentQubeDisplayManifest,
  type ContentQubeEditionSummary,
  type ContentQubeGatingKind,
  type ContentQubeKind,
  type ContentQubeLifecycle,
  type ContentQubeRarity,
  type ContentQubeStorageKind,
} from '@/types/contentQube';
import type { ContentClass, ContentGatingDescriptor, ContentState, GatingKind } from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Row shape from v_content_qube_registry — exported so callers can type
// their Supabase response without duplicating the interface.
// ─────────────────────────────────────────────────────────────────────────

export interface RegistryViewRow {
  id: string;
  series: string;
  content_kind: ContentQubeKind;
  content_type: string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: ContentQubeLifecycle;
  master_qube_id: string | null;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
  gating_kind: ContentQubeGatingKind | null;
  required_sku: string[] | null;
  price_qc: number | null;
  min_identity_level: string | null;
  primary_storage_kind: ContentQubeStorageKind | null;
  primary_storage_url: string | null;
  primary_mime_type: string | null;
  primary_file_size_bytes: number | null;
  primary_content_state: string | null;
  storage_kinds: ContentQubeStorageKind[] | null;
  total_editions: number;
  issued_count: number;
  chain_minted_count: number;
  legendary_count: number;
  epic_count: number;
  rare_count: number;
  secret_black_rare_count: number;
  codex_slugs: string[] | null;
}

// ─────────────────────────────────────────────────────────────────────────
// ContentClass mapping (content_kind + content_type → access.ContentClass)
// ─────────────────────────────────────────────────────────────────────────

export function toContentClass(row: Pick<RegistryViewRow, 'content_kind' | 'content_type'>): ContentClass {
  switch (row.content_kind) {
    case 'gn': return 'gn';
    case 'character': return 'character_card';
    case 'lore_scroll':
    case 'powers_sheet': return 'lore';
    case 'episode':
      switch (row.content_type) {
        case 'episode_still':  return 'episode_still';
        case 'episode_motion': return 'episode_motion';
        case 'episode_print':  return 'episode_print';
        default:               return 'other';
      }
    default: return 'other';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GatingKind bridge: ContentQubeGatingKind → access.GatingKind
// ─────────────────────────────────────────────────────────────────────────

export function toAccessGatingKind(gk: ContentQubeGatingKind | null): GatingKind {
  switch (gk) {
    case 'free':         return 'free';
    case 'subscription': return 'credential';
    case 'owned':
    case 'sku_required':
    default:             return 'payment';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ContentState synthesis for un-bridged rows (no master_qube_id /
// media_asset_id yet — pre-Phase 6 pilot).
// ─────────────────────────────────────────────────────────────────────────

export function synthesizeContentState(row: Pick<RegistryViewRow, 'gating_kind' | 'primary_content_state'>): ContentState {
  const gk = row.gating_kind ?? 'free';
  if (gk === 'free') {
    // No encryption metadata in the view; default to A (open, unqubed).
    return 'A_open_unqubed';
  }
  // Gated — infer from stored content_state when available.
  const stored = row.primary_content_state;
  if (stored === 'D') return 'D_gated_canonical_pool';
  if (stored === 'E') return 'E_gated_canonical_sovereign';
  return 'C_gated_wip';
}

// ─────────────────────────────────────────────────────────────────────────
// Synthesize a minimal ContentGatingDescriptor from the access policy row.
// Used when there is no linked master_qube_id / media_asset_id to pass to
// getContentDescriptor. The descriptor is sufficient for evaluateAccess to
// make a correct allow/deny decision.
// ─────────────────────────────────────────────────────────────────────────

export function synthesizeGatingDescriptor(row: RegistryViewRow): ContentGatingDescriptor {
  const kind = toAccessGatingKind(row.gating_kind);
  const descriptor: ContentGatingDescriptor = { kind };
  if (row.price_qc != null) {
    descriptor.priceUsd = row.price_qc / 100;
  }
  return descriptor;
}

// ─────────────────────────────────────────────────────────────────────────
// Edition summary (no persona identifiers — T1-safe)
// ─────────────────────────────────────────────────────────────────────────

export function buildEditionSummary(row: RegistryViewRow): ContentQubeEditionSummary {
  return {
    content_qube_id: row.id,
    total_editions: row.total_editions,
    issued_count: row.issued_count,
    available_count: Math.max(0, row.total_editions - row.issued_count),
    rarity_breakdown: {
      legendary:         { total: row.legendary_count,         issued: 0 },
      epic:              { total: row.epic_count,              issued: 0 },
      rare:              { total: row.rare_count,              issued: 0 },
      secret_black_rare: { total: row.secret_black_rare_count, issued: 0 },
    } as Record<ContentQubeRarity, { total: number; issued: number }>,
    chain_minted_count: row.chain_minted_count,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Main builder — call after resolving persona_owns
// ─────────────────────────────────────────────────────────────────────────

export function buildDisplayManifest(
  row: RegistryViewRow,
  personaOwns: boolean,
): ContentQubeDisplayManifest {
  return {
    id: row.id,
    series: row.series,
    content_kind: row.content_kind,
    content_type: row.content_type as ContentQubeContentType | string,
    display_number: row.display_number,
    title: row.title,
    description: row.description,
    lifecycle_state: row.lifecycle_state,
    gating_kind: row.gating_kind ?? 'free',
    price_qc: row.price_qc,
    storage_kinds: row.storage_kinds ?? [],
    rarity_counts: row.total_editions > 0 ? CONTENT_QUBE_RARITY_COUNTS : null,
    persona_owns: personaOwns,
  };
}
