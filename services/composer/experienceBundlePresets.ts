import type {
  ExperienceBlockKind,
  ExperienceBlockManifest,
} from "@/services/composer/experienceBlockManifest";

type RecordLike = Record<string, unknown>;

type ExperienceLike = {
  template_id?: string | null;
  name?: string | null;
  description?: string | null;
  goal?: string | null;
  metadata?: RecordLike | null;
  configuration?: RecordLike | null;
};

export type ExperienceBundlePresetId = "image_article_bundle" | "video_article_bundle";

export type ExperienceBundlePreset = {
  id: ExperienceBundlePresetId;
  label: string;
  summary: string;
  blockKinds: ExperienceBlockKind[];
  bundleTemplateId: string;
  bundleTemplateLabel: string;
  sequencing: string[];
  nextActions: string[];
  recommended: boolean;
};

export type AppliedExperienceBundle = {
  presetId: ExperienceBundlePresetId;
  label: string;
  summary: string;
  blockKinds: ExperienceBlockKind[];
  bundleTemplateId: string;
  bundleTemplateLabel: string;
  sequencing: string[];
  nextActions: string[];
  appliedAt: string;
  entryIntent: "make";
};

export type ExperienceBundleBlockStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_review"
  | "accepted";

export type ExperienceBundleBlockState = {
  kind: ExperienceBlockKind;
  label: string;
  status: ExperienceBundleBlockStatus;
  isActive: boolean;
  isNext: boolean;
  templateId: string;
  templateLabel: string;
  suggestedAction: string;
};

export type ExperienceBundleFlowTarget = {
  blockKind: ExperienceBlockKind;
  templateId: string;
  templateLabel: string;
  label: string;
  summary: string;
};

export type ExperienceBundleSequencingState = {
  completedBlocks: ExperienceBlockKind[];
  activeBlock: ExperienceBlockKind | null;
  nextBlock: ExperienceBlockKind | null;
  progressLabel: string;
  completedCount: number;
  totalCount: number;
  blocks: ExperienceBundleBlockState[];
};

export type ExperienceBundleBlockOutputs = Partial<Record<ExperienceBlockKind, RecordLike>>;

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getAssetTimestamp(asset: RecordLike | null): number {
  if (!asset) return 0;
  const raw = firstString([asset.created_at, asset.createdAt, asset.timestamp]);
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeGeneratedAsset(asset: unknown): RecordLike | null {
  const record = asRecord(asset);
  if (!record) return null;
  const assetUrl = firstString([
    record.asset_url,
    record.assetUrl,
    record.video_url,
    record.videoUrl,
    record.image_url,
    record.imageUrl,
    record.url,
    record.storage_path,
  ]);
  if (!assetUrl) return null;
  const type =
    firstString([record.type, record.media_type]) ||
    (/\.(mp4|m4v|mov|webm|ogg)(\?|$)/i.test(assetUrl) ? "video" : "image");
  return {
    id: firstString([record.id]) || assetUrl,
    type,
    label: firstString([record.label]) || `${type} asset`,
    provider: firstString([record.provider]),
    orientation: firstString([record.orientation]),
    asset_url: assetUrl,
    storage_path: firstString([record.storage_path]),
    receipt_ref: firstString([record.receipt_ref, record.receiptRef]),
    prompt: firstString([record.prompt]),
    created_at: firstString([record.created_at, record.createdAt, record.timestamp]),
  };
}

function buildInferredMediaOutput(
  experience: ExperienceLike | null | undefined,
  type: "image" | "video",
): RecordLike | null {
  const metadata = asRecord(experience?.metadata) ?? {};
  const assets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  const normalized = assets
    .map((asset) => normalizeGeneratedAsset(asset))
    .filter((asset): asset is RecordLike => Boolean(asset))
    .filter((asset) => firstString([asset.type]) === type)
    .sort((a, b) => getAssetTimestamp(b) - getAssetTimestamp(a));

  if (type === "video") {
    const videoAsset = normalized[0];
    if (!videoAsset) return null;
    return {
      type: "video",
      asset_url: firstString([videoAsset.asset_url]),
      receipt_ref: firstString([videoAsset.receipt_ref]),
      provider: firstString([videoAsset.provider]),
      label: firstString([videoAsset.label]),
    };
  }

  const imageAssets = normalized.filter((asset) =>
    ["portrait", "landscape"].includes(firstString([asset.orientation]) || ""),
  );
  if (imageAssets.length === 0) return null;
  const portrait = imageAssets.find((asset) => firstString([asset.orientation]) === "portrait") || null;
  const landscape = imageAssets.find((asset) => firstString([asset.orientation]) === "landscape") || null;
  return {
    type: "image",
    assets: imageAssets.map((asset) => ({
      type: "image",
      orientation: firstString([asset.orientation]),
      asset_url: firstString([asset.asset_url]),
      receipt_ref: firstString([asset.receipt_ref]),
      provider: firstString([asset.provider]),
      label: firstString([asset.label]),
    })),
    portrait_url: firstString([portrait?.asset_url]),
    landscape_url: firstString([landscape?.asset_url]),
  };
}

function buildInferredArticleOutput(experience: ExperienceLike | null | undefined): RecordLike | null {
  const configuration = asRecord(experience?.configuration) ?? {};
  const articleDraft = asRecord(configuration.article_draft) ?? {};
  const generated = asRecord(articleDraft.generated);
  if (!generated) return null;
  return {
    generated,
    title: firstString([articleDraft.title, generated.title, experience?.name]),
    prompt: firstString([articleDraft.prompt, experience?.description, experience?.goal]),
    outputs: Array.isArray(articleDraft.outputs)
      ? articleDraft.outputs.filter((item): item is string => typeof item === "string")
      : [],
    takeaways_count:
      typeof articleDraft.takeaways_count === "number" ? articleDraft.takeaways_count : undefined,
  };
}

function buildInferredDeploymentOutput(experience: ExperienceLike | null | undefined): RecordLike | null {
  const metadata = asRecord(experience?.metadata) ?? {};
  const deploymentState = asRecord(metadata.deployment_state);
  if (!deploymentState) return null;
  return {
    last_target: firstString([deploymentState.last_target]),
    last_status: firstString([deploymentState.last_status]),
    last_provider: firstString([deploymentState.last_provider]),
    last_launch_url: firstString([deploymentState.last_launch_url]),
    last_publish_url: firstString([deploymentState.last_publish_url]),
    last_deployed_at: firstString([deploymentState.last_deployed_at]),
  };
}

function hasGeneratedAssetType(experience: ExperienceLike | null | undefined, type: "image" | "video") {
  const bundleOutputs = resolveExperienceBundleBlockOutputs(experience);
  if (type === "video" && bundleOutputs.video_generation) return true;
  if (type === "image" && bundleOutputs.image_generation) return true;
  const metadata = asRecord(experience?.metadata) ?? {};
  const assets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  return assets.some((asset) => {
    const record = asRecord(asset);
    if (!record) return false;
    const explicitType = firstString([record.type, record.media_type]);
    if (explicitType) return explicitType === type;
    const url = firstString([
      record.asset_url,
      record.assetUrl,
      record.video_url,
      record.videoUrl,
      record.image_url,
      record.imageUrl,
      record.url,
      record.storage_path,
    ]);
    return type === "video"
      ? Boolean(url && /\.(mp4|m4v|mov|webm|ogg)(\?|$)/i.test(url))
      : Boolean(url && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url));
  });
}

function hasArticleDraftSignal(experience: ExperienceLike | null | undefined) {
  const metadata = asRecord(experience?.metadata) ?? {};
  const configuration = asRecord(experience?.configuration) ?? {};
  const contentSelection = asRecord(configuration.content_selection) ?? {};
  const articlePrompt = firstString([metadata.article_prompt, metadata.article_title]);
  const contentFeature = firstString([contentSelection.feature_item_id, contentSelection.issue_slug]);
  const haystack = [
    experience?.template_id,
    experience?.name,
    experience?.description,
    experience?.goal,
    articlePrompt,
    contentFeature,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return Boolean(articlePrompt || contentFeature || /(article|editorial|reading|read|feature|copy|draft)/.test(haystack));
}

function hasGeneratedArticleDraft(experience: ExperienceLike | null | undefined) {
  const bundleOutputs = resolveExperienceBundleBlockOutputs(experience);
  if (bundleOutputs.article_draft) return true;
  const configuration = asRecord(experience?.configuration) ?? {};
  const articleDraft = asRecord(configuration.article_draft) ?? {};
  return Boolean(articleDraft.generated && typeof articleDraft.generated === "object");
}

function hasDeploymentState(experience: ExperienceLike | null | undefined) {
  const bundleOutputs = resolveExperienceBundleBlockOutputs(experience);
  if (bundleOutputs.deployment) return true;
  const metadata = asRecord(experience?.metadata) ?? {};
  const deploymentState = asRecord(metadata.deployment_state);
  return Boolean(deploymentState && firstString([deploymentState.last_target, deploymentState.last_status]));
}

export function resolveExperienceBundleBlockOutputs(
  experience: ExperienceLike | null | undefined,
): ExperienceBundleBlockOutputs {
  const metadata = asRecord(experience?.metadata) ?? {};
  const configuration = asRecord(experience?.configuration) ?? {};
  const metadataState = asRecord(metadata.composition_bundle_state) ?? {};
  const configurationState = asRecord(configuration.make_bundle) ?? {};
  const fromMetadata = asRecord(metadataState.block_outputs) ?? {};
  const fromConfiguration = asRecord(configurationState.block_outputs) ?? {};
  const merged = { ...fromConfiguration, ...fromMetadata };
  const resolved: ExperienceBundleBlockOutputs = {};

  const persistedImage = asRecord(merged.image_generation);
  const persistedVideo = asRecord(merged.video_generation);
  const persistedArticle = asRecord(merged.article_draft);
  const persistedDeployment = asRecord(merged.deployment);

  resolved.image_generation = persistedImage || buildInferredMediaOutput(experience, "image") || undefined;
  resolved.video_generation = persistedVideo || buildInferredMediaOutput(experience, "video") || undefined;
  resolved.article_draft = persistedArticle || buildInferredArticleOutput(experience) || undefined;
  resolved.deployment = persistedDeployment || buildInferredDeploymentOutput(experience) || undefined;

  return resolved;
}

function getPersistedBundleBlockStatuses(
  experience: ExperienceLike | null | undefined,
): Partial<Record<ExperienceBlockKind, ExperienceBundleBlockStatus>> {
  const metadata = asRecord(experience?.metadata) ?? {};
  const configuration = asRecord(experience?.configuration) ?? {};
  const metadataState = asRecord(metadata.composition_bundle_state) ?? {};
  const configurationState = asRecord(configuration.make_bundle) ?? {};
  const fromMetadata = asRecord(metadataState.block_statuses) ?? {};
  const fromConfiguration = asRecord(configurationState.block_statuses) ?? {};
  const merged = { ...fromConfiguration, ...fromMetadata };
  const resolved: Partial<Record<ExperienceBlockKind, ExperienceBundleBlockStatus>> = {};
  for (const kind of ["image_generation", "video_generation", "article_draft", "deployment"] as const) {
    const value = merged[kind];
    if (
      value === "not_started" ||
      value === "in_progress" ||
      value === "ready_for_review" ||
      value === "accepted"
    ) {
      resolved[kind] = value;
    }
  }
  return resolved;
}

function getBundleTemplateDescriptor(presetId: ExperienceBundlePresetId) {
  return presetId === "video_article_bundle"
    ? {
        id: "bundle:video_article_stack_v1",
        label: "Watch Companion Stack",
      }
    : {
        id: "bundle:image_article_stack_v1",
        label: "Editorial Experience Stack",
      };
}

function getBlockLabel(kind: ExperienceBlockKind) {
  if (kind === "image_generation") return "Image Generation";
  if (kind === "video_generation") return "Video Generation";
  if (kind === "article_draft") return "Article Draft";
  return "Deployment";
}

function getSuggestedAction(kind: ExperienceBlockKind, status: ExperienceBundleBlockStatus) {
  if (kind === "article_draft") {
    if (status === "ready_for_review") return "Review draft";
    if (status === "accepted") return "Move to deployment";
    if (status === "in_progress") return "Refine copy";
    return "Start draft";
  }
  if (kind === "deployment") {
    return status === "accepted" ? "Deployment complete" : "Prepare deployment";
  }
  if (kind === "video_generation") {
    return status === "accepted" ? "Video locked" : status === "in_progress" ? "Continue video work" : "Start video";
  }
  return status === "accepted" ? "Image locked" : status === "in_progress" ? "Continue image work" : "Start image";
}

function supportsBundle(manifest: ExperienceBlockManifest, requiredKinds: ExperienceBlockKind[]) {
  const availableKinds = new Set(manifest.blocks.map((block) => block.kind));
  return requiredKinds.every((kind) => availableKinds.has(kind));
}

export function listExperienceBundlePresets(manifest: ExperienceBlockManifest): ExperienceBundlePreset[] {
  return [
    {
      id: "image_article_bundle",
      label: "Image + Article",
      summary: "Bundle visual generation with editorial drafting for Make-oriented article experiences.",
      blockKinds: ["image_generation", "article_draft", "deployment"],
      bundleTemplateId: "bundle:image_article_stack_v1",
      bundleTemplateLabel: "Editorial Experience Stack",
      sequencing: [
        "Lock hero/supporting image generation first.",
        "Layer article draft and editorial structure on top of the selected imagery.",
        "Deploy the bundled article experience once the visual/copy pairing is stable.",
      ],
      nextActions: ["Refine image prompt", "Draft article copy", "Deploy article bundle"],
      recommended: supportsBundle(manifest, ["image_generation", "article_draft"]),
    },
    {
      id: "video_article_bundle",
      label: "Video + Article",
      summary: "Bundle motion-led generation with editorial support for Make-oriented watch experiences.",
      blockKinds: ["video_generation", "article_draft", "deployment"],
      bundleTemplateId: "bundle:video_article_stack_v1",
      bundleTemplateLabel: "Watch Companion Stack",
      sequencing: [
        "Generate or bind the primary video asset first.",
        "Add supporting editorial copy and article context around the selected video.",
        "Deploy the bundled watch experience when both video and copy are stable.",
      ],
      nextActions: ["Refine video prompt", "Draft supporting copy", "Deploy watch bundle"],
      recommended: supportsBundle(manifest, ["video_generation", "article_draft"]),
    },
  ];
}

export function getAppliedExperienceBundle(experience: ExperienceLike | null | undefined): AppliedExperienceBundle | null {
  const raw = experience?.metadata?.composition_bundle;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as RecordLike;
  const presetId = record.presetId;
  if (presetId !== "image_article_bundle" && presetId !== "video_article_bundle") return null;
  return {
    presetId,
    label: typeof record.label === "string" ? record.label : presetId,
    summary: typeof record.summary === "string" ? record.summary : "",
    bundleTemplateId:
      typeof record.bundleTemplateId === "string"
        ? record.bundleTemplateId
        : getBundleTemplateDescriptor(presetId).id,
    bundleTemplateLabel:
      typeof record.bundleTemplateLabel === "string"
        ? record.bundleTemplateLabel
        : getBundleTemplateDescriptor(presetId).label,
    blockKinds: Array.isArray(record.blockKinds)
      ? record.blockKinds.filter(
          (kind): kind is ExperienceBlockKind =>
            kind === "image_generation" ||
            kind === "video_generation" ||
            kind === "article_draft" ||
            kind === "deployment",
        )
      : [],
    sequencing: Array.isArray(record.sequencing)
      ? record.sequencing.filter((item): item is string => typeof item === "string")
      : [],
    nextActions: Array.isArray(record.nextActions)
      ? record.nextActions.filter((item): item is string => typeof item === "string")
      : [],
    appliedAt: typeof record.appliedAt === "string" ? record.appliedAt : "",
    entryIntent: "make",
  };
}

export function buildExperienceBundlePresetPatch(
  experience: ExperienceLike | null | undefined,
  manifest: ExperienceBlockManifest,
  preset: ExperienceBundlePreset,
) {
  const now = new Date().toISOString();
  const existingMetadata =
    experience?.metadata && typeof experience.metadata === "object" && !Array.isArray(experience.metadata)
      ? experience.metadata
      : {};
  const existingConfiguration =
    experience?.configuration && typeof experience.configuration === "object" && !Array.isArray(experience.configuration)
      ? experience.configuration
      : {};

  const nextBundle: AppliedExperienceBundle = {
    presetId: preset.id,
    label: preset.label,
    summary: preset.summary,
    blockKinds: preset.blockKinds,
    bundleTemplateId: preset.bundleTemplateId,
    bundleTemplateLabel: preset.bundleTemplateLabel,
    sequencing: preset.sequencing,
    nextActions: preset.nextActions,
    appliedAt: now,
    entryIntent: "make",
  };

  return {
    configuration: {
      ...existingConfiguration,
      make_bundle: {
        presetId: preset.id,
        bundleTemplateId: preset.bundleTemplateId,
        bundleTemplateLabel: preset.bundleTemplateLabel,
        entryIntent: "make",
        recommended: preset.recommended,
        primaryFlow: manifest.primaryFlow,
        blockKinds: preset.blockKinds,
        block_statuses: {
          [preset.blockKinds[0]]: "in_progress",
          ...(preset.blockKinds.includes("article_draft") ? { article_draft: "not_started" } : {}),
          ...(preset.blockKinds.includes("deployment") ? { deployment: "not_started" } : {}),
        },
        block_outputs: {},
        updatedAt: now,
      },
    },
    metadata: {
      ...existingMetadata,
      composition_bundle: nextBundle,
      composition_bundle_state: {
        block_statuses: {
          [preset.blockKinds[0]]: "in_progress",
          ...(preset.blockKinds.includes("article_draft") ? { article_draft: "not_started" } : {}),
          ...(preset.blockKinds.includes("deployment") ? { deployment: "not_started" } : {}),
        },
        block_outputs: {},
        updatedAt: now,
      },
      composition_manifest: {
        primaryFlow: manifest.primaryFlow,
        blockCount: manifest.blockCount,
        blockKinds: manifest.blocks.map((block) => block.kind),
        sequencing: manifest.sequencing,
        updatedAt: now,
      },
    },
    bundle: nextBundle,
  };
}

export function resolveExperienceBundleSequencingState(
  experience: ExperienceLike | null | undefined,
  bundle: AppliedExperienceBundle | null | undefined,
): ExperienceBundleSequencingState | null {
  if (!bundle) return null;

  const acceptedBlocks: ExperienceBlockKind[] = [];
  const persistedStatuses = getPersistedBundleBlockStatuses(experience);
  const blockOutputs = resolveExperienceBundleBlockOutputs(experience);
  const mediaBlock: ExperienceBlockKind =
    bundle.presetId === "video_article_bundle" ? "video_generation" : "image_generation";

  const orderedBlocks = bundle.blockKinds.filter(
    (kind): kind is ExperienceBlockKind =>
      kind === "image_generation" ||
      kind === "video_generation" ||
      kind === "article_draft" ||
      kind === "deployment",
  );
  const blocks = orderedBlocks.map((kind): ExperienceBundleBlockState => {
    const persisted = persistedStatuses[kind];
    let status: ExperienceBundleBlockStatus = "not_started";
    if (kind === "image_generation") {
      status =
        persisted === "accepted"
          ? "accepted"
          : blockOutputs.image_generation || hasGeneratedAssetType(experience, "image")
            ? "accepted"
            : persisted || "in_progress";
    } else if (kind === "video_generation") {
      status =
        persisted === "accepted"
          ? "accepted"
          : blockOutputs.video_generation || hasGeneratedAssetType(experience, "video")
            ? "accepted"
            : persisted || "in_progress";
    } else if (kind === "article_draft") {
      if (persisted === "accepted" || persisted === "in_progress") {
        status = persisted;
      } else if (blockOutputs.article_draft || hasGeneratedArticleDraft(experience)) {
        status = "ready_for_review";
      } else if (hasArticleDraftSignal(experience)) {
        status = "in_progress";
      }
    } else if (kind === "deployment") {
      if (persisted === "accepted") {
        status = "accepted";
      } else if (blockOutputs.deployment || hasDeploymentState(experience)) {
        status = "accepted";
      } else if (persisted) {
        status = persisted;
      }
    }
    if (status === "accepted") acceptedBlocks.push(kind);
    return {
      kind,
      label: getBlockLabel(kind),
      status,
      isActive: false,
      isNext: false,
      templateId: bundle.bundleTemplateId,
      templateLabel: bundle.bundleTemplateLabel,
      suggestedAction: getSuggestedAction(kind, status),
    };
  });

  const activeBlockRecord = blocks.find((block) => block.status !== "accepted") || null;
  const activeBlock = activeBlockRecord?.kind || null;
  const activeIndex = activeBlock ? orderedBlocks.indexOf(activeBlock) : -1;
  const nextBlock = activeBlock && activeIndex >= 0 && activeIndex + 1 < orderedBlocks.length
    ? orderedBlocks[activeIndex + 1]
    : null;
  blocks.forEach((block) => {
    block.isActive = block.kind === activeBlock;
    block.isNext = block.kind === nextBlock;
    if (
      block.kind === "deployment" &&
      block.status === "not_started" &&
      blocks
        .filter((entry) => entry.kind !== "deployment")
        .every((entry) => entry.status === "accepted")
    ) {
      block.status = "in_progress";
      block.suggestedAction = getSuggestedAction(block.kind, block.status);
    }
  });

  return {
    completedBlocks: acceptedBlocks,
    activeBlock,
    nextBlock,
    progressLabel: `${acceptedBlocks.length}/${orderedBlocks.length} blocks accepted`,
    completedCount: acceptedBlocks.length,
    totalCount: orderedBlocks.length,
    blocks,
  };
}

export function resolveExperienceBundleFlowTarget(
  bundle: AppliedExperienceBundle | null | undefined,
  blockKind: ExperienceBlockKind | null | undefined,
): ExperienceBundleFlowTarget | null {
  if (!bundle || !blockKind) return null;

  if (blockKind === "video_generation") {
    return {
      blockKind,
      templateId: "sora-video-generation",
      templateLabel: "AI Video Generation",
      label: "video generation flow",
      summary: "Open the video skill flow to generate or refine the primary motion asset.",
    };
  }

  if (blockKind === "image_generation") {
    return {
      blockKind,
      templateId: "qriptopian_reading_sprint_v0",
      templateLabel: "Qriptopian Reading Sprint",
      label: "image generation flow",
      summary: "Open the reading-sprint customizer on hero image generation.",
    };
  }

  if (blockKind === "article_draft") {
    return {
      blockKind,
      templateId: "qriptopian_reading_sprint_v0",
      templateLabel: "Qriptopian Reading Sprint",
      label: "article draft flow",
      summary: "Open the article-oriented customizer to select content and shape supporting copy.",
    };
  }

  return {
    blockKind,
    templateId: bundle.presetId === "video_article_bundle" ? "sora-video-generation" : "qriptopian_reading_sprint_v0",
    templateLabel: bundle.presetId === "video_article_bundle" ? "AI Video Generation" : "Qriptopian Reading Sprint",
    label: "deployment flow",
    summary: "Return to the bundle source experience and finish deployment and reward configuration.",
  };
}
