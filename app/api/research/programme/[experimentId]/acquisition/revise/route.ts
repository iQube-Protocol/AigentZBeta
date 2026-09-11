/**
 * POST /api/research/programme/[experimentId]/acquisition/revise — the
 * "Revise plan" disposition of the targeted-acquisition proposal (2026-09-05,
 * "complete human proposal-decision contract" fix).
 *
 * Closes the CURRENT proposal version (identified by crystal generation +
 * brief hash, exactly like decline/approve) and records the operator's
 * direction as `rationale` — the instruction a regenerated proposal version
 * should incorporate. This route does not itself regenerate a brief (the
 * brief is a deterministic projection of live readiness —
 * `buildCrystalAcquisitionBrief` — there is no separate "apply this
 * instruction" step to run here); what it guarantees is the CONTRACT
 * requirement: the current proposal version is closed, a fresh brief/hash
 * (from a genuinely changed readiness state) always requires a new human
 * decision, and the closed version is never silently re-offered unchanged.
 *
 * Same non-authorizing property as decline: `getActiveAcquisitionApproval`
 * never matches `status: 'revision_requested'`, and no readiness/scientific
 * check is marked satisfied by this act.
 *
 * `rationale` (the operator's revision direction) is REQUIRED — a revision
 * request with no direction is indistinguishable from a decline.
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
  const rationale = typeof body.rationale === 'string' ? body.rationale.trim() : '';
  if (rationale.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'A revision request requires direction — describe what should change before it is recorded.' },
      { status: 400 },
    );
  }

  const preconditions = await composeAcquisitionPreconditions({
    experimentId,
    crystalDomain: declaration.domain,
  });
  if (!preconditions.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Precondition check exceeded its ${preconditions.deadlineMs}ms safety budget before the revision ` +
          'request could be safely written — nothing was written. Please retry.',
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
          '(selection-space, derivation-headroom, boundary-coverage) are all satisfied. There is no proposal to revise.',
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

  // An already-active APPROVAL for this exact proposal outranks a revision
  // request — see decline/route.ts's identical guard for the reasoning.
  const activeApproval = await getActiveAcquisitionApproval(admin, experimentId, acquisitionDomain);
  if (activeApproval && activeApproval.crystalGeneration === crystalGeneration && activeApproval.briefHash === briefHash) {
    return NextResponse.json(
      { ok: false, error: 'This exact targeted acquisition plan was already approved — it cannot also be sent back for revision.' },
      { status: 409 },
    );
  }

  // IDEMPOTENCY: a repeat submission of the SAME rationale against the SAME
  // brief is the same judgement already made. A DIFFERENT rationale against
  // the same brief is still a fresh direction worth recording, so only an
  // exact rationale match short-circuits.
  const latest = await getLatestAcquisitionDisposition(admin, experimentId, acquisitionDomain);
  if (
    latest &&
    latest.status === 'revision_requested' &&
    latest.crystalGeneration === crystalGeneration &&
    latest.briefHash === briefHash &&
    latest.rationale === rationale
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
    disposition: 'revision_requested',
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
