/**
 * /api/research/review/[reviewId] — the Review Result view (SPEC §12).
 *
 * GET  — the compact result: reviewer agreement, contested items, limitations,
 *        hashes, the receipt and the redacted package.
 * POST — record a governed resolution: accept · revise · defer · reject.
 *
 * ── The four actions do not touch the corpus ───────────────────────────────
 *
 * Each records a resolution ON THE REVIEW RECORD. None writes to `invariants`,
 * grants Standing, changes an asset's lifecycle, or freezes anything.
 * `accept` is the one a reader will assume is a write, so the effect text is
 * carried in the response next to the action: accepting a review accepts its
 * findings AS EVIDENCE. The freeze remains a separate governed act (SPEC §1,
 * §14.13).
 *
 * The route imports no corpus writer and no Standing service — a canary greps
 * for exactly that, because "it doesn't currently call one" is a property that
 * survives only as long as nobody adds a convenient import.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireReviewAccess, requireReviewReadAccess } from '../_lib/gate';
import {
  getReview,
  upsertReview,
  REVIEW_ACTION_EFFECT,
  REVIEW_RESULT_ACTIONS,
  type ReviewResultAction,
} from '@/services/research/independentReviewStore';
import { redactedPreview, ReviewRefusal, tallyResolutions } from '@/services/research/review';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) {
  const gate = await requireReviewReadAccess(req);
  if (!gate.ok) return gate.response;
  const { reviewId } = await ctx.params;

  try {
    const record = await getReview(gate.caller.admin, reviewId);
    if (!record) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    // Reviewer-scoped read (SPEC-IRL-WORKSPACE-001 §10): a non-admin caller
    // may open ONLY a review whose experimentId is within their granted set.
    // A review with no experimentId at all is never guessed as theirs.
    if (gate.caller.allowedExperiments !== 'all') {
      const expId = record.request?.experimentId;
      if (!expId || !gate.caller.allowedExperiments.has(expId)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
    }

    // RECORD-LEVEL DETAIL (operator ruling, 2026-08-02: "the contested records
    // need to be clickable to see their detail").
    //
    // Each contested row carries only the two LABELS. That is enough to show a
    // disagreement exists and nothing like enough to adjudicate it — the
    // reasons, the evidence the reviewers cited, the limitations they stated
    // and the commitment over their raw output all live on the decisions.
    //
    // Attached to the contested rows themselves rather than returned as a
    // parallel array: one object per contested subject, so a client cannot
    // pair the wrong reason with the wrong row, and there is no second
    // projection to drift.
    const r1By = new Map(record.r1Decisions.map((d) => [d.subjectRef, d]));
    const r2By = new Map(record.r2Decisions.map((d) => [d.subjectRef, d]));
    const contested = (record.resolutions ?? [])
      .filter((r) => r.status === 'contested')
      .map((r) => ({
        ...r,
        // `null` where a reviewer returned nothing for this subject — that is
        // the "a missing second pass is not a passing second pass" case, and
        // it must read as absent rather than as an empty decision.
        r1: r1By.get(r.subjectRef) ?? null,
        r2: r2By.get(r.subjectRef) ?? null,
      }));
    const limitations = [...record.r1Decisions, ...record.r2Decisions]
      .flatMap((d) => d.limitations)
      .filter((l, i, arr) => arr.indexOf(l) === i)
      .slice(0, 40);

    return NextResponse.json({
      ok: true,
      review: {
        reviewId: record.reviewId,
        queueState: record.queueState,
        request: record.request,
        reviewers: record.assignments,
        steward: record.steward,
        blockDecisions: record.blockDecisions,
        // Derived by the adjudication service, not hand-counted here. The
        // hand-counted version omitted 'accepted' and 'deferred' — harmless
        // while nothing could produce them, and silently lossy the moment the
        // record-level remedy could: a remedied row would vanish from every
        // count and the totals would no longer sum to the subject count.
        tally: tallyResolutions(record.resolutions ?? []),
        contested,
        limitations,
        action: record.action,
        actionReason: record.actionReason,
        actionAt: record.actionAt,
        receiptId: record.receiptId,
        // Supersession (operator ruling 2026-07-31): a superseded row stays
        // fully readable for audit history but must never look governable —
        // the client uses this to show a banner and disable the four
        // resolution actions. The POST handler below is the authoritative
        // enforcement; this is what lets the UI agree with it before a click.
        supersededBy: record.supersededBy ?? null,
        supersededReason: record.supersededReason ?? null,
      },
      // The SAME sealed object the reviewers received, re-verified on read.
      preview: record.package ? redactedPreview(record.package) : null,
      actionEffects: REVIEW_ACTION_EFFECT,
    });
  } catch (e) {
    if (e instanceof ReviewRefusal) {
      return NextResponse.json({ ok: false, refusalCode: e.refusalCode, error: e.message }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'read failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;
  const { reviewId } = await ctx.params;

  let body: { action?: string; reason?: string };
  try {
    body = (await req.json()) as { action?: string; reason?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const action = body.action as ReviewResultAction | undefined;
  if (!action || !REVIEW_RESULT_ACTIONS.includes(action)) {
    return NextResponse.json(
      { ok: false, error: `action must be one of ${REVIEW_RESULT_ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }
  const reason = (body.reason ?? '').trim();
  if (!reason) {
    // A governed resolution with no stated reason is indistinguishable from a
    // stray click in the audit trail.
    return NextResponse.json({ ok: false, error: 'a governed resolution requires a stated reason' }, { status: 400 });
  }

  try {
    const record = await getReview(gate.caller.admin, reviewId);
    if (!record) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    // Supersession preserves evidence and removes authority to resolve the
    // superseded record (operator ruling 2026-07-31). This is the
    // authoritative enforcement — the client disabling its buttons is UX,
    // not the guarantee; a request that reaches here anyway is refused.
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

    const at = new Date().toISOString();
    await upsertReview(gate.caller.admin, {
      ...record,
      queueState: 'resolved',
      action,
      actionReason: reason,
      actionByRef: gate.caller.callerRef,
      actionAt: at,
      receiptId: record.receiptId,
    });

    return NextResponse.json({
      ok: true,
      action,
      effect: REVIEW_ACTION_EFFECT[action],
      // Stated in the response as data, not only in the docs: no consumer of
      // this endpoint may read a resolution as an admission of the asset.
      corpusWritten: false,
      standingGranted: false,
      lifecycleChanged: false,
      assetFrozen: false,
      resolvedAt: at,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'resolution failed' }, { status: 500 });
  }
}
