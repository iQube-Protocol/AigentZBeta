/**
 * POST /api/passport-connect/finalize — spend the pending-auth transaction,
 * validate the citizen's persona choice, mint the application session.
 *
 * PRD-PAG-001 Amendment A, first-connection closure (operator ruling
 * 2026-07-28, ruling 2). The second half of the ordering /proof's header
 * documents:
 *
 *   [pending-auth transaction + persona choices] → THIS ROUTE:
 *   user selects personaPublicRef → validate it belongs to the pending
 *   transaction's own principal → mint session with that persona active
 *
 * Unauthenticated by design, same necessity as /proof and /challenge: this
 * IS the act that establishes the first session, so there is no Bearer token
 * to require yet. Authority is the SPENT, single-use transaction token —
 * proof of which was already established, cryptographically, by /proof.
 *
 * ── THE CROSS-PRINCIPAL CHECK (canary 7) ────────────────────────────────────
 *
 * `selectPersonaChoice` (services/identity/passportPendingAuth.ts) refuses
 * any `personaPublicRef` that does not belong to the SAME `authProfileId`
 * this transaction's own principal resolves to. A ref for a different
 * principal's persona — forged, guessed, or lifted from a receipt — matches
 * nothing in this transaction's own candidate set and is refused. See that
 * module's header for the full reasoning.
 *
 * ── NO FALLBACK, EVER (canary 5) ────────────────────────────────────────────
 *
 * `personaPublicRef` is REQUIRED. There is no branch here that mints a
 * session for "the only candidate" or "the first candidate" when it is
 * omitted — see `selectPersonaChoice`'s own header for why that is exactly
 * the regression this closure exists to end.
 */

import { NextRequest, NextResponse } from 'next/server';

import { spendPendingAuth, selectPersonaChoice, resolveAuthProfileIdForAuthUser, listCandidatePersonas, stashSelectedPersona } from '@/services/identity/passportPendingAuth';
import { loadUsablePassportByKybe } from '@/services/identity/passportPrincipal';
import { issuePassportSession } from '@/services/identity/passportSession';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const transactionToken = typeof body?.transactionToken === 'string' ? body.transactionToken : '';
  const submittedRef = typeof body?.personaPublicRef === 'string' ? body.personaPublicRef : '';
  if (!transactionToken) {
    return NextResponse.json({ ok: false, error: 'transactionToken required' }, { status: 400, headers: noStore });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
  }

  // 1. THE ATOMIC SPEND. Spent whether or not the persona choice that
  // follows is valid — a rejected selection cannot leave the transaction
  // live to grind against (same discipline as connectionChallenge.ts).
  const spend = await spendPendingAuth(supabase, transactionToken);
  if (!spend.ok) {
    const status = spend.reason === 'unavailable' ? 503 : 401;
    return NextResponse.json({ ok: false, error: spend.reason }, { status, headers: noStore });
  }

  // 2. RE-DERIVE the current passport state — defense in depth against a
  // revocation landing inside the (short) pending-auth window rather than
  // trusting the snapshot /proof took a few minutes earlier.
  const passportResult = await loadUsablePassportByKybe(supabase, spend.row.kybeId);
  if (!passportResult.ok) {
    return NextResponse.json({ ok: false, error: 'no_constitutional_access' }, { status: 403, headers: noStore });
  }

  // 3. THE CROSS-PRINCIPAL CHECK. Candidates are re-listed from the SPENT
  // transaction's own principal — never trusted from the client, never
  // trusted from /proof's earlier response.
  const authProfileId = await resolveAuthProfileIdForAuthUser(spend.row.authUserId);
  if (!authProfileId) {
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }
  const candidates = await listCandidatePersonas(supabase, authProfileId);
  const selection = selectPersonaChoice(candidates, submittedRef);
  if (!selection.ok) {
    // Disclosed specifically — this is the caller's OWN request (its own
    // spent transaction, its own submitted ref), not information about
    // anyone else's principal. Same precedent as /proof's disclosed
    // proof-shape failures (expired / already_consumed).
    return NextResponse.json({ ok: false, error: selection.reason }, { status: 401, headers: noStore });
  }

  // 4. SESSION. Existing, unchanged function — the passport-native session
  // is still an ordinary Supabase session (ruling A.3.2), now minted only
  // after an explicit persona choice instead of before one existed at all.
  const session = await issuePassportSession({
    kybeId: spend.row.kybeId,
    rootIdentityId: spend.row.rootIdentityId,
    authUserId: spend.row.authUserId,
    passport: passportResult.passport,
  });
  if (!session.ok) {
    console.warn('[PassportConnect] session mint failed:', session.reason);
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }

  // 5. Stash the chosen persona for the ONE post-session self-view read
  // (/resolved-persona) — best-effort; a failure here degrades to the
  // spine's own persona resolution on the client's first request, same as
  // any other sign-in.
  await stashSelectedPersona(supabase, spend.row.id, selection.personaId);

  // 6. SessionQube receipt (ruling 5) — T2-safe fields only. Reuses the
  // EXISTING unified receipt writer and the EXISTING 'session_started'
  // action type; no DVN pipeline file touched, no new action type added.
  let kybeDidPublicRef: string | null = null;
  try {
    const { data } = await supabase
      .from('polity_passport_records')
      .select('kybe_did_public_ref')
      .eq('kybe_identity_id', spend.row.kybeId)
      .limit(1)
      .maybeSingle();
    kybeDidPublicRef = (data as { kybe_did_public_ref?: string } | null)?.kybe_did_public_ref ?? null;
  } catch {
    // Receipt is best-effort context, never a gate — proceed without it.
  }
  try {
    await createActivityReceipt({
      personaId: selection.personaId,
      actionType: 'session_started',
      summary: 'Passport-native session established',
      activeCartridge: 'metame-companion',
      actionInput: {
        qube: 'session', // SessionQube marker (§A.3.3)
        audience: spend.row.audience,
        origin: spend.row.origin,
        proofMethod: spend.row.assuranceLevel,
        assuranceLevel: spend.row.assuranceLevel,
        passportLineageRef: kybeDidPublicRef,
        personaPublicRef: selection.choice.personaPublicRef,
        consent: 'connect_action',
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Receipting is not the gate — a receipt failure never strands a
    // citizen who already holds a valid session grant.
    console.warn('[PassportConnect] SessionQube receipt failed:', err);
  }

  // T0 law: nothing below names a persona id, an auth profile, a root or a
  // kybe. personaPublicRef is T2-safe and is the SAME ref the client already
  // holds from /proof's candidate list.
  return NextResponse.json(
    {
      ok: true,
      tokenHash: session.grant.tokenHash,
      handoffTokenHash: session.grant.handoffTokenHash,
      passport: session.grant.passport,
      personaPublicRef: selection.choice.personaPublicRef,
    },
    { headers: noStore },
  );
}
