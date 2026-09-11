/**
 * Admin API: Upload Codex Media Asset
 *
 * POST /api/admin/codex/upload-asset
 *
 * Uploads covers, characters, lore docs, game media, social assets
 * to Autonomys and creates codex_media_assets entries.
 *
 * AUTHORIZATION REPAIR (2026-09-02): this route previously had NO auth
 * check at all ("URL-protected" by obscurity only — confirmed by reading
 * the route directly, not a claim from documentation). Both existing
 * browser callers (this app's CodexUploadModal.tsx and
 * apps/theqriptopian-web's own copy) already attach a real Supabase bearer
 * token when a session exists — this fix makes that ALREADY-SENT token do
 * something, rather than asking either caller to change how it calls this
 * route. The Threshold executor (services/threshold/uploadContentAsset.ts)
 * no longer calls this route via HTTP at all — it calls
 * handleCodexAssetUpload() directly, in-process, after its own Threshold
 * bearer authorization has already succeeded (see that file's own header).
 * See codexAssetUploadHandler.ts for the shared upload/validation logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { handleCodexAssetUpload, CodexAssetUploadError } from '@/services/content/codexAssetUploadHandler';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large uploads

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'admin required' }, { status: 403 });
    }

    const formData = await req.formData();
    const result = await handleCodexAssetUpload(formData);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CodexAssetUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[UploadAsset] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
