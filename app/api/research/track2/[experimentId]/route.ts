/**
 * GET /api/research/track2/[experimentId] — the guided Track 2 programme
 * (operator ruling, 2026-08-02). Read-only, steward-gated.
 *
 * Composes signals the platform already computes into the eleven-stage view.
 * It runs no stage's work and stores no progress: every status is derived at
 * request time, so acting through any underlying surface directly is reflected
 * here immediately and this view can never disagree with the reports it reads.
 *
 * ── THE COMPOSITION MOVED, AND WHY (2026-08-26) ─────────────────────────────
 *
 * The signal composition that used to live inline in this handler now lives in
 * `services/research/researchProgrammeOrchestrator.ts` as
 * `loadTrack2ProgrammeState`. It moved because the Research Programme
 * Orchestrator needs the IDENTICAL composition on every iteration of its
 * advance-until-gate loop, and a second copy would have been the stale one the
 * first time a signal changed (`inv.engineering.036`/`037`). One read model, one
 * set of fail-soft rules — so the loop can never disagree with the surface the
 * operator is looking at.
 *
 * Nothing about the composition changed in the move: the upstream signals
 * (Corpus Scout candidates, discovery candidates, the promoted cohort) are still
 * read BEST-EFFORT and still fail SOFT to `null`, which the programme renders as
 * `unknown`. They are convenience context, not the authority — and an unreadable
 * convenience signal must never be able to make a governed stage look complete
 * or blocked. What the move ADDED is `unreadableSignals`, which names each one,
 * because a zero derived from an unreadable substrate and a genuine zero are
 * different facts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { loadTrack2ProgrammeState } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  const state = await loadTrack2ProgrammeState({
    experimentId,
    acquisitionDomain: req.nextUrl.searchParams.get('acquisitionDomain') ?? undefined,
  });
  if ('error' in state) {
    return NextResponse.json({ requestSucceeded: false, error: state.error }, { status: state.status });
  }

  return NextResponse.json(
    {
      requestSucceeded: true,
      programme: state.programme,
      acquisitionDomain: state.acquisitionDomain,
      lifecycle: state.lifecycle,
      reviewStage: state.reviewStage,
      readiness: state.readiness,
      crystalDomainDeclaration: state.declaration,
      declarationHash: state.declarationHash,
      /** Named, never silently zeroed — see the header. */
      unreadableSignals: state.unreadableSignals,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
