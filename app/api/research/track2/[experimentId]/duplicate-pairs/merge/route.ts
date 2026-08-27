/**
 * POST /api/research/track2/[experimentId]/duplicate-pairs/merge — Stage 9's
 * `duplicate-detection` remediation (operator ruling, 2026-08-27, "Crystal
 * v1/v2 lineage collision", item 4: "duplicate detection → duplicate-pair
 * adjudication queue").
 *
 * The pair itself is never re-derived here — `services/research/
 * crystalReadiness.ts`'s duplicate-detection check already computed the
 * exact near-duplicate pairs (lexical ∪ semantic union) and carries them
 * verbatim on `CrystalReadinessCheck.duplicatePairs`; this route's ONLY job
 * is to let a steward act on one pair the readiness engine already named,
 * through the EXISTING `mergeInvariants` primitive
 * (services/invariants/lifecycle.ts) — never a second, parallel merge
 * implementation. `mergeInvariants` unions contexts/edges onto the survivor
 * and marks the merged row `superseded`; it does not touch the crystal
 * domain, provenance classification, or validation state of the survivor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { mergeInvariants } from '@/services/invariants/lifecycle';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  // experimentId is not otherwise used by this route — mergeInvariants acts
  // on invariant ids directly — but is required in the path for parity with
  // every other Track 2 action route, and so a future audit of "which
  // experiment's readiness surfaced this merge" can be read off the URL.
  await params;

  let body: { survivorId?: unknown; mergedId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const survivorId = asString(body.survivorId);
  const mergedId = asString(body.mergedId);
  if (!survivorId || !mergedId) {
    return NextResponse.json({ ok: false, error: 'survivorId and mergedId are both required' }, { status: 400 });
  }
  if (survivorId === mergedId) {
    return NextResponse.json({ ok: false, error: 'survivorId and mergedId must name two distinct invariants' }, { status: 400 });
  }

  try {
    const survivor = await mergeInvariants(survivorId, [mergedId], { personaId: persona.personaId });
    return NextResponse.json(
      { ok: true, survivorId: survivor.id, mergedId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'merge failed' },
      { status: 409 },
    );
  }
}
