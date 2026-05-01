/**
 * Admin API: Patch codex asset metadata
 *
 * PATCH /api/admin/codex/asset-metadata
 *
 * Edits the editable fields on either `codex_media_assets` (covers, characters,
 * lore, game, social) or `master_content_qubes` (episode masters). The Auto-Drive
 * CID is content-addressed and immutable; only the Supabase row changes.
 *
 * Body:
 *   {
 *     id: string,
 *     table: 'codex_media_assets' | 'master_content_qubes',
 *     title?: string | null,
 *     rarityTier?: 'common'|'rare'|'epic'|'legendary' | null,   // codex_media_assets
 *     variantName?: string | null,                              // codex_media_assets
 *     editionTier?: 'common'|'rare'|'epic'|'legendary' | null,  // master_content_qubes
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TABLES = ['codex_media_assets', 'master_content_qubes'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const ALLOWED_TIERS = ['common', 'rare', 'epic', 'legendary'] as const;
type Tier = typeof ALLOWED_TIERS[number];

interface PatchBody {
  id?: unknown;
  table?: unknown;
  title?: unknown;          // deprecated — kept for backwards compat (now writes supabase_title)
  supabaseTitle?: unknown;  // editable display title used by app
  rarityTier?: unknown;
  variantName?: unknown;
  editionTier?: unknown;
  status?: unknown;         // 'active' | 'archived'
}

const ALLOWED_STATUSES = ['active', 'archived'] as const;

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (ALLOWED_TIERS as readonly string[]).includes(v);
}

export async function PATCH(req: NextRequest) {
  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.id !== 'string' || !body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (typeof body.table !== 'string' || !(ALLOWED_TABLES as readonly string[]).includes(body.table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }
  const table = body.table as AllowedTable;

  const updates: Record<string, unknown> = {};

  // Editable display title — writes to supabase_title (auto-drive title is locked).
  // Accept legacy 'title' field too for backwards compat — but route it to supabase_title.
  const titleInput = body.supabaseTitle !== undefined ? body.supabaseTitle : body.title;
  if (titleInput !== undefined) {
    if (titleInput !== null && typeof titleInput !== 'string') {
      return NextResponse.json({ error: 'title must be a string or null' }, { status: 400 });
    }
    updates.supabase_title = titleInput;
  }

  // Archive / unarchive
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (table === 'codex_media_assets') {
    if (body.rarityTier !== undefined) {
      if (body.rarityTier !== null && !isTier(body.rarityTier)) {
        return NextResponse.json({ error: `rarityTier must be one of: ${ALLOWED_TIERS.join(', ')}` }, { status: 400 });
      }
      updates.rarity_tier = body.rarityTier;
    }
    if (body.variantName !== undefined) {
      if (body.variantName !== null && typeof body.variantName !== 'string') {
        return NextResponse.json({ error: 'variantName must be a string or null' }, { status: 400 });
      }
      updates.variant_name = body.variantName;
    }
  } else {
    if (body.editionTier !== undefined) {
      if (body.editionTier !== null && !isTier(body.editionTier)) {
        return NextResponse.json({ error: `editionTier must be one of: ${ALLOWED_TIERS.join(', ')}` }, { status: 400 });
      }
      updates.edition_tier = body.editionTier;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase unavailable' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('[asset-metadata] update failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[asset-metadata] exception', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    );
  }
}
