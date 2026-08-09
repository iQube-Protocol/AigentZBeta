/**
 * POST /api/research/observer-review/[experimentId]/change-proposal
 *
 * Resolve an open Change Proposal raised by an observer's `changes_requested`
 * decision (SPEC point 8). `accept` provisions a NEW candidate artifact
 * version (`draft` lifecycle, via `upsertArtifact` — never mutating the
 * frozen artifact, IRL-016 §4) and opens a FRESH Observer Review round keyed
 * to that new artifact id; the superseded round is marked, never deleted.
 * `decline` closes the proposal with no artifact created and the current
 * round unchanged.
 *
 * Restricted to admin or a `research-steward` / `principal-investigator`
 * grant — the same authority ceiling as assigning a round. An observer may
 * PROPOSE a change (via the decision route); only a steward may ACT on that
 * proposal (SPEC point 12: reviewers propose, they do not canonize).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { upsertArtifact } from '@/services/research/artifacts';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import { resolveChangeProposal } from '@/services/research/crystalObserverReview';
import {
  observerRoundId,
  getObserverRound,
  resolveStoredChangeProposal,
  upsertObserverRound,
  markObserverRoundSuperseded,
} from '@/services/research/observerReviewStore';

export const dynamic = 'force-dynamic';

const STEWARD_ROLES = new Set(['research-steward', 'principal-investigator']);

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
        { ok: false, error: 'Only a research-steward, principal-investigator, or admin may resolve a Change Proposal.' },
        { status: 403 },
      );
    }
  }

  const body = await req.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const outcome = body?.outcome === 'accept' ? 'accept' : body?.outcome === 'decline' ? 'decline' : null;
  const reason = typeof body?.reason === 'string' ? body.reason : '';
  if (!proposalId || !outcome) {
    return NextResponse.json({ ok: false, error: "'proposalId' and 'outcome' ('accept'|'decline') are required" }, { status: 400 });
  }

  const { getArtifact } = await import('@/services/research/artifacts');
  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  if (!artifact) return NextResponse.json({ ok: false, error: `No crystal-version artifact exists for ${experimentId}` }, { status: 409 });

  const roundId = observerRoundId(experimentId, artifact.id);
  const round = await getObserverRound(admin, roundId);
  const current = round?.changeProposals.find((p) => p.proposalId === proposalId) ?? null;
  if (!current) return NextResponse.json({ ok: false, error: `No open change proposal '${proposalId}' found on this round` }, { status: 404 });

  const resolvedAt = new Date().toISOString();
  const personaRef = persona.personaId; // T0-scoped local variable only; never serialised — see below.

  if (outcome === 'decline') {
    const resolved = resolveChangeProposal(current, {
      outcome: 'decline',
      resolvedByRef: `steward:${experimentId}`,
      resolvedAt,
      reason: reason || 'declined without further reason',
    });
    await resolveStoredChangeProposal(admin, roundId, resolved);
    return NextResponse.json({ ok: true, proposal: resolved, supersedingArtifactId: null });
  }

  // accept — provision the superseding candidate at `draft`, then open a
  // fresh round keyed to it. The frozen artifact this proposal was raised
  // against is never touched.
  const versionSuffix = (round?.changeProposals.filter((p) => p.status === 'accepted').length ?? 0) + 2;
  const supersedingArtifactId = `${artifact.id}.v${versionSuffix}`;
  const provisioned = await upsertArtifact({
    id: supersedingArtifactId,
    kind: artifact.kind,
    phase: 'protocol',
    experimentId,
    lifecycle: 'draft',
  });
  if (!provisioned.ok) {
    return NextResponse.json({ ok: false, error: provisioned.error ?? 'could not provision the superseding candidate' }, { status: 500 });
  }

  const resolved = resolveChangeProposal(current, {
    outcome: 'accept',
    supersedingArtifactId,
    resolvedByRef: `steward:${experimentId}`,
    resolvedAt,
    reason: reason || 'change proposal accepted',
  });
  await resolveStoredChangeProposal(admin, roundId, resolved);

  const freshRoundId = observerRoundId(experimentId, supersedingArtifactId);
  await upsertObserverRound(admin, {
    roundId: freshRoundId,
    experimentId,
    artifactId: supersedingArtifactId,
    status: 'awaiting-freeze',
    package: null,
    roundPolicy: round?.roundPolicy ?? 'all-assigned',
    assignedObserverRefs: round?.assignedObserverRefs ?? [],
    decisions: [],
    changeProposals: [],
    supersedes: roundId,
    supersededBy: null,
  });
  await markObserverRoundSuperseded(admin, roundId, freshRoundId);

  await writeLifecycleReceipt({
    personaId: personaRef,
    summary:
      `${experimentId} Change Proposal '${proposalId}' accepted — superseding candidate '${supersedingArtifactId}' ` +
      `provisioned at draft; fresh Observer Review round '${freshRoundId}' opened (awaiting its own freeze before a ` +
      `package can be built)`,
    invariantSeedIds: [],
  }).catch(() => null);

  return NextResponse.json({ ok: true, proposal: resolved, supersedingArtifactId, freshRoundId });
}
