/**
 * POST /api/passport/passkey/enrol-verify — complete passkey enrolment.
 *
 * PRD-PAG-001 Amendment A §A.6 level 2 (ratified 2026-07-27).
 *
 * AUTHENTICATED, same canonical caller resolution as enrol-options — the
 * credential binds to the RESOLVED auth user, never to anything the client
 * claims. Spine endpoint: browser callers use `personaFetch` only.
 *
 * The ceremony challenge is SPENT before the attestation is judged
 * (ruling 7) — a failed attestation still costs its nonce.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { completePasskeyEnrolment } from '@/services/passport/passkeyService';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerIdentityContext(request);
  if (!caller?.authUserId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: noStore });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
  const response = body?.response as RegistrationResponseJSON | undefined;
  const friendlyName = typeof body?.friendlyName === 'string' ? body.friendlyName : null;
  if (!audience || !response || typeof response !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'audience and response are required' },
      { status: 400, headers: noStore },
    );
  }

  const result = await completePasskeyEnrolment({
    authUserId: caller.authUserId,
    response,
    audience,
    /*
     * THE PUBLIC ORIGIN, NOT THE LAMBDA'S (operator, 2026-08-02).
     *
     * The panel reported "Passkeys aren't configured correctly for this
     * address, so one can't be created here." That classification was CORRECT:
     * the browser raised ERROR_INVALID_RP_ID / ERROR_INVALID_DOMAIN because
     * the RP ID the server put in the challenge did not match the page's own
     * domain.
     *
     * `request.nextUrl.origin` is the origin the LAMBDA saw. Behind Amplify's
     * CloudFront distribution that is the internal host, not
     * `dev-beta.aigentz.me` — and `rpIdFromOrigin()` takes its hostname
     * verbatim. So the challenge was minted for a relying party the browser
     * has never been on, and WebAuthn refused, correctly, every time.
     *
     * `resolveRequestOrigin` honours `x-forwarded-host`/`x-forwarded-proto`,
     * which is the same reason it already exists for agent-card URLs. A
     * relying-party id must be the domain the USER is on; nothing the server
     * sees internally can stand in for it.
     */
    origin: resolveRequestOrigin(request),
    friendlyName,
  });
  if (!result.ok) {
    const status = result.reason === 'unavailable' ? 503 : 400;
    return NextResponse.json({ ok: false, error: result.reason }, { status, headers: noStore });
  }

  // The credential id is authenticator-minted and already held by this
  // browser — returning it discloses nothing new. No T0 identifier.
  return NextResponse.json({ ok: true, credentialId: result.credentialId }, { headers: noStore });
}
