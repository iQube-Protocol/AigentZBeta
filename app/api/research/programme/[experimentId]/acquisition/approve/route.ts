/**
 * POST /api/research/programme/[experimentId]/acquisition/approve — the ONE
 * Copilot decision "Approve targeted acquisition" performs (operator
 * directive, 2026-08-30).
 *
 * Composes its preconditions through `composeAcquisitionPreconditions`
 * (services/research/crystalAcquisitionPrecondition.ts, 2026-08-31 timeout
 * repair) — a BOUNDED projection of the same reads `GET .../acquisition-brief`
 * uses, raced against `STATE_COMPOSITION_DEADLINE_MS` so a pathologically
 * slow read fails CLOSED with a clean, retryable 503 rather than hanging —
 * so the approved target is the exact plan the operator was shown, refuses
 * when nothing is actually failing (`acquisitionBriefApplies`), and writes
 * the ONE durable fact (`services/research/crystalAcquisitionJob.ts::
 * approveAcquisitionJob`) that authorizes `POST .../acquisition/run-step` to
 * proceed. Creates or writes nothing else: no source is added, no statement
 * is authored, no boundary changes.
 *
 * THE SAME route the Laboratory's "Approve & start acquisition" control
 * (components/research/Track2ProgrammePanel.tsx's `CrystalAcquisitionPlan`)
 * calls — one canonical approval service for both surfaces, never a
 * lower-level route (e.g. the raw corpus-scout institution-discovery
 * endpoint) capable of bypassing this route's own constitutional
 * preconditions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { composeAcquisitionPreconditions } from '@/services/research/crystalAcquisitionPrecondition';
import { buildCrystalAcquisitionBrief, acquisitionBriefApplies, hashAcquisitionBrief } from '@/services/research/crystalAcquisitionBrief';
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

  const preconditions = await composeAcquisitionPreconditions({
    experimentId,
    crystalDomain: declaration.domain,
  });
  if (!preconditions.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Precondition check exceeded its ${preconditions.deadlineMs}ms safety budget before the approval could ` +
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
          '(selection-space, derivation-headroom, boundary-coverage) are all satisfied. There is nothing to approve.',
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

  // THE DURABLE-IDENTITY CHECK (2026-08-31, "targeted-acquisition
  // state-machine" repair, operator requirement: "a durable identity such as
  // experimentId + crystalVersion/successor + acquisitionBriefHash"). An
  // active approval for the SAME crystal generation and the SAME brief
  // content is the exact same human judgement already made — short-circuit,
  // never a second row/receipt (double-click/idempotency). An active
  // approval whose generation or content DIFFERS means readiness moved on
  // since that approval (a materially different plan) — this click is a
  // genuinely NEW judgement, so it proceeds to supersede + insert below,
  // never silently reuses the stale row.
  const existing = await getActiveAcquisitionApproval(admin, experimentId, acquisitionDomain);
  if (existing && existing.crystalGeneration === crystalGeneration && existing.briefHash === briefHash) {
    return NextResponse.json(
      { ok: true, alreadyApproved: true, approval: existing },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await approveAcquisitionJob(admin, {
    experimentId,
    acquisitionDomain,
    crystalDomain: declaration.domain,
    approvedByPersonaId: persona.personaId,
    brief,
    briefHash,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, alreadyApproved: false, approval: result.approval, brief },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
