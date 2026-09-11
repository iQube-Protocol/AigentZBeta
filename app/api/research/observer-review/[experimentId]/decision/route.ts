/**
 * POST /api/research/observer-review/[experimentId]/decision
 *
 * Self-service, persona-scoped structured Observer Decision submission
 * (SPEC point 4). The caller's OWN persona resolves to their T2-safe
 * `personaPublicRef` — a caller may only ever submit a decision attributed to
 * THEMSELVES, and only when that ref is one the current package actually
 * assigned (`validateObserverDecision` refuses otherwise). There is no
 * `observerRef` field in the request body: it is never taken from the
 * caller, always derived server-side from the authenticated persona.
 *
 * Gated by the SAME Independent Reviewer Agreement that already governs
 * "submit findings attributable to you" (services/research/reviewerAgreement.ts)
 * — a decision is exactly that act, so this reuses the existing consent gate
 * rather than inventing a second one.
 *
 * A `changes_requested` decision creates a Change Proposal in the SAME call
 * (SPEC point 8) — it never mutates the frozen artifact; `proposedChange` is
 * required in the body when `decision === 'changes_requested'`.
 *
 * A `submittedByAgentRef` in the body records that a delegated research agent
 * assisted (SPEC point 7) — it is carried as attributable evidence only. The
 * decision is still recorded under the caller's own `observerRef`, so any
 * number of agent-assisted resubmissions from the same human observer still
 * resolve to exactly one vote (enforced by `upsertObserverDecision`'s
 * upsert-by-observerRef semantics, not by anything in this route).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { callerMayReadExperimentReview } from '@/services/passport/participationAccess';
import { requireReviewerAgreement } from '@/services/research/reviewerAgreement';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import {
  validateObserverDecision,
  resolveObserverRound,
  createChangeProposal,
  type ObserverDecisionKind,
} from '@/services/research/crystalObserverReview';
import {
  observerRoundId,
  getObserverRound,
  upsertObserverDecision,
  appendChangeProposal,
} from '@/services/research/observerReviewStore';

export const dynamic = 'force-dynamic';

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
  const mayRead = isAdmin || (await callerMayReadExperimentReview(admin, persona.personaId, experimentId));
  if (!mayRead) {
    return NextResponse.json(
      { ok: false, error: 'A reviewer/steward grant scoped to this experiment is required to submit an Observer Decision.' },
      { status: 403 },
    );
  }

  const observerRef = personaPublicRef(persona.personaId);

  const agreementGate = await requireReviewerAgreement(admin, { personaId: persona.personaId, experimentId });
  if (!agreementGate.ok) {
    return NextResponse.json({ ok: false, refusal: agreementGate.refusal }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const decision = body?.decision as ObserverDecisionKind | undefined;
  const rationale = typeof body?.rationale === 'string' ? body.rationale : '';
  const evidenceRefs = Array.isArray(body?.evidenceRefs) ? body.evidenceRefs.filter((x: unknown) => typeof x === 'string') : [];
  const submittedByAgentRef = typeof body?.submittedByAgentRef === 'string' ? body.submittedByAgentRef : null;
  const proposedChange = typeof body?.proposedChange === 'string' ? body.proposedChange : undefined;
  if (!decision) return NextResponse.json({ ok: false, error: "'decision' is required" }, { status: 400 });

  // Find the artifact this experiment's crystal-version round targets.
  const { getArtifact } = await import('@/services/research/artifacts');
  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  if (!artifact) return NextResponse.json({ ok: false, error: `No crystal-version artifact exists yet for ${experimentId}` }, { status: 409 });

  const roundId = observerRoundId(experimentId, artifact.id);
  const round = await getObserverRound(admin, roundId);
  if (!round || !round.package) {
    return NextResponse.json(
      { ok: false, error: 'No Observer Review round has been assigned for this crystal yet — a steward must assign one first.' },
      { status: 409 },
    );
  }
  if (round.status !== 'open') {
    return NextResponse.json({ ok: false, error: `This round is '${round.status}', not 'open' — it no longer accepts decisions.` }, { status: 409 });
  }

  let observerDecision;
  try {
    observerDecision = validateObserverDecision({
      pkg: round.package,
      observerRef,
      decision,
      rationale,
      evidenceRefs,
      submittedByAgentRef,
      decidedAt: new Date().toISOString(),
      proposedChange,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const updated = await upsertObserverDecision(admin, roundId, observerDecision);

  let changeProposal = null;
  if (decision === 'changes_requested' && proposedChange) {
    changeProposal = createChangeProposal({
      proposalId: `${roundId}:proposal:${observerRef}:${Date.now()}`,
      decision: observerDecision,
      proposedChange,
      createdAt: new Date().toISOString(),
    });
    await appendChangeProposal(admin, roundId, changeProposal);
  }

  const resolution = resolveObserverRound({ pkg: round.package, decisions: updated.decisions });

  await writeLifecycleReceipt({
    personaId: persona.personaId,
    summary:
      `${experimentId} Observer Decision '${decision}' by ${observerRef} against package ` +
      `${round.package.packageHash.slice(0, 16)}… — round acceptance now '${resolution.acceptance}'` +
      (submittedByAgentRef ? ` (delegated agent ${submittedByAgentRef} assisted; vote remains the observer's own)` : ''),
    invariantSeedIds: [],
  }).catch(() => null);

  return NextResponse.json({ ok: true, decision: observerDecision, changeProposal, resolution });
}
