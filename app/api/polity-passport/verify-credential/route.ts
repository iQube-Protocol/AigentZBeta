/**
 * POST /api/polity-passport/verify-credential
 *
 * DiDQube Phase 5 item 1 / Phase 5.1c (2026-09-11) — public asymmetric VC
 * verification. Unauthenticated, mirroring `verify/[type]`'s own "external
 * counsel/partners verify without spine auth" precedent. Composes
 * `verifyPassportCredentialWithLifecycle` (Phase 5.1b): the signature +
 * key-authorization-at-issuance-time check (`verifyPassportCredential`) plus
 * DB-backed lifecycle facts (revoked / superseded) for the Passport row the
 * submitted credential names.
 *
 * Request:  { credential: <the full W3C-VC-shaped envelope> }
 * Response: verification OUTCOME only — never the credential body, never any
 * T0 identifier. Per CI-2026-09-07-PASSPORT-ID-PRIVACY-SENSITIVE-NOT-PUBLIC-001
 * (passport_id is holder-visible but circulation-minimized — must not be
 * emitted into an unauthenticated public projection), `superseded` here is a
 * BOOLEAN (was this credential's Passport superseded — yes/no), never the
 * successor's raw passport_id, even though `verifyPassportCredentialWithLifecycle`
 * itself (a more general, internal composition) carries the raw
 * `supersededBy` reference for callers that are themselves authenticated.
 *
 * Rate-limited via system_rate_limits (key: 'polity-passport:verify-credential',
 * scope: 'ip') — the same reusable limiter `referral/resolve-code` uses;
 * fails open (allow) when no limit is configured, exactly like every other
 * caller of `checkAndConsumeRateLimit`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkAndConsumeRateLimit, getClientIp } from '@/services/rateLimit/rateLimitService';
import { verifyPassportCredentialWithLifecycle } from '@/services/passport/passportCredentialVerification';

export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rl = await checkAndConsumeRateLimit({
      endpointKey: 'polity-passport:verify-credential',
      scope: 'ip',
      scopeValue: clientIp,
    });
    if (!rl.allowed) {
      return withCors(
        NextResponse.json(
          { ok: false, error: 'rate-limited', retryAfterSeconds: rl.retryAfterSeconds },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
        ),
      );
    }

    const body = (await req.json().catch(() => ({}))) as { credential?: unknown };
    const credential = body.credential;
    if (!isRecord(credential)) {
      return withCors(NextResponse.json({ ok: false, error: 'credential (object) required' }, { status: 400 }));
    }
    const credentialSubject = credential.credentialSubject;
    const passportId = isRecord(credentialSubject) ? credentialSubject.passportId : undefined;
    if (typeof passportId !== 'string' || !/^[a-z0-9-]{4,80}$/i.test(passportId)) {
      return withCors(
        NextResponse.json({ ok: false, error: 'credential.credentialSubject.passportId is missing or malformed' }, { status: 400 }),
      );
    }

    const admin = getSupabaseServer();
    if (!admin) return withCors(NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 }));

    // Lifecycle facts (Phase 5.1b): the caller-independent DB read this
    // verification module deliberately does NOT perform itself.
    const { data: recordRow } = await admin
      .from('polity_passport_records')
      .select('revoked')
      .eq('passport_id', passportId)
      .maybeSingle();
    const recordFound = !!recordRow;
    const revoked = recordFound ? Boolean((recordRow as { revoked: boolean }).revoked) : false;

    // Reverse direction of renewal_of_passport_id — has some OTHER passport
    // named this one as its predecessor?
    const { data: successorRow } = await admin
      .from('polity_passport_records')
      .select('passport_id')
      .eq('renewal_of_passport_id', passportId)
      .maybeSingle();
    const supersededBy = successorRow ? String((successorRow as { passport_id: string }).passport_id) : null;

    const result = verifyPassportCredentialWithLifecycle(credential, { revoked, supersededBy });

    return withCors(
      NextResponse.json({
        ok: true,
        valid: result.signature.valid,
        reason: result.signature.valid === false ? result.signature.reason : undefined,
        suite: result.signature.valid !== false ? result.signature.suite : undefined,
        keyId: result.signature.valid !== false ? result.signature.keyId : undefined,
        revoked: result.revoked,
        // Boolean only — never the successor's raw passport_id in this
        // PUBLIC, unauthenticated response (see module doc comment above).
        superseded: result.supersededBy !== null,
        presentable: result.presentable,
        recordFound,
      }),
    );
  } catch (e) {
    return withCors(
      NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Verification failed' }, { status: 500 }),
    );
  }
}
