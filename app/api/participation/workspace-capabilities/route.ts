/**
 * GET /api/participation/workspace-capabilities?workspaceId=...
 *
 * The role-projected capability manifest for ONE research workspace's
 * Overview surface (2026-09-08, IRL OS Workspace consolidation; generalized
 * 2026-09-08 second pass). Which existing capabilities are available for
 * THIS workspace, for THIS caller — never a hardcoded EXP-P1 or OCSGA
 * special case.
 *
 * GENERALIZED AROUND THE CANONICAL WORKSPACE, NOT AROUND `experimentId`
 * (operator instruction, second pass): the PRIMARY gate is workspace-level
 * membership — the SAME `getParticipantResearchWorkspaceAccess` projection
 * `/api/participation/my-experiments` and `/api/participation/workspace-tracking`
 * already use. `experimentId` is then just ONE POSSIBLE BINDING on top of
 * that: when a workspace names one (an `EXPERIMENT_REGISTRY` leaf, e.g.
 * EXP-P1), it additionally unlocks the experiment-scoped capabilities
 * (Reviewer Kit documents, Experimental Readiness, Review Agreement) —
 * requiring, in ADDITION to workspace membership, a
 * `resolveExperimentReviewGrant` for that specific experiment (never assume
 * workspace-level membership alone implies experiment-document access). A
 * workspace with NO `experimentId` (a programme/cohort container, e.g.
 * OCSGA) is not thereby capability-less: `exchangeAvailable`/`exchangeIds`
 * resolves the caller's own Reciprocal Artifact Exchange materials keyed
 * DIRECTLY off the canonical `workspaceId` (via
 * `parentExperimentId`/`listMyExchanges`), with no experiment binding at
 * all — the general case this route now actually generalizes to.
 *
 * FAIL CLOSED at both layers: a caller who cannot see this workspace at all
 * (per the canonical membership projection) gets 403 before anything else is
 * resolved; a caller who CAN see the workspace but lacks a specific
 * experiment-scoped grant still gets empty (not fabricated) experiment-bound
 * capabilities, while their workspace-bound capabilities (exchange) still
 * resolve normally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getParticipantResearchWorkspaceAccess, resolveExperimentReviewGrant, resolveWorkspaceRole } from '@/services/passport/participationAccess';
import { getResearchWorkspace } from '@/services/research/researchWorkspace';
import { listIrlPackDocumentsForExperiment } from '@/services/research/irlExperimentPathScope';
import { currentReviewerAgreement } from '@/services/research/reviewerAgreement';
import { listMyExchanges, listExchangesByParentExperiment } from '@/services/research/reciprocalExchange';
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

  // PRIMARY GATE — canonical workspace-level membership, workspaceId-first,
  // never bypassed by an experiment-scoped grant alone (a reviewer scoped to
  // EXP-P1 has no standing here just because EXP-P1 happens to be readable —
  // the workspace itself must be in their entitled set, or they must be
  // admin).
  if (!isAdmin) {
    const entries = await getParticipantResearchWorkspaceAccess(admin, persona.personaId, false);
    if (!entries.some((e) => e.workspaceId === workspaceId)) {
      return NextResponse.json({ ok: false, error: 'Not authorized to read this workspace.' }, { status: 403 });
    }
  }

  const origin = resolveRequestOrigin(req);
  const experimentId = ws.experimentId ?? null;

  // EXPERIMENT-BOUND capabilities — only when this workspace names a
  // registered experiment AND the caller separately holds a grant scoped to
  // it (workspace membership above is necessary but not sufficient for
  // these three; see module header).
  let documents: Array<{ path: string; url: string }> = [];
  let readinessAvailable = false;
  let reviewAgreementAvailable = false;
  if (experimentId) {
    const experimentGrant = isAdmin || (await resolveExperimentReviewGrant(admin, persona.personaId, experimentId)) !== null;
    if (experimentGrant) {
      const documentPaths = await listIrlPackDocumentsForExperiment(experimentId);
      documents = documentPaths.map((path) => ({
        path,
        url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(path)}`,
      }));
      readinessAvailable = READINESS_AVAILABLE_EXPERIMENTS.has(experimentId);
      reviewAgreementAvailable = currentReviewerAgreement(experimentId) !== null;
    }
  }

  // WORKSPACE-BOUND capability — Reciprocal Artifact Exchange materials,
  // keyed DIRECTLY off the canonical workspaceId via `parentExperimentId`
  // (services/research/reciprocalExchange.ts), no experimentId required at
  // all. Starts from the CALLER'S OWN exchanges (`listMyExchanges` is
  // already persona-scoped).
  //
  // Workspace-scoped observer inclusion (2026-09-12, operator instruction:
  // "should not be restricted just to the parties who exchanged them but
  // should be visible to anyone who has access rights to the experiment") —
  // a caller who is not a direct party to any exchange here but DOES hold a
  // research-lab grant reaching this workspace (the SAME `resolveWorkspaceRole`
  // predicate `getExchangeView`/`GET /api/research/exchanges` already use to
  // admit observers) still gets the section: never advertise a capability
  // this same persona's exchange routes would then refuse to open, and never
  // silently hide it either — one authoritative admission check, applied
  // here and at the exchange routes alike.
  let exchangeIds: string[] = [];
  const myExchanges = await listMyExchanges(admin, persona.personaId);
  if (myExchanges.ok) {
    exchangeIds = myExchanges.exchanges.filter((e) => e.parentExperimentId === workspaceId).map((e) => e.id);
  }
  if (!isAdmin) {
    const role = await resolveWorkspaceRole(admin, persona.personaId, workspaceId, experimentId);
    if (role) {
      const all = await listExchangesByParentExperiment(admin, workspaceId);
      if (all.ok) {
        const seen = new Set(exchangeIds);
        for (const e of all.exchanges) {
          if (!seen.has(e.id)) {
            exchangeIds.push(e.id);
            seen.add(e.id);
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    workspaceId,
    experimentId,
    documents,
    readinessAvailable,
    reviewAgreementAvailable,
    exchangeAvailable: exchangeIds.length > 0,
    exchangeIds,
  });
}
