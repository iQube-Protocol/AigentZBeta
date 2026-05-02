/**
 * GET /api/admin/store-skus/bundle-image-options
 *
 * Returns the active bundle_pack assets the operator can select as a SKU's
 * hero image. Used by StoreSkusPanel to populate the per-row image dropdown.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ options: [] });
  }

  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('id, title, supabase_title, cover_thumb_url, auto_drive_cid')
    .eq('asset_kind', 'bundle_pack')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ options: [], error: error.message }, { status: 500 });
  }

  const options = (data ?? []).map((row) => ({
    id: row.id,
    label: row.supabase_title ?? row.title ?? row.id,
    thumbUrl: row.cover_thumb_url ??
      (row.auto_drive_cid ? `/api/content/cover/${encodeURIComponent(row.auto_drive_cid as string)}` : null),
  }));

  return NextResponse.json({ options });
}
