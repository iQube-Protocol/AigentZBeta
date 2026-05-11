/**
 * POST /api/assistant/disconnect-google
 *
 * Aigent Me Phase 6.b — revoke + delete the token row for (persona, source).
 * Best-effort revoke at Google's revoke endpoint; row deletion is the
 * authoritative disconnect.
 *
 * Body: { source: 'gmail' | 'calendar' | 'drive' | 'docs' | 'slides' }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  disconnectSource,
  GOOGLE_SOURCES,
  type GoogleSource,
} from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

interface PostBody {
  source?: GoogleSource;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  let raw: unknown;
  try { raw = await request.json(); } catch { raw = {}; }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.source || !GOOGLE_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: 'invalid-source' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const result = await disconnectSource({
      personaId: context.personaId,
      source: body.source,
    });
    return NextResponse.json(
      { ok: result.ok, source: body.source },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'disconnect-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
