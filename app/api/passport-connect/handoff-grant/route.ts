/**
 * POST /api/passport-connect/handoff-grant — mint the SECOND, application-
 * world session grant, requested ONLY after the Companion has already
 * redeemed its own first grant and holds a real Supabase session.
 *
 * PRD-PAG-001 Amendment A §A.3.2 increment 3 (P0.2 repair, operator-directed
 * 2026-08-21). `issuePassportSession()` used to mint two grants back-to-back
 * for the same email. Live evidence (Supabase Auth logs + direct inspection
 * of `auth.one_time_tokens`/`auth.users` on the connected project) proved a
 * `magiclink` grant for an existing user materializes in this project's
 * GoTrue as a single-slot `recovery_token` column — a second mint before the
 * first is redeemed silently overwrites it, so the first grant was dead on
 * arrival every time (100% of `/verify` attempts observed failed with
 * `otp_expired` / "One-time token not found"). This route replaces the
 * simultaneous second mint with a SEQUENTIAL one: it exists only to be
 * called after the Companion's own grant has already been spent.
 *
 * AUTHORITY comes ENTIRELY from the caller's own, already-established
 * Supabase Bearer session — verified here via `auth.getUser(token)` against
 * Supabase itself (never a locally-decoded, unverified JWT). No request body
 * is read at all: `authUserId`, `personaId`, `email`, a Passport id, RootDID
 * and KybeDID are all resolved SERVER-SIDE from that verified session,
 * exactly like every other passport-native entry point (ruling 8) — there is
 * nothing in the request for a caller to submit that could select a
 * different principal's grant.
 *
 * Reuses the SAME principal walk and the SAME single-mint function every
 * other passport-native entry point uses
 * (`resolvePassportPrincipalForAuthUser`, `issuePassportSession`) —
 * inv.engineering.036/037: no second, parallel authentication path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonClient } from '@/services/wallet/personaRepo';
import { resolvePassportPrincipalForAuthUser } from '@/services/identity/passportPrincipal';
import { issuePassportSession } from '@/services/identity/passportSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

/**
 * Strict verification only — no JWT-decode fallback. A forged or expired
 * bearer must refuse, never fall through to minting a grant.
 */
async function resolveVerifiedAuthUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  if (!token) return null;

  let supabase;
  try {
    supabase = getSupabaseAnonClient();
  } catch {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUserId = await resolveVerifiedAuthUserId(request);
  if (!authUserId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: noStore });
  }

  const principal = await resolvePassportPrincipalForAuthUser(authUserId);
  if (!principal.ok) {
    // Opaque, same anti-enumeration posture as /api/passport/passkey/auth-verify:
    // a caller with a real session but no active Passport learns nothing
    // more specific than the ordinary passport-native refusal.
    return NextResponse.json({ ok: false, error: 'no_constitutional_access' }, { status: 403, headers: noStore });
  }

  const session = await issuePassportSession(principal.principal);
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }

  // Only the single-use token hash — nothing T0, nothing already disclosed
  // by the first grant needs repeating here.
  return NextResponse.json({ ok: true, tokenHash: session.grant.tokenHash }, { headers: noStore });
}
