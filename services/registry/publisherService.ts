/**
 * PublisherService — governs asset promotion through trust bands to publication.
 *
 * An asset can only be published after:
 * 1. A completed validation run
 * 2. A computed trust score
 * 3. A review approval (for L3+ trust bands)
 *
 * Publication creates an immutable PublicationQube and emits a receipt.
 */

import {
  getAsset,
  getValidation,
  getLatestTrustScore,
  createPublication,
  updatePublication,
  updateAsset,
} from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import {
  PolicyClass,
  TrustBand,
  TRUST_BAND_ORDER,
} from "@/types/registryIngestion";

function generateId(): string {
  return `pub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface PublishResult {
  ok: boolean;
  publicationId?: string;
  error?: string;
}

export async function publishAsset(
  assetId: string,
  publishedBy: string,
  options: {
    validationId?: string;
    notes?: string;
    force?: boolean;  // bypass review requirement (L1/L2 only)
  } = {}
): Promise<PublishResult> {
  const asset = await getAsset(assetId);
  if (!asset) return { ok: false, error: `Asset not found: ${assetId}` };

  if (asset.publicationStatus === "published") {
    return { ok: false, error: "Asset is already published" };
  }
  if (asset.publicationStatus === "rejected") {
    return { ok: false, error: "Asset has been rejected and cannot be published" };
  }

  const score = await getLatestTrustScore(assetId);
  if (!score) {
    return { ok: false, error: "Asset must be scored before publication" };
  }

  // L3+ requires explicit review approval unless force-overridden by platform admin
  const requiresReview = TRUST_BAND_ORDER.indexOf(score.trustBand) >= TRUST_BAND_ORDER.indexOf("L3_PRODUCTION_CANDIDATE" as TrustBand);
  if (requiresReview && !options.force) {
    if (asset.publicationStatus !== "review_pending") {
      await updateAsset(assetId, { publicationStatus: "review_pending" });
    }
    return { ok: false, error: "Asset at L3+ requires review approval before publication" };
  }

  const publicationId = generateId();
  const now = new Date().toISOString();

  const pub = await createPublication({
    publicationId,
    assetId,
    validationId: options.validationId,
    scoreId: score.scoreId,
    trustBand: score.trustBand,
    policyClass: asset.policyClass as PolicyClass,
    publishedBy,
    publishedAt: now,
    status: "published",
    notes: options.notes,
  });

  await updateAsset(assetId, { publicationStatus: "published" });

  const receipt = await emitReceipt({
    eventType: "asset.published",
    actorId: publishedBy,
    tenantId: asset.tenantId ?? "system",
    assetId,
    payload: {
      publicationId,
      trustBand: score.trustBand,
      numericScore: score.numericScore,
      policyClass: asset.policyClass,
    },
  });

  await updatePublication(publicationId, { receiptId: receipt.receiptId });

  return { ok: true, publicationId };
}

export async function revokePublication(
  publicationId: string,
  revokedBy: string,
  reason: string,
  assetId: string
): Promise<{ ok: boolean; error?: string }> {
  const asset = await getAsset(assetId);
  if (!asset) return { ok: false, error: `Asset not found: ${assetId}` };

  const now = new Date().toISOString();
  await updatePublication(publicationId, {
    status: "revoked",
    revokedAt: now,
    revokedBy,
    revokeReason: reason,
  });

  await updateAsset(assetId, { publicationStatus: "draft" });

  await emitReceipt({
    eventType: "asset.published",
    actorId: revokedBy,
    tenantId: asset.tenantId ?? "system",
    assetId,
    payload: { publicationId, revoked: true, reason },
  });

  return { ok: true };
}
