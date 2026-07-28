/**
 * GET /api/passport-connect/resolved-persona?transactionToken=... — the ONE
 * post-session self-view read that hands a citizen's own browser its own
 * chosen persona id, so their very first request after connecting is already
 * pinned to the persona they explicitly selected — never to
 * `getActivePersona`'s "first owned persona" fallback (ruling 2; the exact
 * mechanism behind the recorded "sometimes not showing one of my personas"
 * symptom, §A.10.3).
 *
 * ── WHY THIS IS BEARER-GATED, NOT PRE-SESSION ───────────────────────────────
 *
 * Unlike /challenge, /proof and /finalize, this route REQUIRES a valid
 * Bearer session — the one /finalize's `tokenHash` was just exchanged for via
 * `supabase.auth.verifyOtp`. This is the owner self-view exception CLAUDE.md
 * already carves out for the Identity & Access Spine ("a Bearer-scoped
 * self-view route MAY return the caller's own persona UUIDs... the client is
 * the sovereign surface where an owner decrypts and sees their own
 * BlakQube-secured data"): the raw persona id is T0 everywhere EXCEPT this
 * exact shape of route, and this route is that shape — a caller who can
 * already present a valid Bearer token reading their OWN just-established
 * session's own choice back.
 *
 * ── THE DOUBLE-CONSUMPTION GUARD ────────────────────────────────────────────
 *
 * The pending-auth row is already spent once by /finalize
 * (`consumed_at`). This route spends it a SECOND and LAST time
 * (`persona_activation_consumed_at`) — never a general-purpose lookup table,
 * never re-readable, and refuses if the caller's own Bearer `authUserId`
 * does not match the row's `authUserId` (defense against a stale token
 * leaking to an unrelated session and being replayed there).
 */

import { NextRequest, NextResponse } from 'next/server';

import { consumeResolvedPersona } from '@/services/identity/passportPendingAuth';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const transactionToken = request.nextUrl.searchParams.get('transactionToken') ?? '';
  if (!transactionToken) {
    return NextResponse.json({ ok: false, error: 'transactionToken required' }, { status: 400, headers: noStore });
  }

  // Bearer-scoped self-view — the ONE place in this pipeline that requires a
  // session, precisely because it exists to serve the citizen's OWN,
  // already-established session (the owner self-view exception).
  const caller = await getCallerIdentityContext(request);
  if (!caller?.authUserId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: noStore });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
  }

  const resolved = await consumeResolvedPersona(supabase, transactionToken);
  if (!resolved.ok) {
    const status = resolved.reason === 'unavailable' ? 503 : 404;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status, headers: noStore });
  }
  if (resolved.authUserId !== caller.authUserId) {
    // The Bearer session presenting this token is not the one the token was
    // minted for. Refuse — never hand one citizen's chosen persona id to
    // another session's caller.
    return NextResponse.json({ ok: false, error: 'caller_mismatch' }, { status: 403, headers: noStore });
  }

  return NextResponse.json({ ok: true, personaId: resolved.personaId }, { headers: noStore });
}
