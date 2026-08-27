/**
 * POST /api/research/track2/[experimentId]/duplicate-pairs/merge — Stage 9's
 * `duplicate-detection` remediation (operator ruling, 2026-08-27, "Crystal
 * v1/v2 lineage collision", item 4: "duplicate detection → duplicate-pair
 * adjudication queue"; corrected 2026-08-27, "final corrections" pass).
 *
 * The pair itself is never re-derived from client-trusted input — this route
 * re-reads the SAME authoritative Track 2 composition
 * (`loadTrack2ProgrammeState`, `services/research/researchProgrammeOrchestrator.ts`)
 * every GET on this experiment uses, and confirms the submitted
 * (survivorId, mergedId) pair is still one of THAT reading's near-duplicate
 * pairs before acting. A pair the client saw a moment ago but that this
 * fresh read no longer names — because it was already resolved by another
 * request, or the underlying data changed — is refused with 409 rather than
 * acted on blind. This is the identical composition the GET route and the
 * orchestrator loop use, never a second copy (inv.engineering.036/037).
 *
 * The client submits only `survivorId`, `mergedId`, and an optional
 * `operatorOverrideReason`. Every other field on the merge receipt —
 * `recommendedId`, `operatorFollowedRecommendation`, `confidence`,
 * `reasons` — is derived HERE from the same fresh reading, never trusted
 * from the request body.
 *
 * The actual merge still goes through the EXISTING `mergeInvariants`
 * primitive (services/invariants/lifecycle.ts) — never a second, parallel
 * merge implementation. `mergeInvariants` unions contexts/edges onto the
 * survivor and marks the merged row `superseded`; it does not touch the
 * crystal domain, provenance classification, or validation state of the
 * survivor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { mergeInvariants } from '@/services/invariants/lifecycle';
import { loadTrack2ProgrammeState } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('~');
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

  const { experimentId } = await params;

  let body: { survivorId?: unknown; mergedId?: unknown; operatorOverrideReason?: unknown };
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
  const operatorOverrideReason =
    typeof body.operatorOverrideReason === 'string' && body.operatorOverrideReason.trim()
      ? body.operatorOverrideReason.trim()
      : null;

  // AUTHORITATIVE PAIR VALIDATION — the exact composition the Track 2 GET
  // route and the orchestrator loop both read, re-run fresh for this
  // request. A pair the client submitted is only ever acted on if THIS
  // reading still names it.
  const state = await loadTrack2ProgrammeState({ experimentId });
  if ('error' in state) {
    return NextResponse.json({ ok: false, error: state.error }, { status: state.status });
  }

  const duplicateCheck = state.readiness.checks.find((c) => c.name === 'duplicate-detection');
  const submittedKey = pairKey(survivorId, mergedId);
  const matchedPair = duplicateCheck?.duplicatePairs?.find((p) => pairKey(p.aId, p.bId) === submittedKey);
  if (!matchedPair) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'this pair is no longer an adjudicable near-duplicate — it may already have been resolved by another ' +
          'request, or the underlying invariant data changed since it was read. Refresh and try again.',
      },
      { status: 409 },
    );
  }

  // Every other receipt field is DERIVED here, from this same fresh
  // reading — never accepted from the request body.
  const recommendation = matchedPair.recommendation;
  const pairIds = [matchedPair.aId, matchedPair.bId].sort();
  const recommendedId = recommendation?.recommendedId ?? null;
  const operatorFollowedRecommendation = recommendedId !== null && recommendedId === survivorId;
  const confidence = recommendation?.confidence ?? 'low';
  const reasons = recommendation?.reasons ?? [];

  const decisionContext = {
    experimentId,
    pairIds,
    survivorId,
    mergedId,
    recommendedId,
    operatorFollowedRecommendation,
    confidence,
    reasons,
    operatorOverrideReason,
  };

  try {
    const survivor = await mergeInvariants(
      survivorId,
      [mergedId],
      { personaId: persona.personaId },
      decisionContext,
    );
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
