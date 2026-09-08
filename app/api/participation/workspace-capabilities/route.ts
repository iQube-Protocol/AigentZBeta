/**
 * GET /api/participation/workspace-capabilities?workspaceId=...
 *
 * The role-projected capability manifest for ONE research workspace's
 * Overview surface (2026-09-08, IRL OS Workspace consolidation): which
 * existing EXP-P1-Readiness-shaped/document/review capabilities are
 * available for THIS workspace, for THIS caller — never a hardcoded EXP-P1
 * special case. Generalised over any `EXPERIMENT_REGISTRY`-listed experiment
 * via `services/research/irlExperimentPathScope.ts` and
 * `services/research/reviewerAgreement.ts::currentReviewerAgreement`.
 *
 * FAIL CLOSED: this route independently re-verifies the caller may read this
 * experiment (admin OR `resolveExperimentReviewGrant`) — it does not trust
 * that the caller only asks about workspaces `/api/participation/my-experiments`
 * already showed them. A workspace with no `experimentId` (a programme/cohort
 * container, not a leaf experiment) returns an honest empty capability set,
 * never a 403 — there is nothing experiment-scoped to gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { getResearchWorkspace } from '@/services/research/researchWorkspace';
import { listIrlPackDocumentsForExperiment } from '@/services/research/irlExperimentPathScope';
import { currentReviewerAgreement } from '@/services/research/reviewerAgreement';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

/** Experiments the readiness dashboard (PRD-EPI-001 §10) is built for —
 *  mirrors `ExpP1ReadinessTab`'s own `EXPERIMENT_IDS`. Not every
 *  `EXPERIMENT_REGISTRY` entry has a "Crystal readiness" concept (OCSGA does
 *  not — it has no Crystal at all), so this is a deliberate, named allowlist,
 *  not a further-generalised derivation that would fabricate a readiness
 *  surface for an experiment that has no readiness pipeline behind it. */
const READINESS_AVAILABLE_EXPERIMENTS = new Set(['EXP-P1', 'EXP-P2', 'EXP-P3']);

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'workspaceId is required' }, { status: 400 });
  }
  const ws = getResearchWorkspace(workspaceId);
  if (!ws) {
    return NextResponse.json({ ok: false, error: 'Unknown workspace' }, { status: 404 });
  }

  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const experimentId = ws.experimentId ?? null;

  if (!experimentId) {
    // A programme/cohort container, not a leaf experiment — nothing
    // experiment-scoped to show. Not an error; not a gate.
    return NextResponse.json({
      ok: true,
      workspaceId,
      experimentId: null,
      documents: [],
      readinessAvailable: false,
      reviewAgreementAvailable: false,
    });
  }

  if (!isAdmin) {
    const grant = await resolveExperimentReviewGrant(admin, persona.personaId, experimentId);
    if (!grant) {
      return NextResponse.json(
        { ok: false, error: 'Admin or a scoped research-lab reviewer grant for this experiment is required.' },
        { status: 403 },
      );
    }
  }

  const origin = resolveRequestOrigin(req);
  const documentPaths = await listIrlPackDocumentsForExperiment(experimentId);
  const documents = documentPaths.map((path) => ({
    path,
    url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(path)}`,
  }));

  return NextResponse.json({
    ok: true,
    workspaceId,
    experimentId,
    documents,
    readinessAvailable: READINESS_AVAILABLE_EXPERIMENTS.has(experimentId),
    reviewAgreementAvailable: currentReviewerAgreement(experimentId) !== null,
  });
}
