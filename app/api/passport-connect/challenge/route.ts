/**
 * POST /api/passport-connect/challenge — issue a holder-control challenge.
 *
 * PRD-PAG-001 Amendment A §A.3.4, increment 5 (chartered 2026-07-26).
 *
 * THE ONE ROUTE IN THIS CODEBASE THAT MUST NOT AUTHENTICATE ITS CALLER.
 * That is the point: *do not require an account session in order to prove the
 * Passport that is intended to establish the account session.* A
 * `getActivePersona` call here would rebuild the circular dependency Amendment
 * A exists to remove.
 *
 * It is safe unauthenticated because it grants nothing. It returns a nonce and
 * a message to sign; every check that matters happens at /proof, against a
 * challenge that can be spent exactly once.
 *
 * The origin is taken from the REQUEST, never from the body — a caller must not
 * be able to nominate the origin its own signature will be valid for.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  issueConnectionChallenge,
  type RequestedAction,
} from '@/services/passport/connectionChallenge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
  if (!audience) {
    return NextResponse.json({ ok: false, error: 'audience required' }, { status: 400, headers: noStore });
  }

  const requestedAction: RequestedAction = body?.requestedAction === 'step_up' ? 'step_up' : 'connect';
  const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress : undefined;

  const challenge = await issueConnectionChallenge({
    audience,
    // Server-determined. A body-supplied origin would let a caller mint a
    // challenge valid for a site it does not control.
    origin: request.nextUrl.origin,
    requestedAction,
    walletAddress,
  });

  if (!challenge) {
    // Fails CLOSED: no store, no challenge. Never a stateless fallback nonce.
    return NextResponse.json({ ok: false, error: 'challenge_unavailable' }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    {
      ok: true,
      nonce: challenge.nonce,
      message: challenge.message,
      provisionalConnectionId: challenge.provisionalConnectionId,
      audience: challenge.audience,
      origin: challenge.origin,
      requestedAction: challenge.requestedAction,
      expiresAt: challenge.expiresAt,
    },
    { headers: noStore },
  );
}
