/**
 * GET /api/research/crystal/[experimentId]/acquisition-brief — the ONE
 * combined corpus-enlargement objective consolidating `selection-space`,
 * `derivation-headroom` and `boundary-coverage` (Defect 2, 2026-08-27
 * "Crystal freeze-gating continuation" review pass).
 *
 * Read-only, steward-gated identically to the sibling Track 2 routes
 * (`GET /api/research/track2/[experimentId]`, `POST …/advance`). Composes
 * TWO already-canonical reads — `runCrystalReadinessReport` (the SAME report
 * `Track2ProgrammePanel` renders) and `listInvariants` (the SAME admitted
 * population the readiness report itself counted) — into
 * `buildCrystalAcquisitionBrief` (`services/research/crystalAcquisitionBrief.ts`),
 * which performs no arithmetic of its own. This route computes nothing; it
 * reads and assembles.
 *
 * `includeStructuralDiversity=true` folds the optional maturity signal into
 * the brief — an explicit query param because that check is informational
 * and must never ride along un-asked-for (crystalInstrumentSuite.ts's
 * `structural-diversity` contract entry).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { currentCrystalArtifactId } from '@/services/research/artifacts';
import { listInvariants } from '@/services/invariants/store';
import { buildCrystalAcquisitionBrief, acquisitionBriefApplies } from '@/services/research/crystalAcquisitionBrief';

export const dynamic = 'force-dynamic';

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
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      { requestSucceeded: false, error: `no crystal domain is declared for experiment '${experimentId}'` },
      { status: 404 },
    );
  }

  const includeStructuralDiversity = req.nextUrl.searchParams.get('includeStructuralDiversity') === 'true';

  const [report, crystalGeneration, admitted] = await Promise.all([
    runCrystalReadinessReport({ experimentId, crystalDomain: declaration.domain }),
    currentCrystalArtifactId(experimentId),
    listInvariants({ domain: declaration.domain, status: ['validated', 'canonical'], limit: 500 }).catch(() => []),
  ]);

  if (!report.ok && report.invariantCount === 0 && report.checks.some((c) => c.name === 'invariant-fetch')) {
    // Infrastructure fault reading the substrate — see crystalReadiness.ts's
    // own `invariant-fetch` check. Nothing about a brief can be built from an
    // unreadable substrate; report the fault honestly rather than a brief
    // over zero real data.
    return NextResponse.json(
      { requestSucceeded: false, error: report.checks.find((c) => c.name === 'invariant-fetch')?.detail ?? 'the invariant substrate could not be read' },
      { status: 502 },
    );
  }

  if (!acquisitionBriefApplies(report)) {
    return NextResponse.json(
      {
        requestSucceeded: true,
        applies: false,
        note:
          'None of the three freeze-blocking acquisition checks (selection-space, derivation-headroom, ' +
          'boundary-coverage) is currently failing — there is nothing for a combined acquisition brief to target.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const brief = buildCrystalAcquisitionBrief({
    experimentId,
    crystalGeneration,
    domain: declaration,
    report,
    admittedInvariantIds: admitted.map((i) => i.id),
    includeStructuralDiversity,
  });

  return NextResponse.json(
    { requestSucceeded: true, applies: true, brief },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
