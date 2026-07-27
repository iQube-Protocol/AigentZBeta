/**
 * POST /api/passport/passkey/auth-options — begin passkey unlock.
 *
 * PRD-PAG-001 Amendment A §A.6 level 2 (ratified 2026-07-27).
 *
 * PRE-SESSION by design, like /api/passport-connect/challenge: a passkey
 * unlock exists to ESTABLISH the session, so it must never require one
 * (ruling 8 — no personaId, authProfileId or didPersonaId in the contract).
 * It is safe unauthenticated because it grants nothing: a challenge and the
 * request options. Every check that matters happens at auth-verify, against
 * a challenge that can be spent exactly once.
 *
 * Discoverable credentials only — the browser offers the holder their own
 * passkeys; the server never enumerates credential ids for a claimed
 * identity, which would let anyone probe who has enrolled.
 */

import { NextRequest, NextResponse } from 'next/server';

import { beginPasskeyAuthentication } from '@/services/passport/passkeyService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
  if (!audience) {
    return NextResponse.json({ ok: false, error: 'audience required' }, { status: 400, headers: noStore });
  }

  const result = await beginPasskeyAuthentication({
    audience,
    // Server-determined, never body-supplied — same rule as the wallet
    // challenge route.
    origin: request.nextUrl.origin,
  });
  if (!result.ok) {
    // Fails CLOSED: no store, no challenge, never a stateless fallback nonce.
    return NextResponse.json({ ok: false, error: result.reason }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    { ok: true, options: result.options, expiresAt: result.expiresAt },
    { headers: noStore },
  );
}
