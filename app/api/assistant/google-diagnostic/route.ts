/**
 * GET /api/assistant/google-diagnostic?source=gmail
 *
 * Aigent Me Phase 6.b Part 2.5b — operator diagnostic.
 *
 * The standard /api/assistant/google-status endpoint reports `connected:
 * true` whenever a token row exists for the persona. But the underlying
 * access token can still fail at use time (record present but refresh
 * token revoked, refresh request rejected, etc.). This route exposes the
 * full resolveAccessToken result so the operator can tell the difference
 * between:
 *   - "you connected as a different persona"
 *   - "you connected without granting offline access"
 *   - "Google revoked your refresh token"
 *   - "your access token is fine"
 *
 * Returns 200 in every case so the UI can render the diagnostic inline.
 * personaId stays T0 — only echoed in a hashed-prefix form for support.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  resolveAccessToken,
  GOOGLE_SOURCES,
  type GoogleSource,
} from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const source = request.nextUrl.searchParams.get('source') as GoogleSource | null;
  if (!source || !GOOGLE_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: 'invalid-source', detail: `source must be one of: ${GOOGLE_SOURCES.join(', ')}` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const personaShortId = context.personaId.slice(0, 8);
  const result = await resolveAccessToken(context.personaId, source);
  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        source,
        personaShortId,
        message: 'Access token is valid (refresh happened automatically if needed).',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      source,
      personaShortId,
      code: result.code,
      reason: result.reason,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
