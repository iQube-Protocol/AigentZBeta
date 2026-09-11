/**
 * POST /api/research/programme/[experimentId]/acquisition/verify-step — the
 * ONE bounded institution-verification PHASE a Copilot-driven acquisition
 * run performs per call (2026-08-31, "targeted-acquisition ratified-but-
 * unverified dead end" repair, then the follow-on "verification wall-clock
 * granularity" repair). Requires an ACTIVE approval
 * (`POST .../acquisition/approve`), exactly like `.../acquisition/run-step`
 * — this route can never be reached without the one human authorization
 * that already covers the whole bounded acquisition sequence.
 *
 * ── WHY "one institution per call" WAS NOT ENOUGH ──────────────────────────
 *
 * `verifyInstitutionEntry` chains THREE external-HTTP-heavy operations in
 * one call — resolve the seed URL, discover document candidates (itself up
 * to six sequential page fetches), then fetch+inspect up to five candidate
 * documents. Any one of those can independently stall, and the live
 * evidence was a real HTTP 504 on this exact route (BIS, after the
 * "ratified-but-unverified" fix shipped in 8360afc64: "Discovering via
 * BIS…" then the request died). Bounding to one INSTITUTION per call did
 * not bound the WALL-CLOCK of that institution's own request.
 *
 * `runOneInstitutionVerificationStep` (`crystalAcquisitionJob.ts`) now
 * calls `runVerificationStep` (`services/corpusScout/registryVerification.ts`)
 * — the resumable primitive that performs EXACTLY ONE bounded external
 * operation (resolve-seed / discover-candidates / fetch-document[cursor])
 * per call, racing it against `VERIFICATION_STEP_DEADLINE_MS` (comfortably
 * below the hosting request ceiling) and persisting phase/cursor progress
 * on the registry row between calls. A losing race returns `status:
 * 'in-progress'` with the SAME phase/cursor — never an empty 504 — so a
 * caller drives this repeatedly, exactly mirroring how
 * `.../acquisition/run-step` is already driven.
 *
 * No second verification implementation: `runVerificationStep` composes the
 * SAME `resolveSeedPhase`/`discoverCandidatesPhase`/`inspectCandidatePhase`
 * functions the one-shot `runVerification` (still used by the single-entry
 * admin route and the whole-domain sweep) composes.
 *
 * This is a deterministic, bounded, already-Steward-authorised machine act
 * — traced from `registryVerification.ts` before it was written: no human
 * judgement decides a verification OUTCOME, so it needs no separate
 * approval gate beyond the admin auth already required here.
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
// Generous relative to VERIFICATION_STEP_DEADLINE_MS (20s) — this is a
// backstop for the route/framework overhead around the race, never the
// mechanism that bounds the external work itself (that is the internal
// race in runVerificationStep).
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

  const outer = await runOneInstitutionVerificationStep(admin, acquisitionDomain);

  if (!outer.institution || !outer.step) {
    // Nothing eligible at all — the loop-control `done` signal, unrelated
    // to any single request's wall-clock.
    return NextResponse.json(
      { ok: true, status: 'exhausted', institution: null, outcome: null, diagnostics: null, exhausted: true, nextAction: 'none', done: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const step = outer.step;
  if (!step.ok) {
    // A structured, honest per-institution failure (e.g. a malformed
    // checkpoint or an unreadable row) — never a thrown exception, and
    // never treated as "nothing left to verify".
    return NextResponse.json(
      { ok: false, error: step.error, institution: outer.institution },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const terminal = step.status !== 'in-progress';
  return NextResponse.json(
    {
      ok: true,
      status: step.status,
      institution: outer.institution,
      outcome: terminal ? step.outcome : null,
      diagnostics: step.diagnostics,
      // Loop-control: the caller stops calling this route once every
      // ratified institution has reached a terminal verification status.
      // NEVER equivalent to `terminal` above — one institution finishing
      // does not mean the domain is exhausted; there may be 18 more.
      exhausted: false,
      nextAction: 'continue-verification',
      done: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
