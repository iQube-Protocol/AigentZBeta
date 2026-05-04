/**
 * Admin API: Post-replace cleanup for Supabase-hosted content
 *
 * POST /api/admin/codex/storage/post-replace
 *
 * Called after the browser successfully overwrites a Supabase Storage object
 * via a signed upload URL pointing at the existing path. The blob is replaced
 * in place but downstream derivatives (rendered PDF page images, file_size,
 * pages_ready flag) need to be invalidated so they regenerate from the new
 * bytes on the next request.
 *
 * Auto-Drive items are immutable — this endpoint refuses to operate on rows
 * whose auto_drive_cid is a real CID (does not start with http(s)).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetId,
      table,
      fileSize,
      mimeType,
    } = body as {
      assetId: string;
      table: 'master_content_qubes' | 'codex_media_assets';
      fileSize?: number;
      mimeType?: string;
    };

    if (!assetId || !table) {
      return NextResponse.json({ error: 'Missing assetId or table' }, { status: 400 });
    }
    if (table !== 'master_content_qubes' && table !== 'codex_media_assets') {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Read the current row to verify it's a Supabase-hosted asset (cid is a URL).
    const { data: row, error: readError } = await supabase
      .from(table)
      .select('id, auto_drive_cid')
      .eq('id', assetId)
      .single();

    if (readError || !row) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const cid = row.auto_drive_cid as string | null;
    const isUrl = typeof cid === 'string' && (cid.startsWith('http://') || cid.startsWith('https://'));
    if (!isUrl) {
      return NextResponse.json(
        { error: 'Cannot replace: asset is canonical (Auto-Drive). Replace is only allowed on Supabase-hosted WIP content.' },
        { status: 409 }
      );
    }

    // Drop any pre-rendered page-image manifests keyed by the old auto_drive_cid
    // so the page-renderer regenerates them from the new bytes on next request.
    // The blob URL is unchanged (overwrite at same path), but the bytes differ
    // and the rendered images are stale.
    await supabase
      .from('pdf_page_manifests')
      .delete()
      .eq('auto_drive_cid', cid);

    // Reset derivative state on the row + bump updated_at.
    const updates: Record<string, unknown> = {
      pages_ready: false,
      pages_count: null,
      updated_at: new Date().toISOString(),
    };
    if (typeof fileSize === 'number' && fileSize >= 0) updates.file_size = fileSize;
    if (mimeType) updates.mime_type = mimeType;

    const { error: updateError } = await supabase
      .from(table)
      .update(updates)
      .eq('id', assetId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: assetId });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || 'Post-replace failed' }, { status: 500 });
  }
}
