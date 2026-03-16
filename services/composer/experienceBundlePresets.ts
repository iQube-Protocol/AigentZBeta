import type {
  ExperienceBlockKind,
  ExperienceBlockManifest,
} from "@/services/composer/experienceBlockManifest";

type RecordLike = Record<string, unknown>;

type ExperienceLike = {
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
