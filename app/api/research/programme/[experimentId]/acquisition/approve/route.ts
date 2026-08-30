/**
 * POST /api/research/programme/[experimentId]/acquisition/approve — the ONE
 * Copilot decision "Approve targeted acquisition" performs (operator
 * directive, 2026-08-30).
 *
 * Composes the SAME reads `GET .../acquisition-brief` already does
 * (`runCrystalReadinessReport` + `listInvariants` + `currentCrystalArtifactId`
 * into `buildCrystalAcquisitionBrief`) so the approved target is the exact
 * plan the operator was shown, refuses when nothing is actually failing
 * (`acquisitionBriefApplies`), and writes the ONE durable fact
 * (`services/research/crystalAcquisitionJob.ts::approveAcquisitionJob`) that
 * authorizes `POST .../acquisition/run-step` to proceed. Creates or writes
 * nothing else: no source is added, no statement is authored, no boundary
 * changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { currentCrystalArtifactId } from '@/services/research/artifacts';
import { listInvariants } from '@/services/invariants/store';
import { buildCrystalAcquisitionBrief, acquisitionBriefApplies } from '@/services/research/crystalAcquisitionBrief';
import { approveAcquisitionJob, getActiveAcquisitionApproval } from '@/services/research/crystalAcquisitionJob';
import { DEFAULT_ACQUISITION_DOMAIN } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';

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
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      { ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` },
      { status: 404 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { acquisitionDomain?: string };
  const acquisitionDomain = body.acquisitionDomain?.trim() || DEFAULT_ACQUISITION_DOMAIN;

  const [report, crystalGeneration, admitted] = await Promise.all([
    runCrystalReadinessReport({ experimentId, crystalDomain: declaration.domain }),
    currentCrystalArtifactId(experimentId),
    listInvariants({ domain: declaration.domain, status: ['validated', 'canonical'], limit: 500 }).catch(() => []),
  ]);

  if (!acquisitionBriefApplies(report)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Nothing currently requires targeted acquisition — the three freeze-blocking acquisition checks ' +
          '(selection-space, derivation-headroom, boundary-coverage) are all satisfied. There is nothing to approve.',
      },
      { status: 409 },
    );
  }

  const existing = await getActiveAcquisitionApproval(admin, experimentId, acquisitionDomain);
  if (existing) {
    return NextResponse.json(
      { ok: true, alreadyApproved: true, approval: existing },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const brief = buildCrystalAcquisitionBrief({
    experimentId,
    crystalGeneration,
    domain: declaration,
    report,
    admittedInvariantIds: admitted.map((i) => i.id),
  });

  const result = await approveAcquisitionJob(admin, {
    experimentId,
    acquisitionDomain,
    crystalDomain: declaration.domain,
    approvedByPersonaId: persona.personaId,
    brief,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, alreadyApproved: false, approval: result.approval, brief },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
