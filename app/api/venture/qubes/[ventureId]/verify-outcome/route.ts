/**
 * /api/venture/qubes/[ventureId]/verify-outcome — verification gate for
 * ProofOfOutcomeClaims (the Standing accrual edge).
 *
 * Standing must never accrue from a self-declared outcome. A verifier (admin /
 * steward) moves a claim from 'claimed' → 'verified' (or 'rejected') here, and
 * only on 'verified' does the venture owner's Personal Standing accrue the
 * claim's Net Value Acceleration via the existing Standing keystone.
 *
 * POST body:
 *   { claimId: string,
 *     decision: 'verify' | 'reject',
 *     confidence?: number,   // 0–1, applied to NVA on verify
 *     verifier?: string }    // T2-safe label; defaults to the admin's persona label
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { accrueVentureOutcomes } from '@/services/venture/ventureOutcomeAccrual';
import type { VentureQubeV1 } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      { ok: false, error: 'Outcome verification is an admin/steward action' },
      { status: 403 },
    );
  }

  const { ventureId } = await params;
  let body: { claimId?: string; decision?: string; confidence?: number; verifier?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const claimId = typeof body.claimId === 'string' ? body.claimId : '';
  const decision = body.decision === 'reject' ? 'reject' : 'verify';
  if (!claimId) {
    return NextResponse.json({ ok: false, error: 'claimId is required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from('venture_qubes')
    .select('id, layers')
    .eq('id', ventureId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: 'Venture not found' }, { status: 404 });
  }

  const layers = (row.layers ?? {}) as VentureQubeV1;
  const claims = layers.outcome?.proofOfOutcomeClaims ?? [];
  const target = claims.find((c) => c.claimId === claimId);
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Outcome claim not found' }, { status: 404 });
  }
  if (target.accruedAt) {
    return NextResponse.json(
      { ok: false, error: 'Claim already accrued — verification is locked' },
      { status: 409 },
    );
  }

  const verifiedAt = new Date().toISOString();
  // The verifier label is persisted into the (T2/public) venture layers, so it
  // must never carry a raw personaId. Use the caller-supplied T2-safe label or
  // a generic steward tag — never the resolved persona identity.
  const verifier =
    typeof body.verifier === 'string' && body.verifier.trim()
      ? body.verifier.trim().slice(0, 280)
      : 'admin-steward';
  const confidence =
    typeof body.confidence === 'number'
      ? Math.max(0, Math.min(1, body.confidence))
      : target.confidence ?? 1;

  const nextClaims = claims.map((c) =>
    c.claimId === claimId
      ? {
          ...c,
          verificationStatus: decision === 'verify' ? ('verified' as const) : ('rejected' as const),
          verifier,
          verifiedAt,
          confidence,
        }
      : c,
  );
  const nextLayers: VentureQubeV1 = {
    ...layers,
    outcome: { ...layers.outcome, proofOfOutcomeClaims: nextClaims },
  };

  const { error: updErr } = await admin
    .from('venture_qubes')
    .update({ layers: nextLayers })
    .eq('id', ventureId);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // On verify, run the accrual sweep (idempotent — credits Standing once).
  let accrual = null;
  if (decision === 'verify') {
    const result = await accrueVentureOutcomes(ventureId);
    if ('ok' in result && result.ok) accrual = result;
  }

  return NextResponse.json({
    ok: true,
    ventureId,
    claimId,
    decision,
    verifier,
    verifiedAt,
    confidence,
    accrual,
  });
}
