/**
 * POST /api/research/programme/[experimentId]/advance — the Research Programme
 * Orchestrator's single entry point (operator ruling, 2026-08-26).
 *
 *   > "Execute existing capabilities through a bounded server-side
 *   >  advance-until-human-gate loop… The operator should interact only with
 *   >  consolidated governance decisions and the final freeze."
 *
 * ── This route holds NO logic ────────────────────────────────────────────────
 *
 * Resolve the persona, gate on steward access, call the orchestrator, return its
 * result. That is the whole handler. Every decision — which acts are offerable,
 * whether the sequencing gate is open, when to stop, what to receipt — belongs
 * to `services/research/researchProgrammeOrchestrator.ts`, and duplicating any
 * of it here would create a second orchestrator that agrees with the first only
 * until one of them is edited (`inv.engineering.036`/`037`).
 *
 * ── The gate is the SAME gate the Track 2 routes already use ────────────────
 *
 * `getActivePersona` + `cartridgeFlags.isAdmin`, copied verbatim from
 * `GET /api/research/track2/[experimentId]` and its siblings. No new gate is
 * invented here: corpus construction is steward work, and this route performs a
 * subset of exactly the acts those routes perform.
 *
 * ── What one POST authorises, and what it does not ─────────────────────────
 *
 * One POST is ONE explicit, receipted, attributable steward act, and it
 * authorises only the machine-run acts in the orchestrator's closed catalogue.
 * It does not authorise admission, promotion, provenance classification,
 * relationship claims, crystal assignment, independent review or the freeze —
 * every one of those carries per-record or per-act human content, and the loop
 * stops at each of them and names it. Above all it cannot freeze: the
 * orchestrator holds no path to `freezeArtifact` and a canary enforces that.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { advanceResearchProgramme } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const result = await advanceResearchProgramme({
    experimentId,
    personaId: persona.personaId,
    acquisitionDomain: req.nextUrl.searchParams.get('acquisitionDomain') ?? undefined,
    // No `maxActs`, no `timeBudgetMs`, no `resolveMeasurementLayer`: a client
    // must not be able to widen the act budget or open the sequencing gate. The
    // orchestrator clamps both bounds to its own ceilings and reads the gate
    // fail-closed, so omitting them here is the only correct call.
  });
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, run: result }, { headers: { 'Cache-Control': 'no-store' } });
}
