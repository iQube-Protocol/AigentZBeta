/**
 * /api/research/review/[reviewId]/resolution — the RECORD-level governed remedy.
 *
 * ── Why this is a separate route from the sibling POST ─────────────────────
 *
 * `../route.ts`'s POST records a resolution on the REVIEW (accept · revise ·
 * defer · reject — "what do we do with this review's findings"). This one
 * resolves a single contested ROW inside it ("which of the two labels the
 * reviewers returned for this subject stands"). Different target, different
 * vocabulary, different effect. Overloading one handler on the presence of a
 * `subjectRef` would give two governed acts one validation path and one audit
 * shape, which is precisely how the wrong one gets performed by accident.
 *
 * ── Internal only, and enforced here ───────────────────────────────────────
 *
 * The operator's ruling was "in the internal version this modal should allow
 * remedy acceptance". `requireReviewAccess` — not `requireReviewReadAccess` —
 * is what makes that true: an external reviewer holding a review-readable
 * grant can OPEN a contested record and read every reviewer's verbatim
 * decision, and is refused 403 here. The client hiding the form is UX; this
 * gate is the guarantee.
 *
 * ── What it does not do ────────────────────────────────────────────────────
 *
 * Ratifying a label does not write to the corpus, grant Standing, change a
 * lifecycle or freeze anything — same as its sibling, and the response says so
 * in data rather than only in prose. It also does not resolve the review: a
 * review with remedied rows is still `completed` until someone records the
 * review-level action.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireReviewAccess } from '../../_lib/gate';
import { deriveQueueState, getReview, upsertReview } from '@/services/research/independentReviewStore';
import { resolveContestedRecord, ReviewRefusal } from '@/services/research/review';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;
  const { reviewId } = await ctx.params;

  let body: { subjectRef?: string; remedy?: string; operatorDecision?: string; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const subjectRef = (body.subjectRef ?? '').trim();
  if (!subjectRef) {
    return NextResponse.json({ ok: false, error: 'subjectRef is required' }, { status: 400 });
  }
  const remedy = body.remedy === 'adopt' || body.remedy === 'defer' ? body.remedy : null;
  if (!remedy) {
    return NextResponse.json({ ok: false, error: "remedy must be 'adopt' or 'defer'" }, { status: 400 });
  }

  try {
    const record = await getReview(gate.caller.admin, reviewId);
    if (!record) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    // Same supersession rule as the review-level action: a superseded record
    // keeps its evidence and loses its authority to be governed.
    if (record.supersededBy) {
      return NextResponse.json(
        {
          ok: false,
          refusalCode: 'REVIEW_SUPERSEDED',
          error: `${reviewId} was superseded by ${record.supersededBy} and can no longer be governed-resolved`,
          reviewId,
          supersededBy: record.supersededBy,
        },
        { status: 409 },
      );
    }

    const index = (record.resolutions ?? []).findIndex((r) => r.subjectRef === subjectRef);
    if (index === -1) {
      return NextResponse.json(
        {
          ok: false,
          refusalCode: 'UNKNOWN_SUBJECT_REF',
          error: `${subjectRef} is not a row in ${reviewId}`,
        },
        { status: 404 },
      );
    }

    const at = new Date().toISOString();
    // The rule lives in the adjudication service, so a remedied label lands on
    // exactly the status an agreed one would. Its refusals are the validation.
    const next = resolveContestedRecord(record.resolutions[index], {
      remedy,
      operatorDecision: body.operatorDecision,
      reason: body.reason ?? '',
      resolvedByRef: gate.caller.callerRef,
      resolvedAt: at,
    });

    const resolutions = [...record.resolutions];
    resolutions[index] = next;
    const contestedRemaining = resolutions.filter((r) => r.status === 'contested').length;

    // The queue state is DERIVED from how many rows remain in dispute — so
    // remedying the last contested row moves the review out of 'contested'.
    // Only that pair is ever rewritten: a 'planned' or 'running' review has
    // not finished, and a 'resolved' one already carries a review-level
    // action that a row remedy has no authority to undo.
    const queueState =
      record.queueState === 'contested' || record.queueState === 'completed'
        ? deriveQueueState(contestedRemaining)
        : record.queueState;

    await upsertReview(gate.caller.admin, { ...record, queueState, resolutions });

    return NextResponse.json({
      ok: true,
      resolution: next,
      queueState,
      // How many rows remain in dispute — the client needs this to know
      // whether the review is still contested without a second round trip.
      contestedRemaining,
      corpusWritten: false,
      standingGranted: false,
      lifecycleChanged: false,
      assetFrozen: false,
      resolvedAt: at,
    });
  } catch (e) {
    if (e instanceof ReviewRefusal) {
      return NextResponse.json({ ok: false, refusalCode: e.refusalCode, error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'record resolution failed' },
      { status: 500 },
    );
  }
}
