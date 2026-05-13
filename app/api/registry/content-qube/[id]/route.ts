/**
 * GET /api/registry/content-qube/[id]
 *
 * ContentQube registry read endpoint. Phase 3 of the ContentQube integration.
 *
 * Returns a browser-safe ContentQubeDisplayManifest derived from the
 * v_content_qube_registry VIEW. T0 fields (persona_id, author_persona_id)
 * are never present in the view, so the manifest is safe to emit directly.
 *
 * Phase 4 will compose this with services/access/evaluateAccess to set
 * persona_owns and to enforce gating before returning any storage hints.
 * For now, persona_owns is conservatively false and storage URLs are not
 * exposed — delivery still goes through the existing content proxy routes.
 *
 * Auth:
 *   Public read (mirrors /api/registry/assets/[assetId]). The view contains
 *   no persona-bound data and no raw storage URLs are emitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  CONTENT_QUBE_RARITY_COUNTS,
  type ContentQubeContentType,
  type ContentQubeDisplayManifest,
  type ContentQubeGatingKind,
  type ContentQubeKind,
  type ContentQubeLifecycle,
  type ContentQubeRarity,
  type ContentQubeStorageKind,
} from '@/types/contentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegistryViewRow {
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
  primary_mime_type: string | null;
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

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('v_content_qube_registry')
    .select('*')
    .eq('id', id)
    .maybeSingle<RegistryViewRow>();

  if (error) {
    console.error('[registry/content-qube] view error:', error);
    return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'ContentQube not found' }, { status: 404 });
  }

  const manifest: ContentQubeDisplayManifest = {
    id: data.id,
    series: data.series,
    content_kind: data.content_kind,
    content_type: data.content_type as ContentQubeContentType | string,
    display_number: data.display_number,
    title: data.title,
    description: data.description,
    lifecycle_state: data.lifecycle_state,
    gating_kind: data.gating_kind ?? 'free',
    price_qc: data.price_qc,
    storage_kinds: data.storage_kinds ?? [],
    rarity_counts: data.total_editions > 0 ? CONTENT_QUBE_RARITY_COUNTS : null,
    // Phase 4 wires evaluateAccess(); for now never claim ownership.
    persona_owns: false,
  };

  const editionSummary = {
    content_qube_id: data.id,
    total_editions: data.total_editions,
    issued_count: data.issued_count,
    available_count: Math.max(0, data.total_editions - data.issued_count),
    rarity_breakdown: {
      legendary: { total: data.legendary_count, issued: 0 },
      epic: { total: data.epic_count, issued: 0 },
      rare: { total: data.rare_count, issued: 0 },
      secret_black_rare: { total: data.secret_black_rare_count, issued: 0 },
    } as Record<ContentQubeRarity, { total: number; issued: number }>,
    chain_minted_count: data.chain_minted_count,
  };

  return NextResponse.json({
    ok: true,
    data: {
      manifest,
      editionSummary,
      codexSlugs: data.codex_slugs ?? [],
    },
  });
}
