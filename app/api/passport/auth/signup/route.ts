/**
 * POST /api/passport/auth/signup — Polity Passport Bureau localized sign-on.
 *
 * Creates a REAL Supabase auth user with a synthetic email
 * (<username>@passport.metame.internal) + password, per operator decision 1.
 * The account flows through the canonical identity spine unchanged — no
 * parallel auth gate. After signup the client signs in with the returned
 * syntheticEmail + password via standard Supabase password auth, then calls
 * /api/passport/identity/bind with the Bearer token.
 *
 * The optional recoveryEmail is ACCOUNT-scope metadata only (PRD Addendum B
 * stub) — it is never passport data and never lands in passport tables.
 *
 * PRD §7.1, §9 step 1; implementation plan Stage 2.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBureauAuthUser,
  recoveryPolicyStub,
} from '@/services/passport/bureauIdentityService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const recoveryEmail =
      typeof body.recoveryEmail === 'string' && body.recoveryEmail.trim()
        ? body.recoveryEmail.trim()
        : null;

    const result = await createBureauAuthUser({ username, password, recoveryEmail });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.conflict ? 409 : 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      syntheticEmail: result.syntheticEmail,
      recoveryPolicy: recoveryPolicyStub(Boolean(recoveryEmail)),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Signup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
