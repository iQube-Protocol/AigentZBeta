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
  sequencing: string[];
  nextActions: string[];
  recommended: boolean;
};

export type AppliedExperienceBundle = {
  presetId: ExperienceBundlePresetId;
  label: string;
  summary: string;
  blockKinds: ExperienceBlockKind[];
  sequencing: string[];
  nextActions: string[];
  appliedAt: string;
  entryIntent: "make";
};

export type ExperienceBundleSequencingState = {
  completedBlocks: ExperienceBlockKind[];
  activeBlock: ExperienceBlockKind | null;
  nextBlock: ExperienceBlockKind | null;
  progressLabel: string;
  completedCount: number;
  totalCount: number;
};

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function hasGeneratedAssetType(experience: ExperienceLike | null | undefined, type: "image" | "video") {
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

function hasDeploymentState(experience: ExperienceLike | null | undefined) {
  const metadata = asRecord(experience?.metadata) ?? {};
  const deploymentState = asRecord(metadata.deployment_state);
  return Boolean(deploymentState && firstString([deploymentState.last_target, deploymentState.last_status]));
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
        entryIntent: "make",
        recommended: preset.recommended,
        primaryFlow: manifest.primaryFlow,
        blockKinds: preset.blockKinds,
        updatedAt: now,
      },
    },
    metadata: {
      ...existingMetadata,
      composition_bundle: nextBundle,
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

  const completedBlocks: ExperienceBlockKind[] = [];
  const mediaBlock: ExperienceBlockKind =
    bundle.presetId === "video_article_bundle" ? "video_generation" : "image_generation";

  if (mediaBlock === "image_generation" && hasGeneratedAssetType(experience, "image")) {
    completedBlocks.push("image_generation");
  }
  if (mediaBlock === "video_generation" && hasGeneratedAssetType(experience, "video")) {
    completedBlocks.push("video_generation");
  }
  if (bundle.blockKinds.includes("article_draft") && hasArticleDraftSignal(experience)) {
    completedBlocks.push("article_draft");
  }
  if (bundle.blockKinds.includes("deployment") && hasDeploymentState(experience)) {
    completedBlocks.push("deployment");
  }

  const orderedBlocks = bundle.blockKinds.filter(
    (kind): kind is ExperienceBlockKind =>
      kind === "image_generation" ||
      kind === "video_generation" ||
      kind === "article_draft" ||
      kind === "deployment",
  );
  const activeBlock = orderedBlocks.find((kind) => !completedBlocks.includes(kind)) || null;
  const activeIndex = activeBlock ? orderedBlocks.indexOf(activeBlock) : -1;
  const nextBlock = activeBlock && activeIndex >= 0 && activeIndex + 1 < orderedBlocks.length
    ? orderedBlocks[activeIndex + 1]
    : null;

  return {
    completedBlocks,
    activeBlock,
    nextBlock,
    progressLabel: `${completedBlocks.length}/${orderedBlocks.length} blocks complete`,
    completedCount: completedBlocks.length,
    totalCount: orderedBlocks.length,
  };
}
