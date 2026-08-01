/**
 * GET /api/passport/passkey/credentials — the caller's OWN active passkeys.
 *
 * The durable-state read behind the enrolment surface (operator ruling,
 * 2026-08-02): a browser saying "this authenticator is already registered"
 * is not evidence that the PLATFORM holds a matching active record. This
 * route is what turns that browser-side claim into a verified one, so
 * "Passkey ready" is only ever shown when a credential really is bound to
 * the current principal.
 *
 * AUTHENTICATED and owner-scoped, resolved through the canonical caller
 * resolution (`getCallerIdentityContext`) exactly as the enrol routes are —
 * never a parallel resolver. It returns the caller's OWN credentials only,
 * as metadata: no credential ids, no public keys, nothing that would let a
 * caller enumerate or probe another principal's enrolment.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { listActivePasskeyCredentials } from '@/services/passport/passkeyService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerIdentityContext(request);
  if (!caller?.authUserId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: noStore });
  }

  const result = await listActivePasskeyCredentials(caller.authUserId);
  if (!result.ok) {
    // 503 + an explicit reason: the client must be able to tell "we could not
    // check" from "you have none", and must never render the former as the
    // latter.
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    { ok: true, count: result.credentials.length, credentials: result.credentials },
    { headers: noStore },
  );
}
