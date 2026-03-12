import type { ComposerGeneratedAssetRef } from "@/services/copilot/composer/types";

type ExperienceMetadata = {
  generated_assets?: Array<Record<string, unknown>>;
  generated_receipts?: Record<string, unknown>;
  [key: string]: unknown;
};

type ExperienceQubeResponse = {
  success?: boolean;
  experience_qube?: {
    metadata?: ExperienceMetadata;
  };
};

export type PersistableGeneratedAsset = ComposerGeneratedAssetRef & {
  prompt?: string;
  createdAt?: string;
};

function toObjectAsset(asset: PersistableGeneratedAsset) {
  return {
    id: asset.id,
    type: asset.type,
    label: asset.label,
    provider: asset.provider,
    orientation: asset.orientation,
    asset_url: asset.assetUrl,
    storage_path: asset.storagePath,
    receipt_ref: asset.receiptRef,
    prompt: asset.prompt,
    created_at: asset.createdAt,
  };
}

function assetMergeKey(asset: Record<string, unknown>) {
  const type = String(asset.type || "image");
  const orientation = asset.orientation ? String(asset.orientation) : "";
  if (type === "image" && orientation) {
    return `${type}:${orientation}`;
  }
  const provider = asset.provider ? String(asset.provider) : "";
  const label = asset.label ? String(asset.label) : "";
  return `${type}:${provider}:${label}`;
}

export async function persistGeneratedAssetsForExperience(options: {
  experienceId: string;
  assets: PersistableGeneratedAsset[];
  receipt?: Record<string, unknown>;
}) {
  if (!options.experienceId || options.assets.length === 0) return;

  const existingResponse = await fetch(`/api/composer/experiences/${options.experienceId}`, {
    cache: "no-store",
  });

  if (!existingResponse.ok) {
    throw new Error(`Failed to load experience ${options.experienceId}`);
  }

  const existingData = (await existingResponse.json()) as ExperienceQubeResponse;
  const existingMetadata = (existingData.experience_qube?.metadata || {}) as ExperienceMetadata;
  const existingAssets = Array.isArray(existingMetadata.generated_assets)
    ? existingMetadata.generated_assets
    : [];

  const nextAssetsByKey = new Map<string, Record<string, unknown>>();
  existingAssets.forEach((asset) => {
    nextAssetsByKey.set(assetMergeKey(asset), asset);
  });
  options.assets.map(toObjectAsset).forEach((asset) => {
    nextAssetsByKey.set(assetMergeKey(asset), asset);
  });

  const receiptId =
    typeof options.receipt?.receipt_id === "string" && options.receipt.receipt_id.trim()
      ? options.receipt.receipt_id.trim()
      : null;

  const nextReceipts = {
    ...(existingMetadata.generated_receipts || {}),
    ...(receiptId ? { [receiptId]: options.receipt } : {}),
  };

  const updateResponse = await fetch(`/api/composer/experiences/${options.experienceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metadata: {
        generated_assets: Array.from(nextAssetsByKey.values()),
        generated_receipts: nextReceipts,
      },
    }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Failed to persist generated assets for ${options.experienceId}`);
  }
}
