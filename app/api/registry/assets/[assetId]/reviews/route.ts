import { NextRequest, NextResponse } from "next/server";
import {
  listReviewsForAsset,
  createReview,
  updateReview,
  updateAsset,
} from "@/services/registry/persistence";
import { emitReceipt } from "@/services/registry/receiptEmitter";

type Params = { params: { assetId: string } };

/** GET /api/registry/assets/[assetId]/reviews */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const reviews = await listReviewsForAsset(params.assetId);
    return NextResponse.json({ ok: true, data: reviews });
  } catch (err) {
    console.error("[registry/assets/reviews] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/registry/assets/[assetId]/reviews
 * Create a new review or record a decision on an existing review.
 *
 * To create:  { action: "create", reviewerId, reviewerType?, requestedTrustBand?, notes? }
 * To decide:  { action: "decide", reviewId, decision, notes?, tenantId }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === "create") {
      if (!body.reviewerId) {
        return NextResponse.json({ ok: false, error: "reviewerId is required" }, { status: 400 });
      }
      const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const review = await createReview({
        reviewId,
        assetId: params.assetId,
        validationId: body.validationId as string | undefined,
        reviewerId: body.reviewerId as string,
        reviewerType: (body.reviewerType as "human" | "agent") ?? "human",
        requestedTrustBand: body.requestedTrustBand as string | undefined as any,
        notes: body.notes as string | undefined,
        evidenceRefs: (body.evidenceRefs as string[]) ?? [],
      });
      return NextResponse.json({ ok: true, data: review }, { status: 201 });
    }

    if (action === "decide") {
      if (!body.reviewId || !body.decision || !body.tenantId) {
        return NextResponse.json(
          { ok: false, error: "reviewId, decision, and tenantId are required" },
          { status: 400 }
        );
      }
      const now = new Date().toISOString();
      const review = await updateReview(body.reviewId as string, {
        decision: body.decision as "approved" | "rejected" | "deferred",
        notes: body.notes as string | undefined,
        decidedAt: now,
      });

      // Update asset status based on decision
      if (body.decision === "approved") {
        await updateAsset(params.assetId, { publicationStatus: "review_pending" });
        await emitReceipt({
          eventType: "review.approved",
          actorId: review.reviewerId,
          tenantId: body.tenantId as string,
          assetId: params.assetId,
          payload: { reviewId: review.reviewId, requestedTrustBand: review.requestedTrustBand },
        });
      } else if (body.decision === "rejected") {
        await updateAsset(params.assetId, { publicationStatus: "draft" });
        await emitReceipt({
          eventType: "review.rejected",
          actorId: review.reviewerId,
          tenantId: body.tenantId as string,
          assetId: params.assetId,
          payload: { reviewId: review.reviewId, notes: review.notes },
        });
      }

      return NextResponse.json({ ok: true, data: review });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[registry/assets/reviews] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
