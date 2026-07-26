/**
 * POST /api/passport-connect/proof — spend the challenge, resolve the
 * constitutional principal, issue an application session.
 *
 * PRD-PAG-001 Amendment A §A.3, increment 5 (chartered 2026-07-26).
 *
 * The sequence, in the ruled order (§A.3.4):
 *
 *   holder proof → Passport resolution → personhood resolution → session
 *
 * Unauthenticated by design and by necessity — see /challenge. Authority comes
 * from three independent facts, all established here and none supplied by the
 * caller:
 *
 *   1. a signature over a server-issued, single-use, audience- and
 *      origin-bound challenge (proves control of a wallet NOW);
 *   2. that wallet's active binding to a personhood lineage;
 *   3. an ACTIVE Passport on that personhood.
 *
 * Presence of a credential in a wallet is never sufficient. A readable
 * credential is not a bearer token.
 *
 * FAILURE DISCLOSURE. Resolution failures collapse to one opaque reason. A
 * caller learning "this wallet is unknown" vs "this wallet has no Passport"
 * could probe the lineage graph with wallets it does not own. The server logs
 * the specific reason; the caller is told only that it cannot connect.
 */

import { NextRequest, NextResponse } from 'next/server';

import { verifyConnectionProof } from '@/services/passport/connectionChallenge';
import { resolvePassportPrincipal } from '@/services/identity/passportPrincipal';
import { issuePassportSession } from '@/services/identity/passportSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
  const message = typeof body?.message === 'string' ? body.message : '';
  const signature = typeof body?.signature === 'string' ? body.signature : '';
  const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
  if (!nonce || !message || !signature || !audience) {
    return NextResponse.json(
      { ok: false, error: 'nonce, message, signature and audience are required' },
      { status: 400, headers: noStore },
    );
  }

  // 1. HOLDER CONTROL. Spends the challenge whether or not the signature holds.
  const proof = await verifyConnectionProof({
    nonce,
    message,
    signature,
    audience,
    origin: request.nextUrl.origin,
  });
  if (!proof.ok) {
    const status = proof.reason === 'unavailable' ? 503 : 401;
    // Proof-shape failures ARE disclosed: they describe the caller's own
    // request, tell it nothing about anyone else, and a citizen whose
    // signature expired needs to know to retry.
    return NextResponse.json({ ok: false, error: proof.reason }, { status, headers: noStore });
  }

  // 2 + 3. PASSPORT AND PERSONHOOD, from the RECOVERED signer only.
  const resolved = await resolvePassportPrincipal(proof.walletAddress);
  if (!resolved.ok) {
    console.warn('[PassportConnect] principal unresolved:', resolved.reason);
    if (resolved.reason === 'unavailable') {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
    }
    // Deliberately opaque — see the header note on probing.
    return NextResponse.json(
      { ok: false, error: 'no_constitutional_access' },
      { status: 403, headers: noStore },
    );
  }

  // A step-up proof authorises an action; it does not open a session.
  if (proof.requestedAction === 'step_up') {
    return NextResponse.json(
      { ok: true, stepUp: true, passport: resolved.principal.passport },
      { headers: noStore },
    );
  }

  // 4. SESSION.
  const session = await issuePassportSession(resolved.principal);
  if (!session.ok) {
    console.warn('[PassportConnect] session mint failed:', session.reason);
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }

  // T0 law: nothing below names a persona, an auth profile, a root or a kybe.
  return NextResponse.json(
    { ok: true, tokenHash: session.grant.tokenHash, passport: session.grant.passport },
    { headers: noStore },
  );
}
