/**
 * POST /api/passport/passkey/auth-verify — complete passkey unlock, issue an
 * application session.
 *
 * PRD-PAG-001 Amendment A §A.6 level 2 (ratified 2026-07-27).
 *
 * PRE-SESSION, like /api/passport-connect/proof. Authority comes from facts
 * established here, none supplied by the caller:
 *
 *   1. a WebAuthn assertion over a server-issued, single-use, audience- and
 *      origin-bound challenge (cryptographic holder-control, level 2);
 *   2. the credential's SERVER-SIDE binding to an internal principal;
 *   3. an ACTIVE Passport on that principal's personhood lineage.
 *
 * Possession of a passkey is never constitutional access by itself.
 *
 * FAILURE DISCLOSURE mirrors the proof route: challenge-shape failures are
 * disclosed (they describe the caller's own request); resolution failures
 * collapse to one opaque reason so a caller cannot probe which credentials
 * exist or which principals hold Passports. The server logs the specifics.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

import { completePasskeyAuthentication } from '@/services/passport/passkeyService';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
  const response = body?.response as AuthenticationResponseJSON | undefined;
  if (!audience || !response || typeof response !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'audience and response are required' },
      { status: 400, headers: noStore },
    );
  }

  const result = await completePasskeyAuthentication({
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
  });

  if (!result.ok) {
    console.warn('[PassportPasskey] unlock failed:', result.reason);
    if (result.reason === 'unavailable' || result.reason === 'session_unavailable') {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
    }
    if (result.reason === 'challenge_rejected') {
      // Describes the caller's own request (expired / already spent / wrong
      // binding); a citizen whose ceremony timed out needs to know to retry.
      return NextResponse.json({ ok: false, error: 'challenge_rejected' }, { status: 401, headers: noStore });
    }
    // credential_unknown / verification_failed / no_constitutional_access all
    // collapse — deliberately opaque, see the header note on probing.
    return NextResponse.json(
      { ok: false, error: 'no_constitutional_access' },
      { status: 403, headers: noStore },
    );
  }

  // T0 law: nothing below names a persona, an auth profile, a root or a kybe.
  // Same grant shape as the wallet path — a single-use token hash plus
  // T2-safe passport facts. The application-world handoff grant is no
  // longer minted here (P0.2, 2026-08-21) — the client requests it
  // separately, AFTER redeeming this grant, via
  // POST /api/passport-connect/handoff-grant.
  return NextResponse.json(
    {
      ok: true,
      tokenHash: result.grant.tokenHash,
      passport: result.grant.passport,
    },
    { headers: noStore },
  );
}
