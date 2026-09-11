/**
 * Admin API: Sign a Supabase Storage upload URL
 *
 * POST /api/admin/codex/storage/sign
 *
 * Returns a signed upload URL the browser can PUT to directly, bypassing
 * the Lambda body-size limit entirely (handles 300-500 MB files).
 * The browser then calls /storage/register once the PUT completes.
 *
 * AUTHORIZATION REPAIR (2026-09-02): this route previously had NO auth
 * check at all — the most severe of the three related routes fixed this
 * session, since it hands out a signed Storage WRITE capability (and an
 * `existingPath` overwrite of an arbitrary object) to any caller.
 * CodexUploadModal.tsx already attaches a real Supabase bearer token on
 * this exact call unconditionally — this fix makes that token do
 * something. See services/content/codexStorageSignHandler.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { handleCodexStorageSign, CodexStorageSignError } from '@/services/content/codexStorageSignHandler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'admin required' }, { status: 403 });
    }

    const body = await req.json();
    const result = await handleCodexStorageSign(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CodexStorageSignError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error)?.message || 'Sign failed' }, { status: 500 });
  }
}
