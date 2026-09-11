/**
 * Admin API: Register a completed Supabase Storage upload in the DB
 *
 * POST /api/admin/codex/storage/register
 *
 * Called by the browser after a successful direct PUT to the signed URL.
 * Inserts into codex_media_assets or master_content_qubes with the public URL
 * stored in auto_drive_cid (provider-agnostic string identifier field) and
 * encryption_iv set to '' to mark the row as unencrypted Supabase content
 * (content fetch routes detect this and proxy to the URL directly).
 *
 * AUTHORIZATION REPAIR (2026-09-02): this route previously had NO auth
 * check at all. Both existing callers (this app's CodexUploadModal.tsx and
 * apps/theqriptopian-web's own copy) already attach a real Supabase bearer
 * token when a session exists — this fix makes that already-sent token do
 * something, rather than asking either caller to change how it calls this
 * route. See codexStorageRegisterHandler.ts for the shared register logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { handleCodexStorageRegister, CodexStorageRegisterError } from '@/services/content/codexStorageRegisterHandler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'admin required' }, { status: 403 });
    }

    const body = await req.json();
    const result = await handleCodexStorageRegister(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CodexStorageRegisterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error)?.message || 'Register failed' }, { status: 500 });
  }
}
