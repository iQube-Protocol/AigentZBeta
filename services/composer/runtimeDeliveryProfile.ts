import type { ComposerDeliveryVariant, ComposerDeploymentTarget } from "./deploymentBlock";

type RecordLike = Record<string, unknown>;

type ExperienceLike = {
  id?: string;
  template_id?: string;
  name?: string;
  description?: string;
  goal?: string;
  configuration?: RecordLike | null;
  metadata?: RecordLike | null;
};

type PersonaMediaLike = RecordLike & {
  experienceId?: string;
  experience_id?: string;
  pinnedToExperienceId?: string;
  pinned_to_experience_id?: string;
  assetUrl?: string;
  asset_url?: string;
  orientation?: string;
  type?: string;
};

export type RuntimeSurfaceIntent = "read" | "watch";

export type ComposerRuntimeDeliveryProfile = {
  intent: RuntimeSurfaceIntent;
  quickLink: RuntimeSurfaceIntent;
  contentKind: "article" | "video" | "generic";
  codexContext: {
    activeCodexId: string;
    activeCodexName: string;
  };
  runtimeCartridge: string;
  preferredImageOrientationByDevice: {
    mobile: "portrait" | "landscape";
    tablet: "portrait" | "landscape";
    desktop: "portrait" | "landscape";
  };
  imageAssets: {
    portrait?: string;
    landscape?: string;
  };
  videoAssetUrl?: string;
  surfaceHints: {
    target: ComposerDeploymentTarget;
    variant: ComposerDeliveryVariant;
    shellMode: "standard" | "thin";
    chromeMode: "full" | "content-only";
  };
  stubAssignments: {
    personaAssignment: string;
    crmCohortAssignment: string;
    policyAssignment: string;
  };
};

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function assetUrl(asset: RecordLike): string | null {
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

function assetType(asset: RecordLike): "image" | "video" {
  const explicit = firstNonEmptyString([asset.type, asset.media_type]);
  if (explicit === "video") return "video";
  if (explicit === "image") return "image";
  return /\.((mp4|mov|webm|m4v))(\?|$)/i.test(assetUrl(asset) || "") ? "video" : "image";
}

function assetTimestamp(asset: RecordLike): number {
  const raw = firstNonEmptyString([asset.updatedAt, asset.updated_at, asset.createdAt, asset.created_at, asset.timestamp]);
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function experienceMatch(asset: PersonaMediaLike, experienceId?: string): boolean {
  if (!experienceId) return false;
  return [
    firstNonEmptyString([asset.experienceId, asset.experience_id]),
    firstNonEmptyString([asset.pinnedToExperienceId, asset.pinned_to_experience_id]),
  ].includes(experienceId);
}

function collectRelevantAssets(experience: ExperienceLike | null, personaAssets: PersonaMediaLike[]) {
  const metadata = asRecord(experience?.metadata) ?? {};
  const experienceGenerated = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
        .map((item) => asRecord(item))
        .filter((item): item is RecordLike => Boolean(item))
    : [];
  const experienceId = typeof experience?.id === "string" ? experience.id : undefined;
  const personaGenerated = Array.isArray(personaAssets)
    ? personaAssets.filter((item) => experienceMatch(item, experienceId))
    : [];
  return [...experienceGenerated, ...personaGenerated].sort((a, b) => assetTimestamp(b) - assetTimestamp(a));
}

function deriveIntent(experience: ExperienceLike | null, assets: RecordLike[]): {
  intent: RuntimeSurfaceIntent;
  contentKind: "article" | "video" | "generic";
} {
  const haystack = [
    experience?.template_id,
    experience?.name,
    experience?.description,
    experience?.goal,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const hasImage = assets.some((asset) => assetType(asset) === "image");
  const hasVideo = assets.some((asset) => assetType(asset) === "video");
  const articleLike = /(article|reading|read|sprint|editorial|feature)/.test(haystack);
  const videoLike = /(video|watch|trailer|motion|clip)/.test(haystack);

  if (articleLike) return { intent: "read", contentKind: "article" };
  if (videoLike && hasVideo && !hasImage) return { intent: "watch", contentKind: "video" };
  if (hasImage || hasVideo) return { intent: "read", contentKind: hasVideo && !hasImage ? "video" : "article" };
  return { intent: "read", contentKind: "generic" };
}

export function buildRuntimeDeliveryProfile(options: {
  experience: ExperienceLike | null;
  personaLibraryAssets?: PersonaMediaLike[];
  target: ComposerDeploymentTarget;
  variant: ComposerDeliveryVariant;
}): ComposerRuntimeDeliveryProfile {
  const assets = collectRelevantAssets(options.experience, options.personaLibraryAssets || []);
  const portrait = assets.find(
    (asset) => assetType(asset) === "image" && firstNonEmptyString([asset.orientation]) === "portrait",
  );
  const landscape = assets.find(
    (asset) => assetType(asset) === "image" && firstNonEmptyString([asset.orientation]) === "landscape",
  );
  const video = assets.find((asset) => assetType(asset) === "video");
  const { intent, contentKind } = deriveIntent(options.experience, assets);
  const metadata = asRecord(options.experience?.metadata) ?? {};
  const codexContext = asRecord(metadata.codex_context) ?? {};
  const activeCodexId = firstNonEmptyString([codexContext.active_codex_id]) || "qripto-codex";
  const activeCodexName = firstNonEmptyString([codexContext.active_codex_name]) || "Qriptopian";

  return {
    intent,
    quickLink: intent,
    contentKind,
    codexContext: {
      activeCodexId,
      activeCodexName,
    },
    runtimeCartridge: "metame",
    preferredImageOrientationByDevice: {
      mobile: "portrait",
      tablet: "landscape",
      desktop: "landscape",
    },
    imageAssets: {
      portrait: portrait ? assetUrl(portrait) || undefined : undefined,
      landscape: landscape ? assetUrl(landscape) || undefined : undefined,
    },
    videoAssetUrl: video ? assetUrl(video) || undefined : undefined,
    surfaceHints: {
      target: options.target,
      variant: options.variant,
      shellMode: options.variant === "runtime_thin_client" ? "thin" : "standard",
      chromeMode: options.variant === "runtime_thin_client" ? "content-only" : "full",
    },
    stubAssignments: {
      personaAssignment: "stub:active_persona_or_creator_persona",
      crmCohortAssignment: "stub:dynamic_crm_cohort",
      policyAssignment: "stub:persona_content_policy",
    },
  };
}
