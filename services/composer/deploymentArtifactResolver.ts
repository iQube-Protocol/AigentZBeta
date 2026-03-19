import type { ComposerDeliveryVariant } from "@/services/composer/deploymentBlock";
import { resolveExperienceBundleBlockOutputs } from "@/services/composer/experienceBundlePresets";

type RecordLike = Record<string, unknown>;

type ExperienceLike = {
  id?: string;
  configuration?: RecordLike | null;
  metadata?: RecordLike | null;
};

type ContextMediaItem = {
  id?: string;
  tag?: string;
  mediaUri?: string;
  mediaType?: string;
};

type ResolvedMediaCandidate = {
  id?: string;
  url: string;
  mediaType: "image" | "video";
  orientation?: "portrait" | "landscape";
  provider?: string;
  source: "experience_asset" | "persona_asset" | "receipt" | "context";
  timestamp: number;
  priority: number;
};

export type ResolvedDeploymentArtifact = {
  preferredAssetId: string | null;
  artifact: ResolvedMediaCandidate | null;
  preview: ResolvedMediaCandidate | null;
  context: ResolvedMediaCandidate | null;
};

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" ? (value as RecordLike) : null;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function inferMediaType(uri: string, preferred?: string | null): "image" | "video" {
  if (preferred === "video") return "video";
  if (preferred === "image") return "image";
  if (/\.(mp4|m4v|webm|mov|m3u8)(\?|$)/i.test(uri)) return "video";
  return "image";
}

function getTimestamp(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssetUrl(asset: RecordLike): string | null {
  return firstNonEmptyString([
    asset.asset_url,
    asset.assetUrl,
    asset.image_url,
    asset.imageUrl,
    asset.video_url,
    asset.videoUrl,
    asset.url,
  ]);
}

function getAssetPriority(url: string): number {
  if (/\/api\/skills\/video\//i.test(url)) return -10;
  if (/supabase\.co\/storage\/v1\/object\/public\//i.test(url)) return 10;
  if (/^https?:\/\//i.test(url)) return 5;
  return 0;
}

function normalizeAsset(
  asset: RecordLike,
  source: ResolvedMediaCandidate["source"],
): ResolvedMediaCandidate | null {
  const url = getAssetUrl(asset);
  if (!url) return null;
  const preferredMediaType =
    typeof asset.type === "string"
      ? asset.type
      : typeof asset.media_type === "string"
        ? asset.media_type
        : null;
  const orientation =
    asset.orientation === "portrait" || asset.orientation === "landscape"
      ? asset.orientation
      : undefined;

  return {
    id: typeof asset.id === "string" ? asset.id : undefined,
    url,
    mediaType: inferMediaType(url, preferredMediaType),
    orientation,
    provider: typeof asset.provider === "string" ? asset.provider : undefined,
    source,
    timestamp: Math.max(
      getTimestamp(asset.created_at),
      getTimestamp(asset.createdAt),
      getTimestamp(asset.updated_at),
      getTimestamp(asset.updatedAt),
      getTimestamp(asset.timestamp),
    ),
    priority: getAssetPriority(url),
  };
}

function normalizeReceiptAssets(metadata: RecordLike): ResolvedMediaCandidate[] {
  const generatedReceipts = asRecord(metadata.generated_receipts);
  if (!generatedReceipts) return [];

  const candidates: ResolvedMediaCandidate[] = [];
  Object.values(generatedReceipts).forEach((receipt) => {
    const receiptRecord = asRecord(receipt);
    if (!receiptRecord) return;
    const payload = asRecord(receiptRecord.payload) || {};
    const receiptId = typeof receiptRecord.receipt_id === "string" ? receiptRecord.receipt_id : undefined;
    const receiptTimestamp = Math.max(
      getTimestamp(receiptRecord.timestamp),
      getTimestamp(payload.timestamp),
    );

    const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
    outputs.forEach((output) => {
      const outputRecord = asRecord(output);
      if (!outputRecord) return;
      const normalized = normalizeAsset(
        {
          id:
            (typeof outputRecord.id === "string" && outputRecord.id) ||
            (typeof outputRecord.asset_id === "string" && outputRecord.asset_id) ||
            (receiptId ? `${receiptId}:${String(outputRecord.orientation || outputRecord.type || "asset")}` : undefined),
          type:
            (typeof outputRecord.type === "string" && outputRecord.type) ||
            (typeof outputRecord.media_type === "string" && outputRecord.media_type) ||
            (typeof outputRecord.video_url === "string" ? "video" : "image"),
          orientation: outputRecord.orientation,
          provider:
            (typeof outputRecord.model === "string" && outputRecord.model) ||
            (typeof payload.provider === "string" && payload.provider) ||
            undefined,
          image_url: outputRecord.image_url,
          video_url: outputRecord.video_url,
          asset_url: outputRecord.asset_url,
          created_at: typeof outputRecord.created_at === "string" ? outputRecord.created_at : receiptRecord.timestamp,
          timestamp: receiptRecord.timestamp,
        },
        "receipt",
      );
      if (normalized) {
        candidates.push({
          ...normalized,
          timestamp: normalized.timestamp || receiptTimestamp,
        });
      }
    });

    if (outputs.length === 0) {
      const normalized = normalizeAsset(
        {
          id: receiptId,
          type:
            (typeof payload.video_url === "string" && payload.video_url) ? "video" : "image",
          provider: typeof payload.provider === "string" ? payload.provider : undefined,
          image_url: payload.image_url,
          video_url: payload.video_url,
          asset_url: payload.asset_url,
          timestamp: receiptRecord.timestamp,
        },
        "receipt",
      );
      if (normalized) {
        candidates.push({
          ...normalized,
          timestamp: normalized.timestamp || receiptTimestamp,
        });
      }
    }
  });

  return candidates;
}

function normalizeBundleOutputAssets(experience: ExperienceLike | null): ResolvedMediaCandidate[] {
  const outputs = resolveExperienceBundleBlockOutputs(experience);
  const candidates: ResolvedMediaCandidate[] = [];
  const imageOutput = asRecord(outputs.image_generation);
  const videoOutput = asRecord(outputs.video_generation);

  if (imageOutput && Array.isArray(imageOutput.assets)) {
    imageOutput.assets.forEach((asset) => {
      const normalized = normalizeAsset(asRecord(asset) || {}, "experience_asset");
      if (normalized) candidates.push(normalized);
    });
  }

  if (videoOutput) {
    const normalized = normalizeAsset(videoOutput, "experience_asset");
    if (normalized) candidates.push(normalized);
  }

  return candidates;
}

function isPersonaAssetRelevantToExperience(asset: RecordLike, experienceId?: string): boolean {
  if (!experienceId) return false;
  const directExperienceId = firstNonEmptyString([asset.experienceId, asset.experience_id]);
  const pinnedExperienceId = firstNonEmptyString([
    asset.pinnedToExperienceId,
    asset.pinned_to_experience_id,
  ]);
  const lastUsedInExperienceId = firstNonEmptyString([
    asset.lastUsedInExperienceId,
    asset.last_used_in_experience_id,
  ]);

  return [directExperienceId, pinnedExperienceId, lastUsedInExperienceId].some(
    (value) => value === experienceId,
  );
}

function resolveContextMedia(
  experience: ExperienceLike | null,
  contextItems: ContextMediaItem[],
): ResolvedMediaCandidate | null {
  if (!experience) return null;

  const config = asRecord(experience.configuration) ?? {};
  const metadata = asRecord(experience.metadata) ?? {};
  const contentSelection = asRecord(config.content_selection) ?? {};

  const mediaById = new Map<string, ContextMediaItem>();
  contextItems.forEach((item) => {
    if (!item?.id) return;
    if (!mediaById.has(item.id)) {
      mediaById.set(item.id, item);
    }
  });

  const selectedIds: string[] = [];
  const addSelectedId = (value: unknown) => {
    if (typeof value === "string" && value.trim()) selectedIds.push(value.trim());
  };

  if (Array.isArray(contentSelection.content_items)) {
    contentSelection.content_items.forEach(addSelectedId);
  }
  addSelectedId(contentSelection.feature_item_id);
  addSelectedId(contentSelection.primary_content_id);
  addSelectedId(config.primary_content_id);
  addSelectedId(metadata.primary_content_id);

  for (const id of selectedIds) {
    const item = mediaById.get(id);
    if (item?.mediaUri) {
      return {
        id: item.id,
        url: item.mediaUri,
        mediaType: inferMediaType(item.mediaUri, item.mediaType || null),
        source: "context",
        timestamp: 0,
        priority: getAssetPriority(item.mediaUri),
      };
    }
  }

  const selectedTag = firstNonEmptyString([
    contentSelection.content_tag,
    config.content_tag,
    metadata.content_tag,
  ]);
  if (selectedTag) {
    const tagged = contextItems.find((item) => item.tag === selectedTag && item.mediaUri);
    if (tagged?.mediaUri) {
      return {
        id: tagged.id,
        url: tagged.mediaUri,
        mediaType: inferMediaType(tagged.mediaUri, tagged.mediaType || null),
        source: "context",
        timestamp: 0,
        priority: getAssetPriority(tagged.mediaUri),
      };
    }
  }

  const fallback = contextItems.find((item) => Boolean(item.mediaUri));
  if (!fallback?.mediaUri) return null;
  return {
    id: fallback.id,
    url: fallback.mediaUri,
    mediaType: inferMediaType(fallback.mediaUri, fallback.mediaType || null),
    source: "context",
    timestamp: 0,
    priority: getAssetPriority(fallback.mediaUri),
  };
}

function rankByNewest(a: ResolvedMediaCandidate, b: ResolvedMediaCandidate) {
  const priorityDelta = b.priority - a.priority;
  if (priorityDelta !== 0) return priorityDelta;
  return b.timestamp - a.timestamp;
}

function selectPreferredCandidate(
  candidates: ResolvedMediaCandidate[],
  preferredAssetId: string | null,
): ResolvedMediaCandidate | null {
  if (preferredAssetId) {
    const explicit = candidates.find((candidate) => candidate.id === preferredAssetId);
    if (explicit && explicit.priority >= 0) return explicit;
  }

  const videos = candidates.filter((candidate) => candidate.mediaType === "video").sort(rankByNewest);
  if (videos[0]) return videos[0];

  const landscapeImages = candidates
    .filter((candidate) => candidate.mediaType === "image" && candidate.orientation === "landscape")
    .sort(rankByNewest);
  if (landscapeImages[0]) return landscapeImages[0];

  const images = candidates.filter((candidate) => candidate.mediaType === "image").sort(rankByNewest);
  return images[0] || null;
}

function selectPreviewCandidate(
  candidates: ResolvedMediaCandidate[],
  artifact: ResolvedMediaCandidate | null,
  variant: ComposerDeliveryVariant,
): ResolvedMediaCandidate | null {
  if (artifact?.mediaType === "video") return artifact;

  const landscapeImages = candidates
    .filter((candidate) => candidate.mediaType === "image" && candidate.orientation === "landscape")
    .sort(rankByNewest);
  if (
    variant === "discord_asset_inline" ||
    variant === "discord_experience_inline" ||
    variant === "runtime_thin_client"
  ) {
    if (landscapeImages[0]) return landscapeImages[0];
  }

  return artifact || landscapeImages[0] || candidates.sort(rankByNewest)[0] || null;
}

export function resolveExperienceDeploymentArtifact(options: {
  experience: ExperienceLike | null;
  variant?: ComposerDeliveryVariant;
  personaLibraryAssets?: Array<RecordLike>;
  contextItems?: ContextMediaItem[];
}): ResolvedDeploymentArtifact {
  const experience = options.experience;
  const metadata = asRecord(experience?.metadata) ?? {};
  const preferredAssetId =
    (typeof metadata.deployment_preferred_asset_id === "string" && metadata.deployment_preferred_asset_id.trim()) ||
    (typeof metadata.preferred_asset_id === "string" && metadata.preferred_asset_id.trim()) ||
    null;
  const experienceId = typeof experience?.id === "string" ? experience.id : undefined;

  const bundleAssets = normalizeBundleOutputAssets(experience);
  const experienceAssets = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
        .map((asset) => normalizeAsset(asRecord(asset) || {}, "experience_asset"))
        .filter((asset): asset is ResolvedMediaCandidate => Boolean(asset))
    : [];
  const personaAssets = Array.isArray(options.personaLibraryAssets)
    ? options.personaLibraryAssets
        .filter((asset) => isPersonaAssetRelevantToExperience(asRecord(asset) || {}, experienceId))
        .map((asset) => normalizeAsset(asRecord(asset) || {}, "persona_asset"))
        .filter((asset): asset is ResolvedMediaCandidate => Boolean(asset))
    : [];
  const receiptAssets = normalizeReceiptAssets(metadata);
  const context = resolveContextMedia(experience, options.contextItems || []);

  const candidates = [...bundleAssets, ...experienceAssets, ...personaAssets, ...receiptAssets].filter(
    (candidate, index, list) =>
      list.findIndex(
        (other) =>
          other.url === candidate.url &&
          other.mediaType === candidate.mediaType &&
          other.orientation === candidate.orientation,
      ) === index,
  );

  const artifact = selectPreferredCandidate(candidates, preferredAssetId);
  const preview = selectPreviewCandidate(
    candidates,
    artifact,
    options.variant || "runtime_thin_client",
  );

  return {
    preferredAssetId,
    artifact,
    preview,
    context,
  };
}
