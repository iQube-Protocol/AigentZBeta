/**
 * Connector action endpoint for native binary file uploads
 *
 * This endpoint accepts multipart/form-data with native binary files (not base64)
 * and is designed for ChatGPT, Claude actions, and other connector runtimes.
 *
 * It validates admin privileges via Constitutional Handshake bearer token,
 * then streams the bytes to the canonical /api/content/assets/upload endpoint.
 *
 * Auth flow:
 * - Client sends: Authorization: Bearer <constitutional_handshake_token>
 * - This endpoint validates the token and checks cartridgeFlags.isAdmin (canonical)
 * - If authorized, constructs FormData with native binary and forwards to /api/content/assets/upload
 * - That endpoint then calls getActivePersona on the forwarded request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES = new Set(['cover', 'thumbnail', 'hero', 'social', 'pdf', 'video', 'audio', 'attachment']);

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const fileName = typeof form.get('fileName') === 'string' ? form.get('fileName') : null;
    const domain = typeof form.get('domain') === 'string' ? form.get('domain') : null;
    const role = typeof form.get('role') === 'string' ? form.get('role') : null;
    const contentId = typeof form.get('contentId') === 'string' ? form.get('contentId') : null;
    const bind = form.get('bind') !== 'false';

    if (!file || !fileName || !domain || !role) {
      return NextResponse.json({ error: 'missing-required-params' }, { status: 400 });
    }
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: 'invalid-role', allowed: [...ROLES] }, { status: 400 });
    }

    // Stream the native binary file directly to /api/content/assets/upload
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('fileName', fileName);
    uploadForm.append('domain', domain);
    uploadForm.append('role', role);
    if (contentId) {
      uploadForm.append('contentId', contentId);
    }
    uploadForm.append('bind', bind ? 'true' : 'false');

    // Forward the request with the original Authorization header so getActivePersona works
    const authHeader = req.headers.get('authorization');
    const uploadUrl = `${req.nextUrl.origin}/api/content/assets/upload`;
    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadForm,
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      return NextResponse.json(
        { error: 'upload-failed', message: `${uploadResp.status} ${uploadResp.statusText}` },
        { status: uploadResp.status }
      );
    }

    const result = await uploadResp.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'upload-failed' },
      { status: 500 }
    );
  }
}
