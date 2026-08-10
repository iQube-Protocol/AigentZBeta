/**
 * GET/POST /api/research/observer-review/[experimentId]
 *
 * Post-Freeze Observer Review — the round for one experiment's crystal-version
 * artifact (SPEC points 3, 5, 6, 11). This is a SEPARATE mechanism from
 * `/api/research/review` (the automated dual-model R1/R2 pipeline) and from
 * `/api/research/crystal/[experimentId]/freeze-preview` (the pre-freeze
 * ceremony rehearsal) — this route exists ONLY for the post-freeze closure:
 * a package hash-bound to an ALREADY FROZEN artifact, and N independent
 * observer decisions against it.
 *
 * GET  — read-only: the current round (package + decisions + resolution),
 *        for anyone the existing review-access rule already admits
 *        (`callerMayReadExperimentReview`) — admin, or a scoped research-lab
 *        grant in a review-readable role.
 * POST — { action: 'assign', observerRefs: string[], roundPolicy } builds (or
 *        rebuilds) the package from the frozen artifact and declares the
 *        observer assignment + round policy. Restricted to admin or a
 *        `research-steward` / `principal-investigator` grant — never the
 *        reviewer/observer role itself (SPEC point 12: reviewers inspect,
 *        comment, propose and submit decisions; they do not constitute the
 *        review round they participate in).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { callerMayReadExperimentReview, resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { getArtifact } from '@/services/research/artifacts';
import {
  resolveObserverRound,
  deriveCallerObserverStatus,
  blindOtherObserverDecisions,
  projectResolutionForCaller,
} from '@/services/research/crystalObserverReview';
import {
  observerRoundId,
  getObserverRound,
} from '@/services/research/observerReviewStore';
import { assignObserverRound } from '@/services/research/observerRoundAssignment';

export const dynamic = 'force-dynamic';

const STEWARD_ROLES = new Set(['research-steward', 'principal-investigator']);

export async function GET(req: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  try {
    return await getImpl(req, await params);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Unhandled error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

async function getImpl(req: NextRequest, { experimentId }: { experimentId: string }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseServer();
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;
  const mayRead = isAdmin || (admin ? await callerMayReadExperimentReview(admin, persona.personaId, experimentId) : false);
  if (!mayRead) return NextResponse.json({ ok: false, error: 'Steward or assigned-reviewer access required' }, { status: 403 });
  if (!admin) return NextResponse.json({ ok: false, error: 'Store unavailable' }, { status: 503 });

  const callerRef = personaPublicRef(persona.personaId);
  const grant = isAdmin ? null : await resolveExperimentReviewGrant(admin, persona.personaId, experimentId);
  const isSteward = isAdmin || (grant ? STEWARD_ROLES.has(grant.role) : false);

  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  if (!artifact) {
    return NextResponse.json({
      ok: true,
      round: null,
      resolution: null,
      note: `No crystal-version artifact exists yet for ${experimentId} — there is nothing to observe.`,
    });
  }

  const roundId = observerRoundId(experimentId, artifact.id);
  const round = await getObserverRound(admin, roundId);
  if (!round || !round.package) {
    return NextResponse.json({
      ok: true,
      round: round ?? null,
      resolution: null,
      artifact: { id: artifact.id, lifecycle: artifact.lifecycle },
      note:
        artifact.lifecycle === 'frozen'
          ? 'The crystal is frozen but no Observer Review round has been assigned yet — POST { action: "assign" } to open one.'
          : `The crystal-version artifact is '${artifact.lifecycle}', not 'frozen' — an Observer Review round can only be assigned once it is frozen.`,
    });
  }

  /*
   * OBSERVER INDEPENDENCE (fixed 2026-08-09, Validation Programme JSON Agent
   * Package completeness pass, point 8; TIGHTENED 2026-08-09, second and
   * third passes): this endpoint previously returned `round.decisions` —
   * EVERY assigned observer's rationale and outcome — to any caller with
   * review-read access, including a peer observer who had not yet decided.
   * That is exactly the "did the other reviewer already accept?" leak
   * independent review exists to prevent (the same defect class
   * `review/isolation.ts` guards against for R1/R2, restated here for N
   * human observers).
   *
   * The FIRST fix blinded decision CONTENT. The SECOND blinded decision
   * PROGRESS naming a ref: `resolution.outstandingObserverRefs` and its
   * free-text `detail` ("waiting on <ref>…") still named exactly which OTHER
   * principal had not decided, and `round.package.assignedObserverRefs`
   * still listed every principal's ref. The THIRD (this pass) closes the
   * remaining by-elimination leak: in a 2-observer round, EVEN THE REF-FREE
   * `callerObserverStatus.otherDecisionsOutstanding` boolean let an
   * undecided caller invert "has the one other principal decided?" into a
   * fact about that principal specifically. `mayViewAllDecisions` below now
   * ALSO gates whether `otherDecisionsOutstanding` is present at all (see
   * `deriveCallerObserverStatus`'s doc comment) — not just whether refs are
   * shown.
   *
   * A steward's oversight view is unaffected: stewards assign the round and
   * resolve change proposals, are not themselves a voting peer, and already
   * hold this information through that authority.
   */
  const callerHasDecided = round.decisions.some((d) => d.observerRef === callerRef);
  const roundClosed = round.status !== 'open';
  const mayViewAllDecisions = isSteward || callerHasDecided || roundClosed;

  // The AGGREGATE resolution is computed from the FULL, real decision set —
  // never the blinded projection below. Blinding is a display concern for
  // this ONE caller; it must never change what the round actually resolves
  // to (SPEC point 12's "resolve, do not ratify" discipline extended here).
  const resolution = resolveObserverRound({ pkg: round.package, decisions: round.decisions });
  const callerObserverStatus = deriveCallerObserverStatus({
    pkg: round.package,
    decisions: round.decisions,
    callerRef,
    mayViewOthersProgress: mayViewAllDecisions,
  });
  const decisions = blindOtherObserverDecisions({ decisions: round.decisions, callerRef, mayViewAll: mayViewAllDecisions });
  const projectedResolution = projectResolutionForCaller(resolution, mayViewAllDecisions);
  const projectedPackage = mayViewAllDecisions
    ? round.package
    : { ...round.package, assignedObserverRefs: undefined };

  return NextResponse.json({
    ok: true,
    round: { ...round, package: projectedPackage, decisions },
    resolution: projectedResolution,
    callerObserverStatus,
    decisionsBlinded: !mayViewAllDecisions,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  try {
    return await postImpl(req, await params);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Unhandled error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

async function postImpl(req: NextRequest, { experimentId }: { experimentId: string }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Store unavailable' }, { status: 503 });
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;

  if (!isAdmin) {
    const grant = await resolveExperimentReviewGrant(admin, persona.personaId, experimentId);
    if (!grant || !STEWARD_ROLES.has(grant.role)) {
      return NextResponse.json(
        { ok: false, error: 'Only a research-steward, principal-investigator, or admin may assign an Observer Review round.' },
        { status: 403 },
      );
    }
  }

  const body = await req.json().catch(() => null);
  if (body?.action !== 'assign') {
    return NextResponse.json({ ok: false, error: "Unknown action — only 'assign' is supported" }, { status: 400 });
  }
  const observerRefs: string[] = Array.isArray(body.observerRefs) ? body.observerRefs.filter((x: unknown) => typeof x === 'string') : [];

  const result = await assignObserverRound(admin, {
    experimentId,
    observerRefs,
    requestedRoundPolicy: body.roundPolicy,
    actorPersonaId: persona.personaId,
    createdAt: new Date().toISOString(),
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, round: result.round });
}
