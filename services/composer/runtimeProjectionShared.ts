import { getCodexById } from "@/data/codex-configs";
import { resolveExperienceDeploymentArtifact } from "@/services/composer/deploymentArtifactResolver";
import type { ComposerDeliveryVariant, ComposerDeploymentTarget } from "@/services/composer/deploymentBlock";
import type { ComposerRuntimeDeliveryProfile, RuntimeMenuIntent } from "@/services/composer/runtimeDeliveryProfile";
import type { RuntimeCapsuleRecord } from "@/types/runtimeCapsules";

type RecordLike = Record<string, unknown>;

type ExperienceProjectionLike = {
  id: string;
  name?: string;
  description?: string;
  tenant_id: string;
  status?: string;
  metadata?: RecordLike | null;
};

type RuntimeProjectionTarget = {
  codex_id: string;
  codex_slug: string;
  tab_id: string;
  cartridge_id: string;
  placement_priority: number;
  is_primary: boolean;
};

export type RuntimeCapsuleProjection = {
  projection_id: string;
  status: "published" | "draft";
  experience_id: string;
  tenant_id: string;
  primary_codex_id: string;
  primary_codex_slug: string;
  primary_codex_tab: string;
  cartridge_id: string;
  content_kind: "article" | "video" | "generic";
  menu_intent: RuntimeMenuIntent;
  intent: "read" | "watch";
  quick_link: "read" | "watch";
  portrait_asset?: string;
  landscape_asset?: string;
  video_asset?: string;
  preferred_asset?: string;
  preview_asset?: string;
  codex_targets: RuntimeProjectionTarget[];
  target_surface: ComposerDeploymentTarget;
  delivery_variant: ComposerDeliveryVariant;
  publish_url?: string;
  launch_url?: string;
  published_at: string;
  stub_assignments: {
    persona_assignment: string;
    crm_cohort_assignment: string;
    policy_assignment: string;
  };
};

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function slugForCodexId(codexId: string) {
  const configured = getCodexById(codexId);
  if (configured?.slug) return configured.slug;
  if (codexId === "qripto-codex") return "qripto";
  if (codexId === "knyt-codex") return "knyt";
  return codexId.replace(/-codex$/i, "");
}

function enabledCodexTabSlugs(codexId: string) {
  const codex = getCodexById(codexId);
  if (!codex?.tabs) return [];
  return codex.tabs.filter((tab) => tab.enabled !== false).map((tab) => tab.slug);
}

function deriveDefaultCodexTab(input: {
  codexId: string;
  contentKind: "article" | "video" | "generic";
  intent: "read" | "watch";
  metadata?: RecordLike | null;
}) {
  const explicit = firstNonEmptyString([
    input.metadata?.runtime_publication_primary_codex_tab,
    asRecord(input.metadata?.runtime_publication)?.primary_codex_tab,
    asRecord(input.metadata?.deployment_preferences)?.target_codex_tab,
  ]);
  const available = enabledCodexTabSlugs(input.codexId);

  if (explicit && available.includes(explicit)) return explicit;

  if (input.codexId === "qripto-codex") {
    if (available.includes("features") && (input.contentKind === "article" || input.intent === "read")) {
      return "features";
    }
    if (available.includes("scrolls")) return "scrolls";
  }

  if (input.codexId === "knyt-codex") {
    if (input.contentKind === "video" && available.includes("scrolls")) return "scrolls";
    if (input.contentKind === "article" && available.includes("scrolls")) return "scrolls";
    if (input.contentKind === "generic" && available.includes("characters")) return "characters";
  }

  if (available.includes("experiences")) return "experiences";
  if (available.includes("codex")) return "codex";
  return available[0] || "experiences";
}

export function resolveRuntimeCodexTabForExperience(options: {
  experience?: { metadata?: RecordLike | null } | null;
  runtimeProfile: ComposerRuntimeDeliveryProfile;
}) {
  const metadata = asRecord(options.experience?.metadata) ?? {};
  return (
    options.runtimeProfile.codexContext.primaryCodexTab ||
    deriveDefaultCodexTab({
      codexId: options.runtimeProfile.codexContext.activeCodexId,
      contentKind: options.runtimeProfile.contentKind,
      intent: options.runtimeProfile.intent,
      metadata,
    })
  );
}

export function buildExperienceRuntimeProjection(input: {
  experience: Pick<ExperienceProjectionLike, "id" | "name" | "description" | "tenant_id" | "metadata">;
  runtimeProfile: ComposerRuntimeDeliveryProfile;
  target: ComposerDeploymentTarget;
  variant: ComposerDeliveryVariant;
  publishUrl?: string;
  launchUrl?: string;
}): RuntimeCapsuleProjection {
  const metadata = asRecord(input.experience.metadata) ?? {};
  const artifact = resolveExperienceDeploymentArtifact({
    experience: input.experience,
    variant: input.variant,
  });
  const codexId = input.runtimeProfile.codexContext.activeCodexId;
  const codexSlug = slugForCodexId(codexId);
  const primaryCodexTab = resolveRuntimeCodexTabForExperience({
    experience: input.experience,
    runtimeProfile: input.runtimeProfile,
  });
  const now = new Date().toISOString();

  return {
    projection_id:
      firstNonEmptyString([
        asRecord(metadata.runtime_publication)?.projection_id,
        metadata.runtime_projection_id,
      ]) || `rtproj_${input.experience.id}`,
    status: "published",
    experience_id: input.experience.id,
    tenant_id: input.experience.tenant_id,
    primary_codex_id: codexId,
    primary_codex_slug: codexSlug,
    primary_codex_tab: primaryCodexTab,
    cartridge_id: input.runtimeProfile.runtimeCartridge,
    content_kind: input.runtimeProfile.contentKind,
    menu_intent: input.runtimeProfile.menuIntent,
    intent: input.runtimeProfile.intent,
    quick_link: input.runtimeProfile.quickLink,
    portrait_asset: input.runtimeProfile.imageAssets.portrait,
    landscape_asset: input.runtimeProfile.imageAssets.landscape,
    video_asset: input.runtimeProfile.videoAssetUrl,
    preferred_asset: artifact.artifact?.url || undefined,
    preview_asset: artifact.preview?.url || artifact.artifact?.url || undefined,
    codex_targets: [
      {
        codex_id: codexId,
        codex_slug: codexSlug,
        tab_id: primaryCodexTab,
        cartridge_id: input.runtimeProfile.runtimeCartridge,
        placement_priority: 1,
        is_primary: true,
      },
    ],
    target_surface: input.target,
    delivery_variant: input.variant,
    publish_url: input.publishUrl,
    launch_url: input.launchUrl,
    published_at: now,
    stub_assignments: {
      persona_assignment: input.runtimeProfile.stubAssignments.personaAssignment,
      crm_cohort_assignment: input.runtimeProfile.stubAssignments.crmCohortAssignment,
      policy_assignment: input.runtimeProfile.stubAssignments.policyAssignment,
    },
  };
}

export function runtimeProjectionToCapsuleRecord(input: {
  experience: Pick<ExperienceProjectionLike, "id" | "name" | "description" | "status" | "tenant_id">;
  projection: RuntimeCapsuleProjection;
}): RuntimeCapsuleRecord {
  const heroUri =
    input.projection.landscape_asset ||
    input.projection.portrait_asset ||
    input.projection.preview_asset ||
    input.projection.preferred_asset ||
    null;
  const thumbUri =
    input.projection.preview_asset ||
    input.projection.landscape_asset ||
    input.projection.portrait_asset ||
    input.projection.preferred_asset ||
    null;
  const modalityHints =
    input.projection.intent === "watch"
      ? ["watch", input.projection.quick_link]
      : ["read", input.projection.quick_link];
  if (input.projection.video_asset && !modalityHints.includes("watch")) {
    modalityHints.push("watch");
  }
  const launchParams = new URLSearchParams({
    capsule: input.experience.id,
    experienceId: input.experience.id,
    runtimeIntent: input.projection.menu_intent,
    runtimeQuickLink: input.projection.quick_link,
    contentKind: input.projection.content_kind,
    activeCodexId: input.projection.primary_codex_id,
    activeCodexName: getCodexById(input.projection.primary_codex_id)?.name || input.projection.primary_codex_slug,
    runtimeCodexTab: input.projection.primary_codex_tab,
    runtimeCartridge: input.projection.cartridge_id,
    preferredImageOrientationMobile: "portrait",
    preferredImageOrientationTablet: "landscape",
    preferredImageOrientationDesktop: "landscape",
  });
  if (input.experience.name) launchParams.set("experienceName", input.experience.name);
  if (input.experience.description) launchParams.set("experienceDescription", input.experience.description);
  if (input.projection.preferred_asset) launchParams.set("experienceImage", input.projection.preferred_asset);
  if (input.projection.portrait_asset) launchParams.set("experienceImagePortrait", input.projection.portrait_asset);
  if (input.projection.landscape_asset) launchParams.set("experienceImageLandscape", input.projection.landscape_asset);
  if (input.projection.video_asset) launchParams.set("experienceVideo", input.projection.video_asset);
  if (input.projection.stub_assignments.persona_assignment) {
    launchParams.set("personaAssignment", input.projection.stub_assignments.persona_assignment);
  }
  if (input.projection.stub_assignments.crm_cohort_assignment) {
    launchParams.set("crmCohortAssignment", input.projection.stub_assignments.crm_cohort_assignment);
  }
  if (input.projection.stub_assignments.policy_assignment) {
    launchParams.set("policyAssignment", input.projection.stub_assignments.policy_assignment);
  }
  if (input.projection.delivery_variant === "runtime_thin_client") {
    launchParams.set("shell", "thin");
    launchParams.set("chrome", "content-only");
  }

  return {
    id: `experience-${input.experience.id}`,
    sourceType: "experience",
    title: input.experience.name || "Published Experience",
    description: input.experience.description || "Published Composer ExperienceQube",
    heroAsset: heroUri ? { uri: heroUri, kind: "hero", origin: "experience" } : null,
    thumbnailAsset: thumbUri ? { uri: thumbUri, kind: "thumbnail", origin: "experience" } : null,
    assetStatus: heroUri || thumbUri ? "resolved" : "missing",
    metadata: {
      tenantId: input.experience.tenant_id,
      codexId: input.projection.primary_codex_id,
      codexSlug: input.projection.primary_codex_slug,
      codexTab: input.projection.primary_codex_tab,
      runtimeCartridge: input.projection.cartridge_id,
      projectionId: input.projection.projection_id,
      surfaceIntent: input.projection.menu_intent,
      modalityHints,
      durationMinutes: null,
      priceLabel: null,
      status: input.experience.status || "published",
      contentKind: input.projection.content_kind,
      previewMediaUri: input.projection.video_asset || input.projection.preview_asset || null,
    },
    launchTarget: {
      type: "experience",
      href: `/studio/composer/experience/${encodeURIComponent(input.experience.id)}?embed=1&${launchParams.toString()}`,
    },
  };
}
