/**
 * POST /api/research/programme/[experimentId]/acquisition/decline — the
 * "Decline" disposition of the targeted-acquisition proposal (2026-09-05,
 * "complete human proposal-decision contract" fix: the card previously
 * exposed ONLY "Approve targeted acquisition", leaving navigating away as
 * the operator's only other option — which recorded nothing).
 *
 * Mirrors `.../acquisition/approve/route.ts` almost exactly — same
 * preconditions, same brief, same identity (crystal generation + brief hash)
 * — but writes `status: 'declined'` via `recordAcquisitionDisposition`,
 * which `getActiveAcquisitionApproval` never matches. Declining NEVER
 * authorizes acquisition, and NEVER marks derivation-headroom, namespace
 * coverage, structural diversity, or any other readiness check as resolved —
 * `crystalReadiness` re-derives independently of this table, exactly like
 * the approve route's own header already establishes for approval.
 *
 * Idempotent: declining the SAME brief (same crystal generation + brief
 * hash) twice short-circuits to the existing row rather than writing a
 * second one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { composeAcquisitionPreconditions } from '@/services/research/crystalAcquisitionPrecondition';
import { buildCrystalAcquisitionBrief, acquisitionBriefApplies, hashAcquisitionBrief } from '@/services/research/crystalAcquisitionBrief';
import {
  getActiveAcquisitionApproval,
  getLatestAcquisitionDisposition,
  recordAcquisitionDisposition,
} from '@/services/research/crystalAcquisitionJob';
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

  const body = (await req.json().catch(() => ({}))) as { acquisitionDomain?: string; rationale?: string };
  const acquisitionDomain = body.acquisitionDomain?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const rationale = typeof body.rationale === 'string' && body.rationale.trim().length > 0 ? body.rationale.trim() : null;

  const preconditions = await composeAcquisitionPreconditions({
    experimentId,
    crystalDomain: declaration.domain,
  });
  if (!preconditions.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Precondition check exceeded its ${preconditions.deadlineMs}ms safety budget before the decline could ` +
          'be safely written — nothing was written. Please retry.',
        retryable: true,
      },
      { status: 503 },
    );
  }
  const { report, crystalGeneration, admitted } = preconditions;

  if (!acquisitionBriefApplies(report)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Nothing currently requires targeted acquisition — the three freeze-blocking acquisition checks ' +
          '(selection-space, derivation-headroom, boundary-coverage) are all satisfied. There is nothing to decline.',
      },
      { status: 409 },
    );
  }

  const brief = buildCrystalAcquisitionBrief({
    experimentId,
    crystalGeneration,
    domain: declaration,
    report,
    admittedInvariantIds: admitted.map((i) => i.id),
  });
  const briefHash = hashAcquisitionBrief(brief);

  // An already-active APPROVAL for this exact proposal outranks a decline —
  // the operator already authorized it; declining now would contradict a
  // recorded authorization rather than close an open proposal.
  const activeApproval = await getActiveAcquisitionApproval(admin, experimentId, acquisitionDomain);
  if (activeApproval && activeApproval.crystalGeneration === crystalGeneration && activeApproval.briefHash === briefHash) {
    return NextResponse.json(
      { ok: false, error: 'This exact targeted acquisition plan was already approved — it cannot also be declined.' },
      { status: 409 },
    );
  }

  // IDEMPOTENCY (requirement 6, mirroring approve's own hash-identity check):
  // the same operator disposition against the SAME brief is the same
  // judgement already made — short-circuit, never a duplicate row/receipt.
  const latest = await getLatestAcquisitionDisposition(admin, experimentId, acquisitionDomain);
  if (
    latest &&
    latest.status === 'declined' &&
    latest.crystalGeneration === crystalGeneration &&
    latest.briefHash === briefHash
  ) {
    return NextResponse.json(
      { ok: true, alreadyRecorded: true, disposition: latest },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await recordAcquisitionDisposition(admin, {
    experimentId,
    acquisitionDomain,
    crystalDomain: declaration.domain,
    disposition: 'declined',
    decidedByPersonaId: persona.personaId,
    brief,
    briefHash,
    rationale,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, alreadyRecorded: false, disposition: result.approval },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
