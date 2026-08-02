/**
 * POST /api/passport/passkey/enrol-options — begin passkey enrolment.
 *
 * PRD-PAG-001 Amendment A §A.6 level 2 (ratified 2026-07-27). "Additional
 * passkey enrolment is optional for ordinary access; cryptographic
 * holder-control proof is not optional; step-up is mandatory where
 * consequence requires it."
 *
 * AUTHENTICATED — a passkey binds to the holder's principal, so enrolment
 * runs on an established session, resolved through the CANONICAL caller
 * resolution (`getCallerIdentityContext`) — never a parallel resolver. This
 * is a spine endpoint: browser callers reach it via `personaFetch` only.
 *
 * The challenge comes from the single-use store (ruling 7); the origin is
 * server-determined, never body-supplied.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { beginPasskeyEnrolment } from '@/services/passport/passkeyService';
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
  if (!audience) {
    return NextResponse.json({ ok: false, error: 'audience required' }, { status: 400, headers: noStore });
  }

  const result = await beginPasskeyEnrolment({
    authUserId: caller.authUserId,
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
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 503, headers: noStore });
  }

  // The options JSON carries only what WebAuthn needs: the challenge, the rp,
  // and an opaque one-way user-handle commitment. No T0 identifier.
  return NextResponse.json(
    { ok: true, options: result.options, expiresAt: result.expiresAt },
    { headers: noStore },
  );
}
