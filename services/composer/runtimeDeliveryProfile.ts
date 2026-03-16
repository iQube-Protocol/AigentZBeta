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
export type RuntimeMenuIntent = "make" | "play";

export type ComposerRuntimeDeliveryProfile = {
  menuIntent: RuntimeMenuIntent;
  intent: RuntimeSurfaceIntent;
  quickLink: RuntimeSurfaceIntent;
  contentKind: "article" | "video" | "generic";
  codexContext: {
    activeCodexId: string;
    activeCodexName: string;
    primaryCodexTab: string;
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

function assetPriority(asset: RecordLike): number {
  const url = assetUrl(asset) || "";
  if (/\/api\/skills\/video\//i.test(url)) return -10;
  if (/supabase\.co\/storage\/v1\/object\/public\//i.test(url)) return 10;
  if (/^https?:\/\//i.test(url)) return 5;
  return 0;
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
  return [...experienceGenerated, ...personaGenerated].sort((a, b) => {
    const priorityDelta = assetPriority(b) - assetPriority(a);
    if (priorityDelta !== 0) return priorityDelta;
    return assetTimestamp(b) - assetTimestamp(a);
  });
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
  const explicitVideoTemplate = typeof experience?.template_id === "string" && experience.template_id === "sora-video-generation";

  if ((explicitVideoTemplate || videoLike) && hasVideo) return { intent: "watch", contentKind: "video" };
  if (articleLike) return { intent: "read", contentKind: "article" };
  if (hasImage || hasVideo) return { intent: "read", contentKind: hasVideo && !hasImage ? "video" : "article" };
  return { intent: "read", contentKind: "generic" };
}

function deriveRuntimeCartridge(codexId: string, metadata: RecordLike): string {
  const explicit = firstNonEmptyString([
    metadata.runtime_cartridge,
    metadata.cartridge_id,
    asRecord(metadata.runtime_publication)?.cartridge_id,
  ]);
  if (explicit) return explicit;
  if (codexId === "qripto-codex" || codexId === "knyt-codex") return "Qriptopian";
  if (codexId === "aigentiq-codex") return "AgentiQ";
  return "metaMe";
}

function derivePrimaryCodexTab(
  codexId: string,
  contentKind: "article" | "video" | "generic",
  intent: RuntimeSurfaceIntent,
  metadata: RecordLike,
): string {
  const explicit = firstNonEmptyString([
    metadata.runtime_publication_primary_codex_tab,
    asRecord(metadata.runtime_publication)?.primary_codex_tab,
    asRecord(metadata.deployment_preferences)?.target_codex_tab,
  ]);
  if (explicit) return explicit;
  if (codexId === "knyt-codex") return "scrolls";
  if (codexId === "qripto-codex") {
    if (contentKind === "article" || intent === "read" || intent === "watch") return "features";
    return "codex";
  }
  return "experiences";
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
  const primaryCodexTab = derivePrimaryCodexTab(activeCodexId, contentKind, intent, metadata);

  return {
    menuIntent: "make",
    intent,
    quickLink: intent,
    contentKind,
    codexContext: {
      activeCodexId,
      activeCodexName,
      primaryCodexTab,
    },
    runtimeCartridge: deriveRuntimeCartridge(activeCodexId, metadata),
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
