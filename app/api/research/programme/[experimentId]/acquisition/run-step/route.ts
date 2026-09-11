/**
 * POST /api/research/programme/[experimentId]/acquisition/run-step — the ONE
 * bounded acquisition step a Copilot-driven acquisition run performs per
 * call (operator directive, 2026-08-30). Requires an ACTIVE approval
 * (`POST .../acquisition/approve`); refuses otherwise — this route can
 * never be reached without the one human authorization the whole design is
 * about.
 *
 * Bounded to EXACTLY ONE ratified+verified institution per call
 * (`services/research/crystalAcquisitionJob.ts::runOneAcquisitionStep`) —
 * never the whole-domain sequential sweep `runDiscoveryForDomain` performs,
 * which is unbounded wall-clock against third-party sites. A caller (the
 * Research Copilot) drives this repeatedly until `exhausted: true` or
 * `readinessSatisfied: true`, exactly mirroring how "Run until you need me"
 * already drives `POST .../advance` repeatedly.
 *
 * Re-runs hardened readiness after the step and reports whether acquisition
 * is STILL needed (`acquisitionBriefApplies`) — never assumes a fixed
 * acquisition quota. Marks the approval 'completed' the moment readiness no
 * longer needs it, or every ratified institution has been attempted,
 * whichever comes first — so a caller that keeps calling this after either
 * is true gets an honest `done: true` rather than a silent no-op forever.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { acquisitionBriefApplies } from '@/services/research/crystalAcquisitionBrief';
import {
  getActiveAcquisitionApproval,
  runOneAcquisitionStep,
  completeAcquisitionJob,
} from '@/services/research/crystalAcquisitionJob';
import { DEFAULT_ACQUISITION_DOMAIN } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';
// A single institution's curated-seed + homepage-navigation pass — bounded,
// but real external HTTP, so this stays generous the same way corpus-scout's
// own per-institution route already is.
export const maxDuration = 120;

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

  const approval = await getActiveAcquisitionApproval(admin, experimentId, acquisitionDomain);
  if (!approval) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No active targeted-acquisition approval exists for this experiment/domain. ' +
          'Approve targeted acquisition first (POST .../acquisition/approve).',
      },
      { status: 409 },
    );
  }

  const step = await runOneAcquisitionStep(admin, acquisitionDomain);

  // Bounded scope (2026-08-31, "targeted-acquisition approval timeout"
  // repair) — acquisitionBriefApplies below reads only selection-space/
  // derivation-headroom/boundary-coverage; see crystalReadiness.ts's own
  // 'acquisition-gate' doc comment for the full justification. Same fix as
  // the approve route, applied here for the same reason: this call re-runs
  // on every step of the SAME acquisition round.
  const freshReadiness = await runCrystalReadinessReport({
    experimentId,
    crystalDomain: declaration.domain,
    scope: 'acquisition-gate',
  });
  const readinessSatisfied = !acquisitionBriefApplies(freshReadiness);
  // THE PREMATURE-COMPLETION FIX (2026-08-31, "targeted-acquisition
  // state-machine" repair). `step.exhausted` is true in TWO genuinely
  // different situations, and only one of them is a completed round:
  //   - the domain HAS ratified+verified institutions and every one of them
  //     WAS attempted (this call or an earlier one this round) —
  //     `ratifiedVerifiedInstitutionCount > 0` — a real round happened.
  //   - the domain has NOTHING ratified+verified at all —
  //     `ratifiedVerifiedInstitutionCount === 0` — no institution was ever
  //     attempted, so nothing was "completed"; the approval is blocked on a
  //     governance/verification gap, not fulfilled. Marking it 'completed'
  //     here (the pre-fix behaviour) destroyed the durable record that a
  //     steward had authorized this acquisition, and the NEXT read of Track 2
  //     state re-offered "Approve targeted acquisition" from scratch — the
  //     exact "approval remains outstanding after clicking Approve" defect.
  // Deliberately NOT `eligibleInstitutionCountAtStart` (the unattempted-
  // remaining count) — that reaches 0 through a LEGITIMATE completed round
  // too (every institution attempted across one or more calls), which must
  // still complete the approval normally.
  // The approval row is left 'approved' (never silently discarded) so a
  // later re-read still finds it and can route to the correct next decision
  // (`buildAcquisitionPendingDecision`'s blocked-source-universe branch)
  // instead of re-asking.
  const sourceUniverseBlocked = !readinessSatisfied && step.exhausted && step.ratifiedVerifiedInstitutionCount === 0;
  // `done` is loop-control ONLY (tells the caller to stop calling this
  // route) — it stays true on exhaustion exactly as before, blocked or not,
  // so a blocked round still stops after one call rather than spinning the
  // client's retry loop up to its bound for no reason. Completion of the
  // APPROVAL ROW is the separate decision below, and is the one that must
  // never fire on a blocked round.
  const done = readinessSatisfied || step.exhausted;
  if (readinessSatisfied || (step.exhausted && !sourceUniverseBlocked)) {
    await completeAcquisitionJob(admin, approval.id);
  }

  return NextResponse.json(
    {
      ok: true,
      institution: step.institution,
      discovery: step.discovery,
      exhausted: step.exhausted,
      readinessSatisfied,
      sourceUniverseBlocked,
      done,
      invariantCount: freshReadiness.invariantCount,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
