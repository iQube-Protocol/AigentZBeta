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
import { requireReviewAccess } from '../_lib/gate';
import {
  getReview,
  upsertReview,
  REVIEW_ACTION_EFFECT,
  REVIEW_RESULT_ACTIONS,
  type ReviewResultAction,
} from '@/services/research/independentReviewStore';
import { redactedPreview, ReviewRefusal } from '@/services/research/review';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;
  const { reviewId } = await ctx.params;

  try {
    const record = await getReview(gate.caller.admin, reviewId);
    if (!record) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    const contested = (record.resolutions ?? []).filter((r) => r.status === 'contested');
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
        tally: {
          agreed: record.resolutions.filter((r) => r.status === 'agreed').length,
          contested: contested.length,
          rejected: record.resolutions.filter((r) => r.status === 'rejected').length,
          unknown: record.resolutions.filter((r) => r.status === 'unknown').length,
        },
        contested,
        limitations,
        action: record.action,
        actionReason: record.actionReason,
        actionAt: record.actionAt,
        receiptId: record.receiptId,
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
