/**
 * POST /api/research/programme/[experimentId]/acquisition/verify-step — the
 * ONE bounded institution-verification step a Copilot-driven acquisition run
 * performs per call (2026-08-31, "targeted-acquisition ratified-but-
 * unverified dead end" repair). Requires an ACTIVE approval
 * (`POST .../acquisition/approve`), exactly like `.../acquisition/run-step`
 * — this route can never be reached without the one human authorization
 * that already covers the whole bounded acquisition sequence.
 *
 * Bounded to EXACTLY ONE ratified institution per call, and only one still
 * in its first-pass 'proposed' verification state
 * (`services/research/crystalAcquisitionJob.ts::runOneInstitutionVerificationStep`)
 * — never the whole-domain sequential sweep
 * `POST /api/corpus-scout/institution-verification/domain` performs, which
 * is unbounded wall-clock against up to nineteen third-party sites in one
 * request. Reuses `verifyInstitutionEntry` verbatim (the same service that
 * route calls) — no second verification implementation.
 *
 * A caller (the Research Copilot, or the Track 2 panel) drives this
 * repeatedly until `exhausted: true`, exactly mirroring how
 * `.../acquisition/run-step` is already driven. This is a deterministic,
 * bounded, already-Steward-authorised machine act — traced from
 * `registryVerification.ts` before this route was written: no human
 * judgement decides a verification OUTCOME (it is mechanically derived from
 * HTTP responses and content inspection), so it does not need its own
 * separate approval gate beyond the admin auth already required here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import {
  getActiveAcquisitionApproval,
  runOneInstitutionVerificationStep,
} from '@/services/research/crystalAcquisitionJob';
import { DEFAULT_ACQUISITION_DOMAIN } from '@/services/research/researchProgrammeOrchestrator';

export const dynamic = 'force-dynamic';
// One institution's seed-resolve + document-discovery + up-to-five-document
// retrieval/inspection pass — bounded, but real external HTTP, so this
// stays generous the same way the acquisition run-step route already is.
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

  const step = await runOneInstitutionVerificationStep(admin, acquisitionDomain);

  return NextResponse.json(
    {
      ok: true,
      institution: step.institution,
      result: step.result,
      exhausted: step.exhausted,
      // Loop-control, mirroring run-step's own `done` — the caller stops
      // calling this route once every ratified institution has had its one
      // automatic first pass. Never a claim about acquisition readiness;
      // that is `run-step`'s own `readinessSatisfied`/`done`, untouched.
      done: step.exhausted,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
