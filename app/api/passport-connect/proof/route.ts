/**
 * POST /api/passport-connect/proof — spend the wallet challenge, resolve the
 * constitutional principal, and mint a PENDING-AUTH TRANSACTION (never a
 * session directly).
 *
 * PRD-PAG-001 Amendment A §A.3.4 (original) + first-connection closure
 * (operator ruling 2026-07-28, rulings 1–2).
 *
 * ── THE SEQUENCE, IN THE RULED ORDER (§A.3.4 / ruling 1) ────────────────────
 *
 *   holder proof → Passport resolution → personhood resolution
 *   → establish/reconcile wallet binding → persona choices returned
 *   → [client calls /finalize with its choice] → session
 *
 * A session is minted ONLY by /finalize, after an explicit persona choice —
 * never here. This route's own job ends at "who could this become, and what
 * must they now choose from" (ruling 2).
 *
 * ── FIRST CONNECTION, NO PRIOR BINDING (ruling 1) ───────────────────────────
 *
 * `resolvePassportPrincipal` fails closed with `wallet_unknown` when the
 * proven wallet has no existing `wallet_alias_commitments` row — which used
 * to be a dead end requiring a prior, Bearer-authenticated bind (Amendment
 * B's own chartered scope assumes exactly that prerequisite, B.2.1). This
 * route now offers ONE rescue, gated to the assurance level Amendment A's
 * graded ladder already reserves for establishing a brand-new binding from
 * zero (§A.6 level 3): a LIVE World ID proof. `resolvePassportPrincipalByWorldId`
 * resolves personhood independently of the wallet via
 * `world_id_nullifier_hash`; once resolved, `establishWalletBindingForRoot`
 * writes the wallet↔root binding using the SAME two independently-verified
 * facts Amendment B names as sufficient authority (verified wallet control +
 * verified Passport presentation) — no session required, no protected file
 * touched.
 *
 * A wallet that resolves neither way (no binding, no matching World ID
 * proof) is refused with `link_required` — a narrow, considered disclosure
 * (see the inline note at that branch) distinct from the single opaque
 * `no_constitutional_access` every OTHER resolution failure still collapses
 * to, unchanged from before this ruling.
 */

import { NextRequest, NextResponse } from 'next/server';

import { verifyConnectionProof } from '@/services/passport/connectionChallenge';
import {
  resolvePassportPrincipal,
  resolvePassportPrincipalByWorldId,
} from '@/services/identity/passportPrincipal';
import { establishWalletBindingForRoot } from '@/services/identity/walletAliasService';
import {
  issuePendingAuth,
  listCandidatePersonas,
  resolveAuthProfileIdForAuthUser,
  toPersonaChoice,
} from '@/services/identity/passportPendingAuth';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { WorldIdProofPayload } from '@/services/passport/personhoodProof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

function parseWorldIdProof(body: Record<string, unknown> | null): WorldIdProofPayload | null {
  const raw = body?.worldIdProof;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.proof !== 'string' ||
    typeof r.merkle_root !== 'string' ||
    typeof r.nullifier_hash !== 'string' ||
    (r.verification_level !== 'orb' && r.verification_level !== 'device')
  ) {
    return null;
  }
  return {
    proof: r.proof,
    merkle_root: r.merkle_root,
    nullifier_hash: r.nullifier_hash,
    verification_level: r.verification_level,
    action: typeof r.action === 'string' ? r.action : undefined,
    signal: typeof r.signal === 'string' ? r.signal : undefined,
  };
}

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
  const worldIdProof = parseWorldIdProof(body);

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
    return NextResponse.json({ ok: false, error: proof.reason }, { status, headers: noStore });
  }

  // 2 + 3. PASSPORT AND PERSONHOOD, from the RECOVERED signer only.
  let resolved = await resolvePassportPrincipal(proof.walletAddress);

  if (!resolved.ok && resolved.reason === 'wallet_unknown') {
    if (!worldIdProof) {
      // NARROW, CONSIDERED DISCLOSURE — the one exception to "collapse every
      // failure to one opaque reason" in this pipeline, and stated as such.
      // `link_required` confirms only "this specific wallet has never been
      // linked to anything" — it does NOT confirm a Passport exists, does NOT
      // name whose lineage it might belong to, and is the identical response
      // for every unbound wallet whether or not it will ever hold a Passport.
      // Every OTHER resolution failure (no_passport, passport_inactive,
      // lineage_incomplete, principal_unprovisioned, and a wallet that fails
      // the World ID rescue below) still collapses to the single opaque
      // `no_constitutional_access` this route always returned.
      return NextResponse.json({ ok: false, error: 'link_required' }, { status: 403, headers: noStore });
    }

    const byWorldId = await resolvePassportPrincipalByWorldId(worldIdProof);
    if (!byWorldId.ok) {
      if (byWorldId.reason === 'unavailable') {
        return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
      }
      return NextResponse.json(
        { ok: false, error: 'no_constitutional_access' },
        { status: 403, headers: noStore },
      );
    }

    const supabaseForBinding = getSupabaseServer();
    if (!supabaseForBinding) {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
    }
    const binding = await establishWalletBindingForRoot(supabaseForBinding, {
      chain: 'evm',
      walletAddress: proof.walletAddress,
      rootIdentityId: byWorldId.principal.rootIdentityId,
    });
    if (!binding.ok) {
      if (binding.reason === 'unavailable') {
        return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
      }
      // conflict_different_root — this wallet is already actively bound
      // elsewhere. Same opaque reason as every other refusal: confirming
      // "this wallet belongs to someone else" would itself be a disclosure.
      return NextResponse.json(
        { ok: false, error: 'no_constitutional_access' },
        { status: 403, headers: noStore },
      );
    }

    resolved = byWorldId;
  }

  if (!resolved.ok) {
    console.warn('[PassportConnect] principal unresolved:', resolved.reason);
    if (resolved.reason === 'unavailable') {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
    }
    return NextResponse.json(
      { ok: false, error: 'no_constitutional_access' },
      { status: 403, headers: noStore },
    );
  }

  // A step-up proof authorises an action; it does not open a session and has
  // no persona to choose (unchanged from before this ruling).
  if (proof.requestedAction === 'step_up') {
    return NextResponse.json(
      { ok: true, stepUp: true, passport: resolved.principal.passport },
      { headers: noStore },
    );
  }

  // 4. PENDING-AUTH TRANSACTION + PERSONA CHOICES (ruling 2). No session yet.
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: noStore });
  }

  const authProfileId = await resolveAuthProfileIdForAuthUser(resolved.principal.authUserId);
  if (!authProfileId) {
    console.warn('[PassportConnect] auth profile unresolved for authUserId');
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }
  const candidates = await listCandidatePersonas(supabase, authProfileId);

  const pending = await issuePendingAuth(
    supabase,
    {
      kybeId: resolved.principal.kybeId,
      rootIdentityId: resolved.principal.rootIdentityId,
      authUserId: resolved.principal.authUserId,
      assuranceLevel: worldIdProof ? 'wallet_binding+world_id' : 'wallet_binding',
    },
    audience,
    request.nextUrl.origin,
  );
  if (!pending) {
    return NextResponse.json({ ok: false, error: 'session_unavailable' }, { status: 503, headers: noStore });
  }

  // T0 law holds here exactly as it does on the original session grant:
  // nothing below names a persona id, an auth profile, a root or a kybe.
  return NextResponse.json(
    {
      ok: true,
      transactionToken: pending.transactionToken,
      expiresAt: pending.expiresAt,
      passport: resolved.principal.passport,
      personas: candidates.map(toPersonaChoice),
    },
    { headers: noStore },
  );
}
