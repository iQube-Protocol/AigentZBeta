/**
 * /api/research/review — the Review Queue and New Review actions (SPEC §12).
 *
 * GET  — the queue: running · completed · contested · awaiting resolution.
 * POST — freeze a package and either PREVIEW it or RUN the review.
 *
 * ── Two POST modes, and why preview is the default ─────────────────────────
 *
 *   { mode: 'preview' }  builds the block decision, seals and hashes the
 *                        package, resolves and verifies the reviewer pair, and
 *                        returns the REDACTED PREVIEW. Nothing is dispatched.
 *   { mode: 'run' }      does all of that and then dispatches both reviewers.
 *
 * The preview is where a human can see that blinding actually held before
 * committing to a run, so it is the default and `run` must be asked for. The
 * preview is the sealed package object itself — not a second projection of it
 * (see `redactedPreview`), because a preview built by a parallel path drifts
 * from the thing it is supposed to be evidence about.
 *
 * ── What this route will not do ────────────────────────────────────────────
 *
 * It never writes to `invariants`, never grants Standing, never changes an
 * asset's lifecycle and never freezes a crystal. Its only write is the review
 * record in `research_objects`. The reviewers themselves reach no database at
 * all — they receive the frozen package as data.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireReviewAccess } from './_lib/gate';
import { resolveReviewerSelection, type ReviewerSlotSelection } from './_lib/resolveSelection';
import { buildReviewPlan } from '@/services/research/independentReviewPlan';
import { listReviews, upsertReview } from '@/services/research/independentReviewStore';
import {
  buildReviewRequest,
  createFileBackedProvider,
  createVeniceProvider,
  DEFAULT_DETERMINISM,
  redactedPreview,
  ReviewRefusal,
  runDualReview,
  type ReviewProvider,
  type ReviewerAssignment,
  type ReviewerSlot,
  type StewardAssignment,
} from '@/services/research/review';
import { EXP_P1_REVIEW_QUESTION } from '@/services/research/review/templates/expP1Admissibility';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;
  try {
    const reviews = await listReviews(gate.caller.admin);
    return NextResponse.json({
      ok: true,
      reviews: reviews.map((r) => ({
        reviewId: r.reviewId,
        queueState: r.queueState,
        packageHash: r.package?.packageHash ?? null,
        assetRef: r.request?.packageRef ?? null,
        reviewMode: r.request?.reviewMode ?? null,
        reviewers: (r.assignments ?? []).map((a) => ({
          reviewerSlot: a.reviewerSlot,
          reviewerType: a.reviewerType,
          requestedModelId: a.requestedModelId ?? null,
          resolvedModelId: a.resolvedModelId ?? null,
          modelFamily: a.modelFamily ?? null,
          humanReviewerRef: a.humanReviewerRef ?? null,
        })),
        subjectCount: r.package?.subjects?.length ?? 0,
        contestedCount: (r.resolutions ?? []).filter((x) => x.status === 'contested').length,
        agreedCount: (r.resolutions ?? []).filter((x) => x.status === 'agreed').length,
        action: r.action,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'queue read failed' }, { status: 500 });
  }
}

interface CreateBody {
  mode?: 'preview' | 'run';
  version?: string;
  reviewers?: Partial<Record<ReviewerSlot, ReviewerSlotSelection>>;
  stewardRef?: string;
  stewardInterim?: boolean;
  stewardInterimReason?: string;
  /** Adjudication text for a human slot, in DECISION_OUTPUT_SCHEMA form. */
  humanDecisions?: Partial<Record<ReviewerSlot, string>>;
}

export async function POST(req: NextRequest) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const mode = body.mode === 'run' ? 'run' : 'preview';
  const version = (body.version ?? 'vP1').trim() || 'vP1';
  const nowIso = new Date().toISOString();

  try {
    const provider = createVeniceProvider();
    const catalogue = await provider.listModels();

    // AUTHORITATIVE: families come from the catalogue the server just read, and
    // the same assertion the CLI uses decides. The client sends model ids only.
    const { assignments, isPairAmendment, amendedFrom } = resolveReviewerSelection({
      selection: body.reviewers ?? {},
      catalogue,
      runAtIso: nowIso,
    });

    const plan = await buildReviewPlan(gate.caller.admin, { version, createdAt: nowIso });
    const preview = redactedPreview(plan.pkg);

    const steward: StewardAssignment = {
      stewardRef: body.stewardRef?.trim() || gate.caller.callerRef,
      interim: body.stewardInterim !== false,
      interimReason:
        body.stewardInterim === false
          ? undefined
          : body.stewardInterimReason?.trim() ||
            'The Independent Review Steward role is not yet assigned; the operator acts as interim ' +
              'steward. Recorded as interim so a later reader can see that the routine reviewer and ' +
              'the final governed authority were the same party.',
    };

    const request = buildReviewRequest({
      reviewId: plan.reviewId,
      experimentId: `EXP-P1/${version}`,
      assetType: 'invariant-set',
      reviewMode: 'dual',
      reviewQuestion: EXP_P1_REVIEW_QUESTION,
      rubricId: plan.pkg.rubricRef,
      packageRef: plan.pkg.packageId,
      pkg: plan.pkg,
      requestedAt: nowIso,
      requestedByRef: gate.caller.callerRef,
    });

    const summary = {
      reviewId: plan.reviewId,
      packageHash: plan.pkg.packageHash,
      hashVerified: preview.hashVerified,
      corpusRowCount: plan.corpusRowCount,
      inBoundaryCount: plan.inBoundaryCount,
      outOfBoundaryCount: plan.outOfBoundaryCount,
      classC: {
        assessed: plan.block.assessed,
        admitted: plan.block.admitted,
        extracted: plan.block.extracted.length,
        ruling: plan.block.ruling,
        populationQuery: plan.block.populationQuery,
        namespaceCounts: plan.block.namespaceCounts,
        earliestCreatedAt: plan.block.earliestCreatedAt,
        latestCreatedAt: plan.block.latestCreatedAt,
        taskConstructionBegun: plan.block.taskConstructionBegun,
        representativeSample: plan.block.representativeSample,
      },
      individuallyEnumerated: plan.individuallyEnumerated,
      mechanicallyFlagged: plan.mechanicallyFlagged.length,
      reviewers: assignments,
      isPairAmendment,
      amendedFrom,
      steward,
    };

    if (mode === 'preview') {
      await upsertReview(gate.caller.admin, {
        reviewId: plan.reviewId,
        queueState: 'planned',
        request,
        package: plan.pkg,
        assignments: [...assignments],
        steward,
        blockDecisions: [plan.block],
        r1Decisions: [],
        r2Decisions: [],
        resolutions: [],
        action: null,
        actionReason: null,
        actionByRef: null,
        actionAt: null,
      });
      // The preview IS the sealed package — same object, same hash.
      return NextResponse.json({ ok: true, mode, summary, preview });
    }

    const providerFor = (a: ReviewerAssignment): ReviewProvider => {
      if (a.reviewerType !== 'human') return provider;
      const raw = body.humanDecisions?.[a.reviewerSlot];
      if (!raw?.trim()) {
        throw new ReviewRefusal(
          'missing-human-adjudication',
          `${a.reviewerSlot} is a human slot but no adjudication was supplied for it. A human reviewer ` +
            'returns the same decision schema a model does; there is no separate path.',
        );
      }
      return createFileBackedProvider({ reviewerRef: a.humanReviewerRef!, rawDecisions: raw });
    };

    const artifacts = await runDualReview({
      request,
      pkg: plan.pkg,
      r1: { assignment: assignments[0], provider: providerFor(assignments[0]) },
      r2: { assignment: assignments[1], provider: providerFor(assignments[1]) },
      steward,
      determinism: DEFAULT_DETERMINISM,
      coverage: {
        sampleRate: plan.coverage.sampleRate,
        sampleSeed: plan.coverage.sampleSeed,
        mechanicallyFlagged: plan.mechanicallyFlagged,
      },
      assetRef: plan.assetRef,
      assetCommitment: plan.assetCommitment,
      now: () => new Date().toISOString(),
    });

    await upsertReview(gate.caller.admin, {
      reviewId: plan.reviewId,
      queueState: artifacts.tally.contested > 0 ? 'contested' : 'completed',
      request,
      package: plan.pkg,
      assignments: [...assignments],
      steward,
      blockDecisions: [plan.block],
      r1Decisions: artifacts.r1Decisions,
      r2Decisions: artifacts.r2Decisions,
      resolutions: artifacts.resolutions,
      action: null,
      actionReason: null,
      actionByRef: null,
      actionAt: null,
    });

    return NextResponse.json({
      ok: true,
      mode,
      summary,
      preview,
      tally: artifacts.tally,
      contested: artifacts.contested,
      preRunManifest: artifacts.preRunManifest,
      receipt: artifacts.receipt,
    });
  } catch (e) {
    if (e instanceof ReviewRefusal) {
      // A refusal is the expected outcome of a bad selection, not a server
      // error: 409 so the surface renders the reason rather than a stack trace.
      return NextResponse.json({ ok: false, refusalCode: e.refusalCode, error: e.message }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'review failed' }, { status: 500 });
  }
}
