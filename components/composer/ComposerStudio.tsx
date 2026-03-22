"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BarChart, Book, BookOpen, Bot, CheckCircle2, ChevronDown, ChevronUp, Circle, Code, Edit, Eye, FileText, Hexagon, LayoutGrid, List, Loader2, Monitor, MonitorIcon, Moon, Palette, Play, PlayCircle, RefreshCw, Share2, Shield, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Sun, Target, Tablet, Trash2, Tv, Upload, Users, Volume2, Type } from "lucide-react";
import { useCopilotAction } from "@copilotkit/react-core";
import { createShellMessage } from "@metame/iframe-bridge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DevicePreviewSwitcher } from "@/components/preview/DevicePreviewSwitcher";
import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { SmartTriadProvider } from "@/app/components/content";
import { agentConfigs } from "@/app/data/agentConfig";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { resolveLiquidTemplateId } from "@/services/composer/composerRegistryMapping";
import type { SmartContentQube } from "@/types/smartContent";
import { useDesignQubeTheme } from "@/components/metame/useDesignQubeTheme";
import { useCodexList } from "@/app/hooks/useCodexConfig";
import type { CodexListItem } from "@/types/codex";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";
import { CodexCopilotLayer } from "@/app/components/codex/CodexCopilotLayer";
import { AgenticDesignParityPanel } from "@/components/composer/AgenticDesignParityPanel";
import SurfacePlanningPanel from "@/components/composer/SurfacePlanningPanel";
import DVNReceiptsPanel from "@/components/composer/DVNReceiptsPanel";
import {
  buildComposerSessionContext,
  getComposerProviderKnowledge,
  getComposerTemplateKnowledge,
} from "@/services/copilot/composer";
import type { ComposerGeneratedAssetRef } from "@/services/copilot/composer/types";
import { resolveRuntimeIdentity } from "@/services/runtime/identityResolver";
import { recordRuntimeLifecycleContribution } from "@/services/composer/runtimeLifecycleClient";
import {
  type ComposerDeploymentAdapter,
  type ComposerDeploymentAdapterDeclaration,
  dispatchComposerDeployment,
  type ComposerDeploymentCapability,
  type ComposerDeploymentCapabilityState,
  type ComposerDeploymentDeliveryMode,
  getDeploymentAdapterDeclaration,
  getDeploymentTargetLabel,
  getSupportedVariantsForTarget,
  listDeploymentAdapterDeclarations,
  resolveDeploymentFallbackGuidance,
  resolveDeploymentRemediationActions,
  resolveDeploymentCapability,
  resolveDeploymentDeliveryMode,
  type ComposerDeliveryVariant,
  type ComposerDeploymentResult,
  type ComposerDeploymentTarget,
} from "@/services/composer/deploymentBlock";
import { resolveExperienceDeploymentArtifact } from "@/services/composer/deploymentArtifactResolver";
import { buildRuntimeDeliveryProfile } from "@/services/composer/runtimeDeliveryProfile";
import {
  buildExperienceRuntimeProjection,
  resolveRuntimeCodexTabForExperience,
} from "@/services/composer/runtimeProjectionShared";
import { buildExperienceBlockManifest } from "@/services/composer/experienceBlockManifest";
import {
  buildExperienceBundlePresetPatch,
  getAppliedExperienceBundle,
  listExperienceBundlePresets,
  resolveExperienceBundleBlockOutputs,
  resolveExperienceBundleFlowTarget,
  resolveExperienceBundleSequencingState,
  type ExperienceBundleBlockStatus,
  type ExperienceBundlePresetId,
} from "@/services/composer/experienceBundlePresets";
import { buildComposerRoutingEnvelope } from "@/services/composer/routingEnvelope";
import {
  markPersonaGeneratedMediaLifecycle,
  markPersonaGeneratedMediaUsage,
  type PersistableGeneratedAsset,
  persistGeneratedAssetsForExperience,
  setPersonaGeneratedMediaPinned,
  updatePersonaGeneratedMediaRecord,
} from "@/services/composer/generatedAssetClient";

type ComposerField = {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "checkbox" | "slider" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: { min?: number; max?: number; step?: number; pattern?: string };
  default_value?: any;
  help_text?: string;
};

type ComposerStep = {
  id: string;
  title: string;
  description: string;
  type: "selection" | "configuration" | "validation" | "preview";
  required: boolean;
  component_type?: "DataQube" | "ContentQube" | "ToolQube" | "ModelQube" | "AgentQube";
  ui_config: {
    layout: "wizard" | "form" | "grid" | "timeline";
    fields: ComposerField[];
  };
};

type ExperienceTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  estimated_time: number;
  required_components: string[];
  optional_components: string[];
  steps: ComposerStep[];
  tags: string[];
};

type ComposerSession = {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string;
  current_step: number;
  status: "active" | "completed" | "abandoned";
  data: Record<string, any>;
};

type ExperienceQube = {
  id: string;
  name: string;
  description: string;
  goal: string;
  mechanics: string;
  metrics: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  configuration?: Record<string, any>;
  components?: Array<{
    component_type: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AgentQube';
  }>;
  access?: {
    visibility: 'private' | 'tenant' | 'public';
    required_entitlements: string[];
    allowed_roles: string[];
  };
  metadata?: Record<string, any> & {
    creator_persona?: { id?: string; name?: string };
    codex_context?: {
      active_codex_id?: string;
      active_codex_name?: string;
      parent_codex_id?: string;
      parent_codex_name?: string;
      inheritance_mode?: "direct" | "inherited";
    };
    generated_assets?: Array<{
      id: string;
      type: "image" | "video";
      label: string;
      provider?: string;
      orientation?: "portrait" | "landscape";
      asset_url?: string;
      storage_path?: string;
      receipt_ref?: string;
    }>;
    deployment_state?: {
      last_target?: string;
      last_variant?: string;
      last_destination_surface?: string;
      last_status?: string;
      last_capability_state?: string;
      last_capability_summary?: string;
      last_capability_constraints?: string[];
      last_adapter_declaration?: Record<string, any>;
      last_delivery_mode?: string;
      last_destination_adapter?: string;
      last_provider?: string;
      last_mode?: string;
      last_publish_url?: string;
      last_launch_url?: string;
      last_deployed_at?: string;
      last_error?: string;
      last_runtime_profile?: Record<string, any>;
      last_runtime_projection?: Record<string, any>;
    };
      deployment_history?: Array<{
        id: string;
        target: string;
        variant?: string;
        destination_surface?: string;
        provider?: string;
        mode?: string;
        status: string;
      capability_state?: string;
      capability_summary?: string;
      capability_constraints?: string[];
      adapter_declaration?: Record<string, any>;
      delivery_mode?: string;
      destination_adapter?: string;
      publish_url?: string;
      launch_url?: string;
      source?: string;
      deployed_at: string;
      error?: string;
      runtime_profile?: Record<string, any>;
      runtime_projection?: Record<string, any>;
    }>;
  };
};

const DEFAULT_RUNTIME_IFRAME_URL = "https://runtime.metame.com/metame/runtime?embed=1&shell=thin";
const DEFAULT_RUNTIME_IFRAME_PATH = "/metame/runtime";

function normalizeRuntimeIframePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/runtime" || trimmed === "/") {
    return DEFAULT_RUNTIME_IFRAME_PATH;
  }
  return trimmed;
}

function resolveRuntimeBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_RUNTIME_IFRAME_URL ||
    process.env.NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN ||
    DEFAULT_RUNTIME_IFRAME_URL;

  try {
    const parsed = new URL(raw);
    parsed.pathname = normalizeRuntimeIframePath(parsed.pathname);
    parsed.search = "";
    parsed.hash = "";
    return parsed;
  } catch {
    return new URL(DEFAULT_RUNTIME_IFRAME_URL);
  }
}

type ComposerMediaItem = {
  id: string;
  label: string;
  tag: string;
  mediaType: string;
  mediaUri: string;
};

type PersonaGeneratedMediaRecord = {
  id: string;
  experienceId: string;
  personaId: string;
  type: "image" | "video";
  label: string;
  provider?: string;
  orientation?: "portrait" | "landscape";
  assetUrl?: string;
  storagePath?: string;
  receiptRef?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt: string;
  useCount?: number;
  lastUsedAt?: string;
  lastUsedInExperienceId?: string;
  lastAction?: "generated" | "reused";
  previewCount?: number;
  launchCount?: number;
  lastPreviewAt?: string;
  lastLaunchAt?: string;
  pinnedToExperienceId?: string;
  pinnedAt?: string;
  deliveryTargets?: string[];
  lastDeliveryTarget?: string;
  archivedAt?: string;
};

type InspectorMediaPreview = {
  uri: string;
  mediaType: "image" | "video";
};

type InspectorSourceBadge = "Experience" | "Article" | "Video" | "Codex";

type ContentSectionLookupPlan = {
  section: string;
  tab?: string;
};

function inferComposerMediaModeFromPrompt(prompt: string): "image" | "video" | "article" | "mixed" {
  const lower = prompt.toLowerCase();
  if (/(video|trailer|clip|motion|sora|venice)/.test(lower)) return "video";
  if (/(article|editorial|reading|read|feature)/.test(lower)) return "article";
  if (/(image|hero image|illustration|artwork|portrait|landscape|visual)/.test(lower)) return "image";
  return "mixed";
}

function promptWantsVideo(prompt: string) {
  return /(video|trailer|clip|motion|animate|animated|film|cinematic sequence|sora|venice)/.test(
    prompt.toLowerCase()
  );
}

function promptWantsImage(prompt: string) {
  return /(image|hero image|illustration|artwork|portrait|landscape|visual|poster|cover art)/.test(
    prompt.toLowerCase()
  );
}

function inferVisualStyleFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/(comic|graphic novel|panel)/.test(lower)) return "comic";
  if (/(animation|animated|anime)/.test(lower)) return "animation";
  if (/(photo|photoreal|realistic)/.test(lower)) return "photorealistic";
  if (/(editorial|article|magazine)/.test(lower)) return "editorial";
  return "cinematic";
}

function deriveExperienceNameFromPrompt(prompt: string, fallback: string): string {
  const cleaned = prompt
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!]+$/g, "");
  if (!cleaned) return fallback;
  return cleaned.length > 52 ? `${cleaned.slice(0, 49).trim()}...` : cleaned;
}

function buildImagePromptVariants(prompt: string, contextLabel: string) {
  const style = inferVisualStyleFromPrompt(prompt);
  return {
    portrait: `Create a ${style} vertical-format hero image for ${contextLabel}. ${prompt}. Use portrait orientation only as framing. Keep all title text, logos, and key visual subjects fully inside the visible frame with generous safe margins. Do not crop or truncate any important text or focal elements at the edges. Vertical composition, strong focal subject, premium lighting, runtime-grade polish.`,
    landscape: `Create a ${style} horizontal-format hero image for ${contextLabel}. ${prompt}. Use widescreen framing only. Do not depict a natural landscape unless the prompt explicitly asks for one. Keep all title text, logos, and key visual subjects fully inside the visible frame with generous safe margins. Do not crop or truncate any important text or focal elements at the edges. Wide cinematic composition, strong depth, editorial clarity, runtime-grade polish.`,
  };
}

function buildVideoPrompt(prompt: string, contextLabel: string) {
  const style = inferVisualStyleFromPrompt(prompt);
  return `Create a concise ${style} video for ${contextLabel}. ${prompt}. Keep the scene focused, motion readable, composition strong, and suitable for a runtime-grade experience.`;
}

function resolveComposerCodexContext(codexId: string, codexLabel: string) {
  const normalizedId = (codexId || "").toLowerCase();
  const normalizedLabel = (codexLabel || "").toLowerCase();
  const isMetaKnyts =
    normalizedId.includes("metaknyts") ||
    normalizedId.includes("knyt") ||
    normalizedLabel.includes("metaknyts") ||
    normalizedLabel.includes("knyt");

  if (isMetaKnyts) {
    return {
      activeCodexId: codexId || "metaknyts",
      activeCodexName: codexLabel || "metaKnyts",
      parentCodexId: "qripto-codex",
      parentCodexName: "Qriptopian",
      codexInheritanceMode: "inherited" as const,
      codexNotes: [
        "metaKnyts inherits the broader Qriptopian context.",
        "Favor metaKnyts-specific lore, visual language, and templates when relevant.",
      ],
    };
  }

  return {
    activeCodexId: codexId || "qripto-codex",
    activeCodexName: codexLabel || "Qriptopian",
    parentCodexId: undefined,
    parentCodexName: undefined,
    codexInheritanceMode: "direct" as const,
    codexNotes: ["Using the broader Qriptopian codex context."],
  };
}

function extractGeneratedAssetsFromExperience(
  experience: ExperienceQube | null | undefined
): ComposerGeneratedAssetRef[] {
  const generatedAssets = experience?.metadata?.generated_assets;
  if (!Array.isArray(generatedAssets)) return [];
  return generatedAssets.map((asset) => ({
    id: String(asset.id || `${experience?.id || "asset"}:${asset.label || "generated"}`),
    type: asset.type === "video" ? ("video" as const) : ("image" as const),
    label: String(asset.label || "Generated asset"),
    provider: asset.provider ? String(asset.provider) : undefined,
    orientation:
      asset.orientation === "portrait" || asset.orientation === "landscape"
        ? asset.orientation
        : undefined,
    assetUrl: asset.asset_url ? String(asset.asset_url) : undefined,
    storagePath: asset.storage_path ? String(asset.storage_path) : undefined,
    receiptRef: asset.receipt_ref ? String(asset.receipt_ref) : undefined,
  }));
}

function mapStudioTemplateToSessionTemplate(templateId: string) {
  const map: Record<string, string> = {
    "qripto-feature-article": "qriptopian_reading_sprint_v0",
    "qripto-penny-drops": "content_analysis_v1",
    "qripto-smart-offer": "interactive_story_v1",
  };
  return map[templateId] || templateId;
}

function summarizeExperienceResources(
  sessionTemplate: ExperienceTemplate | null | undefined,
  mergedData: Record<string, any> | null | undefined
) {
  const skills: Array<{ label: string; value: string }> = [];
  const resources: Array<{ label: string; value: string }> = [];
  const userData: Array<{ label: string; value: string }> = [];

  if (!sessionTemplate) {
    return { skills, resources, userData };
  }

  const pushItem = (
    bucket: Array<{ label: string; value: string }>,
    label: string,
    value: unknown
  ) => {
    if (value === null || value === undefined || value === "") return;
    const normalizedValue = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "boolean"
        ? value ? "Required" : "Optional"
        : String(value);
    if (!normalizedValue.trim()) return;
    bucket.push({ label, value: normalizedValue });
  };

  sessionTemplate.steps.forEach((step) => {
    const stepValuesForStep = mergedData?.[step.id];
    if (!stepValuesForStep || typeof stepValuesForStep !== "object") return;

    step.ui_config.fields.forEach((field) => {
      const fieldValue = stepValuesForStep[field.id];
      const fingerprint = `${field.id} ${field.name}`.toLowerCase();
      const label = field.name;

      if (fingerprint.includes("skill")) {
        pushItem(skills, label, fieldValue);
        return;
      }

      if (
        fingerprint.includes("resource") ||
        fingerprint.includes("tool") ||
        fingerprint.includes("content") ||
        fingerprint.includes("agent") ||
        fingerprint.includes("model")
      ) {
        pushItem(resources, label, fieldValue);
        return;
      }

      if (
        fingerprint.includes("wallet") ||
        fingerprint.includes("profile") ||
        fingerprint.includes("email") ||
        fingerprint.includes("user") ||
        fingerprint.includes("consent") ||
        fingerprint.includes("data")
      ) {
        pushItem(userData, label, fieldValue);
      }
    });
  });

  return { skills, resources, userData };
}

function mergeExperienceResourceSummary(
  baseSummary: ReturnType<typeof summarizeExperienceResources>,
  activeExperience: ExperienceQube | null | undefined
) {
  const summary = {
    skills: [...baseSummary.skills],
    resources: [...baseSummary.resources],
    userData: [...baseSummary.userData],
  };
  const existing = new Set(
    [...summary.skills, ...summary.resources, ...summary.userData].map((item) => `${item.label}:${item.value}`)
  );
  const pushUnique = (bucket: Array<{ label: string; value: string }>, label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    const entry = `${label}:${String(value)}`;
    if (existing.has(entry)) return;
    existing.add(entry);
    bucket.push({ label, value: String(value) });
  };

  const config = activeExperience?.configuration || {};
  const metadata = activeExperience?.metadata || {};
  const skillSelection = config.skill_selection || {};
  const imageGeneration = config.image_generation || {};
  const generatedAssets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  const generatedReceipts = metadata.generated_receipts && typeof metadata.generated_receipts === "object"
    ? Object.values(metadata.generated_receipts as Record<string, any>)
    : [];

  const selectedModel =
    generatedReceipts
      .flatMap((receipt: any) => (Array.isArray(receipt?.payload?.outputs) ? receipt.payload.outputs : []))
      .map((output: any) => (typeof output?.model === "string" ? output.model : null))
      .find((value: string | null): value is string => Boolean(value)) ||
    (typeof imageGeneration.model === "string" ? imageGeneration.model : null) ||
    (typeof skillSelection.model === "string" ? skillSelection.model : null);

  if (skillSelection.skill_id) {
    pushUnique(summary.skills, "Active video skill", skillSelection.skill_id);
  }
  if (imageGeneration.provider_id) {
    pushUnique(summary.skills, "Image provider", imageGeneration.provider_id);
  }
  if (selectedModel) {
    pushUnique(summary.resources, "Model selected", selectedModel);
  }
  if (generatedAssets.length > 0) {
    pushUnique(summary.resources, "Generated assets", `${generatedAssets.length} persisted asset${generatedAssets.length === 1 ? "" : "s"}`);
    generatedAssets.forEach((asset: any) => {
      pushUnique(
        summary.resources,
        asset.type === "video" ? "Generated video" : `Generated ${asset.orientation || "image"}`,
        asset.provider || asset.label || "Persisted media"
      );
    });
  }
  if (metadata.creator_persona?.name || metadata.creator_persona?.id) {
    pushUnique(summary.resources, "Creator persona", metadata.creator_persona.name || metadata.creator_persona.id);
  }
  if (activeExperience?.template_id) {
    pushUnique(summary.resources, "Experience template", activeExperience.template_id);
  }
  if (metadata.deployment_state && typeof metadata.deployment_state === "object") {
    pushUnique(summary.resources, "Deployment target", metadata.deployment_state.last_target);
    pushUnique(summary.resources, "Deployment status", metadata.deployment_state.last_status);
    pushUnique(summary.resources, "Deployment provider", metadata.deployment_state.last_provider);
    pushUnique(summary.resources, "Last deployed", metadata.deployment_state.last_deployed_at);
  }

  return summary;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );
}

const ARTICLE_DRAFT_OUTPUT_OPTIONS = [
  { value: "takeaways", label: "3 Takeaways" },
  { value: "glossary", label: "Glossary" },
  { value: "next_action", label: "Next Action" },
] as const;

type ArticleDraftArtifact = {
  title: string;
  deck: string;
  opening: string;
  sections: Array<{ heading: string; body: string }>;
  takeaways: string[];
  glossary: Array<{ term: string; definition: string }>;
  nextAction: string | null;
};

function trimTrailingPunctuation(value: string) {
  return value.trim().replace(/[.?!]+$/g, "");
}

function sentence(value: string, fallback: string) {
  const normalized = trimTrailingPunctuation(value || "");
  if (!normalized) return fallback;
  return `${normalized}.`;
}

function buildArticleDraftArtifact(params: {
  experienceName?: string | null;
  title?: string | null;
  prompt?: string | null;
  outputs?: string[];
  takeawaysCount?: number;
  mediaMode?: "image" | "video";
}): ArticleDraftArtifact | null {
  const title = firstNonEmptyString([params.title, params.experienceName, "Editorial draft"]);
  const prompt = firstNonEmptyString([params.prompt]);
  if (!title && !prompt) return null;

  const outputs = normalizeStringArray(params.outputs);
  const takeawaysCount = Math.min(Math.max(params.takeawaysCount || 3, 1), 5);
  const mediaNoun = params.mediaMode === "video" ? "video experience" : "visual experience";
  const promptSentence = sentence(
    prompt || "",
    `Frame the current ${mediaNoun} with a supporting editorial narrative`,
  );
  const deck = `${title || "Editorial draft"} pairs the current ${mediaNoun} with copy that explains why it matters and what the audience should do next.`;
  const opening = `${promptSentence} This draft is structured to help the audience understand the core idea quickly, then move into the supporting details with confidence.`;
  const sections = [
    {
      heading: "Why this matters",
      body: `Use this section to establish the editorial thesis behind ${title || "the experience"} and explain why the audience should care right now.`,
    },
    {
      heading: params.mediaMode === "video" ? "How to watch this" : "How to read the visual",
      body: `Anchor the audience in the primary ${mediaNoun}, call out the important cues to notice, and connect those cues back to the editorial prompt.`,
    },
    {
      heading: "What to do next",
      body: "Close with the strongest practical takeaway, the intended action, and any reward, quest, or follow-on experience the audience should open next.",
    },
  ];

  const takeaways = Array.from({ length: takeawaysCount }, (_, index) => {
    if (index === 0) return `Lead with the core thesis behind ${title || "this experience"}.`;
    if (index === 1) return `Tie the ${mediaNoun} directly to the supporting editorial explanation.`;
    if (index === 2) return "Make the audience's next action explicit and easy to follow.";
    if (index === 3) return "Use the supporting copy to reinforce trust, provenance, and reward context.";
    return "Keep the closing summary concise enough to work as a launch or share-ready capsule.";
  });

  const glossary = outputs.includes("glossary")
    ? [
        {
          term: "Editorial frame",
          definition: "The short narrative layer that explains what the audience is seeing and why it matters.",
        },
        {
          term: "Supporting context",
          definition: "Companion copy that turns a media asset into a guided experience rather than a standalone artifact.",
        },
      ]
    : [];

  const nextAction = outputs.includes("next_action")
    ? "Prompt the user to continue into the linked experience, unlock the next capsule, or share the strongest takeaway."
    : null;

  return {
    title: title || "Editorial draft",
    deck,
    opening,
    sections,
    takeaways: outputs.includes("takeaways") ? takeaways : [],
    glossary,
    nextAction,
  };
}

function resolveBundlePreferredStepId(
  blockKind: string | null | undefined,
  sessionData: Record<string, any> | null | undefined,
) {
  if (blockKind === "image_generation") {
    return "image_generation";
  }
  if (blockKind === "video_generation") {
    const selectedSkillId = sessionData?.skill_selection?.skill_id;
    return typeof selectedSkillId === "string" && selectedSkillId.trim() ? "video_prompt" : "skill_selection";
  }
  if (blockKind === "article_draft") {
    const contentStep = sessionData?.content_selection;
    const hasContentSelection =
      Boolean(contentStep?.feature_item_id) ||
      Boolean(contentStep?.issue_slug) ||
      (Array.isArray(contentStep?.supporting_item_ids) && contentStep.supporting_item_ids.length > 0);
    return hasContentSelection ? "copilot_output" : "content_selection";
  }
  if (blockKind === "deployment") {
    return "wallet_rewards";
  }
  return null;
}

function buildBundleFlowSeedData(
  experience: ExperienceQube | null | undefined,
  sessionData: Record<string, any> | null | undefined,
) {
  const safeConfiguration =
    experience?.configuration && typeof experience.configuration === "object" && !Array.isArray(experience.configuration)
      ? ({ ...experience.configuration } as Record<string, any>)
      : {};
  const safeSessionData =
    sessionData && typeof sessionData === "object" && !Array.isArray(sessionData)
      ? ({ ...sessionData } as Record<string, any>)
      : {};
  const configurationIntent =
    safeConfiguration.intent_timebox && typeof safeConfiguration.intent_timebox === "object"
      ? { ...safeConfiguration.intent_timebox }
      : {};
  const sessionIntent =
    safeSessionData.intent_timebox && typeof safeSessionData.intent_timebox === "object"
      ? { ...safeSessionData.intent_timebox }
      : {};

  return {
    ...safeConfiguration,
    ...safeSessionData,
    intent_timebox: {
      ...configurationIntent,
      ...sessionIntent,
      experience_name: firstNonEmptyString([
        sessionIntent.experience_name,
        configurationIntent.experience_name,
        experience?.name,
      ]) || "",
      goal: firstNonEmptyString([
        sessionIntent.goal,
        configurationIntent.goal,
        safeSessionData.goal,
        safeConfiguration.goal,
        experience?.goal,
        experience?.description,
      ]) || "",
    },
    description:
      firstNonEmptyString([safeSessionData.description, safeConfiguration.description, experience?.description]) || "",
    goal: firstNonEmptyString([safeSessionData.goal, safeConfiguration.goal, experience?.goal]) || "",
    mechanics:
      firstNonEmptyString([safeSessionData.mechanics, safeConfiguration.mechanics, experience?.mechanics]) || "",
    metrics: firstNonEmptyString([safeSessionData.metrics, safeConfiguration.metrics, experience?.metrics]) || "",
  };
}

function resolveStepIndexForId(steps: ComposerStep[], preferredStepId: string | null | undefined) {
  if (!preferredStepId) return null;
  const index = steps.findIndex((step) => step.id === preferredStepId);
  return index >= 0 ? index : null;
}

function getBundleStatusClasses(status: ExperienceBundleBlockStatus) {
  if (status === "accepted") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "ready_for_review") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  }
  if (status === "in_progress") {
    return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
  }
  return "border-slate-700 bg-slate-900/70 text-slate-400";
}

function inferMediaType(uri: string, preferred?: string | null): "image" | "video" {
  if (preferred === "video") return "video";
  if (preferred === "image") return "image";
  if (/\.(mp4|m4v|webm|mov|m3u8)(\?|$)/i.test(uri)) return "video";
  return "image";
}

function isLegacyVideoProxyUrl(uri: string | null | undefined) {
  return typeof uri === "string" && /\/api\/skills\/video\//i.test(uri);
}

function canInlineVideoUri(uri: string | null | undefined) {
  return Boolean(uri) && !isLegacyVideoProxyUrl(uri);
}

function resolveExperiencePrimaryMedia(
  experience: ExperienceQube | null,
  codexItems: ComposerMediaItem[],
  personaLibraryAssets: PersonaGeneratedMediaRecord[] = [],
  variant: ComposerDeliveryVariant = "runtime_thin_client",
): InspectorMediaPreview | null {
  if (!experience) return null;

  const resolved = resolveExperienceDeploymentArtifact({
    experience,
    variant,
    personaLibraryAssets: personaLibraryAssets as unknown as Array<Record<string, unknown>>,
    contextItems: [...codexItems, ...QRIPTO_CONTENT_ITEMS],
  });
  const candidate = resolved.preview || resolved.context;
  if (!candidate?.url) return null;
  if (candidate.mediaType === "video" && !canInlineVideoUri(candidate.url)) return null;
  return {
    uri: candidate.url,
    mediaType: candidate.mediaType,
  };
}

function buildSectionLookupPlans(tag: string | null): ContentSectionLookupPlan[] {
  const normalized = (tag || "").trim().toLowerCase();
  if (!normalized) {
    return [
      { section: "home-hero" },
      { section: "latest-news" },
      { section: "second-hero" },
      { section: "pennydrops" },
      { section: "scrolls" },
      { section: "21knowdz" },
    ];
  }
  if (normalized === "hero") return [{ section: "home-hero" }];
  if (normalized === "second-hero") return [{ section: "second-hero" }];
  if (normalized === "latest-news") return [{ section: "latest-news" }];
  if (normalized === "penny-drops") return [{ section: "pennydrops" }];
  if (normalized === "scrolls-metaknyts") return [{ section: "scrolls", tab: "metaknyts" }, { section: "scrolls" }];
  if (normalized === "scrolls-synthsimms") return [{ section: "scrolls", tab: "synthsims" }, { section: "scrolls" }];
  if (normalized === "knowdz-exec") return [{ section: "21knowdz", tab: "exec" }, { section: "21knowdz" }];
  if (normalized === "knowdz-creative") return [{ section: "21knowdz", tab: "creative" }, { section: "21knowdz" }];
  if (normalized === "knowdz-devs") return [{ section: "21knowdz", tab: "dev" }, { section: "21knowdz" }];
  return [{ section: normalized }];
}

function getDeploymentDestinationSurfaceLabel(
  target: ComposerDeploymentTarget | string | null | undefined,
  variant?: string | null,
) {
  if (target === "studio_preview") return "Studio preview";
  if (target === "runtime_launch") {
    return variant === "runtime_thin_client" ? "metaMe runtime thin client" : "metaMe runtime";
  }
  if (target === "discord_mcp") {
    if (variant === "discord_asset_inline") return "Discord inline asset";
    if (variant === "discord_experience_inline") return "Discord inline experience";
    if (variant === "asset_link") return "External asset link";
    return "Discord via MCP";
  }
  if (target === "mcp_app") {
    if (variant === "asset_link") return "External asset link";
    if (variant === "runtime_thin_client") return "metaMe runtime thin client";
    if (variant === "runtime_standard") return "metaMe runtime";
    return "MCP app surface";
  }
  return "Deployment surface";
}

function getCapabilityToneClass(state: ComposerDeploymentCapabilityState | string | null | undefined) {
  if (state === "supported") return "text-emerald-300";
  if (state === "limited") return "text-amber-200";
  if (state === "scaffolded") return "text-fuchsia-200";
  return "text-slate-400";
}

function getCapabilityLabel(state: ComposerDeploymentCapabilityState | string | null | undefined) {
  if (state === "supported") return "Supported";
  if (state === "limited") return "Limited";
  if (state === "scaffolded") return "Scaffolded";
  return "Unclassified";
}

function getDeliveryVariantLabel(variant: ComposerDeliveryVariant) {
  switch (variant) {
    case "runtime_standard":
      return "Experience in full metaMe runtime";
    case "runtime_thin_client":
      return "Experience in metaMe runtime thin client";
    case "asset_link":
      return "Asset link outside Discord";
    case "discord_asset_inline":
      return "Asset rendered within Discord";
    case "discord_experience_inline":
      return "Experience scaffolded within Discord";
    default:
      return variant;
  }
}

function pickMediaFromSectionContent(items: any[], preferredIds: string[]): InspectorMediaPreview | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const normalizedIds = preferredIds.map((id) => id.toLowerCase());
  const sorted = [...items].sort((a, b) => {
    const aId = String(a?.id || a?.content_id || a?.slug || "").toLowerCase();
    const bId = String(b?.id || b?.content_id || b?.slug || "").toLowerCase();
    const aPreferred = normalizedIds.includes(aId) ? 1 : 0;
    const bPreferred = normalizedIds.includes(bId) ? 1 : 0;
    return bPreferred - aPreferred;
  });

  for (const item of sorted) {
    const imageUri = firstNonEmptyString([item?.image, item?.thumbnail, item?.cover_image_url, item?.cover_image_uri]);
    const videoUri = firstNonEmptyString([item?.modalities?.watch?.video_url]);
    const uri = imageUri || videoUri;
    if (!uri) continue;
    return {
      uri,
      mediaType: videoUri ? "video" : "image",
    };
  }
  return null;
}

function resolveInspectorSourceBadge(params: {
  mcpResult: any;
  fallbackMediaType: string;
}): InspectorSourceBadge {
  const textPool: string[] = [];
  const addText = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      textPool.push(value.trim().toLowerCase());
    }
  };

  const response = params.mcpResult?.output?.mcpResponse || params.mcpResult?.output || {};
  const artifact = response?.artifact || {};
  const dispatch = params.mcpResult?.output?.providerDispatch || {};

  addText(artifact?.title);
  addText(artifact?.body);
  addText(dispatch?.text);
  if (Array.isArray(artifact?.tags)) {
    artifact.tags.forEach(addText);
  }

  const textBlob = textPool.join(" ");
  if (/\bcodex\b/.test(textBlob)) return "Codex";
  if (/\b(video|watch|clip|trailer)\b/.test(textBlob) || params.fallbackMediaType === "video") return "Video";
  if (/\b(article|read|news|feature)\b/.test(textBlob)) return "Article";
  return "Experience";
}

const DEFAULT_TENANT = "qripto-codex";
const DEFAULT_USER = "aigentz@aigent:u_demo_001";
const COMPOSER_CACHE_TTL_MS = 5 * 60 * 1000;
const EXPERIENCE_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_EXPERIENCE_CACHE_TENANTS = 8;

type ComposerStudioCache = {
  templates: ExperienceTemplate[] | null;
  templatesFetchedAt: number;
  designQube: DesignQube | null;
  designQubeId: string | null;
  designQubeFetchedAt: number;
  experiencesByTenant: Record<string, { items: ExperienceQube[]; fetchedAt: number }>;
};

let composerStudioCache: ComposerStudioCache = {
  templates: null,
  templatesFetchedAt: 0,
  designQube: null,
  designQubeId: null,
  designQubeFetchedAt: 0,
  experiencesByTenant: {},
};

const isCacheFresh = (fetchedAt: number, ttlMs: number) =>
  fetchedAt > 0 && Date.now() - fetchedAt < ttlMs;

const pruneExperienceCache = () => {
  const entries = Object.entries(composerStudioCache.experiencesByTenant);
  if (entries.length <= MAX_EXPERIENCE_CACHE_TENANTS) return;
  entries
    .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
    .slice(0, entries.length - MAX_EXPERIENCE_CACHE_TENANTS)
    .forEach(([tenant]) => {
      delete composerStudioCache.experiencesByTenant[tenant];
    });
};

const cacheExperiencesForTenant = (tenantId: string, items: ExperienceQube[]) => {
  composerStudioCache.experiencesByTenant[tenantId] = {
    items,
    fetchedAt: Date.now(),
  };
  pruneExperienceCache();
};

const QRIPTO_FALLBACK_CODEXES = [
  { id: "knyt-codex", label: "KNYT Codex" },
  { id: "qripto-codex", label: "Qriptopian Codex" },
  { id: "aigentiq-codex", label: "AgentiQ Codex" },
  { id: "marketa-codex", label: "Aigent Marketa" },
  { id: "moneypenny-codex", label: "Aigent MoneyPenny" },
  { id: "nakamoto-codex", label: "Aigent Nakamoto" },
];

const DESIGN_QUBE_OPTIONS = [
  { id: "knyt-guidance-v1", label: "KNYT Guidance", contextId: "knyt-codex" },
  { id: "qriptopian-guidance-v1", label: "Qriptopian Guidance", contextId: "qripto-codex" },
  { id: "metame-guidance-v1", label: "metaMe Guidance", contextId: "metame-codex" },
];

const DESIGN_QUBE_ID_TO_CONTEXT: Record<string, string> = DESIGN_QUBE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.contextId;
    return acc;
  },
  {} as Record<string, string>
);

const CONTEXT_TO_DESIGN_QUBE_ID: Record<string, string> = DESIGN_QUBE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.contextId] = option.id;
    return acc;
  },
  {} as Record<string, string>
);

const DESIGN_QUBE_IMAGE_FALLBACKS = [
  "/images/designqube/thumb-qripto.jpg",
  "/images/designqube/thumb-penny.jpg",
  "/images/designqube/thumb-agentiq.jpg",
];

const QRIPTO_CONTENT_TAGS = [
  { value: "hero", label: "Hero Feature" },
  { value: "second-hero", label: "Second Hero" },
  { value: "latest-news", label: "Latest News" },
  { value: "penny-drops", label: "Penny Drops" },
  { value: "scrolls-metaknyts", label: "Scrolls: metaKnyts" },
  { value: "scrolls-synthsimms", label: "Scrolls: SynthSimms" },
  { value: "knowdz-exec", label: "Knowdz: Exec" },
  { value: "knowdz-creative", label: "Knowdz: Creative" },
  { value: "knowdz-devs", label: "Knowdz: Devs" },
];

const QRIPTO_CONTENT_ITEMS = [
  {
    id: "qripto-hero-1",
    label: "Hero Feature: The Genesis Block",
    tag: "hero",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-news-1",
    label: "Latest News: Protocol Briefing",
    tag: "latest-news",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-penny-1",
    label: "Penny Drops: Q¢ Explained",
    tag: "penny-drops",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-scrolls-mk",
    label: "Scrolls: metaKnyts Micro-Episode",
    tag: "scrolls-metaknyts",
    mediaType: "video",
    mediaUri: "",
  },
  {
    id: "qripto-scrolls-ss",
    label: "Scrolls: SynthSimms Micro-Episode",
    tag: "scrolls-synthsimms",
    mediaType: "video",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-exec",
    label: "Knowdz Exec: Leadership Sprint",
    tag: "knowdz-exec",
    mediaType: "audio",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-creative",
    label: "Knowdz Creative: Concept Lab",
    tag: "knowdz-creative",
    mediaType: "audio",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-devs",
    label: "Knowdz Devs: Protocol Builder",
    tag: "knowdz-devs",
    mediaType: "audio",
    mediaUri: "",
  },
];

const QRIPTO_TEMPLATE_SEEDS: ExperienceTemplate[] = [
  {
    id: "qripto-micro-episode",
    name: "Micro-Episode Capsule",
    description: "7–20s episode clips with rewards, metaKnyts or SynthSimms.",
    category: "micro-episode",
    complexity: "beginner",
    estimated_time: 10,
    required_components: ["capsule", "media_clip"],
    optional_components: ["rewards", "share"],
    tags: ["micro-episode", "scrolls-metaknyts", "scrolls-synthsimms"],
    steps: [
      {
        id: "intent_timebox",
        title: "Intent + Timebox",
        description: "Define the micro-episode goal and timebox.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "goal", name: "Goal", type: "textarea", required: false },
            { id: "time_available", name: "Time available (min)", type: "slider", required: false, validation: { min: 5, max: 20, step: 1 } },
          ],
        },
      },
      {
        id: "content_selection",
        title: "Content Selection",
        description: "Choose metaKnyts or SynthSimms episode material.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Scrolls Track", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards for completion.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
            { id: "require_wallet_connect", name: "Require wallet connect", type: "checkbox", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-feature-article",
    name: "Feature Article Experience",
    description: "Hero/Second Hero deep reads with optional companion capsules.",
    category: "article",
    complexity: "intermediate",
    estimated_time: 25,
    required_components: ["article_reader"],
    optional_components: ["capsule", "share"],
    tags: ["article", "hero", "second-hero", "latest-news"],
    steps: [
      {
        id: "content_selection",
        title: "Content Selection",
        description: "Select a feature article or latest news item.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Content Tag", type: "select", required: true },
            { id: "feature_item_id", name: "Feature item", type: "text", required: false },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Set optional reward after completion.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-penny-drops",
    name: "Penny Drops Learning Flow",
    description: "Learning modules, guided explanations, and optional rewards.",
    category: "tutorial",
    complexity: "beginner",
    estimated_time: 20,
    required_components: ["lesson", "takeaways"],
    optional_components: ["rewards"],
    tags: ["tutorial", "penny-drops"],
    steps: [
      {
        id: "content_selection",
        title: "Learning Content",
        description: "Pick Penny Drops material or Knowdz training content.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Content Tag", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "copilot_output",
        title: "Copilot Takeaways",
        description: "Define summary/takeaway outputs.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "takeaways_count", name: "Takeaway count", type: "slider", required: false, validation: { min: 1, max: 6, step: 1 } },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-knowdz-sprint",
    name: "Knowdz Specialist Sprint",
    description: "Exec/Creative/Dev focused micro-sprints.",
    category: "task",
    complexity: "intermediate",
    estimated_time: 30,
    required_components: ["task_list"],
    optional_components: ["rewards"],
    tags: ["task", "knowdz-exec", "knowdz-creative", "knowdz-devs"],
    steps: [
      {
        id: "content_selection",
        title: "Knowdz Track",
        description: "Choose Exec, Creative, or Dev track.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Knowdz Track", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards without gating access.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-smart-offer",
    name: "Smart Wallet + Offer",
    description: "Offer flow with optional rewards and sharing.",
    category: "task",
    complexity: "intermediate",
    estimated_time: 15,
    required_components: ["offer", "consent"],
    optional_components: ["wallet", "receipt"],
    tags: ["offer", "wallet", "rewards"],
    steps: [
      {
        id: "intent_timebox",
        title: "Offer Intent",
        description: "Define the offer objective and duration.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "time_available", name: "Time available (min)", type: "slider", required: false, validation: { min: 5, max: 30, step: 1 } },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards",
        description: "Set optional reward (not required for access).",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "ai-image-generation",
    name: "AI Image Generation",
    description: "Generate standalone AI portrait and landscape images — no article. OpenAI or Venice provider.",
    category: "image",
    complexity: "beginner",
    estimated_time: 10,
    required_components: ["image_player"],
    optional_components: ["rewards"],
    tags: ["image", "ai-generation", "portrait", "landscape", "openai", "venice"],
    steps: [
      {
        id: "intent_timebox",
        title: "Image Intent",
        description: "Name this image experience and describe what you want to create.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "goal", name: "Goal", type: "textarea", required: false },
          ],
        },
      },
      {
        id: "image_generation",
        title: "Image Generation",
        description: "Configure the AI image generation prompts and provider.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "provider_id", name: "Provider", type: "select", required: true, default_value: "openai", options: [{ value: "openai", label: "OpenAI DALL·E" }, { value: "venice", label: "Venice AI" }] },
            { id: "portrait_prompt", name: "Portrait prompt (9:16)", type: "textarea", required: true, help_text: "Describe the portrait image scene." },
            { id: "landscape_prompt", name: "Landscape prompt (16:9)", type: "textarea", required: false, help_text: "Describe the landscape image scene." },
            { id: "visual_style", name: "Visual style", type: "select", required: false, options: [{ value: "editorial", label: "Editorial" }, { value: "cinematic", label: "Cinematic" }, { value: "photorealistic", label: "Photorealistic" }, { value: "illustrated", label: "Illustrated" }] },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards for viewing this image experience.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "ai-article-draft",
    name: "Article Draft",
    description: "Write and publish a standalone article — no images or video. Structured takeaways and editorial copy.",
    category: "article",
    complexity: "beginner",
    estimated_time: 20,
    required_components: ["article_reader"],
    optional_components: ["rewards"],
    tags: ["article", "editorial", "writing", "draft", "copy"],
    steps: [
      {
        id: "intent_timebox",
        title: "Article Intent",
        description: "Name this article and describe what you want to write.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "goal", name: "Goal / topic", type: "textarea", required: true },
          ],
        },
      },
      {
        id: "article_draft",
        title: "Article Draft",
        description: "Configure the article title, prompt, and structure.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "title", name: "Article title", type: "text", required: true },
            { id: "prompt", name: "Article prompt", type: "textarea", required: true, help_text: "What should the article cover? Include tone, audience, and key points." },
            { id: "outputs", name: "Include sections", type: "multiselect", required: false, options: [{ value: "takeaways", label: "Key takeaways" }, { value: "next_action", label: "Next action" }, { value: "summary", label: "Summary" }] },
            { id: "takeaways_count", name: "Number of takeaways", type: "slider", required: false, validation: { min: 1, max: 5, step: 1 } },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Set optional reward for reading completion.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "sora-video-generation",
    name: "Sora Video Generation",
    description: "Generate AI video using OpenAI Sora skill — curated or community. Full supply chain with trust badges, PoSR, and DVN receipts.",
    category: "task",
    complexity: "intermediate",
    estimated_time: 15,
    required_components: ["skill_invocation", "video_player"],
    optional_components: ["rewards"],
    tags: ["video", "sora", "ai-generation", "skill", "toolqube"],
    steps: [
      {
        id: "intent_timebox",
        title: "Video Intent",
        description: "Name this video experience and set parameters.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "goal", name: "Goal", type: "textarea", required: false },
          ],
        },
      },
      {
        id: "skill_selection",
        title: "Skill Selection",
        description: "Choose between curated OpenAI Sora, Venice, or community OpenClaw-backed video generation.",
        type: "selection",
        required: true,
        component_type: "ToolQube",
        ui_config: {
          layout: "form",
          fields: [
            { id: "skill_id", name: "Video Skill", type: "select", required: true, default_value: "sora_video_gen_curated", options: [{ value: "sora_video_gen_curated", label: "Sora Video Gen (Curated) — Badge A, Trusted", description: "First-party OpenAI curated skill. Stable CI, org-backed, high trust." }, { value: "venice_video_gen", label: "Venice Video Gen — Badge A, Trusted", description: "Alternative trusted provider path for video generation." }, { value: "sora_video_gen_community", label: "Sora Video Gen (Community) — Badge C, Basic", description: "Community-maintained OpenClaw skill. Variable review posture." }] },
            { id: "trust_override", name: "Accept lower trust badge?", type: "checkbox", required: false, help_text: "Check to allow community skill even if below hydration threshold." },
          ],
        },
      },
      {
        id: "video_prompt",
        title: "Video Prompt",
        description: "Describe the video you want to generate.",
        type: "configuration",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "prompt", name: "Video prompt", type: "textarea", required: true, help_text: "Describe the scene, style, and motion you want Sora to generate." },
            { id: "duration", name: "Duration (seconds)", type: "slider", required: false, validation: { min: 4, max: 12, step: 4 } },
            { id: "aspect_ratio", name: "Aspect ratio", type: "select", required: false, options: [{ value: "16:9", label: "Landscape (16:9)" }, { value: "9:16", label: "Portrait (9:16)" }] },
            { id: "style", name: "Visual style", type: "select", required: false, options: [{ value: "cinematic", label: "Cinematic" }, { value: "animation", label: "Animation" }, { value: "comic", label: "Comic Book" }, { value: "photorealistic", label: "Photorealistic" }] },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards for video creation.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
];

export const ComposerStudio = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateCustomizerRef = useRef<HTMLDivElement | null>(null);
  const queryHydrationKeyRef = useRef<string | null>(null);
  const [templates, setTemplates] = useState<ExperienceTemplate[]>(() => {
    const cached = composerStudioCache.templates || [];
    const merged = [...cached];
    QRIPTO_TEMPLATE_SEEDS.forEach((seed) => {
      if (!merged.some((t) => t.id === seed.id)) merged.push(seed);
    });
    return merged.length > 0 ? merged : QRIPTO_TEMPLATE_SEEDS;
  });
  const [templatesLoading, setTemplatesLoading] = useState(
    () => !isCacheFresh(composerStudioCache.templatesFetchedAt, COMPOSER_CACHE_TTL_MS)
  );
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [activePersonaName, setActivePersonaName] = useState<string | null>(null);
  const [session, setSession] = useState<ComposerSession | null>(null);
  const [sessionTemplate, setSessionTemplate] = useState<ExperienceTemplate | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, any>>({});
  const [stepData, setStepData] = useState<Record<string, Record<string, any>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [experiences, setExperiences] = useState<ExperienceQube[]>([]);
  const [designQube, setDesignQube] = useState<DesignQube | null>(() => composerStudioCache.designQube);
  const [designQubeLoading, setDesignQubeLoading] = useState(
    () => !isCacheFresh(composerStudioCache.designQubeFetchedAt, COMPOSER_CACHE_TTL_MS)
  );
  const [designQubeError, setDesignQubeError] = useState<string | null>(null);
  const [designTheme, setDesignTheme] = useState<DesignQubeThemeMode>("dark");
  const [designQubeCollapsed, setDesignQubeCollapsed] = useState(true);
  const [experienceQubeCollapsed, setExperienceQubeCollapsed] = useState(true);
  const [designQubeActivePanel, setDesignQubeActivePanel] = useState("style");
  const [designQubeActiveSubPanel, setDesignQubeActiveSubPanel] = useState("visual");
  const [styleQubeActiveTab, setStyleQubeActiveTab] = useState("visual");
  const [structureQubeActiveTab, setStructureQubeActiveTab] = useState("templates");
  const [guidesActiveTab, setGuidesActiveTab] = useState("style-guide");
  const [styleGuideActiveTab, setStyleGuideActiveTab] = useState("css");
  const [experienceGuideActiveTab, setExperienceGuideActiveTab] = useState("who");
  const [designQubeSummaryLayout, setDesignQubeSummaryLayout] = useState<"compact" | "grid">("compact");
  const [activeStyleQubeId, setActiveStyleQubeId] = useState(
    () => CONTEXT_TO_DESIGN_QUBE_ID[DEFAULT_TENANT] || "knyt-guidance-v1"
  );
  const [selectedExperience, setSelectedExperience] = useState<ExperienceQube | null>(null);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [experienceModalTab, setExperienceModalTab] = useState<"goal" | "mechanics" | "metrics">("goal");
  const [experienceToDelete, setExperienceToDelete] = useState<ExperienceQube | null>(null);
  const [applyingBundlePresetId, setApplyingBundlePresetId] = useState<ExperienceBundlePresetId | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [studioAnalysisTab, setStudioAnalysisTab] = useState<"parity" | "surfaces" | "receipts">("parity");
  const [isParityExpanded, setIsParityExpanded] = useState(false);
  const isStudioExpanded = true;
  const [experiencePanelTab, setExperiencePanelTab] = useState("template");
  const [resourcesPanelTab, setResourcesPanelTab] = useState("experience");
  const [editableExperienceName, setEditableExperienceName] = useState("");
  const [editableImagePortraitPrompt, setEditableImagePortraitPrompt] = useState("");
  const [editableImageLandscapePrompt, setEditableImageLandscapePrompt] = useState("");
  const [editableVideoPrompt, setEditableVideoPrompt] = useState("");
  const [editableArticleTitle, setEditableArticleTitle] = useState("");
  const [editableArticlePrompt, setEditableArticlePrompt] = useState("");
  const [editableArticleOutputs, setEditableArticleOutputs] = useState<string[]>([]);
  const [editableArticleTakeawaysCount, setEditableArticleTakeawaysCount] = useState(3);
  const [isSavingEditableGeneration, setIsSavingEditableGeneration] = useState(false);
  const [personaMediaLibrary, setPersonaMediaLibrary] = useState<PersonaGeneratedMediaRecord[]>([]);
  const [personaMediaLibraryLoading, setPersonaMediaLibraryLoading] = useState(false);
  const [applyingPersonaMediaId, setApplyingPersonaMediaId] = useState<string | null>(null);
  const [pinningPersonaMediaId, setPinningPersonaMediaId] = useState<string | null>(null);
  const [editingPersonaMediaId, setEditingPersonaMediaId] = useState<string | null>(null);
  const [editingPersonaMediaLabel, setEditingPersonaMediaLabel] = useState("");
  const [savingPersonaMediaLabelId, setSavingPersonaMediaLabelId] = useState<string | null>(null);
  const [archivingPersonaMediaId, setArchivingPersonaMediaId] = useState<string | null>(null);
  const [showArchivedPersonaMedia, setShowArchivedPersonaMedia] = useState(false);
  const [personaMediaScopeFilter, setPersonaMediaScopeFilter] = useState<"all" | "active">("all");
  const [personaMediaTypeFilter, setPersonaMediaTypeFilter] = useState<"all" | "image" | "video">("all");
  const { data: codexList } = useCodexList({ useDefaults: true });
  const [copilotContextId, setCopilotContextId] = useState("qripto-codex");
  const [codexContentItems, setCodexContentItems] = useState<ComposerMediaItem[]>([]);
  const [codexContentLoading, setCodexContentLoading] = useState(false);
  const studioViewportStylesRef = useRef<{ bodyOverflow: string; htmlOverflow: string } | null>(null);

  // Sync Experience Qube collapse state with Design Qube
  useEffect(() => {
    setExperienceQubeCollapsed(designQubeCollapsed);
  }, [designQubeCollapsed]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!studioViewportStylesRef.current) {
      studioViewportStylesRef.current = {
        bodyOverflow: document.body.style.overflow,
        htmlOverflow: document.documentElement.style.overflow,
      };
    }

    const restoreViewport = () => {
      const originalStyles = studioViewportStylesRef.current;
      delete document.body.dataset.metameStudioExpanded;
      if (originalStyles) {
        document.body.style.overflow = originalStyles.bodyOverflow;
        document.documentElement.style.overflow = originalStyles.htmlOverflow;
      }
    };

    if (isStudioExpanded) {
      document.body.dataset.metameStudioExpanded = "true";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      restoreViewport();
    }

    return restoreViewport;
  }, [isStudioExpanded]);

  useEffect(() => {
    let active = true;

    resolveRuntimeIdentity({ userId, tenantId })
      .then((identity) => {
        if (!active) return;
        setActivePersonaId(identity.activePersonaId || null);
        setActivePersonaName(identity.activePersonaName || null);
        if (identity.tenantId && identity.tenantId !== tenantId) {
          setTenantId(identity.tenantId);
        }
      })
      .catch(() => {
        if (!active) return;
        setActivePersonaId(null);
        setActivePersonaName(null);
      });

    return () => {
      active = false;
    };
  }, [tenantId, userId]);

  // Delete experience function
  const handleDeleteExperience = async (experience: ExperienceQube) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/composer/experiences/${experience.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete experience');
      
      // Remove from local state
      setExperiences(prev => {
        const next = prev.filter(exp => exp.id !== experience.id);
        cacheExperiencesForTenant(tenantId, next);
        return next;
      });
      
      // Close modal and reset state
      setShowDeleteConfirm(false);
      setExperienceToDelete(null);
      
      // Show success message (you could add a toast notification here)
      console.log('Experience deleted successfully');
    } catch (error) {
      console.error('Error deleting experience:', error);
      // Handle error (show error message)
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit experience function - navigate to template customization
  const openRuntimePreviewForExperience = (exp: ExperienceQube | null, actionPrefix: string = "Preview") => {
    const fallbackId = exp?.id || selectedExperienceId || experience?.id || null;
    if (fallbackId) setSelectedExperienceId(fallbackId);
    setPreviewAction(`${actionPrefix} ${exp?.name || "Experience"}`);
    void recordExperienceLifecycle("experience_preview", exp, "studio-preview");
  };

  const launchExperience = async (exp: ExperienceQube | null) => {
    const experienceId = exp?.id?.toString().trim();
    if (!experienceId) {
      openRuntimePreviewForExperience(exp, "Launch fallback");
      return;
    }

    try {
      const res = await fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        openRuntimePreviewForExperience(exp, "Launch fallback");
        return;
      }

      if (!exp) {
        return;
      }

      void recordExperienceLifecycle("experience_launch", exp, "studio-launch");
      router.push(`/studio/composer/experience/${encodeURIComponent(experienceId)}`);
    } catch {
      openRuntimePreviewForExperience(exp, "Launch fallback");
    }
  };

  const openMcpInspector = (exp: ExperienceQube | null) => {
    if (!exp) return;
    setMcpExperience(exp);
    setMcpError(null);
    setMcpResult(null);
    setInspectorFetchedMedia(null);
    setShowMcpInspectorModal(true);
  };

  const runMcpToolFromInspector = async () => {
    if (!mcpExperience) return;
    setMcpLoading(true);
    setMcpError(null);
    try {
      const input =
        mcpTool === "next.best"
          ? {
              event: {
                content: { text: mcpMessage },
                tenant_id: tenantId,
                experience_id: mcpExperience.id,
              },
            }
          : {
              experience_id: mcpExperience.id,
              topic: mcpMessage,
              intent: "collect",
              provider: mcpProvider,
            };

      const res = await fetch("/api/mcp/experience-qube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: mcpTool,
          input,
          tenantId,
          personaId: activePersonaId || userId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to execute MCP tool");
      }
      setMcpResult({
        mode: "mcp-tool",
        tool: mcpTool,
        output: data.response,
      });
    } catch (error: any) {
      setMcpError(error?.message || "Failed to execute MCP tool");
    } finally {
      setMcpLoading(false);
    }
  };

  const runProviderDispatchSimulation = async () => {
    if (!mcpExperience) return;
    setMcpLoading(true);
    setMcpError(null);
    try {
      const latestExperience =
        (await refreshExperienceFromServer(mcpExperience.id).catch(() => null)) || mcpExperience;
      const manualChannelId = mcpChannelId.trim();
      const normalizedChannelId = /^\d+$/.test(manualChannelId) ? manualChannelId : "";
      const runtimeProfile = buildRuntimeDeliveryProfile({
        experience: latestExperience,
        personaLibraryAssets: personaMediaLibrary as unknown as Array<Record<string, unknown>>,
        target: mcpDeploymentTarget,
        variant: mcpDeliveryVariant,
      });
      const runtimeLaunchUrl = buildRuntimeLaunchUrl(latestExperience, {
        target: mcpDeploymentTarget,
        variant: mcpDeliveryVariant,
      });
      // Compute artifact from the freshly-fetched experience, not the stale useMemo
      // (React state updates from refreshExperienceFromServer haven't re-rendered yet).
      const latestArtifact = resolveExperienceDeploymentArtifact({
        experience: latestExperience,
        variant: mcpDeliveryVariant,
        personaLibraryAssets: personaMediaLibrary as unknown as Array<Record<string, unknown>>,
        contextItems: [...codexContentItems, ...QRIPTO_CONTENT_ITEMS],
      });
      const mediaAssetUrl = latestArtifact.artifact?.url || "";
      const mediaPreviewUrl =
        latestArtifact.preview?.url ||
        latestArtifact.context?.url ||
        "";
      const studioExperienceUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/studio/composer/experience/${encodeURIComponent(latestExperience.id)}`
          : `/studio/composer/experience/${encodeURIComponent(latestExperience.id)}`;
      const publishUrl =
        mcpDeploymentTarget === "studio_preview"
          ? studioExperienceUrl
          : mcpDeliveryVariant === "asset_link" || mcpDeliveryVariant === "discord_asset_inline"
            ? mediaAssetUrl || runtimeLaunchUrl || studioExperienceUrl
            : runtimeLaunchUrl || studioExperienceUrl;
      const effectiveTool =
        mcpDeliveryVariant === "discord_asset_inline"
          ? "share.compose"
          : mcpDeliveryVariant === "discord_experience_inline"
            ? "mini_runtime.get"
            : mcpTool;
      const deployment = await dispatchComposerDeployment({
        tenantId,
        experienceId: latestExperience.id,
        personaId: activePersonaId || userId,
        target: mcpDeploymentTarget,
        variant: mcpDeliveryVariant,
        provider: mcpProvider,
        mode: mcpDispatchMode,
        tool: effectiveTool,
        message: mcpMessage,
        channelId: normalizedChannelId,
        inviteUrl: mcpDiscordInvite,
        publishUrl,
        thumbnailUrl: mediaPreviewUrl || mediaAssetUrl,
        titleOverride: latestExperience.name || "",
        campaignId: "experience-distribution-demo",
        runtimeProfile,
      });
      await persistExperienceDeploymentResult(
        latestExperience,
        deployment,
        `deployment-block:${mcpDeploymentTarget}`,
      );
      setDeploymentResultsByTarget((prev) => ({
        ...prev,
        [deployment.target]: deployment,
      }));
      if (!deployment.ok) {
        throw new Error(deployment.error || "Failed to dispatch provider payload");
      }
      setMcpResult({
        mode: "deployment-block",
        target: deployment.target,
        provider:
          mcpDeploymentTarget === "discord_mcp"
            ? mcpProvider
            : deployment.provider === "runtime"
              ? "runtime"
              : "mcp",
        output: {
          deployment,
          ...(deployment.response || {}),
        },
      });
    } catch (error: any) {
      setMcpError(error?.message || "Failed to dispatch provider payload");
    } finally {
      setMcpLoading(false);
    }
  };

  const checkDiscordConnectionStatus = async () => {
    setMcpDiscordStatusLoading(true);
    setMcpError(null);
    setMcpDiscordStatusMessage("Checking Discord connection...");
    try {
      const manualChannelId = mcpChannelId.trim();
      const normalizedChannelId = /^\d+$/.test(manualChannelId) ? manualChannelId : "";
      const params = new URLSearchParams();
      if (normalizedChannelId.length > 0) params.set("channelId", normalizedChannelId);
      if (mcpDiscordInvite.trim().length > 0) params.set("inviteUrl", mcpDiscordInvite.trim());
      const res = await fetch(`/api/messenger/discord/status?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        const err = data?.error || "Failed to check Discord connection";
        setMcpDiscordStatus(data || null);
        setMcpDiscordStatusState("fail");
        setMcpDiscordStatusMessage(`Discord check failed: ${err}`);
        setMcpResult({
          mode: "discord-status",
          output: data,
        });
        throw new Error(err);
      }
      setMcpDiscordStatus(data);
      setMcpDiscordStatusState(data?.ready ? "ok" : "fail");
      setMcpDiscordStatusMessage(
        data?.ready
          ? "Discord connection verified. Ready for live dispatch."
          : "Discord reachable but not fully ready. See details below."
      );
      setMcpResult({
        mode: "discord-status",
        output: data,
      });
    } catch (error: any) {
      setMcpError(error?.message || "Failed to check Discord connection");
    } finally {
      setMcpDiscordStatusLoading(false);
    }
  };

  const handleEditExperience = async (
    experience: ExperienceQube,
    options?: {
      preferredStepId?: string | null;
    }
  ) => {
    setEditingExperienceId(experience.id);
    setSelectedExperienceId(experience.id);
    const templateId = experience.template_id?.trim();
    if (!templateId) {
      setSessionError("This ExperienceQube is missing a template id and cannot be edited.");
      return;
    }

    const safeConfig =
      experience.configuration && typeof experience.configuration === "object"
        ? { ...experience.configuration }
        : {};
    const seedData: Record<string, any> = {
      ...safeConfig,
      intent_timebox: {
        ...(safeConfig.intent_timebox || {}),
        experience_name: safeConfig.intent_timebox?.experience_name || experience.name || "",
        goal: safeConfig.intent_timebox?.goal || experience.goal || experience.description || "",
      },
      description: safeConfig.description || experience.description || "",
      goal: safeConfig.goal || experience.goal || "",
      mechanics: safeConfig.mechanics || experience.mechanics || "",
      metrics: safeConfig.metrics || experience.metrics || "",
    };

    setIsSaving(true);
    setSessionError(null);
    try {
      const createRes = await fetch("/api/composer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: experience.tenant_id || tenantId,
          user_id: experience.creator_id || userId,
          template_id: templateId,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to open a template customization session");
      const createData = await createRes.json();

      const preferredStepIndex = resolveStepIndexForId(createData.template?.steps || [], options?.preferredStepId);
      const initialStep = preferredStepIndex ?? 0;

      const updateRes = await fetch(`/api/composer/sessions/${createData.session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_step: initialStep,
          status: "active",
          data: seedData,
        }),
      });
      if (!updateRes.ok) throw new Error("Failed to seed template customization values");
      const updateData = await updateRes.json();

      setSelectedTemplateId(templateId);
      setSession(updateData.session || { ...createData.session, current_step: initialStep, data: seedData });
      setSessionTemplate({
        ...(createData.template || {}),
        steps: createData.template?.steps || [],
      });
      setSessionData(seedData);
      setStepData(seedData);
      setExperience(experience);
      setSelectedExperience(experience);
      setTemplateQuery("");
      setTemplateIntent(null);

      setTimeout(() => {
        templateCustomizerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (error: any) {
      setSessionError(error?.message || "Failed to open template customizer for this ExperienceQube");
    } finally {
      setIsSaving(false);
    }
  };

  const requestArticleDraftArtifact = useCallback(
    async (params: {
      experienceName?: string | null;
      title?: string | null;
      prompt?: string | null;
      outputs?: string[];
      takeawaysCount?: number;
      mediaMode?: "image" | "video";
      contextHints?: string[];
    }) => {
      const fallback =
        buildArticleDraftArtifact({
          experienceName: params.experienceName,
          title: params.title,
          prompt: params.prompt,
          outputs: params.outputs,
          takeawaysCount: params.takeawaysCount,
          mediaMode: params.mediaMode,
        }) || null;

      try {
        const response = await fetch("/api/composer/article-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experienceName: params.experienceName,
            title: params.title,
            prompt: params.prompt,
            outputs: params.outputs,
            takeawaysCount: params.takeawaysCount,
            mediaMode: params.mediaMode,
            contextHints: params.contextHints,
          }),
        });
        if (!response.ok) return fallback;
        const data = await response.json();
        return (data?.articleDraft as ArticleDraftArtifact | null) || fallback;
      } catch {
        return fallback;
      }
    },
    [],
  );
  const requestImageBundleArtifacts = useCallback(
    async (params: {
      experienceId: string;
      providerId?: "openai" | "venice" | null;
      portraitPrompt?: string | null;
      landscapePrompt?: string | null;
    }) => {
      type GeneratedImageResponseItem = {
        image_url?: string;
        orientation?: "portrait" | "landscape";
        model?: string;
        prompt?: string;
      };
      const providerId = params.providerId === "venice" ? "venice" : "openai";
      const promptEntries = [
        params.portraitPrompt?.trim()
          ? { orientation: "portrait" as const, prompt: params.portraitPrompt.trim() }
          : null,
        params.landscapePrompt?.trim()
          ? { orientation: "landscape" as const, prompt: params.landscapePrompt.trim() }
          : null,
      ].filter(Boolean) as Array<{ orientation: "portrait" | "landscape"; prompt: string }>;

      if (promptEntries.length === 0) return [];

      const portraitEntry = promptEntries.find((e) => e.orientation === "portrait");
      const landscapeEntry = promptEntries.find((e) => e.orientation === "landscape");
      const payload = {
        provider_id: providerId,
        experience_id: params.experienceId,
        ...(portraitEntry ? { portrait_prompt: portraitEntry.prompt } : {}),
        ...(landscapeEntry ? { landscape_prompt: landscapeEntry.prompt } : {}),
      };

      const response = await fetch("/api/skills/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            provider?: "openai" | "venice";
            receipt?: Record<string, unknown>;
            images?: GeneratedImageResponseItem[];
          }
        | null;

      const promptMap = new Map(promptEntries.map((e) => [e.orientation, e.prompt]));
      const assets = Array.isArray(data?.images)
        ? data.images
            .filter((image): image is GeneratedImageResponseItem => Boolean(image?.image_url))
            .map((image) => {
              const orientation = (image?.orientation as "portrait" | "landscape") || "portrait";
              return {
                id: `${params.experienceId}:${orientation}:image`,
                type: "image" as const,
                label: orientation === "portrait" ? "Portrait generated image" : "Landscape generated image",
                provider: image?.model || data?.provider || providerId,
                orientation,
                assetUrl: image?.image_url || "",
                receiptRef:
                  typeof data?.receipt?.receipt_id === "string" ? String(data.receipt.receipt_id) : undefined,
                prompt: image?.prompt || promptMap.get(orientation) || "",
                createdAt: new Date().toISOString(),
              };
            })
        : [];

      if (assets.length > 0) {
        await persistGeneratedAssetsForExperience({
          experienceId: params.experienceId,
          assets,
          receipt: data?.receipt,
          personaId: activePersonaId || userId,
          preferredAssetId: assets[0].id,
        });
      }

      return assets;
    },
    [activePersonaId, userId],
  );

  const requestVideoBundleArtifacts = useCallback(
    async (params: {
      experienceId: string;
      skillId?: string | null;
      prompt: string;
      duration?: number | null;
      aspectRatio?: string | null;
      style?: string | null;
      trustOverride?: boolean;
    }) => {
      const prompt = params.prompt.trim();
      if (!prompt) return null;

      const skillId = params.skillId || "venice_video_gen";
      const invokeController = new AbortController();
      const invokeTimeout = setTimeout(() => invokeController.abort(), 35_000);
      const response = await fetch("/api/skills/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: invokeController.signal,
        body: JSON.stringify({
          skill_id: skillId,
          prompt,
          duration: params.duration ?? 10,
          aspect_ratio: params.aspectRatio || "16:9",
          style: params.style || "cinematic",
          experience_id: params.experienceId,
          trust_override: params.trustOverride ?? false,
        }),
      }).finally(() => clearTimeout(invokeTimeout));
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        generation_id?: string | null;
        video_url?: string | null;
        provider?: "venice" | "openai";
        venice_model?: string;
        receipt?: Record<string, unknown>;
      } | null;

      if (!data?.ok || !data.generation_id) return null;

      const provider = data.provider || "venice";
      const generationId = data.generation_id;
      const videoUrl =
        data.video_url ||
        (provider === "venice" && data.venice_model
          ? `/api/skills/video/venice/${generationId}?model=${encodeURIComponent(data.venice_model)}`
          : `/api/skills/video/${generationId}`);

      const asset: PersistableGeneratedAsset = {
        id: `${params.experienceId}:video:${generationId}`,
        type: "video",
        label: "Generated video",
        provider,
        assetUrl: videoUrl,
        receiptRef:
          typeof data.receipt?.receipt_id === "string" ? String(data.receipt.receipt_id) : undefined,
        prompt,
        createdAt: new Date().toISOString(),
      };

      await persistGeneratedAssetsForExperience({
        experienceId: params.experienceId,
        assets: [asset],
        receipt: data.receipt,
        personaId: activePersonaId || userId,
        preferredAssetId: asset.id,
      });

      return asset;
    },
    [activePersonaId, userId],
  );

  const requestedExperienceId =
    typeof searchParams?.get("experienceId") === "string" && searchParams.get("experienceId")?.trim()
      ? searchParams.get("experienceId")!.trim()
      : null;
  const requestedPanel =
    searchParams?.get("panel") === "customizer" ||
    searchParams?.get("panel") === "resources" ||
    searchParams?.get("panel") === "exqubes" ||
    searchParams?.get("panel") === "template"
      ? searchParams.get("panel")
      : null;
  const requestedBundleBlock =
    searchParams?.get("bundleBlock") === "image_generation" ||
    searchParams?.get("bundleBlock") === "video_generation" ||
    searchParams?.get("bundleBlock") === "article_draft" ||
    searchParams?.get("bundleBlock") === "deployment"
      ? searchParams.get("bundleBlock")
      : null;
  const requestedFocus = searchParams?.get("focus") || null;

  // Auto-open the DVN Receipts tab when navigated back from runtime with focus=receipt
  useEffect(() => {
    if (requestedFocus === "receipt") {
      setStudioAnalysisTab("receipts");
      setIsParityExpanded(true);
    }
  }, [requestedFocus]);

  useEffect(() => {
    if (!requestedExperienceId) return;

    const hydrationKey = `${requestedExperienceId}:${requestedPanel || ""}:${requestedBundleBlock || ""}`;
    if (queryHydrationKeyRef.current === hydrationKey) return;

    const targetExperience =
      experiences.find((candidate) => candidate.id === requestedExperienceId) ||
      (experience?.id === requestedExperienceId ? experience : null);
    if (!targetExperience) return;

    queryHydrationKeyRef.current = hydrationKey;
    setSelectedExperienceId(targetExperience.id);
    setSelectedExperience(targetExperience);

    if (requestedPanel) {
      setExperiencePanelTab(requestedPanel);
    }

    if (requestedPanel === "customizer") {
      void handleEditExperience(targetExperience, {
        preferredStepId: resolveBundlePreferredStepId(requestedBundleBlock, targetExperience.configuration || {}),
      });
    }
  }, [
    experience,
    experiences,
    requestedBundleBlock,
    requestedExperienceId,
    requestedPanel,
  ]);

  const styleQubeThemeTokens = designQube?.tokens?.themes?.[designTheme];
  const styleQubeColors = styleQubeThemeTokens?.color || {};
  const styleQubeThemeBg =
    styleQubeColors.surface || styleQubeColors.bg || "rgba(15,23,42,0.6)";
  const styleQubeThemeBorder = styleQubeColors.border || "rgba(148,163,184,0.2)";
  const styleQubeThemeText = styleQubeColors.text || "#e2e8f0";

  const copilotContextOptions = useMemo<Array<{ id: string; label: string }>>(() => {
    const byId = new Map<string, string>();
    const baseOptions: Array<{ id: string; label: string }> =
      codexList && codexList.length > 0
        ? codexList.map((codex: CodexListItem) => ({
            id: codex.id,
            label: codex.name,
          }))
        : (QRIPTO_FALLBACK_CODEXES as Array<{ id: string; label: string }>);

    baseOptions.forEach((option) => {
      byId.set(option.id, option.label || option.id);
    });
    DESIGN_QUBE_OPTIONS.forEach((option) => {
      if (!byId.has(option.contextId)) {
        byId.set(option.contextId, option.label || option.contextId);
      }
    });
    return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
  }, [codexList]);

  const designQubeOptions = useMemo<Array<{ id: string; label: string; contextId: string }>>(() => {
    const contextLabelById = new Map(copilotContextOptions.map((option) => [option.id, option.label]));
    return DESIGN_QUBE_OPTIONS.map((option) => ({
      ...option,
      label: option.label || contextLabelById.get(option.contextId) || option.id,
    }));
  }, [copilotContextOptions]);

  useEffect(() => {
    if (!copilotContextOptions.length) return;
    if (!copilotContextOptions.some((opt) => opt.id === copilotContextId)) {
      setCopilotContextId(copilotContextOptions[0].id);
    }
  }, [copilotContextOptions, copilotContextId]);

  useEffect(() => {
    if (!designQubeOptions.length) return;
    if (!designQubeOptions.some((option) => option.id === activeStyleQubeId)) {
      setActiveStyleQubeId(designQubeOptions[0].id);
    }
  }, [designQubeOptions, activeStyleQubeId]);

  const handleCopilotContextChange = useCallback(
    (nextContextId: string) => {
      setCopilotContextId(nextContextId);
      const mappedDesignQubeId = CONTEXT_TO_DESIGN_QUBE_ID[nextContextId];
      if (mappedDesignQubeId && mappedDesignQubeId !== activeStyleQubeId) {
        setActiveStyleQubeId(mappedDesignQubeId);
      }
    },
    [activeStyleQubeId]
  );

  const handleDesignQubeSelection = useCallback(
    (nextDesignQubeId: string) => {
      setActiveStyleQubeId(nextDesignQubeId);
      const mappedContextId = DESIGN_QUBE_ID_TO_CONTEXT[nextDesignQubeId];
      if (mappedContextId && mappedContextId !== copilotContextId) {
        setCopilotContextId(mappedContextId);
      }
    },
    [copilotContextId]
  );

  useEffect(() => {
    if (!copilotContextId) return;
    setUserId((prev) => prev || DEFAULT_USER);
  }, [copilotContextId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (copilotContextId !== "qripto-codex") {
      setCodexContentItems([]);
      return;
    }
    let cancelled = false;
    const loadContent = async () => {
      setCodexContentLoading(true);
      try {
        const origin = window.location.origin;
        const issueParam = "issue=issue-1&scope=codex";
        const sections = await Promise.all([
          fetch(`${origin}/api/content/section/home-hero?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/latest-news?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/second-hero?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/pennydrops?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/scrolls?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/21knowdz?${issueParam}`).then((r) => r.json()),
        ]);

        const tagged = [
          { items: sections[0]?.content || [], tag: "hero" },
          { items: sections[1]?.content || [], tag: "latest-news" },
          { items: sections[2]?.content || [], tag: "second-hero" },
          { items: sections[3]?.content || [], tag: "penny-drops" },
          { items: sections[4]?.content || [], tag: "scrolls-metaknyts" },
          { items: sections[5]?.content || [], tag: "knowdz-exec" },
        ];

        const mapped = tagged.flatMap(({ items, tag }) =>
          (items || []).slice(0, 4).map((item: any) => ({
            id: item.id || `${tag}-${item.title}`,
            label: item.title || item.name || tag,
            tag,
            mediaType: item.modalities?.watch ? "video" : item.modalities?.listen ? "audio" : "image",
            mediaUri: item.image || item.thumbnail || item.cover || item.heroImage || "",
          }))
        );

        if (!cancelled) setCodexContentItems(mapped.filter((item) => item.mediaUri));
      } catch {
        if (!cancelled) setCodexContentItems([]);
      } finally {
        if (!cancelled) setCodexContentLoading(false);
      }
    };
    loadContent();
    return () => {
      cancelled = true;
    };
  }, [copilotContextId]);
  const [templateIntent, setTemplateIntent] = useState<"micro-episode" | "article" | "tutorial" | "task" | null>(null);
  const [templateQuery, setTemplateQuery] = useState("");
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceType>("mobile");
  const [previewAction, setPreviewAction] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [runtimePreviewLoaded, setRuntimePreviewLoaded] = useState(false);
  const [runtimePreviewErrored, setRuntimePreviewErrored] = useState(false);
  const runtimePreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [showMcpInspectorModal, setShowMcpInspectorModal] = useState(false);
  const [mcpExperience, setMcpExperience] = useState<ExperienceQube | null>(null);
  const [mcpTool, setMcpTool] = useState<
    "pill.get" | "capsule.get" | "mini_runtime.get" | "codex.entry" | "invite.create" | "share.compose" | "next.best"
  >("next.best");
  const [mcpProvider, setMcpProvider] = useState<"discord" | "whatsapp" | "telegram">("discord");
  const [mcpDeploymentTarget, setMcpDeploymentTarget] = useState<ComposerDeploymentTarget>("discord_mcp");
  const [mcpDeliveryVariant, setMcpDeliveryVariant] = useState<ComposerDeliveryVariant>("runtime_standard");
  const [mcpDispatchMode, setMcpDispatchMode] = useState<"simulate" | "live">("simulate");
  const [mcpChannelId, setMcpChannelId] = useState("886793716273119252");
  const [mcpDiscordInvite, setMcpDiscordInvite] = useState("https://discord.gg/Gzg9wDMVSB");
  const [mcpMessage, setMcpMessage] = useState("Show me a visual-first Qriptopian reading sprint.");
  const [mcpResult, setMcpResult] = useState<any>(null);
  const [deploymentResultsByTarget, setDeploymentResultsByTarget] = useState<
    Partial<Record<ComposerDeploymentTarget, ComposerDeploymentResult>>
  >({});
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpDiscordStatusLoading, setMcpDiscordStatusLoading] = useState(false);
  const [mcpDiscordStatus, setMcpDiscordStatus] = useState<any>(null);
  const [mcpDiscordStatusState, setMcpDiscordStatusState] = useState<"idle" | "ok" | "fail">("idle");
  const [mcpDiscordStatusMessage, setMcpDiscordStatusMessage] = useState("Not checked yet.");
  const [inspectorFetchedMedia, setInspectorFetchedMedia] = useState<InspectorMediaPreview | null>(null);
  const [inspectorRenderMode, setInspectorRenderMode] = useState<"card" | "thread">("card");
  const inspectorUsesMessengerProvider = mcpDeploymentTarget === "discord_mcp";
  const inspectorUsesDiscordFields = mcpDeploymentTarget === "discord_mcp";
  const availableDeliveryVariants = useMemo(
    () => getSupportedVariantsForTarget(mcpDeploymentTarget),
    [mcpDeploymentTarget],
  );
  const inspectorProviderLabel =
    mcpDeploymentTarget === "runtime_launch"
      ? mcpDeliveryVariant === "runtime_thin_client"
        ? "METAME THIN CLIENT"
        : "METAME RUNTIME"
      : mcpDeploymentTarget === "studio_preview"
        ? "STUDIO PREVIEW"
        : mcpDeploymentTarget === "mcp_app"
          ? "MCP APP"
          : mcpProvider.toUpperCase();
  const resolvedInspectorDeploymentArtifact = useMemo(
    () =>
      resolveExperienceDeploymentArtifact({
        experience: mcpExperience,
        variant: mcpDeliveryVariant,
        personaLibraryAssets: personaMediaLibrary as unknown as Array<Record<string, unknown>>,
        contextItems: [...codexContentItems, ...QRIPTO_CONTENT_ITEMS],
      }),
    [codexContentItems, mcpDeliveryVariant, mcpExperience, personaMediaLibrary],
  );
  const inspectorMediaPreview = useMemo(() => {
    const local = resolvedInspectorDeploymentArtifact.preview || resolvedInspectorDeploymentArtifact.context;
    if (local?.url) {
      return {
        uri: local.url,
        mediaType: local.mediaType,
      };
    }
    return inspectorFetchedMedia;
  }, [inspectorFetchedMedia, resolvedInspectorDeploymentArtifact]);
  const routingEnvelope = useMemo(
    () =>
      buildComposerRoutingEnvelope({
        mode: mcpDispatchMode,
        selectedTarget: mcpDeploymentTarget,
        selectedProvider: mcpProvider,
        discordReady: Boolean(mcpDiscordStatus?.ready || mcpDiscordStatusState === "ok"),
        runtimeReady: runtimePreviewLoaded,
        hasPlayableMedia: Boolean(inspectorMediaPreview?.uri),
      }),
    [
      inspectorMediaPreview?.uri,
      mcpDeploymentTarget,
      mcpDispatchMode,
      mcpDiscordStatus?.ready,
      mcpDiscordStatusState,
      mcpProvider,
      runtimePreviewLoaded,
    ],
  );
  const deploymentTargetCards = useMemo(() => {
    return routingEnvelope.candidates.map((candidate) => {
      const latest = deploymentResultsByTarget[candidate.target];
      return {
        id: candidate.target,
        label: getDeploymentTargetLabel(candidate.target),
        ready: candidate.ready,
        note: candidate.reasons[0] || "Deployment candidate",
        latest,
        capabilityState: candidate.capabilityState,
        capabilitySummary: candidate.capabilitySummary,
        capabilityConstraints: candidate.capabilityConstraints,
        trustScore: candidate.trustScore,
        costScore: candidate.costScore,
        suitabilityScore: candidate.suitabilityScore,
        watchouts: candidate.watchouts,
      };
    });
  }, [
    deploymentResultsByTarget,
    routingEnvelope,
  ]);
  const deploymentAdapterCatalog = useMemo(
    () => listDeploymentAdapterDeclarations(),
    [],
  );
  const inspectorSourceBadge = useMemo(
    () =>
      resolveInspectorSourceBadge({
        mcpResult,
        fallbackMediaType: inspectorMediaPreview?.mediaType || "",
      }),
    [mcpResult, inspectorMediaPreview?.mediaType]
  );
  const inspectorPreview = useMemo(() => {
    const base = {
      title: mcpExperience?.name || "ExperienceQube",
      body: mcpMessage || "No output yet.",
      shareText: "",
      depth: "",
      ctaLabel: "",
      providerLabel: inspectorProviderLabel,
      thumbnailUri:
        inspectorMediaPreview?.mediaType === "video" && !canInlineVideoUri(inspectorMediaPreview?.uri)
          ? ""
          : inspectorMediaPreview?.uri || "",
      thumbnailType: inspectorMediaPreview?.mediaType || "",
    };

    if (!mcpResult) return base;

    if (mcpResult.mode === "provider-dispatch" || mcpResult.mode === "deployment-block") {
      const dispatch = mcpResult.output?.providerDispatch || {};
      const response = mcpResult.output?.mcpResponse || {};
      const responseArtifact = response?.artifact || {};
      const responseThumbnailUri = firstNonEmptyString([
        responseArtifact?.thumbnail,
        responseArtifact?.thumbnail_uri,
        responseArtifact?.image,
        responseArtifact?.image_uri,
        responseArtifact?.video_url,
        responseArtifact?.media_uri,
      ]);
      const responseThumbnailType = inferMediaType(
        responseThumbnailUri || base.thumbnailUri,
        typeof responseArtifact?.media_type === "string" ? responseArtifact.media_type : undefined
      );
      const safeThumbnailUri =
        responseThumbnailType === "video" && !canInlineVideoUri(responseThumbnailUri || base.thumbnailUri)
          ? ""
          : responseThumbnailUri || base.thumbnailUri;
      return {
        title: responseArtifact?.title || base.title,
        body: responseArtifact?.body || dispatch?.text || base.body,
        shareText: responseArtifact?.share_text || "",
        depth: response?.depth || "",
        ctaLabel: dispatch?.cta?.label || "",
        providerLabel:
          dispatch?.provider === "runtime"
            ? mcpDeliveryVariant === "runtime_thin_client"
              ? "METAME THIN CLIENT"
              : "METAME RUNTIME"
            : dispatch?.provider === "mcp"
              ? "MCP APP"
              : String(dispatch?.provider || mcpProvider).toUpperCase(),
        thumbnailUri: safeThumbnailUri,
        thumbnailType: safeThumbnailUri ? responseThumbnailType : base.thumbnailType,
      };
    }

    if (mcpResult.mode === "mcp-tool") {
      const response = mcpResult.output || {};
      const responseArtifact = response?.artifact || {};
      const responseThumbnailUri = firstNonEmptyString([
        responseArtifact?.thumbnail,
        responseArtifact?.thumbnail_uri,
        responseArtifact?.image,
        responseArtifact?.image_uri,
        responseArtifact?.video_url,
        responseArtifact?.media_uri,
      ]);
      const responseThumbnailType = inferMediaType(
        responseThumbnailUri || base.thumbnailUri,
        typeof responseArtifact?.media_type === "string" ? responseArtifact.media_type : undefined
      );
      const safeThumbnailUri =
        responseThumbnailType === "video" && !canInlineVideoUri(responseThumbnailUri || base.thumbnailUri)
          ? ""
          : responseThumbnailUri || base.thumbnailUri;
      return {
        title: responseArtifact?.title || base.title,
        body: responseArtifact?.body || base.body,
        shareText: responseArtifact?.share_text || "",
        depth: response?.depth || "",
        ctaLabel: response?.cta?.primary?.label || "",
        providerLabel: inspectorProviderLabel,
        thumbnailUri: safeThumbnailUri,
        thumbnailType: safeThumbnailUri ? responseThumbnailType : base.thumbnailType,
      };
    }

    return base;
  }, [inspectorMediaPreview, inspectorProviderLabel, mcpDeliveryVariant, mcpExperience?.name, mcpMessage, mcpProvider, mcpResult]);

  useEffect(() => {
    if (mcpProvider !== "discord") return;
    setMcpDiscordStatusState("idle");
    setMcpDiscordStatusMessage("Not checked yet.");
    setMcpDiscordStatus(null);
  }, [mcpProvider, mcpChannelId, mcpDiscordInvite]);

  useEffect(() => {
    if (mcpDeploymentTarget === "discord_mcp" && mcpProvider !== "discord") {
      setMcpDeploymentTarget("mcp_app");
    }
  }, [mcpDeploymentTarget, mcpProvider]);

  useEffect(() => {
    if (!availableDeliveryVariants.includes(mcpDeliveryVariant)) {
      setMcpDeliveryVariant(availableDeliveryVariants[0] || "runtime_standard");
    }
  }, [availableDeliveryVariants, mcpDeliveryVariant]);

  useEffect(() => {
    if (!mcpExperience?.metadata?.deployment_history || !Array.isArray(mcpExperience.metadata.deployment_history)) {
      setDeploymentResultsByTarget({});
      return;
    }

    const nextByTarget: Partial<Record<ComposerDeploymentTarget, ComposerDeploymentResult>> = {};
    mcpExperience.metadata.deployment_history.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const target = typeof entry.target === "string" ? (entry.target as ComposerDeploymentTarget) : null;
      if (!target) return;
      const variant =
        typeof entry.variant === "string" ? (entry.variant as ComposerDeliveryVariant) : undefined;
      const capability = entry.capability_state
        ? ({
            adapter:
              typeof entry.destination_adapter === "string"
                ? (entry.destination_adapter as ComposerDeploymentAdapter)
                : resolveDeploymentCapability({ target, variant }).adapter,
            state: String(entry.capability_state) as ComposerDeploymentCapabilityState,
            summary:
              typeof entry.capability_summary === "string"
                ? entry.capability_summary
                : resolveDeploymentCapability({ target, variant }).summary,
            constraints: Array.isArray(entry.capability_constraints)
              ? entry.capability_constraints.filter((item): item is string => typeof item === "string")
              : resolveDeploymentCapability({ target, variant }).constraints,
          } as ComposerDeploymentCapability)
        : resolveDeploymentCapability({ target, variant });
      const adapterDeclaration =
        entry.adapter_declaration && typeof entry.adapter_declaration === "object"
          ? (entry.adapter_declaration as ComposerDeploymentAdapterDeclaration)
          : getDeploymentAdapterDeclaration(capability.adapter);
      const deliveryMode =
        typeof entry.delivery_mode === "string"
          ? (entry.delivery_mode as ComposerDeploymentDeliveryMode)
          : resolveDeploymentDeliveryMode({ target, variant });
      const destinationAdapter =
        typeof entry.destination_adapter === "string"
          ? (entry.destination_adapter as ComposerDeploymentAdapter)
          : capability.adapter;
      const previous = nextByTarget[target];
      const previousAt = previous?.response && typeof previous.response.deployed_at === "string"
        ? previous.response.deployed_at
        : "";
      const currentAt = typeof entry.deployed_at === "string" ? entry.deployed_at : "";
      if (previousAt && currentAt && previousAt > currentAt) return;
      nextByTarget[target] = {
        ok: typeof entry.status === "string" ? entry.status !== "failed" : true,
        target,
        variant,
        mode: typeof entry.mode === "string" ? (entry.mode as "simulate" | "live") : "simulate",
        provider:
          typeof entry.provider === "string" && ["discord", "runtime", "mcp"].includes(entry.provider)
            ? (entry.provider as "discord" | "runtime" | "mcp")
            : "mcp",
        status:
          typeof entry.status === "string" &&
          ["ready", "simulated", "dispatched", "failed"].includes(entry.status)
            ? (entry.status as "ready" | "simulated" | "dispatched" | "failed")
            : "ready",
        publishUrl: typeof entry.publish_url === "string" ? entry.publish_url : undefined,
        launchUrl: typeof entry.launch_url === "string" ? entry.launch_url : undefined,
        error: typeof entry.error === "string" ? entry.error : undefined,
        response: { deployed_at: currentAt, source: entry.source },
        capability,
        adapterDeclaration,
        deliveryMode,
        destinationAdapter,
      };
    });
    setDeploymentResultsByTarget(nextByTarget);
  }, [mcpExperience]);

  useEffect(() => {
    let cancelled = false;
    const loadInspectorMedia = async () => {
      if (!mcpExperience) {
        setInspectorFetchedMedia(null);
        return;
      }

      const local = resolveExperiencePrimaryMedia(
        mcpExperience,
        codexContentItems,
        personaMediaLibrary,
        mcpDeliveryVariant,
      );
      if (local) {
        setInspectorFetchedMedia(null);
        return;
      }

      const config = asRecord(mcpExperience.configuration) ?? {};
      const contentSelection = asRecord(config.content_selection) ?? {};
      const selectedTag = firstNonEmptyString([
        contentSelection.content_tag,
        config.content_tag,
      ]);
      const selectedIds = [
        ...(Array.isArray(contentSelection.content_items)
          ? contentSelection.content_items.filter((id) => typeof id === "string")
          : []),
        firstNonEmptyString([contentSelection.feature_item_id, contentSelection.primary_content_id, config.primary_content_id]),
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

      const plans = buildSectionLookupPlans(selectedTag);
      for (const plan of plans) {
        try {
          const params = new URLSearchParams();
          params.set("scope", "codex");
          if (plan.tab) params.set("tab", plan.tab);
          const res = await fetch(`/api/content/section/${encodeURIComponent(plan.section)}?${params.toString()}`, {
            cache: "no-store",
          });
          if (!res.ok) continue;
          const payload = await res.json().catch(() => ({}));
          const media = pickMediaFromSectionContent(payload?.content || [], selectedIds);
          if (media) {
            if (!cancelled) setInspectorFetchedMedia(media);
            return;
          }
        } catch {
          // Try next lookup plan.
        }
      }
      if (!cancelled) setInspectorFetchedMedia(null);
    };

    loadInspectorMedia();
    return () => {
      cancelled = true;
    };
  }, [codexContentItems, mcpDeliveryVariant, mcpExperience, personaMediaLibrary]);

  useEffect(() => {
    let active = true;
    const mergeTemplates = (apiTemplates: ExperienceTemplate[]) => {
      const merged = [...apiTemplates];
      QRIPTO_TEMPLATE_SEEDS.forEach((seed) => {
        if (!merged.some((t) => t.id === seed.id)) {
          merged.push(seed);
        }
      });
      return merged;
    };

    const cachedTemplates = composerStudioCache.templates;
    const templatesAreFresh = isCacheFresh(composerStudioCache.templatesFetchedAt, COMPOSER_CACHE_TTL_MS);
    if (cachedTemplates && templatesAreFresh) {
      setTemplates(cachedTemplates);
      setTemplatesError(null);
      setTemplatesLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const res = await fetch("/api/composer/templates");
        if (!res.ok) throw new Error("Failed to load templates");
        const data = await res.json();
        const merged = mergeTemplates(data.templates || []);
        composerStudioCache.templates = merged;
        composerStudioCache.templatesFetchedAt = Date.now();
        if (active) {
          setTemplates(merged);
          setTemplatesError(null);
        }
      } catch (err: any) {
        if (active) {
          if (cachedTemplates) {
            setTemplates(cachedTemplates);
            setTemplatesError(null);
          } else {
            setTemplatesError(err.message || "Failed to load templates");
          }
        }
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };
    fetchTemplates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const designIsFresh = isCacheFresh(composerStudioCache.designQubeFetchedAt, COMPOSER_CACHE_TTL_MS);
    const cacheMatchesSelectedQube = composerStudioCache.designQubeId === activeStyleQubeId;
    if (designIsFresh && cacheMatchesSelectedQube) {
      setDesignQube(composerStudioCache.designQube || null);
      setDesignQubeError(null);
      setDesignQubeLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchDesignQube = async () => {
      try {
        setDesignQubeLoading(true);
        const res = await fetch(
          `/api/metame/design-qube?includeImages=0&id=${encodeURIComponent(activeStyleQubeId)}`
        );
        if (!res.ok) throw new Error("Failed to load DesignQube");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load DesignQube");
        composerStudioCache.designQube = data.designQube || null;
        composerStudioCache.designQubeId = activeStyleQubeId;
        composerStudioCache.designQubeFetchedAt = Date.now();
        if (active) {
          setDesignQube(data.designQube || null);
          setDesignQubeError(null);
        }
      } catch (err: any) {
        if (active) {
          if (cacheMatchesSelectedQube && composerStudioCache.designQube) {
            setDesignQube(composerStudioCache.designQube);
            setDesignQubeError(null);
          } else {
            setDesignQubeError(err.message || "Failed to load DesignQube");
          }
        }
      } finally {
        if (active) setDesignQubeLoading(false);
      }
    };
    fetchDesignQube();
    return () => {
      active = false;
    };
  }, [activeStyleQubeId]);

  useDesignQubeTheme(designQube?.tokens, designQube?.constraints, designTheme);

  const [previewSession, setPreviewSession] = useState({
    consentGiven: false,
    iqubeCreated: false,
    settlementComplete: false,
    shared: false,
  });

  const previewExperience = useMemo(() => {
    if (!selectedExperienceId) return experience;
    return experiences.find((exp) => exp.id === selectedExperienceId) || experience;
  }, [selectedExperienceId, experiences, experience]);
  const activeExperienceForEditing = useMemo(
    () => previewExperience || selectedExperience || experience || null,
    [experience, previewExperience, selectedExperience]
  );
  const bundleTemplateTargetExperience = useMemo(
    () => activeExperienceForEditing || null,
    [activeExperienceForEditing],
  );
  const previewExperienceMedia = useMemo(
    () =>
      resolveExperiencePrimaryMedia(
        previewExperience,
        codexContentItems,
        personaMediaLibrary,
        "runtime_thin_client",
      ),
    [codexContentItems, personaMediaLibrary, previewExperience]
  );
  const previewRuntimeDeliveryProfile = useMemo(
    () =>
      buildRuntimeDeliveryProfile({
        experience: previewExperience,
        personaLibraryAssets: personaMediaLibrary as unknown as Array<Record<string, unknown>>,
        target: "runtime_launch",
        variant: "runtime_standard",
      }),
    [personaMediaLibrary, previewExperience],
  );
  const previewExperienceArticleDraft = useMemo(() => {
    const config = previewExperience?.configuration;
    const metadata = previewExperience?.metadata;
    const articleDraft =
      config && typeof config === "object" && !Array.isArray(config)
        ? asRecord((config as Record<string, unknown>).article_draft)
        : null;
    const editableGeneration =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? asRecord((metadata as Record<string, unknown>).editable_generation)
        : null;
    const editableArticleDraft = editableGeneration ? asRecord(editableGeneration.article_draft) : null;
    const generated = articleDraft?.generated ?? editableArticleDraft?.generated;
    return generated && typeof generated === "object" && !Array.isArray(generated)
      ? JSON.stringify(generated)
      : null;
  }, [previewExperience]);
  const serializeExperienceArticleDraft = useCallback((exp: ExperienceQube | null | undefined) => {
    const config = exp?.configuration;
    const metadata = exp?.metadata;
    const articleDraft =
      config && typeof config === "object" && !Array.isArray(config)
        ? asRecord((config as Record<string, unknown>).article_draft)
        : null;
    const editableGeneration =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? asRecord((metadata as Record<string, unknown>).editable_generation)
        : null;
    const editableArticleDraft = editableGeneration ? asRecord(editableGeneration.article_draft) : null;
    const generated = articleDraft?.generated ?? editableArticleDraft?.generated;
    return generated && typeof generated === "object" && !Array.isArray(generated)
      ? JSON.stringify(generated)
      : null;
  }, []);
  const runtimePreviewSrc = useMemo(() => {
    const capsuleId = selectedExperienceId || previewExperience?.id || "capsule-metaknyt-play";
    const experienceId = selectedExperienceId || previewExperience?.id || "";
    const previewHasArticleDraft = Boolean(previewExperienceArticleDraft);
    const previewHasVideo = Boolean(previewRuntimeDeliveryProfile.videoAssetUrl);
    const previewContentKind =
      previewHasArticleDraft && !previewHasVideo ? "article" : previewRuntimeDeliveryProfile.contentKind;
    const previewIntent =
      previewHasArticleDraft && !previewHasVideo ? "read" : previewRuntimeDeliveryProfile.intent;
    const previewQuickLink =
      previewHasArticleDraft && !previewHasVideo ? "read" : previewRuntimeDeliveryProfile.quickLink;
    const params = new URLSearchParams({
      preview: "1",
      capsule: capsuleId,
      experienceId,
      embed: "1",
    });
    if (previewExperience?.name) params.set("experienceName", previewExperience.name);
    if (previewExperience?.description) params.set("experienceDescription", previewExperience.description);
    if (previewRuntimeDeliveryProfile.imageAssets.landscape) {
      params.set("experienceContextImage", previewRuntimeDeliveryProfile.imageAssets.landscape);
    } else if (previewExperienceMedia?.uri && previewExperienceMedia.mediaType !== "video") {
      params.set("experienceContextImage", previewExperienceMedia.uri);
    }
    if (previewExperienceMedia?.uri && previewExperienceMedia.mediaType !== "video") {
      params.set("experienceImage", previewExperienceMedia.uri);
    }
    if (previewRuntimeDeliveryProfile.imageAssets.portrait) {
      params.set("experienceImagePortrait", previewRuntimeDeliveryProfile.imageAssets.portrait);
    }
    if (previewRuntimeDeliveryProfile.imageAssets.landscape) {
      params.set("experienceImageLandscape", previewRuntimeDeliveryProfile.imageAssets.landscape);
    }
    if (previewRuntimeDeliveryProfile.videoAssetUrl) {
      params.set("experienceVideo", previewRuntimeDeliveryProfile.videoAssetUrl);
    }
    if (previewExperienceArticleDraft) {
      params.set("experienceArticleDraft", previewExperienceArticleDraft);
    }
    params.set("runtimeIntent", previewIntent);
    params.set("runtimeQuickLink", previewQuickLink);
    params.set("contentKind", previewContentKind);
    params.set("activeCodexId", previewRuntimeDeliveryProfile.codexContext.activeCodexId);
    params.set("activeCodexName", previewRuntimeDeliveryProfile.codexContext.activeCodexName);
    params.set(
      "runtimeCodexTab",
      resolveRuntimeCodexTabForExperience({
        experience: previewExperience,
        runtimeProfile: previewRuntimeDeliveryProfile,
      }),
    );
    params.set("runtimeCartridge", previewRuntimeDeliveryProfile.runtimeCartridge);
    params.set("preferredImageOrientationMobile", previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.mobile);
    params.set("preferredImageOrientationTablet", previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.tablet);
    params.set("preferredImageOrientationDesktop", previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.desktop);
    params.set("personaAssignment", previewRuntimeDeliveryProfile.stubAssignments.personaAssignment);
    params.set("crmCohortAssignment", previewRuntimeDeliveryProfile.stubAssignments.crmCohortAssignment);
    params.set("policyAssignment", previewRuntimeDeliveryProfile.stubAssignments.policyAssignment);
    if (previewNonce > 0) params.set("nonce", String(previewNonce));
    return `/metame/runtime?${params.toString()}`;
  }, [
    previewNonce,
    previewExperience?.description,
    previewExperience?.id,
    previewExperience?.name,
    previewExperienceArticleDraft,
    previewExperienceMedia?.uri,
    previewRuntimeDeliveryProfile.contentKind,
    previewRuntimeDeliveryProfile.codexContext.activeCodexId,
    previewRuntimeDeliveryProfile.codexContext.activeCodexName,
    previewRuntimeDeliveryProfile.codexContext.primaryCodexTab,
    previewRuntimeDeliveryProfile.imageAssets.landscape,
    previewRuntimeDeliveryProfile.imageAssets.portrait,
    previewRuntimeDeliveryProfile.intent,
    previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.desktop,
    previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.mobile,
    previewRuntimeDeliveryProfile.preferredImageOrientationByDevice.tablet,
    previewRuntimeDeliveryProfile.quickLink,
    previewRuntimeDeliveryProfile.runtimeCartridge,
    previewRuntimeDeliveryProfile.stubAssignments.crmCohortAssignment,
    previewRuntimeDeliveryProfile.stubAssignments.personaAssignment,
    previewRuntimeDeliveryProfile.stubAssignments.policyAssignment,
    previewRuntimeDeliveryProfile.videoAssetUrl,
    selectedExperienceId,
  ]);
  const buildRuntimeLaunchUrl = useCallback(
    (
      exp: ExperienceQube | null | undefined,
      options?: {
        target?: ComposerDeploymentTarget;
        variant?: ComposerDeliveryVariant;
      },
    ) => {
      if (typeof window === "undefined") return "";
      const experienceId = exp?.id || selectedExperienceId || previewExperience?.id || "";
      if (!experienceId) return "";
      const target = options?.target || "runtime_launch";
      const variant = options?.variant || "runtime_standard";
      const runtimeProfile = buildRuntimeDeliveryProfile({
        experience: exp || null,
        personaLibraryAssets: personaMediaLibrary as unknown as Array<Record<string, unknown>>,
        target,
        variant,
      });
      const runtimeBaseUrl = resolveRuntimeBaseUrl();
      const params = new URLSearchParams(runtimeBaseUrl.search);
      params.set("capsule", experienceId);
      params.set("experienceId", experienceId);
      params.set("deliveryTarget", target);
      params.set("deliveryVariant", variant);
      params.set("embed", "1");
      if (exp?.name) params.set("experienceName", exp.name);
      if (exp?.description) params.set("experienceDescription", exp.description);
      if (runtimeProfile.imageAssets.landscape) {
        params.set("experienceContextImage", runtimeProfile.imageAssets.landscape);
      }
      const launchMedia = resolveExperiencePrimaryMedia(
        exp || null,
        codexContentItems,
        personaMediaLibrary,
        variant,
      );
      if (!runtimeProfile.imageAssets.landscape && launchMedia?.uri && launchMedia.mediaType !== "video") {
        params.set("experienceContextImage", launchMedia.uri);
      }
      if (launchMedia?.uri && launchMedia.mediaType !== "video") {
        params.set("experienceImage", launchMedia.uri);
      }
      if (runtimeProfile.imageAssets.portrait) params.set("experienceImagePortrait", runtimeProfile.imageAssets.portrait);
      if (runtimeProfile.imageAssets.landscape) params.set("experienceImageLandscape", runtimeProfile.imageAssets.landscape);
      if (runtimeProfile.videoAssetUrl) params.set("experienceVideo", runtimeProfile.videoAssetUrl);
      params.set("runtimeIntent", runtimeProfile.intent);
      params.set("runtimeQuickLink", runtimeProfile.quickLink);
      params.set("contentKind", runtimeProfile.contentKind);
      params.set("activeCodexId", runtimeProfile.codexContext.activeCodexId);
      params.set("activeCodexName", runtimeProfile.codexContext.activeCodexName);
      params.set(
        "runtimeCodexTab",
        resolveRuntimeCodexTabForExperience({
          experience: exp || null,
          runtimeProfile,
        }),
      );
      params.set("runtimeCartridge", runtimeProfile.runtimeCartridge);
      if (runtimeProfile.experienceContext) {
        params.set("experienceContext", JSON.stringify(runtimeProfile.experienceContext));
      }
      const experienceArticleDraft = serializeExperienceArticleDraft(exp || null);
      if (experienceArticleDraft) {
        params.set("experienceArticleDraft", experienceArticleDraft);
      }
      params.set("preferredImageOrientationMobile", runtimeProfile.preferredImageOrientationByDevice.mobile);
      params.set("preferredImageOrientationTablet", runtimeProfile.preferredImageOrientationByDevice.tablet);
      params.set("preferredImageOrientationDesktop", runtimeProfile.preferredImageOrientationByDevice.desktop);
      params.set("personaAssignment", runtimeProfile.stubAssignments.personaAssignment);
      params.set("crmCohortAssignment", runtimeProfile.stubAssignments.crmCohortAssignment);
      params.set("policyAssignment", runtimeProfile.stubAssignments.policyAssignment);
      if (runtimeProfile.surfaceHints.shellMode === "thin") {
        params.set("shell", "thin");
      } else {
        params.delete("shell");
      }
      if (runtimeProfile.surfaceHints.chromeMode === "content-only") {
        params.set("chrome", "content-only");
      } else {
        params.delete("chrome");
      }
      runtimeBaseUrl.search = params.toString();
      return runtimeBaseUrl.toString();
    },
    [codexContentItems, personaMediaLibrary, previewExperience?.id, selectedExperienceId, serializeExperienceArticleDraft],
  );
  const runtimePreviewShellWidthClass =
    previewDevice === "desktop"
      ? "w-full max-w-[1280px]"
      : previewDevice === "tablet"
        ? "w-full max-w-[920px]"
        : "w-[430px] max-w-full";
  const runtimePreviewViewportClass =
    previewDevice === "mobile"
      ? "mx-auto h-full w-[375px] max-w-[375px]"
      : previewDevice === "tablet"
        ? "mx-auto h-full w-full max-w-[860px]"
        : "h-full w-full";

  useEffect(() => {
    setRuntimePreviewLoaded(false);
    setRuntimePreviewErrored(false);
  }, [runtimePreviewSrc]);

  const postRuntimePreviewDeviceContext = useCallback(
    (device: DeviceType) => {
      const frameWindow = runtimePreviewIframeRef.current?.contentWindow;
      if (!frameWindow || typeof window === "undefined") return;
      const viewportWidth = device === "desktop" ? 1280 : device === "tablet" ? 920 : 390;
      const message = createShellMessage("DEVICE_CONTEXT_UPDATE", {
        device,
        viewport_device: device,
        viewport_width: viewportWidth,
        width: viewportWidth,
      });
      frameWindow.postMessage(message, window.location.origin);
    },
    []
  );

  useEffect(() => {
    if (!runtimePreviewLoaded) return;
    postRuntimePreviewDeviceContext(previewDevice);
  }, [postRuntimePreviewDeviceContext, previewDevice, runtimePreviewLoaded]);

  const liquidTemplateId = resolveLiquidTemplateId((previewExperience as any) || null);
  const PreviewTemplate = liquidTemplateRegistry[liquidTemplateId] || liquidTemplateRegistry["liquidui:drawer_grid_v1"];
  const demoContent = useMemo(() => {
    return [
      {
        id: previewExperience?.id || "experience-preview",
        type: "SmartContentQube",
        app: "metaMe",
        title: previewExperience?.name || "Experience Preview",
        description: previewExperience?.description || "Preview capsule",
        rewardOutcomes: {
          engagementRewards: previewSession.settlementComplete
            ? [{ trigger: "settled", amount: 40, currency: "Q¢" }]
            : [],
        },
        modalities: { read: { enabled: true }, watch: { enabled: false }, listen: { enabled: false }, interact: { enabled: false } },
      } as unknown as SmartContentQube,
    ];
  }, [previewExperience, previewSession.settlementComplete]);

  const previewTemplateDevice = previewDevice === "desktop" ? "desktop" : previewDevice === "tablet" ? "tablet" : "mobile";

  const previewSettings = useMemo(() => {
    return {
      device: previewTemplateDevice,
      action: previewAction,
      consentGiven: previewSession.consentGiven,
      iqubeCreated: previewSession.iqubeCreated,
      settlementComplete: previewSession.settlementComplete,
      shared: previewSession.shared,
      receipts: previewSession.settlementComplete
        ? [
            {
              id: `receipt_${previewExperience?.id || "preview"}`,
              action: "settle",
              createdAt: new Date().toISOString(),
              receiptId: `rcpt_${Math.random().toString(36).slice(2, 8)}`,
            },
          ]
        : [],
    };
  }, [previewTemplateDevice, previewAction, previewSession, previewExperience?.id]);

  const RuntimePreviewMenu = ({
    onEarn,
    onPlay,
    onMake,
    onBe,
    onShare,
  }: {
    onEarn?: () => void;
    onPlay?: () => void;
    onMake?: () => void;
    onBe?: () => void;
    onShare?: () => void;
  }) => (
    <div className="absolute inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 px-4 py-2 text-[10px] uppercase tracking-wide text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between">
        <button onClick={onBe} className="text-slate-400 hover:text-white">Be</button>
        <div className="flex items-center gap-4 text-slate-100">
          <button onClick={onEarn} className="hover:text-white">Earn</button>
          <button onClick={onPlay} className="hover:text-white">Play</button>
          <button onClick={onMake} className="hover:text-white">Make</button>
        </div>
        <button onClick={onShare} className="text-slate-400 hover:text-white">Share</button>
      </div>
    </div>
  );

  const PreviewStatus = () => (
    <div className="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span>Consent</span>
        <span className={previewSession.consentGiven ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.consentGiven ? "On" : "Off"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>iQube</span>
        <span className={previewSession.iqubeCreated ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.iqubeCreated ? "Created" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Settlement</span>
        <span className={previewSession.settlementComplete ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.settlementComplete ? "Complete" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Share</span>
        <span className={previewSession.shared ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.shared ? "Sent" : "Pending"}
        </span>
      </div>
    </div>
  );

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    const tenantCache = composerStudioCache.experiencesByTenant[tenantId];
    if (tenantCache && isCacheFresh(tenantCache.fetchedAt, EXPERIENCE_CACHE_TTL_MS)) {
      setExperiences(tenantCache.items);
      return () => {
        active = false;
      };
    }

    const fetchExperiences = async () => {
      try {
        const res = await fetch(`/api/composer/experiences?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        let next = data.experience_qubes || [];
        if (next.length === 0) {
          const fallbackRes = await fetch(`/api/composer/experiences?limit=50`);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const fallbackItems = fallbackData.experience_qubes || [];
            if (fallbackItems.length > 0) {
              next = fallbackItems;
            }
          }
        }
        cacheExperiencesForTenant(tenantId, next);
        if (active) setExperiences(next);
      } catch {
        if (active) {
          if (tenantCache?.items) {
            setExperiences(tenantCache.items);
          } else {
            setExperiences([]);
          }
        }
      }
    };
    fetchExperiences();
    return () => {
      active = false;
    };
  }, [tenantId, experience?.id]);

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    const intentKeywords: Record<string, string[]> = {
      "micro-episode": ["episode", "story", "series", "micro", "narrative", "serial"],
      article: ["article", "reader", "read", "essay", "news", "editorial"],
      tutorial: ["tutorial", "guide", "how", "lesson", "learn", "training"],
      task: ["task", "workflow", "checklist", "action", "runbook", "ops"],
    };

    const keywords = templateIntent ? intentKeywords[templateIntent] || [] : [];

    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        template.category,
        template.complexity,
        ...(template.tags || []),
        ...(template.required_components || []),
        ...(template.optional_components || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const intentMatch = keywords.length === 0 || keywords.some((word) => haystack.includes(word));
      const queryMatch = query.length === 0 || haystack.includes(query);
      return intentMatch && queryMatch;
    });
  }, [templates, templateIntent, templateQuery]);

  const selectedTemplate = useMemo(
    () => filteredTemplates.find((t) => t.id === selectedTemplateId) || null,
    [filteredTemplates, selectedTemplateId]
  );

  const currentStep = useMemo(() => {
    if (!sessionTemplate) return null;
    return sessionTemplate.steps[session?.current_step || 0] || null;
  }, [sessionTemplate, session?.current_step]);

  useCopilotAction({
    name: "composer_set_template_intent",
    description: "Set the template intent and filter query for Studio composition.",
    parameters: [
      { name: "intent", type: "string", description: "micro-episode, article, tutorial, or task", required: false },
      { name: "query", type: "string", description: "Filter query for templates", required: false },
    ],
    handler: async ({ intent, query }) => {
      if (intent === "micro-episode" || intent === "article" || intent === "tutorial" || intent === "task") {
        setTemplateIntent(intent);
      }
      if (query) {
        setTemplateQuery(query);
      }
      return "Template filters updated.";
    },
  });

  const composerAgent = agentConfigs["aigent-z"];
  const handleCopilotPrompt = (prompt: string) => {
    const lower = prompt.toLowerCase();
    const contextLabel =
      copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
    let promptWithContext = `${contextLabel}: ${prompt}`;
    if (/(show|view|browse).*(all|templates)|all templates/.test(lower)) {
      setTemplateIntent(null);
      setTemplateQuery("");
      return;
    }
    if (/(video|sora|generate.*video|create.*video)/.test(lower)) {
      setTemplateIntent("task");
      promptWithContext += " video venice sora ai-generation skill toolqube";
    } else if (/(micro|episode|story|series|serial)/.test(lower)) {
      setTemplateIntent("micro-episode");
      if (/(synth|synthsimms)/.test(lower)) {
        promptWithContext += " scrolls-synthsimms";
      } else if (/(knyt|metaknyt)/.test(lower)) {
        promptWithContext += " scrolls-metaknyts";
      } else {
        promptWithContext += " scrolls-metaknyts";
      }
    } else if (/(article|reader|read|essay|news)/.test(lower)) {
      setTemplateIntent("article");
      if (/(hero|feature)/.test(lower)) promptWithContext += " hero";
      if (/news/.test(lower)) promptWithContext += " latest-news";
    } else if (/(tutorial|guide|how|lesson|learn)/.test(lower)) {
      setTemplateIntent("tutorial");
      if (/penny/.test(lower)) promptWithContext += " penny-drops";
    } else if (/(task|workflow|checklist|runbook|ops)/.test(lower)) {
      setTemplateIntent("task");
      if (/exec/.test(lower)) promptWithContext += " knowdz-exec";
      if (/creative/.test(lower)) promptWithContext += " knowdz-creative";
      if (/dev/.test(lower)) promptWithContext += " knowdz-devs";
    }
    setTemplateQuery(promptWithContext);
  };

  const handleComposerUserPrompt = useCallback(
    async (prompt: string) => {
      const lower = prompt.toLowerCase();
      const wantsVideo = promptWantsVideo(prompt);
      const wantsImage = promptWantsImage(prompt);
      const templateName = sessionTemplate?.name || selectedTemplate?.name || "the current template";
      const imageGenerationStep = mergedData?.image_generation || {};
      const videoPromptStep = mergedData?.video_prompt || {};
      const skillSelectionStep = mergedData?.skill_selection || {};
      const selectedProviderId =
        typeof imageGenerationStep.provider_id === "string" && imageGenerationStep.provider_id
          ? imageGenerationStep.provider_id
          : /venice/.test(String(skillSelectionStep.skill_id || ""))
            ? "venice"
            : typeof skillSelectionStep.skill_id === "string" && skillSelectionStep.skill_id
              ? "openai"
              : null;
      const selectedProvider = getComposerProviderKnowledge(selectedProviderId || undefined);
      const selectedSkillId =
        typeof skillSelectionStep.skill_id === "string" && skillSelectionStep.skill_id
          ? skillSelectionStep.skill_id
          : null;

      if (/(show|view|browse).*(all|templates)|all templates/.test(lower)) {
        handleCopilotPrompt(prompt);
        setExperiencePanelTab("template");
        return "I reset the template filters and moved you back to **Template** so you can browse the full Studio template set.";
      }

      if (/(compare|difference|vs|versus|tradeoff)/.test(lower) && /openai|venice/.test(lower)) {
        const openai = getComposerProviderKnowledge("openai");
        const venice = getComposerProviderKnowledge("venice");
        return [
          `For the current alpha, **OpenAI** and **Venice** are both valid image and video providers.`,
          "",
          `**OpenAI**`,
          `- ${openai?.strengths[0] || "Strong general-purpose multimodal generation"}`,
          `- ${openai?.watchouts[0] || "Video can be expensive or rate-limited"}`,
          "",
          `**Venice**`,
          `- ${venice?.strengths[0] || "Useful as a primary or fallback provider"}`,
          `- ${venice?.operationalNotes[1] || "Good alpha path for image and video workflows"}`,
          "",
          `For image-led article work I can guide either provider and explicitly plan **portrait + landscape** variants. For video-led work, I now generally recommend **OpenAI** as the default first-party path and keep **Venice** as the alternative provider path.`,
        ].join("\n");
      }

      if (/(curated|community|openclaw)/.test(lower) && /(sora|video|skill|venice)/.test(lower)) {
        return [
          `For the current video path, the main tradeoff is trust posture versus flexibility.`,
          "",
          `- **Curated / first-party**: best when you want the cleanest default path.`,
          `- **Community / OpenClaw**: useful as an alternative, but with a more variable trust posture.`,
          `- **Venice**: a trusted alternative provider path that fits the same video workflow.`,
          "",
          `If you want, I can set up a video session now with either **OpenAI curated**, **Venice**, or **community** selected as the starting path.`,
        ].join("\n");
      }

      if (/(parity|surface plan|surface planning|receipts|dvn|deploy|deployment)/.test(lower)) {
        setIsParityExpanded(true);
        if (/(surface)/.test(lower)) setStudioAnalysisTab("surfaces");
        else if (/(receipt|dvn)/.test(lower)) setStudioAnalysisTab("receipts");
        else setStudioAnalysisTab("parity");

        return `I expanded **Parity Review** and moved to **${
          /(surface)/.test(lower)
            ? "Surface Planning"
            : /(receipt|dvn)/.test(lower)
              ? "DVN Receipts"
              : "Design Parity"
        }** so you can review design, proof, and deployment state without losing your Studio context.`;
      }

      if (/(what next|next step|where next|how do i continue|what should i do next)/.test(lower)) {
        if (experiencePanelTab === "customizer" && currentStep) {
          return `You are in **Customizer** on **${currentStep.title}** for **${templateName}**. The best next step is to complete the fields in this step, then move into **Resources** to confirm provider, skills, cost envelope, and any required user data.`;
        }
        if (experiencePanelTab === "resources") {
          return `You are already in **Resources** for **${templateName}**. The next review loop is: confirm provider and skill path, confirm required user inputs, review the DesignQube summary, then move into **Preview** and **Parity Review**.`;
        }
        if (experiencePanelTab === "exqubes") {
          return `You are in **Experiences**. The next step is to select or review the target ExperienceQube, then open **Runtime Preview** and **Parity Review** before deployment.`;
        }
        if (sessionTemplate) {
          setExperiencePanelTab("customizer");
          return `I moved you to **Customizer** for **${templateName}**. Start there, then review **Resources**, then check **Preview** and **Parity Review**.`;
        }
      }

      if (/(prompt|rewrite|refine|improve|stronger prompt|better prompt)/.test(lower)) {
        if (typeof videoPromptStep.prompt === "string" && videoPromptStep.prompt.trim()) {
          return [
            `You already have a seeded **video prompt** in **${templateName}**.`,
            "",
            `**Current prompt**`,
            videoPromptStep.prompt,
            "",
            `I’d refine it by keeping it short, visually specific, and strongly framed around one scene, one motion idea, and one clear style.`,
          ].join("\n");
        }

        if (
          typeof imageGenerationStep.portrait_prompt === "string" &&
          imageGenerationStep.portrait_prompt.trim()
        ) {
          return [
            `You already have seeded **portrait + landscape** image prompts in **${templateName}**.`,
            "",
            `**Portrait**`,
            imageGenerationStep.portrait_prompt,
            "",
            `**Landscape**`,
            imageGenerationStep.landscape_prompt || "Landscape prompt not set yet.",
            "",
            `I’d keep the portrait variant tighter and more subject-led, and the landscape variant wider and more environmental.`,
          ].join("\n");
        }
      }

      if (/(resource|resources|cost|price|pricing|skills|required data|provider)/.test(lower)) {
        setExperiencePanelTab("resources");
        setResourcesPanelTab(/designqube|design qube|design/.test(lower) ? "design" : "experience");
        return [
          `I moved the configurator to **Resources** so you can review the current build envelope.`,
          "",
          `**Template**: ${templateName}`,
          `**Provider**: ${selectedProvider?.name || selectedProviderId || "Not selected yet"}`,
          `**Skill**: ${selectedSkillId || "Not selected yet"}`,
          `**Resource items surfaced**: ${experienceResourceCounts.resourceCount || 0}`,
          `**User data requirements surfaced**: ${experienceResourceCounts.userDataCount || 0}`,
          "",
          `This is also where I surface the current cost envelope stub, provider path, and DesignQube summary.`,
        ].join("\n");
      }

      if (wantsVideo) {
        const contextLabel =
          copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
        const explicitlyOpenAI = /openai/.test(lower) && !/venice/.test(lower);
        const explicitlyVenice = /venice/.test(lower);
        const providerId = explicitlyOpenAI ? "openai" : explicitlyVenice ? "venice" : "openai";
        const useCommunity = /community|openclaw/.test(lower);
        const skillId =
          useCommunity
            ? "sora_video_gen_community"
            : providerId === "venice"
              ? "venice_video_gen"
              : "sora_video_gen_curated";
        const suggestedPrompt = buildVideoPrompt(prompt, contextLabel);
        const experienceName = deriveExperienceNameFromPrompt(
          prompt,
          providerId === "venice" ? "Venice Video Experience" : "Sora Video Experience"
        );

        setTemplateIntent("task");
        setSelectedTemplateId("sora-video-generation");
        setTemplateQuery(`${contextLabel}: ${prompt} video sora venice ai-generation skill toolqube`);

        const seedData = {
          intent_timebox: {
            experience_name: experienceName,
            goal: prompt,
          },
          skill_selection: {
            ...(skillId ? { skill_id: skillId } : {}),
            trust_override: useCommunity,
          },
          video_prompt: {
            prompt: suggestedPrompt,
            duration: /12/.test(lower) ? 12 : /4/.test(lower) ? 4 : 8,
            aspect_ratio: /portrait|vertical|9:16/.test(lower) ? "9:16" : "16:9",
            style:
              inferVisualStyleFromPrompt(prompt) === "editorial"
                ? "cinematic"
                : inferVisualStyleFromPrompt(prompt),
          },
          delegation_stub: {
            human_selection_required: true,
            delegated_provider_selection: false,
            delegation_mode: "future_agentic_routing",
            delegation_note:
              "Human-in-the-loop provider and skill selection required for now. Agentic delegation can route this later.",
          },
        };

        const seeded = await startSeededSessionForTemplate("sora-video-generation", seedData, {
          currentStep: 1,
        });
        const providerKnowledge = providerId ? getComposerProviderKnowledge(providerId) : null;

        return seeded.ok
          ? [
              `I set up a **video-led experience path** in **${seeded.templateName || "Sora Video Generation"}** and opened **Customizer** on **Skill Selection** first.`,
              "",
              `**Provider selection**: human-in-the-loop`,
              providerKnowledge?.name
                ? `- Seeded provider hint: ${providerKnowledge.name}`
                : `- No provider has been preselected so you can choose between OpenAI, Venice, or community explicitly.`,
              `- Future path stubbed: agentic delegation can select the provider/skill later.`,
              "",
              `**Selected skill**: ${skillId || "Choose in Skill Selection"}`,
              "",
              `**Suggested prompt**`,
              suggestedPrompt,
              "",
              `Next, confirm the video skill in **Skill Selection**, then continue into **Video Prompt** to review duration, aspect ratio, and style before checking **Resources**.`,
            ].join("\n")
          : `I prepared a video-led path and a first-pass prompt, but I couldn't open the Customizer session automatically: ${seeded.error}`;
      }

      const wantsArticle = /(article|write|writing|editorial|blog|essay|draft)\b/.test(lower);

      // Image-only: user asks for images without article or story writing
      if (wantsImage && !wantsArticle && !wantsVideo) {
        const contextLabel =
          copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
        const providerId = /venice/.test(lower) && !/openai/.test(lower) ? "venice" : "openai";
        const promptVariants = buildImagePromptVariants(prompt, contextLabel);
        const experienceName = deriveExperienceNameFromPrompt(prompt, "Image Experience");

        setTemplateIntent("task");
        setSelectedTemplateId("ai-image-generation");
        setTemplateQuery(`${contextLabel}: ${prompt} image portrait landscape`);

        const seedData = {
          intent_timebox: {
            experience_name: experienceName,
            goal: prompt,
          },
          image_generation: {
            provider_id: providerId,
            portrait_prompt: promptVariants.portrait,
            landscape_prompt: promptVariants.landscape,
            visual_style: inferVisualStyleFromPrompt(prompt),
          },
        };

        const seeded = await startSeededSessionForTemplate("ai-image-generation", seedData, {
          currentStep: 1,
        });
        const providerKnowledge = getComposerProviderKnowledge(providerId);

        return seeded.ok
          ? [
              `I set up a **standalone image path** in **${seeded.templateName || "AI Image Generation"}** and opened **Customizer** on the image step.`,
              "",
              `**Provider**: ${providerKnowledge?.name || providerId}`,
              "",
              `**Portrait prompt**: ${promptVariants.portrait}`,
              `**Landscape prompt**: ${promptVariants.landscape}`,
              "",
              `Review the prompts in the Customizer, then hit **Run** to generate. To add an article alongside, switch to the Image + Article bundle preset.`,
            ].join("\n")
          : `I prepared a standalone image path, but couldn't open the Customizer automatically: ${seeded.error}`;
      }

      // Article-only: user asks for article/writing without images or video
      if (wantsArticle && !wantsImage && !wantsVideo) {
        const contextLabel =
          copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
        const experienceName = deriveExperienceNameFromPrompt(prompt, "Article Experience");
        const articleTitle = experienceName;
        const articlePrompt = prompt;

        setTemplateIntent("article");
        setSelectedTemplateId("ai-article-draft");
        setTemplateQuery(`${contextLabel}: ${prompt} article editorial draft`);

        const seedData = {
          intent_timebox: {
            experience_name: experienceName,
            goal: prompt,
          },
          article_draft: {
            title: articleTitle,
            prompt: articlePrompt,
            outputs: ["takeaways", "next_action"],
            takeaways_count: 3,
          },
        };

        const seeded = await startSeededSessionForTemplate("ai-article-draft", seedData, {
          currentStep: 1,
        });

        return seeded.ok
          ? [
              `I set up a **standalone article path** in **${seeded.templateName || "Article Draft"}** and opened **Customizer** on the article step.`,
              "",
              `**Article**: ${articleTitle}`,
              `**Prompt**: ${articlePrompt}`,
              "",
              `Review in Customizer, then hit **Run** to generate. To add images alongside, switch to the Image + Article bundle preset. To add video, switch to the Video + Article bundle.`,
            ].join("\n")
          : `I prepared a standalone article path, but couldn't open the Customizer automatically: ${seeded.error}`;
      }

      // Image + article: user asks for images with article context, or editorial
      if (
        wantsImage ||
        (!wantsVideo && /(qriptopian article|editorial)/.test(lower))
      ) {
        const contextLabel =
          copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
        const providerId = /venice/.test(lower) && !/openai/.test(lower) ? "venice" : "openai";
        const promptVariants = buildImagePromptVariants(prompt, contextLabel);
        const experienceName = deriveExperienceNameFromPrompt(prompt, "Qriptopian Image Experience");

        setTemplateIntent("article");
        setSelectedTemplateId("qripto-feature-article");
        setTemplateQuery(`${contextLabel}: ${prompt} article hero image portrait landscape`);

        const seedData = {
          intent_timebox: {
            experience_name: experienceName,
            goal: prompt,
            time_available: "15",
            depth: /technical/.test(lower) ? "technical" : /practical/.test(lower) ? "practical" : "overview",
          },
          content_selection: {
            issue_slug: /issue 1|latest|news/.test(lower) ? "issue-1" : "issue-0",
            feature_item_id: "",
            supporting_item_ids: [],
            preview_enabled: true,
          },
          image_generation: {
            provider_id: providerId,
            portrait_prompt: promptVariants.portrait,
            landscape_prompt: promptVariants.landscape,
            visual_style: inferVisualStyleFromPrompt(prompt),
          },
        };

        const seeded = await startSeededSessionForTemplate("qriptopian_reading_sprint_v0", seedData, {
          currentStep: 2,
        });
        const templateKnowledge = getComposerTemplateKnowledge("feature-article-experience");
        const providerKnowledge = getComposerProviderKnowledge(providerId);

        return seeded.ok
          ? [
              `I set up an **image-led article path** in **${seeded.templateName || "Qriptopian Reading Sprint"}** and opened **Customizer** on the hero image step.`,
              "",
              `**Recommended provider**: ${providerKnowledge?.name || providerId}`,
              `- ${providerKnowledge?.strengths[0] || "Good fit for alpha image generation"}`,
              "",
              `**Portrait prompt**`,
              promptVariants.portrait,
              "",
              `**Landscape prompt**`,
              promptVariants.landscape,
              "",
              templateKnowledge?.summary
                ? `Template note: ${templateKnowledge.summary}`
                : `This follows the current alpha path for article and capsule imagery: template selection, provider choice, portrait + landscape planning, then Resources and Preview review.`,
            ].join("\n")
          : `I prepared an image-led article path, but I couldn't open the Customizer session automatically: ${seeded.error}`;
      }

      return undefined;
    },
    [
      copilotContextId,
      copilotContextOptions,
      currentStep,
      experiencePanelTab,
      handleCopilotPrompt,
      selectedTemplate?.name,
      tenantId,
      userId,
      sessionData,
      stepData,
      sessionTemplate,
    ]
  );

  const qriptoContentOptions = useMemo(() => {
    if (codexContentItems.length > 0) {
      return codexContentItems.map((item) => ({ value: item.id, label: item.label }));
    }
    return QRIPTO_CONTENT_ITEMS.map((item) => ({ value: item.id, label: item.label }));
  }, [codexContentItems]);

  const selectContentDefaults = useMemo(() => {
    const source = codexContentItems.length > 0 ? codexContentItems : QRIPTO_CONTENT_ITEMS;
    return source.slice(0, 3).map((item) => item.id);
  }, [codexContentItems]);

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    if (selectedTemplateId && !filteredTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(null);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const getFieldError = (field: ComposerField, value: any): string | null => {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0);

    if (field.type === "multiselect") {
      const list = Array.isArray(value) ? value : [];
      if (field.required && list.length === 0) return "Select at least one option.";
      return null;
    }

    if (field.type === "checkbox") {
      if (field.required && value !== true) return "This must be enabled.";
      return null;
    }

    if (field.required && isEmpty) return "This field is required.";

    if (field.validation?.pattern && !isEmpty) {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(value))) return "Value does not match the required format.";
      } catch {
        // Ignore invalid regex patterns.
      }
    }

    if (field.validation && typeof value === "number") {
      const min = field.validation.min;
      const max = field.validation.max;
      if (min !== undefined && value < min) return `Minimum value is ${min}.`;
      if (max !== undefined && value > max) return `Maximum value is ${max}.`;
    }

    return null;
  };

  useEffect(() => {
    if (!currentStep) return;
    setStepData((prev) => {
      if (prev[currentStep.id]) return prev;
      const defaults: Record<string, any> = {};
      currentStep.ui_config.fields.forEach((field) => {
        if (field.default_value !== undefined) {
          defaults[field.id] = field.default_value;
          return;
        }
        if (field.id === "content_items") {
          defaults[field.id] = selectContentDefaults;
          return;
        }
        if (field.id === "content_tag") {
          defaults[field.id] = QRIPTO_CONTENT_TAGS[0]?.value;
        }
      });
      if (Object.keys(defaults).length === 0) return prev;
      return { ...prev, [currentStep.id]: defaults };
    });
  }, [currentStep]);

  const stepValues = currentStep ? stepData[currentStep.id] || {} : {};

  const mergedData = useMemo(() => {
    if (!currentStep) return sessionData;
    return {
      ...sessionData,
      [currentStep.id]: stepValues,
    };
  }, [currentStep, sessionData, stepValues]);

  const experienceResourceCounts = useMemo(() => {
    const summary = summarizeExperienceResources(sessionTemplate, mergedData);
    return {
      resourceCount: summary.resources.length,
      userDataCount: summary.userData.length,
    };
  }, [mergedData, sessionTemplate]);

  const isStepValid = useMemo(() => {
    if (!currentStep) return false;
    return currentStep.ui_config.fields.every((field) => !getFieldError(field, stepValues[field.id]));
  }, [currentStep, stepValues]);

  const handleStartSession = async () => {
    if (!selectedTemplate || !tenantId || !userId) return;
    try {
      setSessionError(null);
      setIsSaving(true);
      const res = await fetch("/api/composer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: userId,
          template_id: mapStudioTemplateToSessionTemplate(selectedTemplate.id),
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSession(data.session);
      setSessionTemplate({ ...selectedTemplate, steps: data.template.steps || selectedTemplate.steps });
      setSessionData(data.session?.data || {});
      setStepData({});
      setExperience(null);
      setExperiencePanelTab("customizer");
    } catch (err: any) {
      setSessionError(err.message || "Failed to start session");
    } finally {
      setIsSaving(false);
    }
  };

  const startSeededSessionForTemplate = useCallback(
    async (
      templateId: string,
      seedData: Record<string, any>,
      options?: {
        currentStep?: number;
        preferredStepId?: string | null;
        preserveExperience?: ExperienceQube | null;
        editingExperienceId?: string | null;
      },
    ) => {
      if (!tenantId || !userId) {
        return { ok: false, error: "Tenant or user is missing." };
      }

      try {
        setSessionError(null);
        setIsSaving(true);

        const createRes = await fetch("/api/composer/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            user_id: userId,
            template_id: templateId,
          }),
        });

        if (!createRes.ok) {
          throw new Error("Failed to create session");
        }

        const createData = await createRes.json();
        let nextSession = createData.session;
        const preferredStepIndex = resolveStepIndexForId(
          createData.template?.steps || [],
          options?.preferredStepId,
        );
        const initialStep = preferredStepIndex ?? options?.currentStep ?? 0;

        const nextData = { ...(createData.session?.data || {}), ...seedData };
        const updateRes = await fetch(`/api/composer/sessions/${createData.session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_step: initialStep,
            status: "active",
            data: nextData,
          }),
        });

        if (!updateRes.ok) {
          throw new Error("Failed to seed Studio customization state.");
        }

        const updateData = await updateRes.json();
        nextSession = updateData.session;

        setSession(nextSession);
        setSessionTemplate(createData.template);
        setSelectedTemplateId(templateId);
        setSessionData(nextSession?.data || nextData);
        setStepData(nextData);
        setExperience(options?.preserveExperience || null);
        if (options?.preserveExperience) {
          setSelectedExperience(options.preserveExperience);
          setSelectedExperienceId(options.preserveExperience.id);
        }
        if (options?.editingExperienceId) {
          setEditingExperienceId(options.editingExperienceId);
        }
        setExperiencePanelTab("customizer");

        setTimeout(() => {
          templateCustomizerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);

        return {
          ok: true,
          templateName: createData.template?.name || templateId,
        };
      } catch (err: any) {
        const message = err?.message || "Failed to start template customization session.";
        setSessionError(message);
        return { ok: false, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [tenantId, userId]
  );

  const updateSession = async (nextStep: number) => {
    if (!session) return;
    const nextData = {
      ...sessionData,
      ...(currentStep ? { [currentStep.id]: stepValues } : {}),
    };
    const res = await fetch(`/api/composer/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_step: nextStep,
        data: nextData,
        status: session.status,
      }),
    });
    if (!res.ok) throw new Error("Failed to save session");
    const data = await res.json();
    setSession(data.session);
    setSessionData(nextData);
  };

  const handleJumpToBundleStep = async () => {
    if (!session || bundleCustomizerTargetStepIndex === null) return;
    try {
      setIsSaving(true);
      await updateSession(bundleCustomizerTargetStepIndex);
    } catch (err: any) {
      setSessionError(err.message || "Failed to move to the active bundle step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenBundleBlockFlow = async () => {
    if (!activeExperienceForEditing || !activeExperienceBundleFlowTarget) return;
    const seeded = await startSeededSessionForTemplate(
      activeExperienceBundleFlowTarget.templateId,
      buildBundleFlowSeedData(activeExperienceForEditing, mergedData),
      {
        preferredStepId: activeBundlePreferredStepId,
        preserveExperience: activeExperienceForEditing,
        editingExperienceId: activeExperienceForEditing.id,
      },
    );
    if (!seeded.ok) return;
    setPreviewAction(`Opened ${activeExperienceBundleFlowTarget.label}`);
  };

  const handleNext = async () => {
    if (!sessionTemplate || !session) return;
    const nextStep = Math.min(sessionTemplate.steps.length - 1, (session.current_step || 0) + 1);
    try {
      setIsSaving(true);
      await updateSession(nextStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = async () => {
    if (!sessionTemplate || !session) return;
    const prevStep = Math.max(0, (session.current_step || 0) - 1);
    try {
      setIsSaving(true);
      await updateSession(prevStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      setIsCompleting(true);
      setSessionError(null);
      const res = await fetch(`/api/composer/sessions/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();
      const returnedExperience = data.experience_qube || null;
      const codexLabel =
        copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "Qriptopian";
      const creatorPersonaName = userId || "Studio User";
      const resolvedCreatorPersonaId = activePersonaId || userId;
      const resolvedCreatorPersonaName = activePersonaName || activePersonaId || creatorPersonaName;
      const codexContext = resolveComposerCodexContext(copilotContextId, codexLabel);
      const generatedAssets = extractGeneratedAssetsFromExperience(returnedExperience);
      const articleDraftStep = asRecord(mergedData.article_draft) || {};
      const copilotOutputStep = asRecord(mergedData.copilot_output) || {};
      const articleOutputs = normalizeStringArray(articleDraftStep.outputs ?? copilotOutputStep.outputs);
      const articleTakeawaysCount =
        typeof articleDraftStep.takeaways_count === "number"
          ? articleDraftStep.takeaways_count
          : typeof copilotOutputStep.takeaways_count === "number"
            ? copilotOutputStep.takeaways_count
            : undefined;
      const articleTitle =
        firstNonEmptyString([articleDraftStep.title, returnedExperience?.metadata?.article_title, returnedExperience?.name]) ||
        null;
      const articlePrompt =
        firstNonEmptyString([
          articleDraftStep.prompt,
          returnedExperience?.metadata?.article_prompt,
          asRecord(mergedData.intent_timebox)?.goal,
          returnedExperience?.description,
        ]) || null;
      const existingBundleState = asRecord(returnedExperience?.metadata?.composition_bundle_state) || {};
      const existingMakeBundle = asRecord(returnedExperience?.configuration?.make_bundle) || {};
      const editingExpForBundleCheck = editingExperienceId
        ? experiences.find((e) => e.id === editingExperienceId) ?? null
        : null;
      const preAppliedBundleBlockKinds =
        getAppliedExperienceBundle(editingExpForBundleCheck ?? returnedExperience)?.blockKinds ?? null;
      const mergedBlockStatuses = {
        ...(asRecord(existingMakeBundle.block_statuses) || {}),
        ...(asRecord(existingBundleState.block_statuses) || {}),
        ...(articleTitle || articlePrompt || articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
          ? { article_draft: "ready_for_review" }
          : {}),
      };
      const articleGenerated =
        articleTitle || articlePrompt || articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
          ? await requestArticleDraftArtifact({
              experienceName: returnedExperience?.name,
              title: articleTitle,
              prompt: articlePrompt,
              outputs: articleOutputs,
              takeawaysCount: articleTakeawaysCount,
              mediaMode:
                getAppliedExperienceBundle(returnedExperience)?.presetId === "video_article_bundle" ? "video" : "image",
              contextHints: normalizeStringArray([
                returnedExperience?.description,
                returnedExperience?.goal,
                asRecord(mergedData.image_generation)?.portrait_prompt,
                asRecord(mergedData.image_generation)?.landscape_prompt,
                asRecord(mergedData.video_prompt)?.prompt,
              ]),
            })
          : null;
      let completedExperience = returnedExperience
          ? {
            ...returnedExperience,
            creator_id: returnedExperience.creator_id || userId,
            configuration: {
              ...(returnedExperience.configuration || {}),
              ...(Object.keys(mergedBlockStatuses).length > 0
                ? {
                    make_bundle: {
                      ...existingMakeBundle,
                      ...(preAppliedBundleBlockKinds?.length ? { blockKinds: preAppliedBundleBlockKinds } : {}),
                      block_statuses: mergedBlockStatuses,
                    },
                  }
                : {}),
              ...(articleTitle || articlePrompt || articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
                ? {
                    article_draft: {
                      ...(asRecord(returnedExperience.configuration?.article_draft) || {}),
                      ...(articleTitle ? { title: articleTitle } : {}),
                      ...(articlePrompt ? { prompt: articlePrompt } : {}),
                      ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                      ...(typeof articleTakeawaysCount === "number"
                        ? { takeaways_count: articleTakeawaysCount }
                        : {}),
                      ...(articleGenerated ? { generated: articleGenerated } : {}),
                    },
                    ...(articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
                      ? {
                          copilot_output: {
                            ...(asRecord(returnedExperience.configuration?.copilot_output) || {}),
                            ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                            ...(typeof articleTakeawaysCount === "number"
                              ? { takeaways_count: articleTakeawaysCount }
                              : {}),
                          },
                        }
                      : {}),
                  }
                : {}),
            },
            metadata: {
              ...(returnedExperience.metadata || {}),
              // Preserve composition_bundle from the editing experience so the packet
              // route can correctly identify video_article_bundle → buildSkillPacket.
              // Session completion creates a new experience without this field.
              ...(editingExpForBundleCheck?.metadata?.composition_bundle
                ? { composition_bundle: editingExpForBundleCheck.metadata.composition_bundle }
                : {}),
              creator_persona: {
                id: resolvedCreatorPersonaId,
                name: resolvedCreatorPersonaName,
              },
              codex_context: {
                active_codex_id: codexContext.activeCodexId,
                active_codex_name: codexContext.activeCodexName,
                parent_codex_id: codexContext.parentCodexId,
                parent_codex_name: codexContext.parentCodexName,
                inheritance_mode: codexContext.codexInheritanceMode,
              },
              ...(Object.keys(mergedBlockStatuses).length > 0
                ? {
                    composition_bundle_state: {
                      ...existingBundleState,
                      block_statuses: mergedBlockStatuses,
                    },
                  }
                : {}),
              ...(articleTitle ? { article_title: articleTitle } : {}),
              ...(articlePrompt ? { article_prompt: articlePrompt } : {}),
              editable_generation: {
                ...(asRecord(returnedExperience.metadata?.editable_generation) || {}),
                ...(articleTitle || articlePrompt || articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
                  ? {
                      article_draft: {
                        ...(articleTitle ? { title: articleTitle } : {}),
                        ...(articlePrompt ? { prompt: articlePrompt } : {}),
                        ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                        ...(typeof articleTakeawaysCount === "number"
                          ? { takeaways_count: articleTakeawaysCount }
                          : {}),
                        ...(articleGenerated ? { generated: articleGenerated } : {}),
                      },
                      ...(articleOutputs.length > 0 || typeof articleTakeawaysCount === "number"
                        ? {
                            copilot_output: {
                              ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                              ...(typeof articleTakeawaysCount === "number"
                                ? { takeaways_count: articleTakeawaysCount }
                                : {}),
                            },
                          }
                        : {}),
                    }
                  : {}),
              },
              generated_assets: generatedAssets,
            },
          }
        : null;
      const bundleCheckSource = editingExpForBundleCheck ?? completedExperience;
      const imageBundleTargetId = editingExperienceId || completedExperience?.id;
      const imageGenerationConfig =
        asRecord(completedExperience?.configuration?.image_generation) ||
        asRecord(bundleCheckSource?.configuration?.image_generation) ||
        {};
      const isImageBundle =
        getAppliedExperienceBundle(bundleCheckSource)?.presetId === "image_article_bundle" ||
        asRecord(bundleCheckSource?.configuration?.make_bundle)?.presetId === "image_article_bundle" ||
        asRecord(completedExperience?.configuration?.make_bundle)?.presetId === "image_article_bundle";
      const isVideoBundle =
        getAppliedExperienceBundle(bundleCheckSource)?.presetId === "video_article_bundle" ||
        asRecord(bundleCheckSource?.configuration?.make_bundle)?.presetId === "video_article_bundle" ||
        asRecord(completedExperience?.configuration?.make_bundle)?.presetId === "video_article_bundle" ||
        // Direct template check: if the completed session IS the video generation template,
        // treat it as a video session regardless of whether bundle metadata propagated.
        session.template_id === "sora-video-generation";
      const hasImagePrompts = typeof imageGenerationConfig.portrait_prompt === "string" && (imageGenerationConfig.portrait_prompt as string).trim().length > 0;
      // Mirror the image pattern: read from the completed experience configuration first
      // (session.data is saved as configuration), then fall back to React session state.
      const videoPromptRecord =
        asRecord(completedExperience?.configuration?.video_prompt) ||
        asRecord(bundleCheckSource?.configuration?.video_prompt) ||
        asRecord(mergedData?.video_prompt);
      const skillSelectionRecord =
        asRecord(completedExperience?.configuration?.skill_selection) ||
        asRecord(bundleCheckSource?.configuration?.skill_selection) ||
        asRecord(mergedData?.skill_selection);
      const hasVideoPrompt = typeof videoPromptRecord?.prompt === "string" && (videoPromptRecord.prompt as string).trim().length > 0;
      const shouldAutoGenerateImages = isImageBundle || (hasImagePrompts && !isVideoBundle && !hasVideoPrompt);
      const shouldAutoGenerateVideo = isVideoBundle && hasVideoPrompt;
      // Diagnostic: log auto-gen decision tree so we can trace failures in production
      console.info("[AutoGen] decision", {
        isImageBundle,
        isVideoBundle,
        hasImagePrompts,
        hasVideoPrompt,
        shouldAutoGenerateImages,
        shouldAutoGenerateVideo,
        sessionTemplateId: session.template_id,
        makeBundlePresetId: asRecord(completedExperience?.configuration?.make_bundle)?.presetId,
        bundleCheckPresetId: asRecord(bundleCheckSource?.configuration?.make_bundle)?.presetId,
        compositionBundlePresetId: getAppliedExperienceBundle(bundleCheckSource)?.presetId,
        videoPromptSnippet: typeof videoPromptRecord?.prompt === "string" ? (videoPromptRecord.prompt as string).substring(0, 60) : null,
        imagePromptSnippet: typeof imageGenerationConfig?.portrait_prompt === "string" ? (imageGenerationConfig.portrait_prompt as string).substring(0, 60) : null,
        imageBundleTargetId,
        editingExperienceId,
        completedExperienceId: completedExperience?.id,
      });
      if (completedExperience && shouldAutoGenerateImages && imageBundleTargetId) {
        const articleDraftToPreserve = completedExperience.configuration?.article_draft;
        await requestImageBundleArtifacts({
          experienceId: imageBundleTargetId,
          providerId:
            typeof imageGenerationConfig.provider_id === "string"
              ? (imageGenerationConfig.provider_id as "openai" | "venice")
              : "openai",
          portraitPrompt:
            typeof imageGenerationConfig.portrait_prompt === "string" ? imageGenerationConfig.portrait_prompt : null,
          landscapePrompt:
            typeof imageGenerationConfig.landscape_prompt === "string" ? imageGenerationConfig.landscape_prompt : null,
        }).catch(() => []);
        const refreshedCompletedExperience =
          (await refreshExperienceFromServer(imageBundleTargetId).catch(() => null)) || null;
        if (refreshedCompletedExperience) {
          completedExperience = {
            ...refreshedCompletedExperience,
            configuration: {
              ...refreshedCompletedExperience.configuration,
              ...(articleDraftToPreserve ? { article_draft: articleDraftToPreserve } : {}),
            },
          };
        }
      }
      if (completedExperience && shouldAutoGenerateVideo && imageBundleTargetId) {
        // Preserve article_draft before the server refresh overwrites it,
        // mirroring the same pattern used in the image bundle block above.
        const articleDraftToPreserve = completedExperience.configuration?.article_draft;
        const rawSkillId = skillSelectionRecord?.skill_id;
        const skillId = typeof rawSkillId === "string" && rawSkillId.trim() ? rawSkillId.trim() : "venice_video_gen";
        const trustOverride = skillSelectionRecord?.trust_override === true;
        const videoPrompt = typeof videoPromptRecord?.prompt === "string" ? (videoPromptRecord.prompt as string).trim() : "";
        const duration = typeof videoPromptRecord?.duration === "number" ? (videoPromptRecord.duration as number) : 10;
        const aspectRatio = typeof videoPromptRecord?.aspect_ratio === "string" ? (videoPromptRecord.aspect_ratio as string) : "16:9";
        const style = typeof videoPromptRecord?.style === "string" ? (videoPromptRecord.style as string) : "cinematic";
        await requestVideoBundleArtifacts({
          experienceId: imageBundleTargetId,
          skillId,
          prompt: videoPrompt,
          duration,
          aspectRatio,
          style,
          trustOverride,
        }).catch(() => null);
        const refreshedCompletedExperience =
          (await refreshExperienceFromServer(imageBundleTargetId).catch(() => null)) || null;
        if (refreshedCompletedExperience) {
          completedExperience = {
            ...refreshedCompletedExperience,
            configuration: {
              ...refreshedCompletedExperience.configuration,
              ...(articleDraftToPreserve ? { article_draft: articleDraftToPreserve } : {}),
            },
          };
        }
      }
      setExperience(completedExperience);
      setSession((prev) => (prev ? { ...prev, status: "completed" } : prev));
      if (completedExperience) {
        setExperiences((prev) => {
          const exists = prev.some((exp) => exp.id === completedExperience.id);
          const next = exists
            ? prev.map((exp) => (exp.id === completedExperience.id ? completedExperience : exp))
            : [completedExperience, ...prev];
          cacheExperiencesForTenant(tenantId, next);
          return next;
        });
        setSelectedExperience(completedExperience);
        setSelectedExperienceId(completedExperience.id);
        setPreviewAction(`Review ${completedExperience.name}`);
        setExperiencePanelTab("exqubes");
      }

      if (editingExperienceId && completedExperience) {
        try {
          const updateRes = await fetch(`/api/composer/experiences/${editingExperienceId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: completedExperience.name,
                description: completedExperience.description,
                goal: completedExperience.goal,
                mechanics: completedExperience.mechanics,
                metrics: completedExperience.metrics,
                template_id: completedExperience.template_id,
                status: completedExperience.status,
                configuration: completedExperience.configuration,
                components: completedExperience.components,
                execution: completedExperience.execution,
                access: completedExperience.access,
                metadata: completedExperience.metadata,
              }),
          });
          if (!updateRes.ok) throw new Error("Failed to update ExperienceQube after edit.");
          const updatedData = await updateRes.json();
          const updatedExperience = updatedData.experience_qube || completedExperience;
          setExperiences((prev) => {
            const next = prev.map((exp) => (exp.id === editingExperienceId ? updatedExperience : exp));
            cacheExperiencesForTenant(tenantId, next);
            return next;
          });
          setSelectedExperience(updatedExperience);
          setSelectedExperienceId(updatedExperience.id);
          setEditingExperienceId(null);

          if (completedExperience.id !== editingExperienceId) {
            await fetch(`/api/composer/experiences/${completedExperience.id}`, {
              method: "DELETE",
            }).catch(() => {});
          }
        } catch (updateErr: any) {
          console.warn("Failed to update edited ExperienceQube:", updateErr);
        }
      } else if (completedExperience) {
        try {
          const persistRes = await fetch(`/api/composer/experiences/${completedExperience.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: completedExperience.name,
              description: completedExperience.description,
              goal: completedExperience.goal,
              mechanics: completedExperience.mechanics,
              metrics: completedExperience.metrics,
              template_id: completedExperience.template_id,
              status: completedExperience.status,
              configuration: completedExperience.configuration,
              components: completedExperience.components,
              execution: completedExperience.execution,
              access: completedExperience.access,
              metadata: completedExperience.metadata,
            }),
          });
          if (!persistRes.ok) throw new Error("Failed to persist ExperienceQube metadata after completion.");
          const persistedData = await persistRes.json();
          const persistedExperience = persistedData.experience_qube || completedExperience;
          setExperiences((prev) => {
            const next = prev.map((exp) =>
              exp.id === persistedExperience.id ? persistedExperience : exp
            );
            cacheExperiencesForTenant(tenantId, next);
            return next;
          });
          setSelectedExperience(persistedExperience);
          setSelectedExperienceId(persistedExperience.id);
          setExperience(persistedExperience);
        } catch (persistErr: any) {
          console.warn("Failed to persist completed ExperienceQube metadata:", persistErr);
        }
      }
    } catch (err: any) {
      setSessionError(err.message || "Failed to complete session");
    } finally {
      setIsCompleting(false);
    }
  };

  const createDprAuditReceipt = async (
    experienceId: string,
    action: "pipeline_run" | "pipeline_error" | "remedy_proposed" | "remedy_applied" | "remedy_rejected",
    summary: string,
    details?: Record<string, any>
  ) => {
    const response = await fetch("/api/design-parity/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experienceId,
        tenantId,
        userId,
        action,
        summary,
        details: details || {},
      }),
    });
    if (!response.ok) {
      return { receipt: null, dvnEvent: null };
    }
    const data = await response.json();
    return {
      receipt: data?.receipt || null,
      dvnEvent: data?.dvnEvent || null,
    };
  };

  const persistExperienceUpdate = async (experienceId: string, payload: Record<string, any>, errorMessage: string) => {
    const updateRes = await fetch(`/api/composer/experiences/${experienceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!updateRes.ok) {
      throw new Error(errorMessage);
    }
    const updatedData = await updateRes.json();
    const updatedExperience = updatedData.experience_qube || null;
    setExperiences((prev) => {
      const next = prev.map((exp) => (exp.id === experienceId ? updatedExperience || exp : exp));
      cacheExperiencesForTenant(tenantId, next);
      return next;
    });
    if (selectedExperienceId === experienceId && updatedExperience) {
      setSelectedExperience(updatedExperience);
    }
    if (experience?.id === experienceId && updatedExperience) {
      setExperience(updatedExperience);
    }
    if (mcpExperience?.id === experienceId && updatedExperience) {
      setMcpExperience(updatedExperience);
    }
  };

  const refreshExperienceFromServer = useCallback(
    async (experienceId: string) => {
      const res = await fetch(`/api/composer/experiences/${experienceId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to refresh experience.");
      }
      const data = await res.json();
      const refreshedExperience = data.experience_qube || null;
      if (!refreshedExperience) return null;

      setExperiences((prev) => {
        const exists = prev.some((exp) => exp.id === refreshedExperience.id);
        const next = exists
          ? prev.map((exp) => (exp.id === refreshedExperience.id ? refreshedExperience : exp))
          : [refreshedExperience, ...prev];
        cacheExperiencesForTenant(tenantId, next);
        return next;
      });
      if (selectedExperienceId === refreshedExperience.id) {
        setSelectedExperience(refreshedExperience);
      }
      if (experience?.id === refreshedExperience.id) {
        setExperience(refreshedExperience);
      }
      if (mcpExperience?.id === refreshedExperience.id) {
        setMcpExperience(refreshedExperience);
      }
      return refreshedExperience;
    },
    [experience?.id, mcpExperience?.id, selectedExperienceId, tenantId],
  );

  const recordExperienceLifecycle = async (
    action: "experience_preview" | "experience_launch",
    exp: ExperienceQube | null | undefined,
    source: string
  ) => {
    if (!exp?.id) return;

    const metadata = exp.metadata || {};
    const previousLifecycle =
      metadata.lifecycle_summary && typeof metadata.lifecycle_summary === "object"
        ? (metadata.lifecycle_summary as Record<string, any>)
        : {};

    const nextLifecycle = {
      ...previousLifecycle,
      previewCount:
        action === "experience_preview"
          ? (Number(previousLifecycle.previewCount) || 0) + 1
          : Number(previousLifecycle.previewCount) || 0,
      launchCount:
        action === "experience_launch"
          ? (Number(previousLifecycle.launchCount) || 0) + 1
          : Number(previousLifecycle.launchCount) || 0,
      lastPreviewAt:
        action === "experience_preview"
          ? new Date().toISOString()
          : previousLifecycle.lastPreviewAt,
      lastLaunchAt:
        action === "experience_launch"
          ? new Date().toISOString()
          : previousLifecycle.lastLaunchAt,
      lastLifecyclePersonaId: activePersonaId || userId,
    };

    const deliveryTarget =
      action === "experience_preview"
        ? "Studio Preview"
        : action === "experience_launch"
          ? "Runtime Launch"
          : source;

    void persistExperienceUpdate(
      exp.id,
      {
        name: exp.name,
        description: exp.description,
        goal: exp.goal,
        mechanics: exp.mechanics,
        metrics: exp.metrics,
        template_id: exp.template_id,
        status: exp.status,
        configuration: exp.configuration,
        components: exp.components,
        execution: (exp as any).execution,
        access: exp.access,
        metadata: {
          ...metadata,
          lifecycle_summary: nextLifecycle,
        },
      },
      `Failed to record ${action}.`
    ).catch(() => undefined);

    void markPersonaGeneratedMediaLifecycle({
      personaId: activePersonaId || userId,
      experienceId: exp.id,
      action,
      deliveryTarget,
    }).catch(() => undefined);

    setPersonaMediaLibrary((prev) =>
      prev.map((item) => {
        const matchesExperience =
          item.experienceId === exp.id || item.lastUsedInExperienceId === exp.id;
        if (!matchesExperience) return item;

        const now = new Date().toISOString();
        return {
          ...item,
          updatedAt: now,
          previewCount:
            action === "experience_preview"
              ? (item.previewCount || 0) + 1
              : item.previewCount || 0,
          launchCount:
            action === "experience_launch"
              ? (item.launchCount || 0) + 1
              : item.launchCount || 0,
          lastPreviewAt:
            action === "experience_preview" ? now : item.lastPreviewAt,
          lastLaunchAt:
            action === "experience_launch" ? now : item.lastLaunchAt,
          deliveryTargets:
            deliveryTarget && !(item.deliveryTargets || []).includes(deliveryTarget)
              ? [...(item.deliveryTargets || []), deliveryTarget]
              : item.deliveryTargets,
          lastDeliveryTarget: deliveryTarget || item.lastDeliveryTarget,
        };
      })
    );

    void recordRuntimeLifecycleContribution({
      tenantId: exp.tenant_id || tenantId,
      personaId: activePersonaId || userId,
      experienceId: exp.id,
      contributionType: action,
      source,
      units: 1,
    }).catch(() => undefined);
  };
  const handleSaveEditableGeneration = async () => {
    const articleOutputs = normalizeStringArray(editableArticleOutputs);
    const activeBundle = getAppliedExperienceBundle(activeExperienceForEditing);
    const articleDraftRequested = Boolean(activeBundle?.blockKinds.includes("article_draft"));
    const hasArticleDraftState = Boolean(
      articleDraftRequested ||
        editableArticleTitle.trim() ||
        editableArticlePrompt.trim() ||
        articleOutputs.length > 0 ||
        editableArticleTakeawaysCount !== 3,
    );
    const articleGeneratedDraft = hasArticleDraftState
      ? await requestArticleDraftArtifact({
          experienceName: editableExperienceName.trim() || editableGenerationDefaults.experienceName,
          title: editableArticleTitle.trim() || editableGenerationDefaults.articleTitle,
          prompt: editableArticlePrompt.trim() || editableGenerationDefaults.articlePrompt,
          outputs: articleOutputs,
          takeawaysCount: editableArticleTakeawaysCount,
          mediaMode:
            getAppliedExperienceBundle(activeExperienceForEditing)?.presetId === "video_article_bundle"
              ? "video"
              : "image",
          contextHints: normalizeStringArray([
            activeExperienceForEditing?.description,
            activeExperienceForEditing?.goal,
            editableImagePortraitPrompt.trim(),
            editableImageLandscapePrompt.trim(),
            editableVideoPrompt.trim(),
          ]),
        })
      : null;
    const nextIntentTimebox = {
      ...(asRecord(sessionData.intent_timebox) || {}),
      ...(asRecord(stepData.intent_timebox) || {}),
      experience_name: editableExperienceName.trim(),
    };
    const nextImageGeneration = {
      ...(asRecord(sessionData.image_generation) || {}),
      ...(asRecord(stepData.image_generation) || {}),
      portrait_prompt: editableImagePortraitPrompt.trim(),
      landscape_prompt: editableImageLandscapePrompt.trim(),
    };
    const nextVideoPrompt = {
      ...(asRecord(sessionData.video_prompt) || {}),
      ...(asRecord(stepData.video_prompt) || {}),
      prompt: editableVideoPrompt.trim(),
    };
    const nextArticleDraft = {
      ...(asRecord(sessionData.article_draft) || {}),
      ...(asRecord(stepData.article_draft) || {}),
      ...(editableArticleTitle.trim() ? { title: editableArticleTitle.trim() } : {}),
      ...(editableArticlePrompt.trim() ? { prompt: editableArticlePrompt.trim() } : {}),
      ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
      ...(editableArticleTakeawaysCount > 0 ? { takeaways_count: editableArticleTakeawaysCount } : {}),
      ...(articleGeneratedDraft ? { generated: articleGeneratedDraft } : {}),
    };
    const nextCopilotOutput = {
      ...(asRecord(sessionData.copilot_output) || {}),
      ...(asRecord(stepData.copilot_output) || {}),
      ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
      ...(editableArticleTakeawaysCount > 0 ? { takeaways_count: editableArticleTakeawaysCount } : {}),
    };

    const nextSessionData = {
      ...sessionData,
      intent_timebox: nextIntentTimebox,
      ...(editableImagePortraitPrompt.trim() || editableImageLandscapePrompt.trim()
        ? { image_generation: nextImageGeneration }
        : {}),
      ...(editableVideoPrompt.trim() ? { video_prompt: nextVideoPrompt } : {}),
      ...(hasArticleDraftState ? { article_draft: nextArticleDraft } : {}),
      ...(hasArticleDraftState ? { copilot_output: nextCopilotOutput } : {}),
    };

    const nextStepData = {
      ...stepData,
      ...(Object.keys(nextIntentTimebox).length > 0 ? { intent_timebox: nextIntentTimebox } : {}),
      ...(editableImagePortraitPrompt.trim() || editableImageLandscapePrompt.trim()
        ? { image_generation: nextImageGeneration }
        : {}),
      ...(editableVideoPrompt.trim() ? { video_prompt: nextVideoPrompt } : {}),
      ...(hasArticleDraftState ? { article_draft: nextArticleDraft } : {}),
      ...(hasArticleDraftState ? { copilot_output: nextCopilotOutput } : {}),
    };

    try {
      setIsSavingEditableGeneration(true);
      setSessionError(null);
      setSessionData(nextSessionData);
      setStepData(nextStepData);

      if (session?.id) {
        const sessionRes = await fetch(`/api/composer/sessions/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_step: session.current_step,
            status: session.status,
            data: nextSessionData,
          }),
        });
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json();
          setSession(sessionJson.session || session);
        }
      }

      if (activeExperienceForEditing?.id) {
        setSelectedExperienceId(activeExperienceForEditing.id);
        const existingConfiguration = activeExperienceForEditing.configuration || {};
        const existingMetadata = activeExperienceForEditing.metadata || {};
        const existingMakeBundle = asRecord(existingConfiguration.make_bundle) || {};
        const existingBundleState = asRecord(existingMetadata.composition_bundle_state) || {};
        const mergedBlockStatuses = {
          ...(asRecord(existingMakeBundle.block_statuses) || {}),
          ...(asRecord(existingBundleState.block_statuses) || {}),
          ...(hasArticleDraftState ? { article_draft: "ready_for_review" } : {}),
        };
        await persistExperienceUpdate(
          activeExperienceForEditing.id,
          {
            name: editableExperienceName.trim() || activeExperienceForEditing.name,
            description: activeExperienceForEditing.description,
            goal: activeExperienceForEditing.goal,
            mechanics: activeExperienceForEditing.mechanics,
            metrics: activeExperienceForEditing.metrics,
            template_id: activeExperienceForEditing.template_id,
            status: activeExperienceForEditing.status,
            configuration: {
              ...existingConfiguration,
              ...(Object.keys(mergedBlockStatuses).length > 0
                ? {
                    make_bundle: {
                      ...existingMakeBundle,
                      block_statuses: mergedBlockStatuses,
                    },
                  }
                : {}),
              intent_timebox: {
                ...(asRecord(existingConfiguration.intent_timebox) || {}),
                experience_name: editableExperienceName.trim() || activeExperienceForEditing.name,
              },
              ...(editableImagePortraitPrompt.trim() || editableImageLandscapePrompt.trim()
                ? {
                    image_generation: {
                      ...(asRecord(existingConfiguration.image_generation) || {}),
                      portrait_prompt: editableImagePortraitPrompt.trim(),
                      landscape_prompt: editableImageLandscapePrompt.trim(),
                    },
                  }
                : {}),
              ...(editableVideoPrompt.trim()
                ? {
                    video_prompt: {
                      ...(asRecord(existingConfiguration.video_prompt) || {}),
                      prompt: editableVideoPrompt.trim(),
                    },
                  }
                : {}),
              ...(hasArticleDraftState
                ? {
                    article_draft: {
                      ...(asRecord(existingConfiguration.article_draft) || {}),
                      ...(editableArticleTitle.trim() ? { title: editableArticleTitle.trim() } : {}),
                      ...(editableArticlePrompt.trim() ? { prompt: editableArticlePrompt.trim() } : {}),
                      ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                      ...(editableArticleTakeawaysCount > 0
                        ? { takeaways_count: editableArticleTakeawaysCount }
                        : {}),
                    },
                  }
                : {}),
              ...(hasArticleDraftState
                ? {
                    copilot_output: {
                      ...(asRecord(existingConfiguration.copilot_output) || {}),
                      ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                      ...(editableArticleTakeawaysCount > 0
                        ? { takeaways_count: editableArticleTakeawaysCount }
                        : {}),
                    },
                  }
                : {}),
            },
            components: activeExperienceForEditing.components,
            execution: (activeExperienceForEditing as any).execution,
            access: activeExperienceForEditing.access,
            metadata: {
              ...existingMetadata,
              ...(Object.keys(mergedBlockStatuses).length > 0
                ? {
                    composition_bundle_state: {
                      ...existingBundleState,
                      block_statuses: mergedBlockStatuses,
                    },
                  }
                : {}),
              ...(editableArticleTitle.trim() ? { article_title: editableArticleTitle.trim() } : {}),
              ...(editableArticlePrompt.trim() ? { article_prompt: editableArticlePrompt.trim() } : {}),
              editable_generation: {
                experience_name: editableExperienceName.trim() || activeExperienceForEditing.name,
                ...(editableImagePortraitPrompt.trim() || editableImageLandscapePrompt.trim()
                  ? {
                      image_generation: {
                        portrait_prompt: editableImagePortraitPrompt.trim(),
                        landscape_prompt: editableImageLandscapePrompt.trim(),
                      },
                    }
                  : {}),
                ...(editableVideoPrompt.trim()
                  ? {
                      video_prompt: {
                        prompt: editableVideoPrompt.trim(),
                      },
                    }
                  : {}),
                ...(hasArticleDraftState
                  ? {
                      article_draft: {
                        ...(editableArticleTitle.trim() ? { title: editableArticleTitle.trim() } : {}),
                        ...(editableArticlePrompt.trim() ? { prompt: editableArticlePrompt.trim() } : {}),
                        ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                        ...(editableArticleTakeawaysCount > 0
                          ? { takeaways_count: editableArticleTakeawaysCount }
                          : {}),
                      },
                    }
                  : {}),
                ...(hasArticleDraftState
                  ? {
                      copilot_output: {
                        ...(articleOutputs.length > 0 ? { outputs: articleOutputs } : {}),
                        ...(editableArticleTakeawaysCount > 0
                          ? { takeaways_count: editableArticleTakeawaysCount }
                          : {}),
                      },
                    }
                  : {}),
              },
            },
          },
          "Failed to save generation edits."
        );
        const refreshedExperience = await refreshExperienceFromServer(activeExperienceForEditing.id).catch(() => null);
        if (refreshedExperience) {
          setSelectedExperience(refreshedExperience);
          if (experience?.id === refreshedExperience.id) {
            setExperience(refreshedExperience);
          }
        }
        setPreviewNonce(Date.now());
        setPreviewAction(`Updated ${editableExperienceName.trim() || activeExperienceForEditing.name}`);
      }
    } catch (err: any) {
      setSessionError(err?.message || "Failed to save generation edits.");
    } finally {
      setIsSavingEditableGeneration(false);
    }
  };

  const handleUsePersonaMediaInExperience = async (item: PersonaGeneratedMediaRecord) => {
    if (!activeExperienceForEditing?.id || !item.assetUrl) return;

    const experienceId = activeExperienceForEditing.id;
    const assetId =
      item.type === "video"
        ? `${experienceId}:video`
        : `${experienceId}:${item.orientation === "landscape" ? "landscape" : "portrait"}:image`;

    try {
      setApplyingPersonaMediaId(item.id);
      setSessionError(null);

      await persistGeneratedAssetsForExperience({
        experienceId,
        assets: [
          {
            id: assetId,
            type: item.type,
            label:
              item.type === "video"
                ? "Generated video"
                : item.orientation === "landscape"
                  ? "Landscape generated image"
                  : "Portrait generated image",
            provider: item.provider,
            orientation: item.type === "image" ? item.orientation : undefined,
            assetUrl: item.assetUrl,
            storagePath: item.storagePath,
            receiptRef: item.receiptRef,
            prompt: item.prompt,
            createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
          },
        ],
        preferredAssetId: assetId,
      });

      await markPersonaGeneratedMediaUsage({
        personaId: activePersonaId || userId,
        mediaId: item.id,
        experienceId,
      });

      void recordRuntimeLifecycleContribution({
        tenantId,
        personaId: activePersonaId || userId,
        experienceId,
        contributionType: "reused_saved_media",
        source: "studio-persona-library",
        units: 1,
      }).catch(() => undefined);

      const response = await fetch(`/api/composer/experiences/${experienceId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Saved media was applied, but the experience could not be refreshed.");
      }

      const data = await response.json();
      const refreshedExperience = data.experience_qube || null;
      if (refreshedExperience) {
        setExperiences((prev) => {
          const exists = prev.some((exp) => exp.id === refreshedExperience.id);
          const next = exists
            ? prev.map((exp) => (exp.id === refreshedExperience.id ? refreshedExperience : exp))
            : [refreshedExperience, ...prev];
          cacheExperiencesForTenant(tenantId, next);
          return next;
        });
        if (selectedExperienceId === refreshedExperience.id) {
          setSelectedExperience(refreshedExperience);
        }
        if (experience?.id === refreshedExperience.id) {
          setExperience(refreshedExperience);
        }
        setPersonaMediaLibrary((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  updatedAt: new Date().toISOString(),
                  useCount: (entry.useCount || 0) + 1,
                  lastUsedAt: new Date().toISOString(),
                  lastUsedInExperienceId: experienceId,
                  lastAction: "reused",
                }
              : entry
          )
        );
        setPreviewAction(`Reused saved ${item.type} in ${refreshedExperience.name}`);
      }
    } catch (err: any) {
      setSessionError(err?.message || "Failed to apply saved media to this experience.");
    } finally {
      setApplyingPersonaMediaId(null);
    }
  };

  const handleTogglePersonaMediaPin = async (item: PersonaGeneratedMediaRecord) => {
    const activeExperienceId = activeExperienceForEditing?.id;
    if (!activeExperienceId) return;

    const nextPinnedExperienceId =
      item.pinnedToExperienceId === activeExperienceId ? null : activeExperienceId;

    try {
      setPinningPersonaMediaId(item.id);
      setSessionError(null);
      await setPersonaGeneratedMediaPinned({
        personaId: activePersonaId || userId,
        mediaId: item.id,
        pinnedToExperienceId: nextPinnedExperienceId,
      });

      const now = new Date().toISOString();
      setPersonaMediaLibrary((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                updatedAt: now,
                pinnedToExperienceId: nextPinnedExperienceId || undefined,
                pinnedAt: nextPinnedExperienceId ? now : undefined,
              }
            : entry
        )
      );
    } catch (err: any) {
      setSessionError(err?.message || "Failed to update pinned media.");
    } finally {
      setPinningPersonaMediaId(null);
    }
  };

  const handleStartEditingPersonaMedia = (item: PersonaGeneratedMediaRecord) => {
    setEditingPersonaMediaId(item.id);
    setEditingPersonaMediaLabel(item.label);
  };

  const handleSavePersonaMediaLabel = async (item: PersonaGeneratedMediaRecord) => {
    const nextLabel = editingPersonaMediaLabel.trim();
    if (!nextLabel) {
      setSessionError("Saved media label cannot be empty.");
      return;
    }

    try {
      setSavingPersonaMediaLabelId(item.id);
      setSessionError(null);
      await updatePersonaGeneratedMediaRecord({
        personaId: activePersonaId || userId,
        mediaId: item.id,
        updates: { label: nextLabel },
      });
      const now = new Date().toISOString();
      setPersonaMediaLibrary((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, label: nextLabel, updatedAt: now } : entry
        )
      );
      setEditingPersonaMediaId(null);
      setEditingPersonaMediaLabel("");
    } catch (err: any) {
      setSessionError(err?.message || "Failed to save media label.");
    } finally {
      setSavingPersonaMediaLabelId(null);
    }
  };

  const handleToggleArchivePersonaMedia = async (item: PersonaGeneratedMediaRecord) => {
    const nextArchivedAt = item.archivedAt ? undefined : new Date().toISOString();
    try {
      setArchivingPersonaMediaId(item.id);
      setSessionError(null);
      await updatePersonaGeneratedMediaRecord({
        personaId: activePersonaId || userId,
        mediaId: item.id,
        updates: { archivedAt: nextArchivedAt },
      });
      const now = new Date().toISOString();
      setPersonaMediaLibrary((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                archivedAt: nextArchivedAt,
                updatedAt: now,
              }
            : entry
        )
      );
      if (editingPersonaMediaId === item.id) {
        setEditingPersonaMediaId(null);
        setEditingPersonaMediaLabel("");
      }
    } catch (err: any) {
      setSessionError(err?.message || "Failed to update archived media.");
    } finally {
      setArchivingPersonaMediaId(null);
    }
  };

  const handleLogAuditEvent = async (
    experienceId: string,
    action: "pipeline_run" | "pipeline_error" | "remedy_proposed" | "remedy_rejected",
    summary: string,
    details?: Record<string, any>
  ) => {
    const existing = experiences.find((exp) => exp.id === experienceId) || selectedExperience || experience;
    if (!existing) return;
    const { receipt, dvnEvent } = await createDprAuditReceipt(experienceId, action, summary, details);
    const now = new Date().toISOString();
    const eventRecord = {
      id: `dpr_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      summary,
      details: details || {},
      createdAt: now,
      receiptId: receipt?.receiptId || null,
      dvnEventId: dvnEvent?.id || null,
      status: dvnEvent?.status || "logged",
    };
    const previousMetadata = existing.metadata || {};
    const previousAuditTrail = Array.isArray(previousMetadata.dprAuditTrail)
      ? previousMetadata.dprAuditTrail
      : [];
    const previousCopilotLog = Array.isArray(previousMetadata.copilotLog)
      ? previousMetadata.copilotLog
      : [];
    const nextMetadata = {
      ...previousMetadata,
      dprLastAction: action,
      dprUpdatedAt: now,
      dprAuditTrail: [...previousAuditTrail, eventRecord].slice(-60),
      dprReceipts: [...(Array.isArray(previousMetadata.dprReceipts) ? previousMetadata.dprReceipts : []), receipt]
        .filter(Boolean)
        .slice(-25),
      dprDvnEvents: [...(Array.isArray(previousMetadata.dprDvnEvents) ? previousMetadata.dprDvnEvents : []), dvnEvent]
        .filter(Boolean)
        .slice(-25),
      dprLatest:
        action === "pipeline_run"
          ? {
              score: details?.overall ?? null,
              structural: details?.structural ?? null,
              checks: details?.audit || null,
              violations: details?.violationCount ?? null,
              summary,
              updatedAt: now,
            }
          : previousMetadata.dprLatest,
      copilotLog: [
        ...previousCopilotLog,
        {
          id: `copilot_dpr_${Date.now()}`,
          type: "design-parity",
          action,
          summary,
          createdAt: now,
          receiptId: receipt?.receiptId || null,
          dvnEventId: dvnEvent?.id || null,
        },
      ].slice(-100),
    };
    const baseConfiguration = existing.configuration || {};
    const baseCopilotOutput = (baseConfiguration as any).copilot_output || {};
    const dprLog = Array.isArray(baseCopilotOutput.dpr_log) ? baseCopilotOutput.dpr_log : [];
    const nextConfiguration = {
      ...baseConfiguration,
      copilot_output: {
        ...baseCopilotOutput,
        dpr_log: [...dprLog, eventRecord].slice(-50),
      },
    };

    await persistExperienceUpdate(
      experienceId,
      {
        name: existing.name,
        description: existing.description,
        goal: existing.goal,
        mechanics: existing.mechanics,
        metrics: existing.metrics,
        template_id: existing.template_id,
        status: existing.status,
        configuration: nextConfiguration,
        components: existing.components,
        access: existing.access,
        metadata: nextMetadata,
      },
      "Failed to log DPR event."
      );
  };

  const persistExperienceDeploymentResult = useCallback(
    async (
      exp: ExperienceQube | null | undefined,
      deployment: ComposerDeploymentResult,
      source: string,
    ) => {
      if (!exp?.id) return;

      const metadata = exp.metadata || {};
      const previousLifecycle =
        metadata.lifecycle_summary && typeof metadata.lifecycle_summary === "object"
          ? (metadata.lifecycle_summary as Record<string, any>)
          : {};
      const previousHistory = Array.isArray(metadata.deployment_history)
        ? metadata.deployment_history
        : [];
      const deployedAt = new Date().toISOString();
      const runtimeProjection =
        (deployment.target === "runtime_launch" || deployment.target === "runtime_thin_client") && deployment.runtimeProfile
          ? buildExperienceRuntimeProjection({
              experience: exp,
              runtimeProfile: deployment.runtimeProfile,
              target: deployment.target,
              variant:
                deployment.variant ||
                (deployment.target === "runtime_thin_client" ? "runtime_thin_client" : "runtime_standard"),
              publishUrl: deployment.publishUrl,
              launchUrl: deployment.launchUrl,
            })
          : undefined;
      const nextEntry = {
        id: `deploy_${deployment.target}_${Date.now()}`,
        target: deployment.target,
        variant: deployment.variant,
        destination_surface:
          typeof deployment.response?.destinationSurface === "string"
            ? deployment.response.destinationSurface
            : undefined,
        provider: deployment.provider,
        mode: deployment.mode,
        status: deployment.status,
        capability_state: deployment.capability.state,
        capability_summary: deployment.capability.summary,
        capability_constraints: deployment.capability.constraints,
        adapter_declaration: deployment.adapterDeclaration,
        delivery_mode: deployment.deliveryMode,
        destination_adapter: deployment.destinationAdapter,
        publish_url: deployment.publishUrl,
        launch_url: deployment.launchUrl,
        source,
        deployed_at: deployedAt,
        error: deployment.error,
        runtime_profile: deployment.runtimeProfile,
        runtime_projection: runtimeProjection,
      };
      const nextLifecycle = {
        ...previousLifecycle,
        deploymentCount: (Number(previousLifecycle.deploymentCount) || 0) + 1,
        lastDeploymentAt: deployedAt,
        lastDeploymentPersonaId: activePersonaId || userId,
      };

      await persistExperienceUpdate(
        exp.id,
        {
          name: exp.name,
          description: exp.description,
          goal: exp.goal,
          mechanics: exp.mechanics,
          metrics: exp.metrics,
          template_id: exp.template_id,
          status: exp.status,
          configuration: exp.configuration,
          components: exp.components,
          execution: (exp as any).execution,
          access: exp.access,
          metadata: {
            ...metadata,
            deployment_state: {
              last_target: deployment.target,
              last_variant: deployment.variant,
              last_destination_surface:
                typeof deployment.response?.destinationSurface === "string"
                  ? deployment.response.destinationSurface
                  : undefined,
              last_status: deployment.status,
              last_capability_state: deployment.capability.state,
              last_capability_summary: deployment.capability.summary,
              last_capability_constraints: deployment.capability.constraints,
              last_adapter_declaration: deployment.adapterDeclaration,
              last_delivery_mode: deployment.deliveryMode,
              last_destination_adapter: deployment.destinationAdapter,
              last_provider: deployment.provider,
              last_mode: deployment.mode,
              last_publish_url: deployment.publishUrl,
              last_launch_url: deployment.launchUrl,
              last_deployed_at: deployedAt,
              last_error: deployment.error,
              last_runtime_profile: deployment.runtimeProfile,
              last_runtime_projection: runtimeProjection,
            },
            runtime_publication: runtimeProjection || metadata.runtime_publication,
            deployment_history: [...previousHistory, nextEntry].slice(-25),
            lifecycle_summary: nextLifecycle,
          },
        },
        "Failed to persist deployment state.",
      );

      if (deployment.ok) {
        void recordRuntimeLifecycleContribution({
          tenantId,
          personaId: activePersonaId || userId,
          experienceId: exp.id,
          contributionType: "deployment_dispatch",
          source,
          units: 1,
        }).catch(() => undefined);
      }
    },
    [activePersonaId, tenantId, userId],
  );

  const handleApplyRemedy = async (
    experienceId: string,
    patch: Partial<ExperienceQube>,
    summary: string
  ) => {
    const existing = experiences.find((exp) => exp.id === experienceId) || selectedExperience || experience;
    if (!existing) {
      throw new Error("ExperienceQube not found for remedy.");
    }
    const { receipt, dvnEvent } = await createDprAuditReceipt(experienceId, "remedy_applied", summary, {
      patch,
      proposalCount: Array.isArray((patch.metadata as any)?.parityRemedies)
        ? (patch.metadata as any).parityRemedies.length
        : undefined,
    });
    const now = new Date().toISOString();
    const previousMetadata = existing.metadata || {};
    const previousAuditTrail = Array.isArray(previousMetadata.dprAuditTrail)
      ? previousMetadata.dprAuditTrail
      : [];
    const previousCopilotLog = Array.isArray(previousMetadata.copilotLog)
      ? previousMetadata.copilotLog
      : [];
    const eventRecord = {
      id: `dpr_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action: "remedy_applied",
      summary,
      createdAt: now,
      receiptId: receipt?.receiptId || null,
      dvnEventId: dvnEvent?.id || null,
      status: dvnEvent?.status || "logged",
    };
    const nextMetadata = {
      ...previousMetadata,
      ...(patch.metadata || {}),
      dprLastAction: "remedy_applied",
      dprUpdatedAt: now,
      dprAuditTrail: [...previousAuditTrail, eventRecord].slice(-60),
      dprReceipts: [...(Array.isArray(previousMetadata.dprReceipts) ? previousMetadata.dprReceipts : []), receipt]
        .filter(Boolean)
        .slice(-25),
      dprDvnEvents: [...(Array.isArray(previousMetadata.dprDvnEvents) ? previousMetadata.dprDvnEvents : []), dvnEvent]
        .filter(Boolean)
        .slice(-25),
      copilotLog: [
        ...previousCopilotLog,
        {
          id: `copilot_dpr_${Date.now()}`,
          type: "design-parity",
          action: "remedy_applied",
          summary,
          createdAt: now,
          receiptId: receipt?.receiptId || null,
          dvnEventId: dvnEvent?.id || null,
        },
      ].slice(-100),
    };
    const baseConfiguration = patch.configuration ?? existing.configuration ?? {};
    const baseCopilotOutput = (baseConfiguration as any).copilot_output || {};
    const dprLog = Array.isArray(baseCopilotOutput.dpr_log) ? baseCopilotOutput.dpr_log : [];
    const nextConfiguration = {
      ...baseConfiguration,
      copilot_output: {
        ...baseCopilotOutput,
        dpr_log: [...dprLog, eventRecord].slice(-50),
      },
    };
    const payload = {
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      goal: patch.goal ?? existing.goal,
      mechanics: patch.mechanics ?? existing.mechanics,
      metrics: patch.metrics ?? existing.metrics,
      template_id: patch.template_id ?? existing.template_id,
      status: patch.status ?? existing.status,
      configuration: nextConfiguration,
      components: patch.components ?? existing.components,
      access: patch.access ?? existing.access,
      execution: (patch as any).execution ?? (existing as any)?.execution,
      metadata: nextMetadata,
    };

    await persistExperienceUpdate(experienceId, payload, "Failed to apply ExperienceQube remedy.");
    setPreviewAction(`Remedy applied: ${summary}`);
  };

  const updateField = (stepId: string, fieldId: string, value: any) => {
    setStepData((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const cardClass = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6";
  const summaryCardClass = "rounded-xl border border-slate-800 bg-slate-950/60 p-4";
  const getMergedValue = (stepId: string, fieldId: string) => mergedData?.[stepId]?.[fieldId];
  const summary = useMemo(() => {
    if (!sessionTemplate) return [];
    const getLabel = (stepId: string, fieldId: string) => {
      const step = sessionTemplate.steps.find((s) => s.id === stepId);
      const field = step?.ui_config.fields.find((f) => f.id === fieldId);
      return field?.name || fieldId;
    };

    const list: Array<{ label: string; value: string }> = [];
    const intentStep = mergedData.intent_timebox || {};
    if (intentStep.experience_name) list.push({ label: getLabel("intent_timebox", "experience_name"), value: intentStep.experience_name });
    if (intentStep.goal) list.push({ label: getLabel("intent_timebox", "goal"), value: intentStep.goal });
    if (intentStep.time_available) list.push({ label: getLabel("intent_timebox", "time_available"), value: `${intentStep.time_available} min` });
    if (intentStep.depth) list.push({ label: getLabel("intent_timebox", "depth"), value: intentStep.depth });

    const contentStep = mergedData.content_selection || {};
    if (contentStep.issue_slug) list.push({ label: getLabel("content_selection", "issue_slug"), value: contentStep.issue_slug });
    if (contentStep.feature_item_id) list.push({ label: getLabel("content_selection", "feature_item_id"), value: contentStep.feature_item_id });
    if (Array.isArray(contentStep.supporting_item_ids) && contentStep.supporting_item_ids.length > 0) {
      list.push({ label: getLabel("content_selection", "supporting_item_ids"), value: `${contentStep.supporting_item_ids.length} items` });
    }

    const walletStep = mergedData.wallet_rewards || {};
    if (walletStep.unlock_price !== undefined) list.push({ label: getLabel("wallet_rewards", "unlock_price"), value: `${walletStep.unlock_price} Q¢` });
    if (walletStep.reward_amount !== undefined) list.push({ label: getLabel("wallet_rewards", "reward_amount"), value: `${walletStep.reward_amount} Q¢` });
    if (walletStep.require_wallet_connect !== undefined) list.push({ label: getLabel("wallet_rewards", "require_wallet_connect"), value: walletStep.require_wallet_connect ? "Required" : "Optional" });

    const copilotStep = mergedData.copilot_output || {};
    if (Array.isArray(copilotStep.outputs) && copilotStep.outputs.length > 0) {
      list.push({ label: getLabel("copilot_output", "outputs"), value: copilotStep.outputs.join(", ") });
    }
    if (copilotStep.takeaways_count !== undefined) {
      list.push({ label: getLabel("copilot_output", "takeaways_count"), value: String(copilotStep.takeaways_count) });
    }

    return list;
  }, [mergedData, sessionTemplate]);
  const experienceResourceSummary = useMemo(() => {
    return summarizeExperienceResources(sessionTemplate, mergedData);
  }, [mergedData, sessionTemplate]);
  const activeExperienceResourceSummary = useMemo(() => {
    return mergeExperienceResourceSummary(
      experienceResourceSummary,
      previewExperience || selectedExperience || experience || null
    );
  }, [experience, experienceResourceSummary, previewExperience, selectedExperience]);
  const editableGenerationDefaults = useMemo(() => {
    const activeConfig = activeExperienceForEditing?.configuration || {};
    const activeMetadata = activeExperienceForEditing?.metadata || {};
    const metadataEditable = asRecord(activeMetadata.editable_generation) || {};
    const intentTimebox =
      (asRecord(mergedData?.intent_timebox) as Record<string, any> | null) ||
      (asRecord(activeConfig.intent_timebox) as Record<string, any> | null) ||
      (asRecord(metadataEditable.intent_timebox) as Record<string, any> | null) ||
      {};
    const imageGeneration =
      (asRecord(mergedData?.image_generation) as Record<string, any> | null) ||
      (asRecord(activeConfig.image_generation) as Record<string, any> | null) ||
      (asRecord(metadataEditable.image_generation) as Record<string, any> | null) ||
      {};
    const videoPrompt =
      (asRecord(mergedData?.video_prompt) as Record<string, any> | null) ||
      (asRecord(activeConfig.video_prompt) as Record<string, any> | null) ||
      (asRecord(metadataEditable.video_prompt) as Record<string, any> | null) ||
      {};
    const articleDraft =
      (asRecord(mergedData?.article_draft) as Record<string, any> | null) ||
      (asRecord(activeConfig.article_draft) as Record<string, any> | null) ||
      (asRecord(metadataEditable.article_draft) as Record<string, any> | null) ||
      {};
    const copilotOutput =
      (asRecord(mergedData?.copilot_output) as Record<string, any> | null) ||
      (asRecord(activeConfig.copilot_output) as Record<string, any> | null) ||
      (asRecord(metadataEditable.copilot_output) as Record<string, any> | null) ||
      {};
    const articleOutputs = normalizeStringArray(articleDraft.outputs ?? copilotOutput.outputs);
    const takeawaysCount =
      typeof articleDraft.takeaways_count === "number"
        ? articleDraft.takeaways_count
        : typeof copilotOutput.takeaways_count === "number"
          ? copilotOutput.takeaways_count
          : 3;
    const articleGenerated =
      (asRecord(articleDraft.generated) as Record<string, any> | null) ||
      (asRecord(metadataEditable.article_draft)?.generated as Record<string, any> | null) ||
      null;

    return {
      experienceName:
        (typeof intentTimebox.experience_name === "string" && intentTimebox.experience_name.trim()
          ? intentTimebox.experience_name
          : null) ||
        activeExperienceForEditing?.name ||
        "",
      imagePortraitPrompt:
        (typeof imageGeneration.portrait_prompt === "string" && imageGeneration.portrait_prompt.trim()
          ? imageGeneration.portrait_prompt
          : "") || "",
      imageLandscapePrompt:
        (typeof imageGeneration.landscape_prompt === "string" && imageGeneration.landscape_prompt.trim()
          ? imageGeneration.landscape_prompt
          : "") || "",
      videoPrompt:
        (typeof videoPrompt.prompt === "string" && videoPrompt.prompt.trim() ? videoPrompt.prompt : "") || "",
      articleTitle:
        firstNonEmptyString([articleDraft.title, activeMetadata.article_title, activeExperienceForEditing?.name]) || "",
      articlePrompt:
        firstNonEmptyString([
          articleDraft.prompt,
          activeMetadata.article_prompt,
          intentTimebox.goal,
          activeExperienceForEditing?.description,
        ]) || "",
      articleOutputs,
      articleTakeawaysCount:
        typeof takeawaysCount === "number" && Number.isFinite(takeawaysCount) ? takeawaysCount : 3,
      articleGenerated,
    };
  }, [activeExperienceForEditing, mergedData]);
  const showEditableArticleDraft = useMemo(() => {
    const activeBundle = getAppliedExperienceBundle(activeExperienceForEditing);
    return (
      Boolean(activeBundle?.blockKinds.includes("article_draft")) ||
      Boolean(
        editableGenerationDefaults.articleTitle ||
        editableGenerationDefaults.articlePrompt ||
          editableGenerationDefaults.articleOutputs.length > 0 ||
          editableGenerationDefaults.articleGenerated,
      )
    );
  }, [activeExperienceForEditing, editableGenerationDefaults]);
  const editableArticleDraftPreview = useMemo(
    () =>
      (editableGenerationDefaults.articleGenerated as ArticleDraftArtifact | null) ||
      buildArticleDraftArtifact({
        experienceName: editableExperienceName.trim() || editableGenerationDefaults.experienceName,
        title: editableArticleTitle.trim(),
        prompt: editableArticlePrompt.trim(),
        outputs: editableArticleOutputs,
        takeawaysCount: editableArticleTakeawaysCount,
        mediaMode:
          getAppliedExperienceBundle(activeExperienceForEditing)?.presetId === "video_article_bundle"
            ? "video"
            : "image",
      }) ||
      null,
    [
      activeExperienceForEditing,
      editableArticleOutputs,
      editableArticlePrompt,
      editableArticleTakeawaysCount,
      editableArticleTitle,
      editableExperienceName,
      editableGenerationDefaults.articleGenerated,
      editableGenerationDefaults.experienceName,
    ],
  );
  const activeExperienceDeploymentHistory = useMemo(() => {
    const raw = activeExperienceForEditing?.metadata?.deployment_history;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => Boolean(item && typeof item === "object"))
      .sort(
        (a, b) =>
          new Date(String(b.deployed_at || 0)).getTime() -
          new Date(String(a.deployed_at || 0)).getTime(),
      )
      .slice(0, 5);
  }, [activeExperienceForEditing]);
  const activeExperienceBlockManifest = useMemo(
    () => buildExperienceBlockManifest(bundleTemplateTargetExperience),
    [bundleTemplateTargetExperience],
  );
  const activeExperienceBundlePresets = useMemo(
    () => listExperienceBundlePresets(activeExperienceBlockManifest),
    [activeExperienceBlockManifest],
  );
  const activeAppliedExperienceBundle = useMemo(
    () => getAppliedExperienceBundle(bundleTemplateTargetExperience),
    [bundleTemplateTargetExperience],
  );
  const activeExperienceBundleSequencingState = useMemo(
    () => resolveExperienceBundleSequencingState(bundleTemplateTargetExperience, activeAppliedExperienceBundle),
    [activeAppliedExperienceBundle, bundleTemplateTargetExperience],
  );
  const activeExperienceBundleFlowTarget = useMemo(
    () =>
      resolveExperienceBundleFlowTarget(
        activeAppliedExperienceBundle,
        activeExperienceBundleSequencingState?.activeBlock || null,
      ),
    [activeAppliedExperienceBundle, activeExperienceBundleSequencingState],
  );
  const activeBundlePreferredStepId = useMemo(
    () => resolveBundlePreferredStepId(activeExperienceBundleSequencingState?.activeBlock, mergedData),
    [activeExperienceBundleSequencingState, mergedData],
  );
  const bundleCustomizerTargetStepIndex = useMemo(() => {
    if (!sessionTemplate || !activeExperienceBundleFlowTarget || !activeBundlePreferredStepId) return null;
    if (sessionTemplate.id !== activeExperienceBundleFlowTarget.templateId) return null;
    return resolveStepIndexForId(sessionTemplate.steps || [], activeBundlePreferredStepId);
  }, [activeBundlePreferredStepId, activeExperienceBundleFlowTarget, sessionTemplate]);
  const persistBundleBlockStatus = useCallback(
    async (
      blockKind: "image_generation" | "video_generation" | "article_draft" | "deployment",
      status: ExperienceBundleBlockStatus,
      options?: {
        generatedArticleDraft?: Record<string, any> | null;
        blockOutput?: Record<string, any> | null;
        previewAction?: string;
      },
    ) => {
      if (!activeExperienceForEditing || !activeAppliedExperienceBundle) return;

      const now = new Date().toISOString();
      const existingConfiguration = activeExperienceForEditing.configuration || {};
      const existingMetadata = activeExperienceForEditing.metadata || {};
      const makeBundle = asRecord(existingConfiguration.make_bundle) || {};
      const compositionBundleState = asRecord(existingMetadata.composition_bundle_state) || {};
      const mergedStatuses = {
        ...(asRecord(makeBundle.block_statuses) || {}),
        ...(asRecord(compositionBundleState.block_statuses) || {}),
        [blockKind]: status,
      };
      const existingBlockOutputs = {
        ...(asRecord(makeBundle.block_outputs) || {}),
        ...(asRecord(compositionBundleState.block_outputs) || {}),
      };
      const mergedBlockOutputs = {
        ...existingBlockOutputs,
        ...(options?.blockOutput ? { [blockKind]: options.blockOutput } : {}),
        ...(options?.generatedArticleDraft
          ? {
              article_draft: {
                ...(asRecord(existingBlockOutputs.article_draft) || {}),
                generated: options.generatedArticleDraft,
              },
            }
          : {}),
      };
      const editableGenerationMetadata = asRecord(existingMetadata.editable_generation) || {};
      const nextConfiguration = {
        ...existingConfiguration,
        make_bundle: {
          ...makeBundle,
          presetId: activeAppliedExperienceBundle.presetId,
          bundleTemplateId: activeAppliedExperienceBundle.bundleTemplateId,
          bundleTemplateLabel: activeAppliedExperienceBundle.bundleTemplateLabel,
          entryIntent: activeAppliedExperienceBundle.entryIntent,
          blockKinds: activeAppliedExperienceBundle.blockKinds,
          block_statuses: mergedStatuses,
          block_outputs: mergedBlockOutputs,
          updatedAt: now,
        },
        ...(options?.generatedArticleDraft
          ? {
              article_draft: {
                ...(asRecord(existingConfiguration.article_draft) || {}),
                generated: options.generatedArticleDraft,
              },
            }
          : {}),
      };
      const nextMetadata = {
        ...existingMetadata,
        composition_bundle_state: {
          ...compositionBundleState,
          block_statuses: mergedStatuses,
          block_outputs: mergedBlockOutputs,
          updatedAt: now,
        },
        ...(options?.generatedArticleDraft
          ? {
              editable_generation: {
                ...editableGenerationMetadata,
                article_draft: {
                  ...(asRecord(editableGenerationMetadata.article_draft) || {}),
                  generated: options.generatedArticleDraft,
                },
              },
            }
          : {}),
      };

      await persistExperienceUpdate(
        activeExperienceForEditing.id,
        {
          name: activeExperienceForEditing.name,
          description: activeExperienceForEditing.description,
          goal: activeExperienceForEditing.goal,
          mechanics: activeExperienceForEditing.mechanics,
          metrics: activeExperienceForEditing.metrics,
          template_id: activeExperienceForEditing.template_id,
          status: activeExperienceForEditing.status,
          configuration: nextConfiguration,
          components: activeExperienceForEditing.components,
          execution: (activeExperienceForEditing as any).execution,
          access: activeExperienceForEditing.access,
          metadata: nextMetadata,
        },
        `Failed to update ${blockKind} bundle status.`,
      );

      if (options?.previewAction) {
        setPreviewAction(options.previewAction);
      }
    },
    [activeAppliedExperienceBundle, activeExperienceForEditing],
  );
  const handleJumpToBundleBlock = useCallback(
    async (blockKind: "image_generation" | "video_generation" | "article_draft" | "deployment") => {
      if (!sessionTemplate || !session) return;
      const preferredStepId = resolveBundlePreferredStepId(blockKind, mergedData);
      const stepIndex = resolveStepIndexForId(sessionTemplate.steps || [], preferredStepId);
      if (stepIndex === null || stepIndex === (session.current_step || 0)) return;
      try {
        setIsSaving(true);
        await updateSession(stepIndex);
      } catch (err: any) {
        setSessionError(err.message || `Failed to move to ${blockKind}`);
      } finally {
        setIsSaving(false);
      }
    },
    [mergedData, session, sessionTemplate],
  );
  const handleOpenBundleBlockByKind = useCallback(
    async (blockKind: "image_generation" | "video_generation" | "article_draft" | "deployment") => {
      if (!activeExperienceForEditing || !activeAppliedExperienceBundle) return;
      const flowTarget = resolveExperienceBundleFlowTarget(activeAppliedExperienceBundle, blockKind);
      if (!flowTarget) return;
      const preferredStepId = resolveBundlePreferredStepId(blockKind, mergedData);
      if (sessionTemplate?.id === flowTarget.templateId && session) {
        await handleJumpToBundleBlock(blockKind);
        return;
      }
      const seeded = await startSeededSessionForTemplate(
        flowTarget.templateId,
        buildBundleFlowSeedData(activeExperienceForEditing, mergedData),
        {
          preferredStepId,
          preserveExperience: activeExperienceForEditing,
          editingExperienceId: activeExperienceForEditing.id,
        },
      );
      if (seeded.ok) {
        setPreviewAction(`Opened ${flowTarget.label}`);
      }
    },
    [
      activeAppliedExperienceBundle,
      activeExperienceForEditing,
      handleJumpToBundleBlock,
      mergedData,
      session,
      sessionTemplate,
      startSeededSessionForTemplate,
    ],
  );
  const handleAcceptArticleDraft = useCallback(async () => {
    const articleOutput = resolveExperienceBundleBlockOutputs(activeExperienceForEditing).article_draft || null;
    await persistBundleBlockStatus("article_draft", "accepted", {
      blockOutput: articleOutput ? { ...articleOutput } : undefined,
      previewAction: "Accepted article draft bundle block",
    });
  }, [activeExperienceForEditing, persistBundleBlockStatus]);
  const handleRefineArticleDraft = useCallback(async () => {
    await persistBundleBlockStatus("article_draft", "in_progress", {
      previewAction: "Article draft moved back to refinement",
    });
    await handleOpenBundleBlockByKind("article_draft");
  }, [handleOpenBundleBlockByKind, persistBundleBlockStatus]);
  const handleRegenerateArticleDraft = useCallback(async () => {
    const generated = await requestArticleDraftArtifact({
      experienceName: editableExperienceName.trim() || editableGenerationDefaults.experienceName,
      title: editableArticleTitle.trim() || editableGenerationDefaults.articleTitle,
      prompt: editableArticlePrompt.trim() || editableGenerationDefaults.articlePrompt,
      outputs: editableArticleOutputs,
      takeawaysCount: editableArticleTakeawaysCount,
      mediaMode:
        getAppliedExperienceBundle(activeExperienceForEditing)?.presetId === "video_article_bundle"
          ? "video"
          : "image",
      contextHints: normalizeStringArray([
        activeExperienceForEditing?.description,
        activeExperienceForEditing?.goal,
        editableImagePortraitPrompt.trim(),
        editableImageLandscapePrompt.trim(),
        editableVideoPrompt.trim(),
      ]),
    });
    if (!generated) return;
    await persistBundleBlockStatus("article_draft", "ready_for_review", {
      generatedArticleDraft: {
        ...generated,
        generatedAt: new Date().toISOString(),
        revision: Date.now(),
      },
      blockOutput: {
        ...(asRecord(resolveExperienceBundleBlockOutputs(activeExperienceForEditing).article_draft) || {}),
        generated: {
          ...generated,
          generatedAt: new Date().toISOString(),
          revision: Date.now(),
        },
        title: editableArticleTitle.trim() || editableGenerationDefaults.articleTitle,
        prompt: editableArticlePrompt.trim() || editableGenerationDefaults.articlePrompt,
        outputs: editableArticleOutputs,
        takeaways_count: editableArticleTakeawaysCount,
      },
      previewAction: "Regenerated article draft review artifact",
    });
  }, [
    activeExperienceForEditing,
    editableArticleOutputs,
    editableArticlePrompt,
    editableArticleTakeawaysCount,
    editableArticleTitle,
    editableExperienceName,
    editableGenerationDefaults.articlePrompt,
    editableGenerationDefaults.articleTitle,
    editableGenerationDefaults.experienceName,
    editableImageLandscapePrompt,
    editableImagePortraitPrompt,
    editableVideoPrompt,
    persistBundleBlockStatus,
    requestArticleDraftArtifact,
  ]);
  const handleAcceptMediaBlock = useCallback(
    async (blockKind: "image_generation" | "video_generation") => {
      const blockOutput = resolveExperienceBundleBlockOutputs(activeExperienceForEditing)[blockKind] || null;
      await persistBundleBlockStatus(blockKind, "accepted", {
        blockOutput: blockOutput ? { ...blockOutput } : undefined,
        previewAction: `Accepted ${blockKind === "image_generation" ? "image" : "video"} bundle block`,
      });
    },
    [activeExperienceForEditing, persistBundleBlockStatus],
  );
  const handleRefineMediaBlock = useCallback(
    async (blockKind: "image_generation" | "video_generation") => {
      await persistBundleBlockStatus(blockKind, "in_progress", {
        previewAction: `Reopened ${blockKind === "image_generation" ? "image" : "video"} bundle block`,
      });
      await handleOpenBundleBlockByKind(blockKind);
    },
    [handleOpenBundleBlockByKind, persistBundleBlockStatus],
  );
  const handleAcceptDeploymentBlock = useCallback(async () => {
    const deploymentOutput = resolveExperienceBundleBlockOutputs(activeExperienceForEditing).deployment || null;
    await persistBundleBlockStatus("deployment", "accepted", {
      blockOutput: deploymentOutput ? { ...deploymentOutput } : undefined,
      previewAction: "Marked deployment bundle block complete",
    });
  }, [activeExperienceForEditing, persistBundleBlockStatus]);
  const handleReviewDeploymentBlock = useCallback(async () => {
    await persistBundleBlockStatus("deployment", "in_progress", {
      previewAction: "Reopened deployment bundle block",
    });
    await handleOpenBundleBlockByKind("deployment");
  }, [handleOpenBundleBlockByKind, persistBundleBlockStatus]);
  const handleApplyBundlePreset = useCallback(
    async (presetId: ExperienceBundlePresetId) => {
      if (!bundleTemplateTargetExperience?.id) {
        setSessionError("Select an ExperienceQube before applying a bundle preset.");
        return;
      }
      const preset = activeExperienceBundlePresets.find((item) => item.id === presetId);
      if (!preset) {
        setSessionError("Requested bundle preset is not available.");
        return;
      }

      setApplyingBundlePresetId(presetId);
      setSessionError(null);
      try {
        const patch = buildExperienceBundlePresetPatch(
          bundleTemplateTargetExperience,
          activeExperienceBlockManifest,
          preset,
        );
        const shouldSeedArticleDraft = preset.blockKinds.includes("article_draft");
        const seededArticleOutputs = ["takeaways", "next_action"];
        const seededArticleTitle = bundleTemplateTargetExperience.name || "Editorial draft";
        const seededArticlePrompt =
          firstNonEmptyString([
            bundleTemplateTargetExperience.description,
            bundleTemplateTargetExperience.goal,
            "Write a supporting article that explains the generated media experience and gives the audience a clear next step.",
          ]) || "";
        const seededArticleDraft = shouldSeedArticleDraft
          ? await requestArticleDraftArtifact({
              experienceName: bundleTemplateTargetExperience.name,
              title: seededArticleTitle,
              prompt: seededArticlePrompt,
              outputs: seededArticleOutputs,
              takeawaysCount: 3,
              mediaMode: preset.id === "video_article_bundle" ? "video" : "image",
              contextHints: normalizeStringArray([
                bundleTemplateTargetExperience.description,
                bundleTemplateTargetExperience.goal,
              ]),
            })
          : null;
        const patchConfigurationRecord = patch.configuration as Record<string, unknown>;
        const patchMetadataRecord = patch.metadata as Record<string, unknown>;
        const patchConfiguration = shouldSeedArticleDraft
          ? {
              ...patch.configuration,
              article_draft: {
                ...(asRecord(patchConfigurationRecord.article_draft) || {}),
                title: seededArticleTitle,
                prompt: seededArticlePrompt,
                outputs: seededArticleOutputs,
                takeaways_count: 3,
                ...(seededArticleDraft ? { generated: seededArticleDraft } : {}),
              },
              copilot_output: {
                ...(asRecord(patchConfigurationRecord.copilot_output) || {}),
                outputs: seededArticleOutputs,
                takeaways_count: 3,
              },
              make_bundle: {
                ...(asRecord(patchConfigurationRecord.make_bundle) || {}),
                block_statuses: {
                  ...(asRecord(asRecord(patchConfigurationRecord.make_bundle)?.block_statuses) || {}),
                  article_draft: seededArticleDraft ? "ready_for_review" : "in_progress",
                },
                block_outputs: {
                  ...(asRecord(asRecord(patchConfigurationRecord.make_bundle)?.block_outputs) || {}),
                  ...(seededArticleDraft
                    ? {
                        article_draft: {
                          title: seededArticleTitle,
                          prompt: seededArticlePrompt,
                          outputs: seededArticleOutputs,
                          takeaways_count: 3,
                          generated: seededArticleDraft,
                        },
                      }
                    : {}),
                },
              },
            }
          : patch.configuration;
        const patchMetadata = shouldSeedArticleDraft
          ? {
              ...patch.metadata,
              article_title: seededArticleTitle,
              article_prompt: seededArticlePrompt,
              composition_bundle_state: {
                ...(asRecord(patchMetadataRecord.composition_bundle_state) || {}),
                block_statuses: {
                  ...(asRecord(asRecord(patchMetadataRecord.composition_bundle_state)?.block_statuses) || {}),
                  article_draft: seededArticleDraft ? "ready_for_review" : "in_progress",
                },
                block_outputs: {
                  ...(asRecord(asRecord(patchMetadataRecord.composition_bundle_state)?.block_outputs) || {}),
                  ...(seededArticleDraft
                    ? {
                        article_draft: {
                          title: seededArticleTitle,
                          prompt: seededArticlePrompt,
                          outputs: seededArticleOutputs,
                          takeaways_count: 3,
                          generated: seededArticleDraft,
                        },
                      }
                    : {}),
                },
              },
              editable_generation: {
                ...(asRecord(patchMetadataRecord.editable_generation) || {}),
                article_draft: {
                  title: seededArticleTitle,
                  prompt: seededArticlePrompt,
                  outputs: seededArticleOutputs,
                  takeaways_count: 3,
                  ...(seededArticleDraft ? { generated: seededArticleDraft } : {}),
                },
              },
            }
          : patch.metadata;
        await persistExperienceUpdate(
          bundleTemplateTargetExperience.id,
          {
            name: bundleTemplateTargetExperience.name,
            description: bundleTemplateTargetExperience.description,
            goal: bundleTemplateTargetExperience.goal,
            mechanics: bundleTemplateTargetExperience.mechanics,
            metrics: bundleTemplateTargetExperience.metrics,
            template_id: bundleTemplateTargetExperience.template_id,
            status: bundleTemplateTargetExperience.status,
            configuration: patchConfiguration,
            components: bundleTemplateTargetExperience.components,
            execution: (bundleTemplateTargetExperience as any).execution,
            access: bundleTemplateTargetExperience.access,
            metadata: patchMetadata,
          },
          "Failed to apply Make bundle preset.",
        );
        const refreshedPatchedExperience =
          (await refreshExperienceFromServer(bundleTemplateTargetExperience.id).catch(() => null)) || null;
        const patchedExperience = (refreshedPatchedExperience || {
          ...bundleTemplateTargetExperience,
          configuration: patchConfiguration,
          metadata: patchMetadata,
        }) as ExperienceQube;
        setSelectedExperience(patchedExperience);
        setSelectedExperienceId(patchedExperience.id);
        setExperiencePanelTab("customizer");
        await handleEditExperience(
          patchedExperience,
          {
            preferredStepId: resolveBundlePreferredStepId(
              resolveExperienceBundleSequencingState(patchedExperience, patch.bundle)?.activeBlock,
              patchConfiguration,
            ),
          }
        );
        setPreviewAction(`Applied ${preset.label} bundle`);
      } catch (error: any) {
        setSessionError(error?.message || "Failed to apply Make bundle preset.");
      } finally {
        setApplyingBundlePresetId(null);
      }
    },
    [
      activeExperienceBlockManifest,
      activeExperienceBundlePresets,
      bundleTemplateTargetExperience,
      requestArticleDraftArtifact,
    ],
  );
  const activeExperienceDeploymentState = useMemo(() => {
    const raw = activeExperienceForEditing?.metadata?.deployment_state;
    return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
  }, [activeExperienceForEditing]);
  const selectedDeploymentCard = useMemo(
    () => deploymentTargetCards.find((target) => target.id === mcpDeploymentTarget) || null,
    [deploymentTargetCards, mcpDeploymentTarget],
  );
  const latestSelectedDeploymentResult = useMemo(() => {
    const inSession = deploymentResultsByTarget[mcpDeploymentTarget];
    if (inSession) {
      return {
        target: inSession.target,
        variant: inSession.variant,
        destinationSurface:
          typeof inSession.response?.destinationSurface === "string"
            ? inSession.response.destinationSurface
            : getDeploymentDestinationSurfaceLabel(inSession.target, inSession.variant),
        status: inSession.status,
        capability: inSession.capability,
        adapterDeclaration: inSession.adapterDeclaration,
        deliveryMode: inSession.deliveryMode,
        destinationAdapter: inSession.destinationAdapter,
        provider: inSession.provider,
        mode: inSession.mode,
        publishUrl: inSession.publishUrl,
        launchUrl: inSession.launchUrl,
        warnings: inSession.warnings,
        error: inSession.error,
        runtimeProfile: inSession.runtimeProfile,
        nextActions: Array.isArray(inSession.response?.nextActions)
          ? (inSession.response.nextActions as string[])
          : undefined,
        deployedAt:
          activeExperienceDeploymentState?.last_target === mcpDeploymentTarget
            ? String(activeExperienceDeploymentState.last_deployed_at || "")
            : undefined,
      };
    }
    if (activeExperienceDeploymentState?.last_target === mcpDeploymentTarget) {
      return {
        target: String(activeExperienceDeploymentState.last_target),
        variant: typeof activeExperienceDeploymentState.last_variant === "string"
          ? activeExperienceDeploymentState.last_variant
          : undefined,
        destinationSurface:
          typeof activeExperienceDeploymentState.last_destination_surface === "string"
            ? activeExperienceDeploymentState.last_destination_surface
            : getDeploymentDestinationSurfaceLabel(
                typeof activeExperienceDeploymentState.last_target === "string"
                  ? activeExperienceDeploymentState.last_target
                  : null,
                typeof activeExperienceDeploymentState.last_variant === "string"
                  ? activeExperienceDeploymentState.last_variant
                  : undefined,
              ),
        status: String(activeExperienceDeploymentState.last_status || "unknown"),
        capability:
          typeof activeExperienceDeploymentState.last_capability_state === "string"
            ? ({
                adapter:
                  typeof activeExperienceDeploymentState.last_provider === "string" &&
                  activeExperienceDeploymentState.last_provider === "runtime"
                    ? "runtime"
                    : typeof activeExperienceDeploymentState.last_provider === "string" &&
                        activeExperienceDeploymentState.last_provider === "discord"
                      ? "discord_mcp"
                      : typeof activeExperienceDeploymentState.last_target === "string" &&
                          activeExperienceDeploymentState.last_target === "studio_preview"
                        ? "studio"
                        : typeof activeExperienceDeploymentState.last_target === "string" &&
                            activeExperienceDeploymentState.last_target === "runtime_thin_client"
                          ? "thin_client"
                          : typeof activeExperienceDeploymentState.last_target === "string" &&
                              activeExperienceDeploymentState.last_target === "mcp_app"
                            ? "mcp_app"
                            : "runtime",
                state: activeExperienceDeploymentState.last_capability_state as ComposerDeploymentCapabilityState,
                summary:
                  typeof activeExperienceDeploymentState.last_capability_summary === "string"
                    ? activeExperienceDeploymentState.last_capability_summary
                    : "Capability summary unavailable.",
                constraints: Array.isArray(activeExperienceDeploymentState.last_capability_constraints)
                  ? activeExperienceDeploymentState.last_capability_constraints.filter(
                      (item): item is string => typeof item === "string",
                    )
                  : undefined,
              } as ComposerDeploymentCapability)
            : undefined,
        adapterDeclaration:
          activeExperienceDeploymentState.last_adapter_declaration &&
          typeof activeExperienceDeploymentState.last_adapter_declaration === "object"
            ? (activeExperienceDeploymentState.last_adapter_declaration as ComposerDeploymentAdapterDeclaration)
            : undefined,
        deliveryMode:
          typeof activeExperienceDeploymentState.last_delivery_mode === "string"
            ? (activeExperienceDeploymentState.last_delivery_mode as ComposerDeploymentDeliveryMode)
            : undefined,
        destinationAdapter:
          typeof activeExperienceDeploymentState.last_destination_adapter === "string"
            ? (activeExperienceDeploymentState.last_destination_adapter as ComposerDeploymentAdapter)
            : undefined,
        provider: typeof activeExperienceDeploymentState.last_provider === "string"
          ? activeExperienceDeploymentState.last_provider
          : undefined,
        mode: typeof activeExperienceDeploymentState.last_mode === "string"
          ? activeExperienceDeploymentState.last_mode
          : undefined,
        publishUrl: typeof activeExperienceDeploymentState.last_publish_url === "string"
          ? activeExperienceDeploymentState.last_publish_url
          : undefined,
        launchUrl: typeof activeExperienceDeploymentState.last_launch_url === "string"
          ? activeExperienceDeploymentState.last_launch_url
          : undefined,
        warnings: undefined as string[] | undefined,
        error: typeof activeExperienceDeploymentState.last_error === "string"
          ? activeExperienceDeploymentState.last_error
          : undefined,
        runtimeProfile:
          activeExperienceDeploymentState.last_runtime_profile &&
          typeof activeExperienceDeploymentState.last_runtime_profile === "object"
            ? (activeExperienceDeploymentState.last_runtime_profile as Record<string, any>)
            : undefined,
        deployedAt: typeof activeExperienceDeploymentState.last_deployed_at === "string"
          ? activeExperienceDeploymentState.last_deployed_at
          : undefined,
      };
    }
    return null;
  }, [activeExperienceDeploymentState, deploymentResultsByTarget, mcpDeploymentTarget]);
  const inspectorRemediationSteps = useMemo(() => {
    const steps: string[] = [];
    const fallbackGuidance = resolveDeploymentFallbackGuidance({
      target: mcpDeploymentTarget,
      variant: mcpDeliveryVariant,
    });
    const remediationActions = resolveDeploymentRemediationActions({
      target: mcpDeploymentTarget,
      variant: mcpDeliveryVariant,
    });

    if (selectedDeploymentCard?.watchouts?.length) {
      steps.push(...selectedDeploymentCard.watchouts);
    }
    if (mcpDeploymentTarget === "discord_mcp" && !(mcpDiscordStatus?.ready || mcpDiscordStatusState === "ok")) {
      steps.push("Run Check Discord Connection and confirm a valid channel or invite before live dispatch.");
    }
    if (mcpDeploymentTarget === "runtime_launch" && !inspectorMediaPreview?.uri) {
      steps.push("Generate or attach a playable image or video artifact before runtime launch.");
    }
    if (latestSelectedDeploymentResult?.error) {
      steps.push(`Latest failure: ${latestSelectedDeploymentResult.error}`);
    }
    if (mcpDispatchMode === "live" && selectedDeploymentCard && !selectedDeploymentCard.ready) {
      steps.push("Use Simulation first to verify the deployment payload before retrying live dispatch.");
    }
    if (fallbackGuidance.length > 0) {
      steps.push(...fallbackGuidance);
    }
    if (remediationActions.length > 0) {
      steps.push(...remediationActions);
    }
    if (steps.length === 0) {
      steps.push("No major blockers detected. You can dispatch this target or open the generated launch surface.");
    }

    return Array.from(new Set(steps)).slice(0, 4);
  }, [
    inspectorMediaPreview?.uri,
    latestSelectedDeploymentResult,
    mcpDeploymentTarget,
    mcpDispatchMode,
    mcpDiscordStatus?.ready,
    mcpDiscordStatusState,
    mcpDeliveryVariant,
    selectedDeploymentCard,
  ]);
  const filteredPersonaMediaLibrary = useMemo(() => {
    const activeExperienceId = activeExperienceForEditing?.id || null;

    return personaMediaLibrary
      .filter((item) => {
        if (!showArchivedPersonaMedia && item.archivedAt) {
          return false;
        }
        if (personaMediaTypeFilter !== "all" && item.type !== personaMediaTypeFilter) {
          return false;
        }
        if (personaMediaScopeFilter === "active") {
          if (!activeExperienceId) return false;
          return (
            item.experienceId === activeExperienceId ||
            item.lastUsedInExperienceId === activeExperienceId
          );
        }
        return true;
      })
      .sort((a, b) => {
        const aPinned = activeExperienceId && a.pinnedToExperienceId === activeExperienceId ? 1 : 0;
        const bPinned = activeExperienceId && b.pinnedToExperienceId === activeExperienceId ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const aActive = activeExperienceId && (a.experienceId === activeExperienceId || a.lastUsedInExperienceId === activeExperienceId) ? 1 : 0;
        const bActive = activeExperienceId && (b.experienceId === activeExperienceId || b.lastUsedInExperienceId === activeExperienceId) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        const aRelevantAt = new Date(
          a.lastLaunchAt || a.lastPreviewAt || a.lastUsedAt || a.updatedAt || a.createdAt || 0
        ).getTime();
        const bRelevantAt = new Date(
          b.lastLaunchAt || b.lastPreviewAt || b.lastUsedAt || b.updatedAt || b.createdAt || 0
        ).getTime();
        if (aRelevantAt !== bRelevantAt) return bRelevantAt - aRelevantAt;

        const aUsageScore = (a.useCount || 0) + (a.launchCount || 0) + (a.previewCount || 0);
        const bUsageScore = (b.useCount || 0) + (b.launchCount || 0) + (b.previewCount || 0);
        if (aUsageScore !== bUsageScore) return bUsageScore - aUsageScore;

        return String(a.label || "").localeCompare(String(b.label || ""));
      });
  }, [activeExperienceForEditing?.id, personaMediaLibrary, personaMediaScopeFilter, personaMediaTypeFilter, showArchivedPersonaMedia]);
  const editableGenerationSourceKey = useMemo(
    () =>
      [
        activeExperienceForEditing?.id || "no-experience",
        session?.id || "no-session",
        editableGenerationDefaults.experienceName,
        editableGenerationDefaults.imagePortraitPrompt,
        editableGenerationDefaults.imageLandscapePrompt,
        editableGenerationDefaults.videoPrompt,
        editableGenerationDefaults.articleTitle,
        editableGenerationDefaults.articlePrompt,
        editableGenerationDefaults.articleOutputs.join("|"),
        String(editableGenerationDefaults.articleTakeawaysCount),
      ].join(":"),
    [activeExperienceForEditing?.id, editableGenerationDefaults, session?.id]
  );

  useEffect(() => {
    setEditableExperienceName(editableGenerationDefaults.experienceName);
    setEditableImagePortraitPrompt(editableGenerationDefaults.imagePortraitPrompt);
    setEditableImageLandscapePrompt(editableGenerationDefaults.imageLandscapePrompt);
    setEditableVideoPrompt(editableGenerationDefaults.videoPrompt);
    setEditableArticleTitle(editableGenerationDefaults.articleTitle);
    setEditableArticlePrompt(editableGenerationDefaults.articlePrompt);
    setEditableArticleOutputs(editableGenerationDefaults.articleOutputs);
    setEditableArticleTakeawaysCount(editableGenerationDefaults.articleTakeawaysCount);
  }, [editableGenerationSourceKey]);

  const refreshPersonaMediaLibrary = useCallback(() => {
    const personaKey = (activePersonaId || userId || "").trim();
    if (!personaKey) {
      setPersonaMediaLibrary([]);
      return;
    }

    setPersonaMediaLibraryLoading(true);

    return fetch(
      `/api/ops/state/user-preferences?userId=${encodeURIComponent(personaKey)}&category=workflow&keys=${encodeURIComponent("composer_generated_media_library_v1")}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const serverLibrary = Array.isArray(data?.preferences?.composer_generated_media_library_v1)
          ? data.preferences.composer_generated_media_library_v1
          : null;
        const fallbackLibrary = (() => {
          try {
            const fallbackRaw = window.localStorage.getItem(
              `composer_generated_media_library_v1:${personaKey}`
            );
            const fallbackParsed = fallbackRaw ? JSON.parse(fallbackRaw) : [];
            return Array.isArray(fallbackParsed) ? fallbackParsed : [];
          } catch {
            return [];
          }
        })();
        const rawLibrary =
          Array.isArray(serverLibrary) && serverLibrary.length > 0
            ? serverLibrary
            : fallbackLibrary;
        if (!Array.isArray(rawLibrary) || rawLibrary.length === 0) {
          setPersonaMediaLibrary(Array.isArray(rawLibrary) ? rawLibrary : []);
          return;
        }
        setPersonaMediaLibrary(
          rawLibrary
            .filter((item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object"))
            .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        );
      })
      .catch(() => {
        try {
          const personaKeyFallback = (activePersonaId || userId || "").trim();
          const fallbackRaw = window.localStorage.getItem(
            `composer_generated_media_library_v1:${personaKeyFallback}`
          );
          const fallbackParsed = fallbackRaw ? JSON.parse(fallbackRaw) : [];
          setPersonaMediaLibrary(
            Array.isArray(fallbackParsed)
              ? fallbackParsed.filter(
                  (item): item is PersonaGeneratedMediaRecord =>
                    Boolean(item && typeof item === "object")
                )
              : []
          );
        } catch {
          setPersonaMediaLibrary([]);
        }
      })
      .finally(() => {
        setPersonaMediaLibraryLoading(false);
      });
  }, [activePersonaId, userId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await refreshPersonaMediaLibrary();
      } catch {
        if (!active) return;
      }
    };
    void run();

    const handlePersonaMediaUpdated = (event?: Event) => {
      if (!active) return;
      void refreshPersonaMediaLibrary();
      const experienceId =
        event && "detail" in event && event.detail && typeof (event.detail as { experienceId?: unknown }).experienceId === "string"
          ? ((event.detail as { experienceId?: string }).experienceId as string)
          : undefined;
      if (experienceId) {
        void refreshExperienceFromServer(experienceId).catch(() => undefined);
      }
    };
    const handlePersonaMediaMessage = (event: MessageEvent) => {
      if (!active) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "composer:persona-media-updated") return;
      void refreshPersonaMediaLibrary();
      const experienceId =
        typeof (data as { experienceId?: unknown }).experienceId === "string"
          ? ((data as { experienceId?: string }).experienceId as string)
          : undefined;
      if (experienceId) {
        void refreshExperienceFromServer(experienceId).catch(() => undefined);
      }
    };
    const handlePersonaMediaStorage = (event: StorageEvent) => {
      if (!active) return;
      const personaKey = (activePersonaId || userId || "").trim();
      if (!personaKey) return;
      if (event.key !== `composer_generated_media_library_v1:${personaKey}`) return;
      void refreshPersonaMediaLibrary();
    };
    window.addEventListener("composer:persona-media-updated", handlePersonaMediaUpdated);
    window.addEventListener("message", handlePersonaMediaMessage);
    window.addEventListener("storage", handlePersonaMediaStorage);

    return () => {
      active = false;
      window.removeEventListener("composer:persona-media-updated", handlePersonaMediaUpdated);
      window.removeEventListener("message", handlePersonaMediaMessage);
      window.removeEventListener("storage", handlePersonaMediaStorage);
    };
  }, [activePersonaId, refreshExperienceFromServer, refreshPersonaMediaLibrary, userId]);

  useEffect(() => {
    const handleGenerateImagesMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "composer:generate-images") return;
      const imageGen = asRecord(previewExperience?.configuration?.image_generation);
      const portraitPrompt = typeof imageGen?.portrait_prompt === "string" ? imageGen.portrait_prompt : null;
      const landscapePrompt = typeof imageGen?.landscape_prompt === "string" ? imageGen.landscape_prompt : null;
      const experienceId = previewExperience?.id?.toString().trim();
      if (!experienceId) return;
      void requestImageBundleArtifacts({ experienceId, portraitPrompt, landscapePrompt })
        .then(() => refreshExperienceFromServer(experienceId).catch(() => undefined));
    };
    window.addEventListener("message", handleGenerateImagesMessage);
    return () => window.removeEventListener("message", handleGenerateImagesMessage);
  }, [previewExperience, requestImageBundleArtifacts, refreshExperienceFromServer]);

  const buildComposerChatRequestContext = useCallback(
    (prompt: string) => {
      const lower = prompt.toLowerCase();
      const activePhase =
        experiencePanelTab === "template"
          ? "Template"
          : experiencePanelTab === "customizer"
            ? "Customizer"
            : experiencePanelTab === "resources"
              ? "Resources"
              : studioAnalysisTab === "surfaces"
                ? "Parity Review"
                : studioAnalysisTab === "receipts"
                  ? "Parity Review"
                  : "Experiences";
      const inferredMediaMode =
        /(video|trailer|clip|motion|sora|venice)/.test(lower)
          ? "video"
          : /(article|editorial|reading|read)/.test(lower)
            ? "article"
            : /(image|hero image|illustration|artwork|portrait|landscape|visual)/.test(lower)
              ? "image"
              : "mixed";
      const contextLabel =
        copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
      const activeCodexContext = resolveComposerCodexContext(copilotContextId, contextLabel);

      const selectedProviders = new Set<string>();
      const selectedSkills = new Set<string>();
      const selectedResources: Array<{ id: string; name: string; type: string; provider?: string }> = [];
      const requiredUserInputs = new Set<string>();
      const suggestedPrompts: Record<string, string> = {};

      if (sessionTemplate) {
        sessionTemplate.steps.forEach((step) => {
          const stepValuesForStep = mergedData?.[step.id];
          if (!stepValuesForStep || typeof stepValuesForStep !== "object") return;

          step.ui_config.fields.forEach((field) => {
            const fieldValue = stepValuesForStep[field.id];
            if (
              fieldValue === null ||
              fieldValue === undefined ||
              fieldValue === "" ||
              (Array.isArray(fieldValue) && fieldValue.length === 0)
            ) {
              return;
            }

            const fingerprint = `${field.id} ${field.name}`.toLowerCase();
            const normalizedValues = Array.isArray(fieldValue) ? fieldValue.map(String) : [String(fieldValue)];

            if (fingerprint.includes("provider")) {
              normalizedValues.forEach((value) => selectedProviders.add(value));
            }

            if (fingerprint.includes("skill")) {
              normalizedValues.forEach((value) => selectedSkills.add(value));
            }

            if (
              fingerprint.includes("resource") ||
              fingerprint.includes("tool") ||
              fingerprint.includes("provider") ||
              fingerprint.includes("content") ||
              fingerprint.includes("agent") ||
              fingerprint.includes("model")
            ) {
              selectedResources.push({
                id: `${step.id}:${field.id}`,
                name: field.name,
                type: field.id,
                provider: fingerprint.includes("provider") ? normalizedValues[0] : undefined,
              });
            }

            if (
              fingerprint.includes("wallet") ||
              fingerprint.includes("profile") ||
              fingerprint.includes("email") ||
              fingerprint.includes("user") ||
              fingerprint.includes("consent") ||
              fingerprint.includes("data")
            ) {
              requiredUserInputs.add(field.name);
            }
          });
        });
      }

      const imageGenerationStep = mergedData?.image_generation || {};
      if (typeof imageGenerationStep.portrait_prompt === "string" && imageGenerationStep.portrait_prompt.trim()) {
        suggestedPrompts.imagePortrait = imageGenerationStep.portrait_prompt;
      }
      if (typeof imageGenerationStep.landscape_prompt === "string" && imageGenerationStep.landscape_prompt.trim()) {
        suggestedPrompts.imageLandscape = imageGenerationStep.landscape_prompt;
      }
      const videoPromptStep = mergedData?.video_prompt || {};
      if (typeof videoPromptStep.prompt === "string" && videoPromptStep.prompt.trim()) {
        suggestedPrompts.video = videoPromptStep.prompt;
      }
      const intentStep = mergedData?.intent_timebox || {};
      const resolvedEditableExperienceName =
        editableExperienceName.trim() ||
        (typeof intentStep.experience_name === "string" && intentStep.experience_name.trim()
          ? intentStep.experience_name
          : undefined);
      const generatedAssets = extractGeneratedAssetsFromExperience(
        previewExperience || experience || selectedExperience || null
      );

      const portraitNeeded =
        Boolean(suggestedPrompts.imagePortrait) ||
        /(portrait|vertical|9:16)/.test(lower) ||
        inferredMediaMode === "article";
      const landscapeNeeded =
        Boolean(suggestedPrompts.imageLandscape) ||
        /(landscape|horizontal|16:9|wide)/.test(lower) ||
        inferredMediaMode === "article";

      return {
        mode: "composer",
        domain: "qriptopian",
        persona: "moneypenny",
        composerSessionContext: buildComposerSessionContext({
          sessionId: session?.id || `composer-${Date.now()}`,
          tenantId,
          userId,
          personaId: activePersonaId || userId,
          activeCodexId: activeCodexContext.activeCodexId,
          activeCodexName: activeCodexContext.activeCodexName,
          parentCodexId: activeCodexContext.parentCodexId,
          parentCodexName: activeCodexContext.parentCodexName,
          codexInheritanceMode: activeCodexContext.codexInheritanceMode,
          codexNotes: activeCodexContext.codexNotes,
          currentPhase: activePhase,
          activeExperienceTab:
            experiencePanelTab === "template"
              ? "Template"
              : experiencePanelTab === "customizer"
                ? "Customizer"
                : experiencePanelTab === "resources"
                  ? "Resources"
                  : "Experiences",
          activeResourceSubTab: resourcesPanelTab === "design" ? "Design" : "Experience",
          activeParityTab:
            studioAnalysisTab === "surfaces"
              ? "Surface Planning"
              : studioAnalysisTab === "receipts"
                ? "DVN Receipts"
                : "Design Parity",
          inferredIntent: prompt,
          inferredMediaMode,
          selectedTemplateId: sessionTemplate?.id || selectedTemplate?.id || selectedTemplateId || undefined,
          selectedTemplateName: sessionTemplate?.name || selectedTemplate?.name || undefined,
          candidateTemplateIds: filteredTemplates.slice(0, 6).map((template) => template.id),
          customizationFields:
            currentStep?.id && typeof stepValues === "object" ? stepValues : sessionData,
          suggestedPrompts,
          editableExperienceName: resolvedEditableExperienceName,
          editableImagePortraitPrompt: editableImagePortraitPrompt.trim() || suggestedPrompts.imagePortrait,
          editableImageLandscapePrompt:
            editableImageLandscapePrompt.trim() || suggestedPrompts.imageLandscape,
          editableVideoPrompt: editableVideoPrompt.trim() || suggestedPrompts.video,
          providerBindingMode: "strict",
          selectedProviders: Array.from(selectedProviders),
          selectedSkills: Array.from(selectedSkills),
          selectedResources,
          requiredUserInputs: Array.from(requiredUserInputs),
          generationCostEnvelope: {
            status: "stubbed",
            notes: [
              selectedProviders.size > 0
                ? `Provider path: ${Array.from(selectedProviders).join(", ")}`
                : "Provider path still needs confirmation.",
              selectedSkills.size > 0
                ? `Skill path: ${Array.from(selectedSkills).join(", ")}`
                : "Skill selection still needs confirmation.",
              inferredMediaMode === "video"
                ? "Video generation usually has the highest alpha cost and latency."
                : "Image generation is the cheaper and faster alpha path.",
            ],
          },
          activeDesignQubeId: activeStyleQubeId,
          activeDesignQubeName: designQube?.name,
          designSummary: experienceResourceSummary.resources.map((item) => `${item.label}: ${item.value}`).slice(0, 6),
          orientationAssetPlan: {
            portraitNeeded,
            landscapeNeeded,
            notes: [
              portraitNeeded ? "Portrait assets are part of the current planning context." : "",
              landscapeNeeded ? "Landscape assets are part of the current planning context." : "",
            ].filter(Boolean),
          },
          selectedExperienceQubeId: selectedExperienceId || previewExperience?.id || experience?.id || undefined,
          selectedExperienceQubeName: previewExperience?.name || experience?.name || undefined,
          availableExperienceQubeIds: experiences.slice(0, 10).map((exp) => exp.id),
          previewDevice,
          previewStatus: runtimePreviewLoaded ? "ready" : "idle",
          parityStatus: isParityExpanded ? "ready" : "idle",
          surfacePlanStatus: studioAnalysisTab === "surfaces" ? "ready" : "idle",
          dvnReceiptStatus: studioAnalysisTab === "receipts" ? "ready" : "idle",
          personaContext: {
            id: activePersonaId || userId,
            name: activePersonaName || activePersonaId || userId || "Studio User",
          },
          activeDataQubes: [],
          activeContentQubes: [],
          creatorPersonaId: activePersonaId || userId,
          creatorPersonaName: activePersonaName || activePersonaId || userId || "Studio User",
          generatedAssets,
          deploymentTargets: ["Studio Preview", "MCP App Deployment", "Discord via MCP"],
          recommendedDeploymentTarget: "Studio Preview",
          deploymentReady: Boolean(selectedExperienceId || previewExperience?.id),
          deploymentNotes: [
            "Use Parity Review before deployment when resources or policy posture changed.",
            "Discord and MCP deployment can follow after preview and parity review are satisfactory.",
          ],
        }),
      };
    },
    [
      activeStyleQubeId,
      editableExperienceName,
      editableImageLandscapePrompt,
      editableImagePortraitPrompt,
      editableVideoPrompt,
      activePersonaId,
      activePersonaName,
      copilotContextId,
      copilotContextOptions,
      currentStep?.id,
      designQube?.name,
      experience?.id,
      experience?.name,
      experiencePanelTab,
      experienceResourceSummary.resources,
      experiences,
      filteredTemplates,
      isParityExpanded,
      mergedData,
      previewDevice,
      previewExperience?.id,
      previewExperience?.name,
      selectedExperience,
      resourcesPanelTab,
      runtimePreviewLoaded,
      selectedExperienceId,
      selectedTemplate?.id,
      selectedTemplate?.name,
      selectedTemplateId,
      session?.id,
      sessionData,
      sessionTemplate,
      stepValues,
      studioAnalysisTab,
      tenantId,
      userId,
    ]
  );
  const experiencePanelMeta = useMemo(() => {
    if (experiencePanelTab === "template") {
      return {
        title: "Experience Template",
        icon: <LayoutGrid className="h-4 w-4 text-emerald-300" />,
      };
    }
    if (experiencePanelTab === "customizer") {
      return {
        title: "Experience Customizer",
        icon: <SlidersHorizontal className="h-4 w-4 text-violet-300" />,
      };
    }
    if (experiencePanelTab === "resources") {
      return {
        title: "Experience Resources",
        icon: <Shield className="h-4 w-4 text-cyan-300" />,
      };
    }
    if (experiencePanelTab === "exqubes") {
      return {
        title: "Experiences",
        icon: <Hexagon className="h-4 w-4 text-cyan-300" />,
      };
    }
    return {
      title: "Experience Configurator",
      icon: <LayoutGrid className="h-4 w-4 text-emerald-300" />,
    };
  }, [experiencePanelTab]);
  const parityPanelMeta = useMemo(() => {
    if (studioAnalysisTab === "surfaces") {
      return {
        title: "Surface Planning",
        icon: <LayoutGrid className="h-4 w-4 text-cyan-300" />,
        description: `Configure surface selection and module placement for the ${tenantId} cartridge.`,
      };
    }
    if (studioAnalysisTab === "receipts") {
      return {
        title: "DVN Receipts",
        icon: <ShieldCheck className="h-4 w-4 text-fuchsia-300" />,
        description: "Review proof-linked receipts, audit traces, and runtime-ready settlement records.",
      };
    }
    return {
      title: "Parity Review",
      icon: <Shield className="h-4 w-4 text-fuchsia-300" />,
      description: "Review design parity, policy fit, and runtime readiness before launch.",
    };
  }, [studioAnalysisTab, tenantId]);
  const configuratorTabsListClass =
    "grid h-10 w-full items-center rounded-full border border-white/10 bg-slate-950/60 p-1";
  const configuratorTabTriggerClass =
    "inline-flex h-full items-center justify-center rounded-full px-3 py-0 text-[11px] font-medium leading-none text-slate-400 transition data-[state=active]:border data-[state=active]:border-fuchsia-400/35 data-[state=active]:bg-[linear-gradient(180deg,rgba(217,70,239,0.18),rgba(168,85,247,0.14))] data-[state=active]:text-white data-[state=active]:shadow-[inset_0_0_0_1px_rgba(244,114,182,0.12),0_0_24px_rgba(168,85,247,0.12)] data-[state=active]:backdrop-blur-xl";
  const renderRuntimePreviewShell = () => {
    const shellClasses = `${runtimePreviewShellWidthClass} pointer-events-auto ml-auto flex h-full max-h-full flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.72)]`;

    return (
      <div className={shellClasses}>
        <div className="flex items-center justify-between px-4 pt-2.5">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-[#ff7f50]" />
            <h2 className="text-lg font-semibold text-white">Runtime Preview</h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DevicePreviewSwitcher value={previewDevice} onChange={setPreviewDevice} />
          </div>
        </div>
        {isLegacyVideoProxyUrl(previewRuntimeDeliveryProfile.videoAssetUrl) && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-sky-400" />
            <span className="flex-1">Video generating — open the launcher to track, then reload when done</span>
            <button
              type="button"
              onClick={() => setPreviewNonce(Date.now())}
              className="ml-1 shrink-0 rounded border border-slate-600 bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
            >
              Reload Preview
            </button>
          </div>
        )}
        <div className="flex-1 px-4 pb-4 pt-2.5">
          <div className="relative h-full overflow-hidden rounded-2xl bg-slate-950/70">
            {!runtimePreviewLoaded && !runtimePreviewErrored && (
              <div className="pointer-events-none absolute inset-x-0 mt-3 flex justify-center">
                <div className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
                  Loading runtime preview...
                </div>
              </div>
            )}
            {runtimePreviewErrored && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90">
                <div className="flex flex-col items-center gap-3 text-slate-300">
                  <p className="text-sm">Runtime preview failed to load.</p>
                  <button
                    type="button"
                    onClick={() => setPreviewNonce(Date.now())}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Retry Preview
                  </button>
                </div>
              </div>
            )}
            <div className={runtimePreviewViewportClass}>
              <iframe
                key={`${runtimePreviewSrc}-${previewNonce}`}
                ref={runtimePreviewIframeRef}
                src={runtimePreviewSrc}
                title="Runtime Preview"
                className="h-full w-full border-0"
                loading="eager"
                onLoad={() => {
                  setRuntimePreviewLoaded(true);
                  setRuntimePreviewErrored(false);
                  postRuntimePreviewDeviceContext(previewDevice);
                }}
                onError={() => {
                  setRuntimePreviewLoaded(false);
                  setRuntimePreviewErrored(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900">
      <div className="min-h-screen px-5 py-4">
      <div className="w-full space-y-6">
        <div className="flex min-w-0 items-start gap-3">
          <Hexagon className="mt-0.5 h-6 w-6 shrink-0 text-rose-400" />
          <h1 className="shrink-0 text-xl font-bold text-white">metaMe Studio</h1>
          <span className="min-w-0 text-sm leading-snug text-slate-400">
            Build Experiences using guided templates, the Composer API and receipt pipeline.
          </span>
        </div>

        <div className="relative grid gap-4 lg:grid-cols-3">
          <div
            className={`${cardClass} flex min-h-[700px] max-h-[700px] overflow-hidden flex-col`}
            style={
              designQube
                ? {
                    backgroundColor: styleQubeThemeBg,
                    borderColor: styleQubeThemeBorder,
                    color: styleQubeThemeText,
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-lg font-semibold text-white">Composer Copilot</h2>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-1 items-start justify-start">
              <div className="relative z-[70] h-[632px] w-full max-w-[420px] overflow-hidden rounded-2xl border border-transparent bg-slate-950/60 backdrop-blur-xl flex flex-col md:max-w-full lg:max-w-[420px]">
                <div className="h-full overflow-hidden">
                  <CodexCopilotLayer
                    isOpen
                    onClose={() => {}}
                    variant="embedded"
                    enableInferenceRendering
                    showNavMenu
                    showWalletMenu
                    hideAvatarToggle
                    contextOptions={copilotContextOptions}
                    contextId={copilotContextId}
                    onContextChange={handleCopilotContextChange}
                    initialMessage="What would you like to compose?"
                    inputPanelClassName="rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl px-3 py-3 shadow-lg"
                    inputPanelInputClassName="flex-1 px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                    panelBorder={false}
                    quickPrompts={[
                      "Show all templates",
                      "Create a Qriptopian article with portrait and landscape hero imagery",
                      "Create a short Venice video experience",
                      "Compare OpenAI and Venice for image generation",
                      "Compare OpenAI and Venice for video generation",
                      "Review parity and deployment",
                      "What resources and costs does this experience need?",
                    ]}
                    onPrompt={handleCopilotPrompt}
                    onUserPrompt={handleComposerUserPrompt}
                    getChatRequestContext={buildComposerChatRequestContext}
                    agent={{
                      id: composerAgent.id,
                      name: composerAgent.name,
                      evmSepolia: composerAgent.walletAddresses?.evmAddress as `0x${string}`,
                      evmArb: composerAgent.walletAddresses?.evmAddress as `0x${string}`,
                      btcAddress: composerAgent.walletAddresses?.btcAddress,
                      fioHandle: composerAgent.fioId,
                      walletAddress: composerAgent.walletAddresses?.evmAddress,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div ref={templateCustomizerRef} className={`${cardClass} flex min-h-[700px] max-h-[700px] overflow-hidden flex-col`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {experiencePanelMeta.icon}
                  <h2 className="text-lg font-semibold text-white">{experiencePanelMeta.title}</h2>
                </div>
              </div>
              {templatesLoading && experiencePanelTab === "template" ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
              {session && experiencePanelTab === "customizer" ? (
                <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">{session.status}</span>
              ) : null}
            </div>

            <Tabs value={experiencePanelTab} onValueChange={setExperiencePanelTab} className="mt-4 flex min-h-0 flex-1 flex-col">
              <TabsList className={`${configuratorTabsListClass} grid-cols-4`}>
                <TabsTrigger value="template" className={configuratorTabTriggerClass}>Template</TabsTrigger>
                <TabsTrigger value="customizer" className={configuratorTabTriggerClass}>Customizer</TabsTrigger>
                <TabsTrigger value="resources" className={configuratorTabTriggerClass}>Resources</TabsTrigger>
                <TabsTrigger value="exqubes" className={configuratorTabTriggerClass}>Experiences</TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {templatesError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {templatesError}
                  </div>
                )}
                <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-cyan-300">Bundle Templates</div>
                          <div className="mt-1 text-sm font-semibold text-white">Make bundle authoring</div>
                          <div className="mt-1 text-xs text-slate-300">
                        Apply a bundle template to the selected ExperienceQube to move directly into a multi-block Make flow.
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">
                        Select an ExperienceQube in <span className="text-slate-200">Experiences</span> or open one in{" "}
                        <span className="text-slate-200">Customizer</span> first. That selected ExperienceQube becomes the bundle target.
                      </div>
                    </div>
                    {activeAppliedExperienceBundle ? (
                      <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-[11px] text-cyan-200">
                        Active: {activeAppliedExperienceBundle.bundleTemplateLabel}
                      </span>
                    ) : null}
                    {bundleTemplateTargetExperience ? (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                        Target: {bundleTemplateTargetExperience.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3">
                    {activeExperienceBundlePresets.map((preset) => {
                      const isActive = activeAppliedExperienceBundle?.presetId === preset.id;
                      const isLoading = applyingBundlePresetId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-medium text-white">{preset.bundleTemplateLabel}</div>
                                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                                  {preset.label}
                                </span>
                                {preset.recommended ? (
                                  <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[11px] text-emerald-300">
                                    recommended
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">{preset.summary}</div>
                              <div className="mt-2 text-[11px] text-slate-500">
                                Blocks: {preset.blockKinds.join(" · ")}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? "secondary" : "outline"}
                              disabled={isLoading || !bundleTemplateTargetExperience}
                              onClick={() => void handleApplyBundlePreset(preset.id)}
                              className="border-cyan-400/20 text-xs text-slate-100"
                              title={
                                bundleTemplateTargetExperience
                                  ? `Apply ${preset.bundleTemplateLabel} to ${bundleTemplateTargetExperience.name}`
                                  : "Select an ExperienceQube in Experiences before applying a bundle template."
                              }
                            >
                              {isLoading ? "Applying..." : isActive ? "Reapply bundle" : "Apply bundle"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {!bundleTemplateTargetExperience ? (
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-xs text-slate-400">
                        Select an ExperienceQube in <span className="text-slate-200">Experiences</span> to attach a bundle template and open the corresponding multi-block flow.
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="max-h-[445px] space-y-3 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setExperiencePanelTab("customizer");
                      }}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedTemplateId === template.id
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{template.name}</div>
                          <div className="text-xs text-slate-400">{template.description}</div>
                        </div>
                        <div className="text-xs text-slate-400">{template.estimated_time} min</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full border border-slate-700 px-2 py-0.5">{template.category}</span>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5">{template.complexity}</span>
                        {template.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">{tag}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                  {!templatesLoading && filteredTemplates.length === 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                      No templates match that intent yet. Try a different prompt or clear filters.
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Tenant ID</label>
                    <input
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">User ID</label>
                    <input
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                </div>
                <button
                  onClick={handleStartSession}
                  disabled={!selectedTemplate || isSaving}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-500/40"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Session"}
                </button>
              </TabsContent>

              <TabsContent value="customizer" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {!session && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6">
                    <div className="text-sm font-semibold text-white">
                      {selectedTemplate ? `Customize ${selectedTemplate.name}` : "Start customization"}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {selectedTemplate
                        ? "Start the session to run the full customization flow, including the skill-selection steps."
                        : "Choose a template to begin composing an experience."}
                    </div>
                    {selectedTemplate && (
                      <button
                        onClick={handleStartSession}
                        disabled={isSaving}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-500/40"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Customization"}
                      </button>
                    )}
                  </div>
                )}
                {session && sessionTemplate && (
                  <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
                    {activeAppliedExperienceBundle && activeExperienceBundleSequencingState && (
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Bundle Blocks</div>
                            <div className="mt-3 space-y-2">
                              {activeExperienceBundleSequencingState.blocks.map((block) => (
                                <button
                                  key={block.kind}
                                  type="button"
                                  onClick={() => void handleOpenBundleBlockByKind(block.kind)}
                                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                    block.isActive
                                      ? "border-cyan-400/30 bg-cyan-500/10"
                                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium text-white">{block.label}</div>
                                    {block.isActive ? (
                                      <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-[10px] text-cyan-200">
                                        active
                                      </span>
                                    ) : block.isNext ? (
                                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                                        next
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] ${getBundleStatusClasses(block.status)}`}
                                    >
                                      {block.status.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{block.suggestedAction}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-widest text-cyan-300">Make Bundle</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                  {activeAppliedExperienceBundle.label}
                                </div>
                                <div className="mt-1 text-xs text-slate-300">
                                  {activeAppliedExperienceBundle.bundleTemplateLabel} · {activeAppliedExperienceBundle.bundleTemplateId}
                                </div>
                                <div className="mt-2 text-xs text-slate-300">
                                  {activeExperienceBundleSequencingState.progressLabel}
                                </div>
                                <div className="mt-2 text-xs text-slate-400">
                                  Active block: {activeExperienceBundleSequencingState.activeBlock || "Bundle complete"}
                                </div>
                                {activeExperienceBundleFlowTarget ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Flow: {activeExperienceBundleFlowTarget.templateLabel}
                                  </div>
                                ) : null}
                                {activeExperienceBundleSequencingState.nextBlock ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Next block: {activeExperienceBundleSequencingState.nextBlock}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {bundleCustomizerTargetStepIndex !== null &&
                                bundleCustomizerTargetStepIndex !== (session.current_step || 0) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleJumpToBundleStep()}
                                    disabled={isSaving}
                                    className="border-cyan-400/30 text-cyan-100"
                                  >
                                    Jump to active block
                                  </Button>
                                ) : null}
                                {activeExperienceBundleFlowTarget &&
                                activeExperienceBundleFlowTarget.templateId !== sessionTemplate.id ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleOpenBundleBlockFlow()}
                                    disabled={isSaving}
                                    className="border-fuchsia-400/30 text-fuchsia-100"
                                  >
                                    Open {activeExperienceBundleFlowTarget.label}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {activeExperienceBundleFlowTarget && activeExperienceBundleFlowTarget.templateId !== sessionTemplate.id ? (
                              <div className="mt-3 text-xs text-slate-400">
                                {activeExperienceBundleFlowTarget.summary}
                              </div>
                            ) : null}
                            <div className="mt-4 space-y-3">
                              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Sequencing
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-slate-300">
                                  {activeAppliedExperienceBundle.sequencing.map((step) => (
                                    <div key={step}>{step}</div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Next Actions
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {activeAppliedExperienceBundle.nextActions.map((item) => (
                                    <span
                                      key={item}
                                      className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {activeExperienceBundleSequencingState.activeBlock === "article_draft" ? (
                              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-amber-300">
                                      Article Review Controls
                                    </div>
                                    <div className="mt-1 text-xs text-slate-300">
                                      Accept the current draft, move it back to refinement, or regenerate the bundle review artifact.
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleRefineArticleDraft()}
                                      className="border-slate-700 text-slate-200"
                                    >
                                      Refine
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleRegenerateArticleDraft()}
                                      className="border-cyan-400/30 text-cyan-100"
                                    >
                                      Regenerate
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => void handleAcceptArticleDraft()}
                                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                                    >
                                      Accept Draft
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {activeExperienceBundleSequencingState.activeBlock === "image_generation" ? (
                              <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                                      Image Block Controls
                                    </div>
                                    <div className="mt-1 text-xs text-slate-300">
                                      Continue image work or lock the image block when the hero visuals are final.
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleRefineMediaBlock("image_generation")}
                                      className="border-cyan-400/30 text-cyan-100"
                                    >
                                      Continue
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => void handleAcceptMediaBlock("image_generation")}
                                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                                    >
                                      Mark Locked
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {activeExperienceBundleSequencingState.activeBlock === "video_generation" ? (
                              <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-300">
                                      Video Block Controls
                                    </div>
                                    <div className="mt-1 text-xs text-slate-300">
                                      Continue video work or lock the video block when the motion asset is final.
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleRefineMediaBlock("video_generation")}
                                      className="border-fuchsia-400/30 text-fuchsia-100"
                                    >
                                      Continue
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => void handleAcceptMediaBlock("video_generation")}
                                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                                    >
                                      Mark Locked
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {activeExperienceBundleSequencingState.activeBlock === "deployment" ? (
                              <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                                      Deployment Block Controls
                                    </div>
                                    <div className="mt-1 text-xs text-slate-300">
                                      Review deployment configuration or mark the bundle as deployed.
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleReviewDeploymentBlock()}
                                      className="border-emerald-400/30 text-emerald-100"
                                    >
                                      Review Deployment
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => void handleAcceptDeploymentBlock()}
                                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                                    >
                                      Mark Deployed
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {sessionTemplate.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-start gap-3">
                          {idx <= (session.current_step || 0) ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 text-slate-500" />
                          )}
                          <div>
                            <div className="text-sm text-slate-200">{step.title}</div>
                            <div className="text-xs text-slate-500">{step.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {currentStep && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="mb-2 text-sm font-semibold text-white">{currentStep.title}</div>
                        <div className="mb-4 text-xs text-slate-400">{currentStep.description}</div>
                        <div className="space-y-3">
                          {currentStep.ui_config.fields.map((field) => {
                            const value = stepValues[field.id];
                            const error = getFieldError(field, value);
                            const isContentItemsField = field.id === "content_items";
                            const isContentTagField =
                              field.id.includes("content_tag") || field.name.toLowerCase().includes("content tag");
                            const options = isContentItemsField
                              ? qriptoContentOptions
                              : isContentTagField && field.options
                                ? [
                                    ...field.options,
                                    ...QRIPTO_CONTENT_TAGS.filter(
                                      (tag) => !field.options?.some((opt) => opt.value === tag.value)
                                    ),
                                  ]
                                : isContentTagField
                                  ? QRIPTO_CONTENT_TAGS
                                  : field.options;

                            return (
                              <div key={field.id}>
                                <label className="text-xs text-slate-400">
                                  {field.name} {field.required && <span className="text-rose-400">*</span>}
                                </label>
                                {field.type === "text" && (
                                  <input
                                    value={value || ""}
                                    onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                    className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                      error ? "border-rose-500/60" : "border-slate-800"
                                    }`}
                                  />
                                )}
                                {field.type === "textarea" && (
                                  <textarea
                                    value={value || ""}
                                    onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                    className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                      error ? "border-rose-500/60" : "border-slate-800"
                                    }`}
                                    rows={3}
                                  />
                                )}
                                {field.type === "select" && (
                                  <select
                                    value={value || ""}
                                    onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                    className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                      error ? "border-rose-500/60" : "border-slate-800"
                                    }`}
                                  >
                                    <option value="">Select...</option>
                                    {options?.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {field.type === "multiselect" && (
                                  <div className="mt-2 grid gap-2">
                                    {options?.map((opt) => {
                                      const selected = Array.isArray(value) && value.includes(opt.value);
                                      return (
                                        <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300">
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={(e) => {
                                              const next = new Set(Array.isArray(value) ? value : []);
                                              if (e.target.checked) next.add(opt.value);
                                              else next.delete(opt.value);
                                              updateField(currentStep.id, field.id, Array.from(next));
                                            }}
                                          />
                                          {opt.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                                {field.type === "checkbox" && (
                                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={value === true}
                                      onChange={(e) => updateField(currentStep.id, field.id, e.target.checked)}
                                    />
                                    Enabled
                                  </label>
                                )}
                                {field.type === "slider" && (
                                  <div className="mt-2 space-y-1">
                                    <input
                                      type="range"
                                      min={field.validation?.min ?? 0}
                                      max={field.validation?.max ?? 100}
                                      step={field.validation?.step ?? 1}
                                      value={value ?? field.default_value ?? 0}
                                      onChange={(e) => updateField(currentStep.id, field.id, Number(e.target.value))}
                                      className="w-full"
                                    />
                                    <div className="text-xs text-slate-500">{value ?? field.default_value ?? 0}</div>
                                  </div>
                                )}
                                {error && <div className="mt-1 text-[11px] text-rose-300">{error}</div>}
                                {field.help_text && !error && <div className="mt-1 text-[11px] text-slate-500">{field.help_text}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {summary.length > 0 && (
                      <div className={summaryCardClass}>
                        <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Experience Snapshot</div>
                        <div className="grid gap-2 text-sm text-slate-200">
                          {summary.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-3">
                              <span className="text-slate-400">{item.label}</span>
                              <span className="text-right text-slate-200">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sessionError && (
                      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        {sessionError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleBack}
                        disabled={!session || (session.current_step || 0) === 0 || isSaving}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={!sessionTemplate || !session || !isStepValid || isSaving || (session.current_step || 0) === sessionTemplate.steps.length - 1}
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Next"}
                      </button>
                      <button
                        onClick={handleComplete}
                        disabled={!sessionTemplate || !session || !isStepValid || isCompleting || (session.current_step || 0) !== sessionTemplate.steps.length - 1}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isCompleting ? "Completing..." : "Complete"}
                      </button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resources" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <Tabs value={resourcesPanelTab} onValueChange={setResourcesPanelTab} className="flex min-h-0 h-full flex-col">
                  <TabsList className={`${configuratorTabsListClass} grid-cols-2`}>
                    <TabsTrigger value="experience" className={configuratorTabTriggerClass}>
                      Experience
                    </TabsTrigger>
                    <TabsTrigger value="design" className={configuratorTabTriggerClass}>
                      Design
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="experience" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Editable generation</div>
                            <div className="mt-1 text-sm text-slate-400">
                              Refine the experience name and the generated prompts before review, launch, or regeneration.
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => void handleSaveEditableGeneration()}
                            disabled={isSavingEditableGeneration}
                            className="shrink-0"
                          >
                            {isSavingEditableGeneration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save edits
                          </Button>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-slate-400">Experience name</label>
                            <input
                              value={editableExperienceName}
                              onChange={(event) => setEditableExperienceName(event.target.value)}
                              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50"
                              placeholder="Name this experience"
                            />
                          </div>

                          {(editableImagePortraitPrompt || editableImageLandscapePrompt) && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-slate-400">Portrait prompt</label>
                                <Textarea
                                  value={editableImagePortraitPrompt}
                                  onChange={(event) => setEditableImagePortraitPrompt(event.target.value)}
                                  rows={6}
                                  className="min-h-[144px] border-slate-700 bg-slate-900/70 text-white"
                                  placeholder="Portrait image prompt"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-slate-400">Landscape prompt</label>
                                <Textarea
                                  value={editableImageLandscapePrompt}
                                  onChange={(event) => setEditableImageLandscapePrompt(event.target.value)}
                                  rows={6}
                                  className="min-h-[144px] border-slate-700 bg-slate-900/70 text-white"
                                  placeholder="Landscape image prompt"
                                />
                              </div>
                            </div>
                          )}

                          {editableVideoPrompt && (
                            <div className="space-y-2">
                              <label className="text-xs uppercase tracking-widest text-slate-400">Video prompt</label>
                              <Textarea
                                value={editableVideoPrompt}
                                onChange={(event) => setEditableVideoPrompt(event.target.value)}
                                rows={6}
                                className="min-h-[144px] border-slate-700 bg-slate-900/70 text-white"
                                placeholder="Video generation prompt"
                              />
                            </div>
                          )}

                          {showEditableArticleDraft && (
                            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                              <div>
                                <div className="text-xs uppercase tracking-widest text-slate-400">Article draft</div>
                                <div className="mt-1 text-sm text-slate-400">
                                  Define the copy block that should ship with this Make bundle.
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-slate-400">Article title</label>
                                <input
                                  value={editableArticleTitle}
                                  onChange={(event) => setEditableArticleTitle(event.target.value)}
                                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50"
                                  placeholder="Supporting article title"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-slate-400">Draft scaffold</label>
                                <div className="space-y-2">
                                  {ARTICLE_DRAFT_OUTPUT_OPTIONS.map((option) => {
                                    const selected = editableArticleOutputs.includes(option.value);
                                    return (
                                      <label
                                        key={option.value}
                                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={(event) => {
                                            setEditableArticleOutputs((prev) => {
                                              const next = new Set(prev);
                                              if (event.target.checked) next.add(option.value);
                                              else next.delete(option.value);
                                              return Array.from(next);
                                            });
                                          }}
                                        />
                                        {option.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-slate-400">Article prompt</label>
                                <Textarea
                                  value={editableArticlePrompt}
                                  onChange={(event) => setEditableArticlePrompt(event.target.value)}
                                  rows={5}
                                  className="min-h-[132px] border-slate-700 bg-slate-900/70 text-white"
                                  placeholder="What should the supporting article explain, frame, or teach?"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="text-xs uppercase tracking-widest text-slate-400">Takeaways count</label>
                                  <div className="text-xs text-slate-500">{editableArticleTakeawaysCount}</div>
                                </div>
                                <input
                                  type="range"
                                  min={1}
                                  max={5}
                                  step={1}
                                  value={editableArticleTakeawaysCount}
                                  onChange={(event) => setEditableArticleTakeawaysCount(Number(event.target.value))}
                                  className="w-full"
                                />
                              </div>
                              {editableArticleDraftPreview ? (
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-xs uppercase tracking-widest text-cyan-300">Draft review</div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {editableArticleDraftPreview.title}
                                      </div>
                                    </div>
                                    <span className="rounded-full border border-cyan-400/30 px-2.5 py-1 text-[11px] text-cyan-200">
                                      bundle copy
                                    </span>
                                  </div>
                                  <div className="mt-3 text-sm text-slate-200">
                                    {editableArticleDraftPreview.deck}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-400">
                                    {editableArticleDraftPreview.opening}
                                  </div>
                                  <div className="mt-4 space-y-3">
                                    {editableArticleDraftPreview.sections.map((section) => (
                                      <div
                                        key={section.heading}
                                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                                      >
                                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                          {section.heading}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-300">{section.body}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {editableArticleDraftPreview.takeaways.length > 0 ? (
                                    <div className="mt-4">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                        Takeaways
                                      </div>
                                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                                        {editableArticleDraftPreview.takeaways.map((item) => (
                                          <div key={item}>{item}</div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  {editableArticleDraftPreview.glossary.length > 0 ? (
                                    <div className="mt-4">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                        Glossary
                                      </div>
                                      <div className="mt-2 space-y-2 text-xs text-slate-300">
                                        {editableArticleDraftPreview.glossary.map((item) => (
                                          <div key={item.term}>
                                            <span className="font-medium text-white">{item.term}</span>: {item.definition}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  {editableArticleDraftPreview.nextAction ? (
                                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                                        Next action
                                      </div>
                                      <div className="mt-1">{editableArticleDraftPreview.nextAction}</div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={summaryCardClass}>
                        <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Session envelope</div>
                        <div className="space-y-2 text-sm text-slate-200">
                          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Template chosen</span><span>{selectedTemplate?.name || "Not selected"}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Tenant</span><span>{tenantId}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">User</span><span>{userId}</span></div>
                          {activeExperienceResourceSummary.resources
                            .filter((item) => item.label === "Model selected")
                            .slice(0, 1)
                            .map((item) => (
                              <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3">
                                <span className="text-slate-400">{item.label}</span>
                                <span>{item.value}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-sm font-semibold text-white">Skills selected in customization</div>
                        <div className="mt-3 space-y-2">
                          {activeExperienceResourceSummary.skills.length > 0 ? (
                            activeExperienceResourceSummary.skills.map((item) => (
                              <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                                <span className="text-slate-400">{item.label}</span>
                                <span className="text-right">{item.value}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">Skill selections from the customization flow will appear here.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-sm font-semibold text-white">Experience resources</div>
                        <div className="mt-2 text-sm text-slate-400">
                          Registry-backed resources and template-configured dependencies will be collected here.
                        </div>
                        <div className="mt-3 space-y-2">
                          {activeExperienceResourceSummary.resources.length > 0 ? (
                            activeExperienceResourceSummary.resources.map((item) => (
                              <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                                <span className="text-slate-400">{item.label}</span>
                                <span className="text-right">{item.value}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                              <span className="rounded-full border border-slate-700 px-2 py-1">DataQubes</span>
                              <span className="rounded-full border border-slate-700 px-2 py-1">ToolQubes</span>
                              <span className="rounded-full border border-slate-700 px-2 py-1">SkillQubes</span>
                              <span className="rounded-full border border-slate-700 px-2 py-1">BrowserQube</span>
                              <span className="rounded-full border border-slate-700 px-2 py-1">Voice stub</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Persona media library</div>
                            <div className="mt-2 text-sm text-slate-400">
                              Recently generated persona-scoped media saved from Composer experiences.
                            </div>
                          </div>
                          <div className="text-xs uppercase tracking-widest text-slate-500">
                            {(activePersonaName || activePersonaId || userId || "persona").slice(0, 32)}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 p-1">
                            <button
                              type="button"
                              onClick={() => setPersonaMediaScopeFilter("all")}
                              className={`rounded-full px-3 py-1 text-xs transition ${
                                personaMediaScopeFilter === "all"
                                  ? "bg-fuchsia-500/20 text-fuchsia-100"
                                  : "text-slate-400 hover:text-white"
                              }`}
                            >
                              All assets
                            </button>
                            <button
                              type="button"
                              onClick={() => setPersonaMediaScopeFilter("active")}
                              className={`rounded-full px-3 py-1 text-xs transition ${
                                personaMediaScopeFilter === "active"
                                  ? "bg-fuchsia-500/20 text-fuchsia-100"
                                  : "text-slate-400 hover:text-white"
                              }`}
                            >
                              Active experience
                            </button>
                          </div>
                          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 p-1">
                            {(["all", "image", "video"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setPersonaMediaTypeFilter(value)}
                                className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                                  personaMediaTypeFilter === value
                                    ? "bg-cyan-500/20 text-cyan-100"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                {value === "all" ? "All media" : value}
                              </button>
                            ))}
                          </div>
                          <div className="text-xs text-slate-500">
                            Showing {filteredPersonaMediaLibrary.length} of {personaMediaLibrary.length}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowArchivedPersonaMedia((value) => !value)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              showArchivedPersonaMedia
                                ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                                : "border-slate-700 text-slate-400 hover:text-white"
                            }`}
                          >
                            {showArchivedPersonaMedia ? "Hide archived" : "Show archived"}
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {personaMediaLibraryLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading saved media...
                            </div>
                          ) : filteredPersonaMediaLibrary.length > 0 ? (
                            filteredPersonaMediaLibrary.slice(0, 8).map((item) => (
                              <div
                                key={item.id}
                                className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-200 md:grid-cols-[140px_minmax(0,1fr)]"
                              >
                                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
                                  {item.assetUrl ? (
                                    item.type === "video" && canInlineVideoUri(item.assetUrl) ? (
                                      <video
                                        src={item.assetUrl}
                                        className="h-28 w-full object-cover"
                                        muted
                                        playsInline
                                        preload="metadata"
                                      />
                                    ) : item.type === "video" ? (
                                      <div className="flex h-28 items-center justify-center text-xs text-slate-500">
                                        Saved video
                                      </div>
                                    ) : (
                                      <img
                                        src={item.assetUrl}
                                        alt={item.label}
                                        className="h-28 w-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    )
                                  ) : (
                                    <div className="flex h-28 items-center justify-center text-xs text-slate-500">
                                      Saved asset
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  {editingPersonaMediaId === item.id ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={editingPersonaMediaLabel}
                                        onChange={(event) => setEditingPersonaMediaLabel(event.target.value)}
                                        className="h-8 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-sm text-white outline-none transition focus:border-fuchsia-400/50 md:min-w-[220px]"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-slate-700 bg-transparent px-2 text-xs text-slate-200"
                                        disabled={savingPersonaMediaLabelId === item.id}
                                        onClick={() => void handleSavePersonaMediaLabel(item)}
                                      >
                                        {savingPersonaMediaLabelId === item.id ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : null}
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-xs text-slate-400 hover:text-white"
                                        onClick={() => {
                                          setEditingPersonaMediaId(null);
                                          setEditingPersonaMediaLabel("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="truncate font-medium text-white">{item.label}</div>
                                  )}
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                                      {item.type === "video" ? "Video" : "Image"}
                                    </span>
                                    {item.orientation ? (
                                      <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                                        {item.orientation}
                                      </span>
                                    ) : null}
                                    {item.provider ? (
                                      <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                                        {item.provider}
                                      </span>
                                    ) : null}
                                    {item.archivedAt ? (
                                      <span className="rounded-full border border-amber-400/40 px-2 py-1 text-amber-300">
                                        archived
                                      </span>
                                    ) : null}
                                    {activeExperienceForEditing?.id && item.pinnedToExperienceId === activeExperienceForEditing.id ? (
                                      <span className="rounded-full border border-fuchsia-400/40 px-2 py-1 text-fuchsia-300">
                                        pinned to active experience
                                      </span>
                                    ) : null}
                                    {activeExperienceForEditing?.id && item.experienceId === activeExperienceForEditing.id ? (
                                      <span className="rounded-full border border-emerald-400/40 px-2 py-1 text-emerald-300">
                                        generated for active experience
                                      </span>
                                    ) : null}
                                    {activeExperienceForEditing?.id && item.lastUsedInExperienceId === activeExperienceForEditing.id ? (
                                      <span className="rounded-full border border-cyan-400/40 px-2 py-1 text-cyan-300">
                                        last reused in active experience
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                  <div className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                                    {item.lastAction ? <div>State: {item.lastAction}</div> : null}
                                    {typeof item.useCount === "number" && item.useCount > 0 ? (
                                      <div>Reused: {item.useCount}</div>
                                    ) : null}
                                    {typeof item.previewCount === "number" && item.previewCount > 0 ? (
                                      <div>Previewed: {item.previewCount}</div>
                                    ) : null}
                                    {typeof item.launchCount === "number" && item.launchCount > 0 ? (
                                      <div>Launched: {item.launchCount}</div>
                                    ) : null}
                                    {item.lastDeliveryTarget ? <div>Delivered via: {item.lastDeliveryTarget}</div> : null}
                                    {Array.isArray(item.deliveryTargets) && item.deliveryTargets.length > 0 ? (
                                      <div className="sm:col-span-2">Targets: {item.deliveryTargets.join(" / ")}</div>
                                    ) : null}
                                    {item.lastUsedAt ? (
                                      <div>Last used: {new Date(item.lastUsedAt).toLocaleString()}</div>
                                    ) : null}
                                    {item.lastPreviewAt ? (
                                      <div>Last preview: {new Date(item.lastPreviewAt).toLocaleString()}</div>
                                    ) : null}
                                    {item.lastLaunchAt ? (
                                      <div>Last launch: {new Date(item.lastLaunchAt).toLocaleString()}</div>
                                    ) : null}
                                    {item.updatedAt ? (
                                      <div>Updated: {new Date(item.updatedAt).toLocaleString()}</div>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {editingPersonaMediaId !== item.id ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-slate-700 bg-transparent px-2 text-xs text-slate-200 hover:border-fuchsia-400/60 hover:bg-slate-900"
                                        onClick={() => handleStartEditingPersonaMedia(item)}
                                      >
                                        Rename
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-slate-700 bg-transparent px-2 text-xs text-slate-200 hover:border-amber-400/60 hover:bg-slate-900"
                                      disabled={archivingPersonaMediaId === item.id}
                                      onClick={() => void handleToggleArchivePersonaMedia(item)}
                                    >
                                      {archivingPersonaMediaId === item.id ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : null}
                                      {item.archivedAt ? "Unarchive" : "Archive"}
                                    </Button>
                                    {activeExperienceForEditing?.id ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-slate-700 bg-transparent px-2 text-xs text-slate-200 hover:border-fuchsia-400/60 hover:bg-slate-900"
                                        disabled={pinningPersonaMediaId === item.id}
                                        onClick={() => void handleTogglePersonaMediaPin(item)}
                                      >
                                        {pinningPersonaMediaId === item.id ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : null}
                                        {item.pinnedToExperienceId === activeExperienceForEditing.id ? "Unpin" : "Pin"}
                                      </Button>
                                    ) : null}
                                    {activeExperienceForEditing?.id && item.assetUrl ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-slate-700 bg-transparent px-2 text-xs text-slate-200 hover:border-fuchsia-400/60 hover:bg-slate-900"
                                        disabled={applyingPersonaMediaId === item.id}
                                        onClick={() => void handleUsePersonaMediaInExperience(item)}
                                      >
                                        {applyingPersonaMediaId === item.id ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : null}
                                        Use in experience
                                      </Button>
                                    ) : null}
                                    {item.assetUrl ? (
                                      <a
                                        href={item.assetUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-fuchsia-400/60 hover:text-white"
                                      >
                                        Open
                                      </a>
                                    ) : (
                                      <span className="text-xs text-slate-500">Saved</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : personaMediaLibrary.length > 0 ? (
                            <div className="text-sm text-slate-400">
                              No saved media matches the current library filters.
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400">
                              Generated image and video assets will appear here once they are saved for the active persona.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Block composition readiness</div>
                            <div className="mt-1 text-sm text-slate-400">
                              Phase 4 foundation view of this ExperienceQube as reusable image, video, article, and deployment blocks.
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${
                              activeExperienceBlockManifest.primaryFlow === "compound_ready"
                                ? "border-emerald-400/40 text-emerald-300"
                                : "border-slate-700 text-slate-300"
                            }`}
                          >
                            {activeExperienceBlockManifest.primaryFlow === "compound_ready"
                              ? "compound-ready"
                              : "single-block foundation"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            {activeExperienceBlockManifest.blocks.length > 0 ? (
                              activeExperienceBlockManifest.blocks.map((block) => (
                                <div
                                  key={block.id}
                                  className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3 text-sm text-slate-200"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium text-white">{block.label}</div>
                                    <span
                                      className={
                                        block.state === "ready"
                                          ? "text-emerald-300"
                                          : block.state === "partial"
                                            ? "text-amber-200"
                                            : "text-fuchsia-200"
                                      }
                                    >
                                      {block.state}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                                    <div>Inputs: {block.inputs.join(" · ")}</div>
                                    <div>Outputs: {block.outputs.join(" · ")}</div>
                                    {block.dependsOn.length > 0 ? (
                                      <div className="sm:col-span-2">Depends on: {block.dependsOn.join(" · ")}</div>
                                    ) : null}
                                    {block.evidence.length > 0 ? (
                                      <div className="sm:col-span-2">Evidence: {block.evidence.join(" · ")}</div>
                                    ) : null}
                                    {block.notes.length > 0 ? (
                                      <div className="sm:col-span-2 text-slate-500">Notes: {block.notes.join(" · ")}</div>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-400">
                                No composition blocks are inferred yet for this ExperienceQube.
                              </div>
                            )}
                          </div>
                          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3 text-sm text-slate-200">
                            <div>
                              <div className="font-medium text-white">Sequencing</div>
                              <div className="mt-2 space-y-2 text-xs text-slate-400">
                                {activeExperienceBlockManifest.sequencing.map((step) => (
                                  <div key={step}>{step}</div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-white">Next composition opportunities</div>
                              <div className="mt-2 space-y-2 text-xs text-slate-400">
                                {activeExperienceBlockManifest.nextCompositionOpportunities.map((item) => (
                                  <div key={item}>{item}</div>
                                ))}
                              </div>
                            </div>
                            <div className="border-t border-slate-800 pt-3">
                              <div className="font-medium text-white">Make bundle presets</div>
                              <div className="mt-2 space-y-3">
                                {activeAppliedExperienceBundle ? (
                                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3 text-xs text-cyan-100">
                                    <div className="font-medium text-white">
                                      Active bundle: {activeAppliedExperienceBundle.label}
                                    </div>
                                    <div className="mt-1 text-cyan-100/80">
                                      {activeAppliedExperienceBundle.summary}
                                    </div>
                                    <div className="mt-2 text-cyan-100/70">
                                      Applied{" "}
                                      {activeAppliedExperienceBundle.appliedAt
                                        ? new Date(activeAppliedExperienceBundle.appliedAt).toLocaleString()
                                        : "recently"}
                                    </div>
                                  </div>
                                ) : null}
                                {activeExperienceBundlePresets.map((preset) => {
                                  const isActive = activeAppliedExperienceBundle?.presetId === preset.id;
                                  const isLoading = applyingBundlePresetId === preset.id;
                                  return (
                                    <div
                                      key={preset.id}
                                      className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-medium text-white">{preset.label}</div>
                                            <span
                                              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                                preset.recommended
                                                  ? "border-emerald-400/30 text-emerald-300"
                                                  : "border-slate-700 text-slate-400"
                                              }`}
                                            >
                                              {preset.recommended ? "recommended" : "available"}
                                            </span>
                                            {isActive ? (
                                              <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-[11px] text-cyan-300">
                                                active
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="mt-1 text-xs text-slate-400">{preset.summary}</div>
                                          <div className="mt-2 text-[11px] text-slate-500">
                                            Blocks: {preset.blockKinds.join(" · ")}
                                          </div>
                                          <div className="mt-1 text-[11px] text-slate-500">
                                            Bundle template: {preset.bundleTemplateLabel}
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={isActive ? "secondary" : "outline"}
                                          disabled={isLoading}
                                          onClick={() => void handleApplyBundlePreset(preset.id)}
                                          className="border-slate-700 text-xs text-slate-200"
                                        >
                                          {isLoading ? "Applying..." : isActive ? "Reapply" : "Apply"}
                                        </Button>
                                      </div>
                                      <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                                        {preset.sequencing.map((step) => (
                                          <div key={step}>{step}</div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-sm font-semibold text-white">End-user data requirements</div>
                        <div className="mt-3 space-y-2">
                          {activeExperienceResourceSummary.userData.length > 0 ? (
                            activeExperienceResourceSummary.userData.map((item) => (
                              <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                                <span className="text-slate-400">{item.label}</span>
                                <span className="text-right">{item.value}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">Required end-user data and consent inputs will be listed here once they are defined.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
                        <div className="text-sm font-semibold text-white">Cost envelope</div>
                        <div className="mt-2 text-sm text-slate-400">
                          Skill costs, runtime resource fees, and user-facing charges are not defined yet. This section is stubbed for later pricing integration.
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Deployment guidance</div>
                            <div className="mt-1 text-sm text-slate-300">
                              Recommended path: {getDeploymentTargetLabel(routingEnvelope.recommendedTarget)}
                            </div>
                            <div className="mt-1 text-sm text-slate-400">{routingEnvelope.summary}</div>
                          </div>
                          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                            Trust + Cost Envelope
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                          {deploymentTargetCards.map((target) => (
                            <div
                              key={target.id}
                              className={`rounded-lg border px-3 py-3 text-sm ${
                                target.ready
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-amber-500/20 bg-amber-500/5"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-white">{target.label}</span>
                                <span className={target.ready ? "text-emerald-300" : "text-amber-300"}>
                                  {target.ready ? "ready" : "blocked"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-400">{target.note}</div>
                              <div className={`mt-1 text-[11px] ${getCapabilityToneClass(target.capabilityState)}`}>
                                {getCapabilityLabel(target.capabilityState)}: {target.capabilitySummary}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
                                <span>trust {target.trustScore}/5</span>
                                <span>cost {target.costScore}/5</span>
                                <span>fit {target.suitabilityScore}</span>
                              </div>
                              {target.watchouts.length > 0 ? (
                                <div className="mt-2 text-[11px] text-amber-200/90">
                                  {target.watchouts.join(" · ")}
                                </div>
                              ) : null}
                              {target.latest ? (
                                <div className="mt-2 text-[11px] text-slate-500">
                                  Last result: {target.latest.status}
                                  {target.latest.mode ? ` · ${target.latest.mode}` : ""}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Adapter coverage</div>
                            <div className="mt-1 text-sm text-slate-400">
                              Active and planned deployment adapters on the universal deployment contract.
                            </div>
                          </div>
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                            3D-B proof surfaces
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {deploymentAdapterCatalog.map((adapter) => (
                            <div
                              key={adapter.adapter}
                              className={`rounded-lg border px-3 py-3 text-sm ${
                                adapter.availability === "active"
                                  ? "border-slate-800 bg-slate-900/50"
                                  : "border-dashed border-slate-700 bg-slate-950/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-white">{adapter.label}</div>
                                <span
                                  className={
                                    adapter.availability === "active"
                                      ? "text-emerald-300"
                                      : "text-fuchsia-200"
                                  }
                                >
                                  {adapter.availability}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-400">{adapter.note}</div>
                              {adapter.supportedTargets.length > 0 ? (
                                <div className="mt-2 text-[11px] text-slate-500">
                                  Targets: {adapter.supportedTargets.map((target) => getDeploymentTargetLabel(target)).join(" · ")}
                                </div>
                              ) : (
                                <div className="mt-2 text-[11px] text-slate-500">Targets: planned</div>
                              )}
                              {adapter.supportedVariants.length > 0 ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  Variants: {adapter.supportedVariants.map((variant) => getDeliveryVariantLabel(variant)).join(" · ")}
                                </div>
                              ) : (
                                <div className="mt-1 text-[11px] text-slate-500">Variants: planned</div>
                              )}
                              {Array.isArray(adapter.onboarding) && adapter.onboarding.length > 0 ? (
                                <div className="mt-2 text-[11px] text-slate-400">
                                  Next: {adapter.onboarding.join(" · ")}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-sm font-semibold text-white">Latest deployment proof</div>
                        <div className="mt-3 space-y-2">
                          {activeExperienceDeploymentState ? (
                            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3 text-sm text-slate-200">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-white">
                                  {getDeploymentTargetLabel(
                                    String(activeExperienceDeploymentState.last_target || "studio_preview") as ComposerDeploymentTarget,
                                  )}
                                </span>
                                <div className="flex items-center gap-3">
                                  {activeExperienceDeploymentState.last_capability_state ? (
                                    <span className={getCapabilityToneClass(String(activeExperienceDeploymentState.last_capability_state))}>
                                      {getCapabilityLabel(String(activeExperienceDeploymentState.last_capability_state))}
                                    </span>
                                  ) : null}
                                  <span
                                    className={
                                      String(activeExperienceDeploymentState.last_status || "") === "failed"
                                        ? "text-rose-300"
                                        : "text-emerald-300"
                                    }
                                  >
                                    {String(activeExperienceDeploymentState.last_status || "unknown")}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                                {activeExperienceDeploymentState.last_capability_summary ? (
                                  <div className="sm:col-span-2">
                                    Capability: {String(activeExperienceDeploymentState.last_capability_summary)}
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_adapter_declaration &&
                                typeof activeExperienceDeploymentState.last_adapter_declaration === "object" ? (
                                  <>
                                    <div>
                                      Adapter: {String((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).label || (activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).adapter || "Unknown")}
                                    </div>
                                    <div>
                                      Availability: {String((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).availability || "active")}
                                    </div>
                                    {Array.isArray((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedModes) &&
                                    ((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedModes as unknown[]).length > 0 ? (
                                      <div className="sm:col-span-2">
                                        Supported modes: {((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedModes as unknown[]).join(" · ")}
                                      </div>
                                    ) : null}
                                    {Array.isArray((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedVariants) &&
                                    ((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedVariants as unknown[]).length > 0 ? (
                                      <div className="sm:col-span-2">
                                        Supported variants: {((activeExperienceDeploymentState.last_adapter_declaration as Record<string, any>).supportedVariants as unknown[]).join(" · ")}
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                                {activeExperienceDeploymentState.last_destination_adapter ? (
                                  <div>
                                    Destination adapter: {String(activeExperienceDeploymentState.last_destination_adapter)}
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_delivery_mode ? (
                                  <div>
                                    Delivery mode: {String(activeExperienceDeploymentState.last_delivery_mode)}
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_provider ? (
                                  <div>Provider: {String(activeExperienceDeploymentState.last_provider)}</div>
                                ) : null}
                                {activeExperienceDeploymentState.last_variant ? (
                                  <div>Variant: {String(activeExperienceDeploymentState.last_variant)}</div>
                                ) : null}
                                {activeExperienceDeploymentState.last_destination_surface ? (
                                  <div>Surface: {String(activeExperienceDeploymentState.last_destination_surface)}</div>
                                ) : null}
                                {activeExperienceDeploymentState.last_mode ? (
                                  <div>Mode: {String(activeExperienceDeploymentState.last_mode)}</div>
                                ) : null}
                                {Array.isArray(activeExperienceDeploymentState.last_capability_constraints) &&
                                activeExperienceDeploymentState.last_capability_constraints.length > 0 ? (
                                  <div className="sm:col-span-2 text-amber-200/90">
                                    Constraints: {activeExperienceDeploymentState.last_capability_constraints.join(" · ")}
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_runtime_profile &&
                                typeof activeExperienceDeploymentState.last_runtime_profile === "object" ? (
                                  <>
                                    <div>
                                      Intent: {String((activeExperienceDeploymentState.last_runtime_profile as Record<string, any>).intent || "read")}
                                    </div>
                                    <div>
                                      Quick link: {String((activeExperienceDeploymentState.last_runtime_profile as Record<string, any>).quickLink || "read")}
                                    </div>
                                    <div className="sm:col-span-2">
                                      Codex: {String(((activeExperienceDeploymentState.last_runtime_profile as Record<string, any>).codexContext as Record<string, any> | undefined)?.activeCodexName || ((activeExperienceDeploymentState.last_runtime_profile as Record<string, any>).codexContext as Record<string, any> | undefined)?.activeCodexId || "Unknown")}
                                    </div>
                                    <div>Cartridge: {String((activeExperienceDeploymentState.last_runtime_profile as Record<string, any>).runtimeCartridge || "metame")}</div>
                                  </>
                                ) : null}
                                {activeExperienceDeploymentState.last_deployed_at ? (
                                  <div>
                                    At: {new Date(String(activeExperienceDeploymentState.last_deployed_at)).toLocaleString()}
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_publish_url ? (
                                  <div className="sm:col-span-2">
                                    Publish:{" "}
                                    <a
                                      href={String(activeExperienceDeploymentState.last_publish_url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-cyan-200 underline underline-offset-2"
                                    >
                                      Open publish surface
                                    </a>
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_launch_url ? (
                                  <div className="sm:col-span-2">
                                    Launch:{" "}
                                    <a
                                      href={String(activeExperienceDeploymentState.last_launch_url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-cyan-200 underline underline-offset-2"
                                    >
                                      Open launch surface
                                    </a>
                                  </div>
                                ) : null}
                                {activeExperienceDeploymentState.last_error ? (
                                  <div className="sm:col-span-2 text-rose-300">
                                    Error: {String(activeExperienceDeploymentState.last_error)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400">
                              No deployment proof is recorded yet for this ExperienceQube.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-sm font-semibold text-white">Deployment history</div>
                        <div className="mt-3 space-y-2">
                          {activeExperienceDeploymentHistory.length > 0 ? (
                            activeExperienceDeploymentHistory.map((entry) => (
                              <div
                                key={String(entry.id || `${entry.target}-${entry.deployed_at}`)}
                                className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-200"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-white">
                                    {getDeploymentTargetLabel(String(entry.target) as ComposerDeploymentTarget)}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    {entry.capability_state ? (
                                      <span className={getCapabilityToneClass(String(entry.capability_state))}>
                                        {getCapabilityLabel(String(entry.capability_state))}
                                      </span>
                                    ) : null}
                                    <span
                                      className={
                                        entry.status === "failed" ? "text-rose-300" : "text-emerald-300"
                                      }
                                    >
                                      {String(entry.status || "unknown")}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                                  {entry.capability_summary ? (
                                    <div className="sm:col-span-2">
                                      Capability: {String(entry.capability_summary)}
                                    </div>
                                  ) : null}
                                  {entry.adapter_declaration && typeof entry.adapter_declaration === "object" ? (
                                    <>
                                      <div>
                                        Adapter: {String((entry.adapter_declaration as Record<string, any>).label || (entry.adapter_declaration as Record<string, any>).adapter || "Unknown")}
                                      </div>
                                      <div>
                                        Availability: {String((entry.adapter_declaration as Record<string, any>).availability || "active")}
                                      </div>
                                    </>
                                  ) : null}
                                  {entry.destination_adapter ? <div>Destination adapter: {String(entry.destination_adapter)}</div> : null}
                                  {entry.delivery_mode ? <div>Delivery mode: {String(entry.delivery_mode)}</div> : null}
                                  {entry.provider ? <div>Provider: {String(entry.provider)}</div> : null}
                                  {entry.variant ? <div>Variant: {String(entry.variant)}</div> : null}
                                  {entry.destination_surface ? <div>Surface: {String(entry.destination_surface)}</div> : null}
                                  {entry.mode ? <div>Mode: {String(entry.mode)}</div> : null}
                                  {Array.isArray(entry.capability_constraints) && entry.capability_constraints.length > 0 ? (
                                    <div className="sm:col-span-2 text-amber-200/90">
                                      Constraints: {entry.capability_constraints.join(" · ")}
                                    </div>
                                  ) : null}
                                  {entry.deployed_at ? (
                                    <div>At: {new Date(String(entry.deployed_at)).toLocaleString()}</div>
                                  ) : null}
                                  {entry.runtime_profile && typeof entry.runtime_profile === "object" ? (
                                    <>
                                      <div>Intent: {String((entry.runtime_profile as Record<string, any>).intent || "read")}</div>
                                      <div>Quick link: {String((entry.runtime_profile as Record<string, any>).quickLink || "read")}</div>
                                    </>
                                  ) : null}
                                  {entry.source ? <div>Source: {String(entry.source)}</div> : null}
                                  {entry.publish_url ? (
                                    <div className="sm:col-span-2 truncate">Publish: {String(entry.publish_url)}</div>
                                  ) : null}
                                  {entry.error ? (
                                    <div className="sm:col-span-2 text-rose-300">Error: {String(entry.error)}</div>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">
                              Deployment actions will appear here once this ExperienceQube has been dispatched or simulated.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="design" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div
                      className="rounded-xl border p-4"
                      style={
                        designQube
                          ? {
                              backgroundColor: styleQubeThemeBg,
                              borderColor: styleQubeThemeBorder,
                              color: styleQubeThemeText,
                            }
                          : undefined
                      }
                    >
                      {designQube ? (
                        <>
                          <div
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2"
                            style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: styleQubeThemeText }}>
                              <select
                                value={activeStyleQubeId}
                                onChange={(e) => handleDesignQubeSelection(e.target.value)}
                                className="rounded-md border border-white/10 bg-slate-950/40 px-2 py-1 text-xs text-white/90"
                                style={{ borderColor: styleQubeThemeBorder, backgroundColor: styleQubeThemeBg }}
                              >
                                {designQubeOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="inline-flex items-center rounded-full border px-2 py-0.5"
                                title={designQube.manifest?.authorityLevel || "guidance"}
                                style={{ borderColor: styleQubeThemeBorder }}
                              >
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDesignTheme("light")}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designTheme === "light" ? "border-amber-300/60 bg-amber-500/10" : ""}`}
                                title="Light theme"
                                style={designTheme === "light" ? undefined : { borderColor: styleQubeThemeBorder }}
                              >
                                <Sun className="h-3.5 w-3.5 text-amber-300" />
                              </button>
                              <button
                                onClick={() => setDesignTheme("dark")}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designTheme === "dark" ? "border-slate-300/60 bg-slate-500/10" : ""}`}
                                title="Dark theme"
                                style={designTheme === "dark" ? undefined : { borderColor: styleQubeThemeBorder }}
                              >
                                <Moon className="h-3.5 w-3.5 text-slate-300" />
                              </button>
                              <button
                                onClick={() => setDesignQubeSummaryLayout("compact")}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designQubeSummaryLayout === "compact" ? "border-cyan-300/60 bg-cyan-500/10" : ""}`}
                                title="Row view"
                                style={designQubeSummaryLayout === "compact" ? undefined : { borderColor: styleQubeThemeBorder }}
                              >
                                <List size={14} className="text-cyan-300" />
                              </button>
                              <button
                                onClick={() => setDesignQubeSummaryLayout("grid")}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designQubeSummaryLayout === "grid" ? "border-cyan-300/60 bg-cyan-500/10" : ""}`}
                                title="Grid view"
                                style={designQubeSummaryLayout === "grid" ? undefined : { borderColor: styleQubeThemeBorder }}
                              >
                                <LayoutGrid size={14} className="text-cyan-300" />
                              </button>
                              <button
                                onClick={() => setDesignQubeCollapsed((prev) => !prev)}
                                className="inline-flex items-center rounded-full border px-2 py-0.5"
                                title={designQubeCollapsed ? "Expand details" : "Collapse details"}
                                style={{ borderColor: styleQubeThemeBorder }}
                              >
                                {designQubeCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                              </button>
                            </div>
                          </div>

                          {(() => {
                            const themeTokens = designQube.tokens?.themes?.[designTheme];
                            const colors = themeTokens?.color || {};
                            const palette = [
                              colors.bg,
                              colors.surface,
                              colors.accent,
                              colors.text,
                              colors.muted,
                              colors.border,
                            ].filter(Boolean) as string[];
                            const resolvedPalette =
                              palette.length > 0
                                ? palette
                                : ["#020617", "#0f172a", "#1d4ed8", "#f8fafc", "#94a3b8", "rgba(148,163,184,0.2)"];
                            const radiusValues = designQube.tokens?.radius
                              ? Object.values(designQube.tokens.radius).slice(0, 3)
                              : [];
                            const fontFamily = designQube.tokens?.typography?.fontFamily?.sans || "system-ui";
                            const scale = designQube.tokens?.typography?.scale || {};
                            const glassEnabled = designQube.constraints?.material?.glass?.enabled;
                            const summaryBadges = designQube.manifest?.themes || [];

                            return designQubeCollapsed ? (
                              <div className="mt-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: styleQubeThemeText }}>
                                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: styleQubeThemeBorder }}>
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                                  </span>
                                  {summaryBadges.map((theme) => (
                                    <span key={theme} className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: styleQubeThemeBorder }}>
                                      {theme.toLowerCase().includes("light") ? (
                                        <Sun className="h-3.5 w-3.5 text-amber-300" />
                                      ) : (
                                        <Moon className="h-3.5 w-3.5 text-slate-300" />
                                      )}
                                    </span>
                                  ))}
                                  {glassEnabled && (
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: styleQubeThemeBorder }} title="Glass material">
                                      <Moon className="h-3.5 w-3.5 text-slate-400" />
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {resolvedPalette.slice(0, 6).map((color, idx) => (
                                    <span
                                      key={`${color}-${idx}`}
                                      className="h-5 w-5 rounded-md border"
                                      style={{ backgroundColor: color, borderColor: styleQubeThemeBorder }}
                                      title={color}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span style={{ fontFamily, fontSize: scale.xl || 22 }} className="text-white">Aa</span>
                                  <span style={{ fontFamily, fontSize: scale.sm || 14 }} className="text-slate-400">Aa</span>
                                  <div className="ml-auto flex items-center gap-2">
                                    {radiusValues.map((radius, idx) => (
                                      <div
                                        key={`radius-grid-${idx}`}
                                        className="h-6 w-12 border"
                                        style={{ borderRadius: `${radius}px`, backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}
                                        title={`radius ${radius}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center justify-end gap-2" title="Experience Modalities">
                                  <div className="rounded-lg border border-blue-400/60 bg-blue-400/10 p-2">
                                    <Eye className="h-4 w-4 text-blue-300" />
                                  </div>
                                  <div className="rounded-lg border border-green-400/60 bg-green-400/10 p-2">
                                    <Volume2 className="h-4 w-4 text-green-300" />
                                  </div>
                                  <div className="rounded-lg border border-purple-400/60 bg-purple-400/10 p-2">
                                    <LayoutGrid className="h-4 w-4 text-purple-300" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-4">
                                <div className="rounded-xl border p-3" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                                    <BookOpen className="h-4 w-4 text-indigo-300" />
                                    Enhanced Data Loading
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1" style={{ color: styleQubeThemeText }}>
                                      <div>✅ StyleQube: {designQube.styleQube ? "Loaded" : "Missing"}</div>
                                      <div>✅ StructureQube: {designQube.structureQube ? "Loaded" : "Missing"}</div>
                                      <div>✅ GuidesBriefs: {designQube.guidesBriefs ? "Loaded" : "Missing"}</div>
                                      <div>✅ Sources: {designQube.sources?.length || 0} files</div>
                                      <div>✅ References: {designQube.references?.length || 0} assets</div>
                                      <div>✅ Visual Sub-Groups: {designQube.styleQube?.visual ? "Available" : "Missing"}</div>
                                    </div>
                                    <div className="space-y-1" style={{ color: styleQubeThemeText }}>
                                      <div>✅ Audio Sub-Groups: {designQube.styleQube?.audio ? "Available" : "Missing"}</div>
                                      <div>✅ Text Sub-Groups: {designQube.styleQube?.text ? "Available" : "Missing"}</div>
                                      <div>✅ Spatial Sub-Groups: {designQube.styleQube?.spatial ? "Available" : "Missing"}</div>
                                      <div>✅ Content Modules: {designQube.structureQube?.contentModules?.length || 0} available</div>
                                      <div>✅ Big-Screen Support: {designQube.structureQube?.breakpoints?.bigScreen ? "Enabled" : "Missing"}</div>
                                    </div>
                                  </div>
                                </div>

                                <Tabs value={designQubeActivePanel} onValueChange={setDesignQubeActivePanel} className="w-full">
                                  <TabsList className="grid h-10 w-full grid-cols-5 items-center rounded-full border border-white/10 bg-slate-950/60 p-1">
                                    <TabsTrigger value="guides" className={configuratorTabTriggerClass}>
                                      Guides
                                    </TabsTrigger>
                                    <TabsTrigger value="style" className={configuratorTabTriggerClass}>
                                      StyleQube
                                    </TabsTrigger>
                                    <TabsTrigger value="structure" className={configuratorTabTriggerClass}>
                                      StructureQube
                                    </TabsTrigger>
                                    <TabsTrigger value="screens" className={configuratorTabTriggerClass}>
                                      Screens
                                    </TabsTrigger>
                                    <TabsTrigger value="guidance" className={configuratorTabTriggerClass}>
                                      Guidance
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="guides" className="mt-4">
                                    <div className="rounded-xl border p-4" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                      <div className="mb-3 flex items-center justify-between">
                                        <h4 className="flex items-center gap-2 text-sm font-medium text-white">
                                          <BookOpen className="h-4 w-4 text-indigo-300" />
                                          Guides & Briefs
                                        </h4>
                                        <button className="flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30">
                                          <Upload className="h-3 w-3" />
                                          Upload
                                        </button>
                                      </div>
                                      {designQube.styleBrief && (
                                        <div className="mb-4 max-h-[120px] overflow-y-auto pr-1 text-sm" style={{ color: styleQubeThemeText }}>
                                          {designQube.styleBrief}
                                        </div>
                                      )}
                                      <Tabs value={guidesActiveTab} onValueChange={setGuidesActiveTab} className="w-full">
                                        <TabsList className="grid h-10 w-full grid-cols-2 items-center rounded-xl border border-white/10 bg-slate-900/40 p-1">
                                          <TabsTrigger value="style-guide" className={configuratorTabTriggerClass}>
                                            Style Guide
                                          </TabsTrigger>
                                          <TabsTrigger value="experience-guide" className={configuratorTabTriggerClass}>
                                            Experience Guide
                                          </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="style-guide" className="mt-4">
                                          <Tabs value={styleGuideActiveTab} onValueChange={setStyleGuideActiveTab} className="w-full">
                                            <TabsList className="grid h-10 w-full grid-cols-3 items-center rounded-xl border border-white/10 bg-slate-900/30 p-1">
                                              <TabsTrigger value="css" className={configuratorTabTriggerClass}>
                                                CSS
                                              </TabsTrigger>
                                              <TabsTrigger value="brand-guide" className={configuratorTabTriggerClass}>
                                                Brand Guide
                                              </TabsTrigger>
                                              <TabsTrigger value="look-book" className={configuratorTabTriggerClass}>
                                                Look Book
                                              </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="css" className="mt-4">
                                              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">CSS Styles</div>
                                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs" style={{ color: styleQubeThemeText }}>
                                                  {(designQube.guidesBriefs?.styleGuide?.css || []).join("\n") ||
                                                    `/* Primary Colors */\n--primary: ${styleQubeThemeText};\n--background: ${styleQubeThemeBg};\n--border: ${styleQubeThemeBorder};`}
                                                </pre>
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="brand-guide" className="mt-4">
                                              <div className="space-y-2">
                                                {(designQube.guidesBriefs?.styleGuide?.brandGuidelines || []).length > 0 ? (
                                                  designQube.guidesBriefs?.styleGuide?.brandGuidelines.map((item, idx) => (
                                                    <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                      {item}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                                                    Brand guide not configured.
                                                  </div>
                                                )}
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="look-book" className="mt-4">
                                              <div className="space-y-2">
                                                {(designQube.guidesBriefs?.styleGuide?.lookBooks || []).length > 0 ? (
                                                  designQube.guidesBriefs?.styleGuide?.lookBooks.map((item, idx) => (
                                                    <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                      {item}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                                                    Look book not configured.
                                                  </div>
                                                )}
                                              </div>
                                            </TabsContent>
                                          </Tabs>
                                        </TabsContent>

                                        <TabsContent value="experience-guide" className="mt-4">
                                          <Tabs value={experienceGuideActiveTab} onValueChange={setExperienceGuideActiveTab} className="w-full">
                                            <TabsList className="grid h-10 w-full grid-cols-4 items-center rounded-xl border border-white/10 bg-slate-900/30 p-1">
                                              <TabsTrigger value="who" className={configuratorTabTriggerClass}>Who</TabsTrigger>
                                              <TabsTrigger value="what" className={configuratorTabTriggerClass}>What</TabsTrigger>
                                              <TabsTrigger value="wow" className={configuratorTabTriggerClass}>Wow</TabsTrigger>
                                              <TabsTrigger value="metrics" className={configuratorTabTriggerClass}>Metrics</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="who" className="mt-4 space-y-3">
                                              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Audience</div>
                                                <div className="mt-2 text-sm" style={{ color: styleQubeThemeText }}>
                                                  {designQube.guidesBriefs?.experienceGuide?.who?.audience || "Audience guide not configured."}
                                                </div>
                                              </div>
                                              <div className="space-y-2">
                                                {(designQube.guidesBriefs?.experienceGuide?.who?.demographics || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="what" className="mt-4 space-y-3">
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Delivery Methods</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.what?.delivery || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Mechanics</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.what?.mechanics || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="wow" className="mt-4 space-y-3">
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Differentiators</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.wow?.differentiators || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Innovations</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.wow?.innovations || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="metrics" className="mt-4 space-y-3">
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">Success Metrics</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.metrics?.success || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="space-y-2">
                                                <div className="text-xs uppercase tracking-widest text-slate-400">KPIs</div>
                                                {(designQube.guidesBriefs?.experienceGuide?.metrics?.kpis || []).slice(0, 6).map((item, idx) => (
                                                  <div key={`${item}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" style={{ color: styleQubeThemeText }}>
                                                    {item}
                                                  </div>
                                                ))}
                                              </div>
                                            </TabsContent>
                                          </Tabs>
                                        </TabsContent>
                                      </Tabs>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="style" className="mt-4">
                                    <div className="rounded-xl border p-4" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                                        <Palette className="h-4 w-4 text-rose-300" />
                                        StyleQube
                                      </h4>
                                      <Tabs value={styleQubeActiveTab} onValueChange={setStyleQubeActiveTab} className="w-full">
                                        <TabsList className="grid h-10 w-full grid-cols-4 items-center rounded-xl border border-white/10 bg-slate-900/40 p-1">
                                          <TabsTrigger value="visual" className={configuratorTabTriggerClass}>Visual</TabsTrigger>
                                          <TabsTrigger value="audio" className={configuratorTabTriggerClass}>Audio</TabsTrigger>
                                          <TabsTrigger value="text" className={configuratorTabTriggerClass}>Text</TabsTrigger>
                                          <TabsTrigger value="spatial" className={configuratorTabTriggerClass}>Spatial</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="visual" className="mt-4 space-y-4">
                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div>
                                              <span className="text-slate-400">Primary Color</span>
                                              <div className="mt-1 flex items-center gap-2">
                                                <div className="h-3 w-3 rounded border border-slate-600" style={{ backgroundColor: designQube.styleQube?.visual?.colors?.primary }} />
                                                <span style={{ color: styleQubeThemeText }}>{designQube.styleQube?.visual?.colors?.primary}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-slate-400">Secondary Color</span>
                                              <div className="mt-1 flex items-center gap-2">
                                                <div className="h-3 w-3 rounded border border-slate-600" style={{ backgroundColor: designQube.styleQube?.visual?.colors?.secondary }} />
                                                <span style={{ color: styleQubeThemeText }}>{designQube.styleQube?.visual?.colors?.secondary}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-slate-400">Accent Color</span>
                                              <div className="mt-1 flex items-center gap-2">
                                                <div className="h-3 w-3 rounded border border-slate-600" style={{ backgroundColor: designQube.styleQube?.visual?.colors?.accent }} />
                                                <span style={{ color: styleQubeThemeText }}>{designQube.styleQube?.visual?.colors?.accent}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-slate-400">Font Family</span>
                                              <div className="mt-1" style={{ color: styleQubeThemeText }}>
                                                {designQube.styleQube?.visual?.typography?.fontFamily?.primary}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-slate-400">Border Radius</span>
                                              <div className="mt-1" style={{ color: styleQubeThemeText }}>
                                                {designQube.styleQube?.visual?.radius?.md}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-slate-400">Shadow</span>
                                              <div className="mt-1" style={{ color: styleQubeThemeText }}>
                                                {designQube.styleQube?.visual?.shadows?.md}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-slate-400">Animation Duration</div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                              <div style={{ color: styleQubeThemeText }}>Fast: {designQube.styleQube?.visual?.animations?.duration?.fast}</div>
                                              <div style={{ color: styleQubeThemeText }}>Normal: {designQube.styleQube?.visual?.animations?.duration?.normal}</div>
                                              <div style={{ color: styleQubeThemeText }}>Slow: {designQube.styleQube?.visual?.animations?.duration?.slow}</div>
                                            </div>
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="audio" className="mt-4 space-y-4">
                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div><span className="text-slate-400">Voice Persona</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.voice?.persona}</div></div>
                                            <div><span className="text-slate-400">Accent</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.voice?.accent}</div></div>
                                            <div><span className="text-slate-400">Pace</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.voice?.pace}</div></div>
                                            <div><span className="text-slate-400">Sound Effects</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.soundEffects?.enabled ? "Enabled" : "Disabled"}</div></div>
                                            <div><span className="text-slate-400">TTS Provider</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.voice?.ttsHints?.provider as string || "Not configured"}</div></div>
                                            <div><span className="text-slate-400">Voice ID</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.audio?.voice?.ttsHints?.voiceId as string || "Not configured"}</div></div>
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div style={{ color: styleQubeThemeText }}>Volume: {(designQube.styleQube?.audio as any)?.volume || "80%"}</div>
                                            <div style={{ color: styleQubeThemeText }}>Pitch: {(designQube.styleQube?.audio as any)?.pitch || "Normal"}</div>
                                            <div style={{ color: styleQubeThemeText }}>Quality: {(designQube.styleQube?.audio as any)?.quality || "High"}</div>
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="text" className="mt-4 space-y-4">
                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div><span className="text-slate-400">Font Family</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.formatting?.fontFamily}</div></div>
                                            <div><span className="text-slate-400">Font Size</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.formatting?.fontSize}</div></div>
                                            <div><span className="text-slate-400">Line Height</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.formatting?.lineHeight}</div></div>
                                            <div><span className="text-slate-400">Max Width</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.formatting?.maxWidth}</div></div>
                                            <div><span className="text-slate-400">Personality</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.tone?.personality}</div></div>
                                            <div><span className="text-slate-400">Formality</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.text?.tone?.formality}</div></div>
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div style={{ color: styleQubeThemeText }}>Weight: {(designQube.styleQube?.text?.formatting as any)?.fontWeight || "Medium"}</div>
                                            <div style={{ color: styleQubeThemeText }}>Spacing: {(designQube.styleQube?.text?.formatting as any)?.letterSpacing || "Normal"}</div>
                                            <div style={{ color: styleQubeThemeText }}>Transform: {(designQube.styleQube?.text?.formatting as any)?.textTransform || "None"}</div>
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="spatial" className="mt-4 space-y-4">
                                          <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div><span className="text-slate-400">3D Transforms</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.spatial?.threeD?.enabled ? "Enabled" : "Disabled"}</div></div>
                                            <div><span className="text-slate-400">Z-Axis Stacking</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.spatial?.zAxis?.enabled ? "Enabled" : "Disabled"}</div></div>
                                            <div><span className="text-slate-400">AR Support</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.spatial?.ar?.enabled ? "Enabled" : "Disabled"}</div></div>
                                            <div><span className="text-slate-400">VR Support</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.styleQube?.spatial?.vr?.enabled ? "Enabled" : "Disabled"}</div></div>
                                          </div>
                                          {designQube.styleQube?.spatial?.threeD?.enabled && (
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div style={{ color: styleQubeThemeText }}>Perspective: {designQube.styleQube.spatial.threeD.perspective}px</div>
                                              <div style={{ color: styleQubeThemeText }}>Depth: {designQube.styleQube.spatial.threeD.depth}px</div>
                                            </div>
                                          )}
                                        </TabsContent>
                                      </Tabs>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="structure" className="mt-4">
                                    <div className="rounded-xl border p-4" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                                        <LayoutGrid className="h-4 w-4 text-cyan-300" />
                                        StructureQube
                                      </h4>
                                      <Tabs value={structureQubeActiveTab} onValueChange={setStructureQubeActiveTab} className="w-full">
                                        <TabsList className="grid h-10 w-full grid-cols-4 items-center rounded-xl border border-white/10 bg-slate-900/40 p-1">
                                          <TabsTrigger value="templates" className={configuratorTabTriggerClass}>Templates</TabsTrigger>
                                          <TabsTrigger value="modules" className={configuratorTabTriggerClass}>Modules</TabsTrigger>
                                          <TabsTrigger value="breakpoints" className={configuratorTabTriggerClass}>Breakpoints</TabsTrigger>
                                          <TabsTrigger value="priorities" className={configuratorTabTriggerClass}>Priority</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="templates" className="mt-4 space-y-4">
                                          <div className="space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-slate-400">Priority Templates</div>
                                            <div className="grid grid-cols-3 gap-2">
                                              {(designQube.structureQube?.templateSelection?.priority || []).slice(0, 9).map((template, idx) => (
                                                <div key={`${template}-${idx}`} className="flex items-center gap-2 rounded-lg bg-slate-950/40 p-2 text-xs" style={{ color: styleQubeThemeText }}>
                                                  <div className="h-2 w-2 rounded-full bg-cyan-400" />
                                                  {template}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div><span className="text-slate-400">Total Templates</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{designQube.structureQube?.templates?.length || 0} available</div></div>
                                            <div><span className="text-slate-400">By Modality</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{Object.keys(designQube.structureQube?.templateSelection?.byModality || {}).length} categories</div></div>
                                            <div><span className="text-slate-400">By Density</span><div className="mt-1" style={{ color: styleQubeThemeText }}>{Object.keys(designQube.structureQube?.templateSelection?.byDensity || {}).length} types</div></div>
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="modules" className="mt-4">
                                          <div className="space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-slate-400">Content Modules</div>
                                            <div className="space-y-2">
                                              {(designQube.structureQube?.contentModules || []).map((module, idx) => (
                                                <div key={`${module.id}-${idx}`} className="flex items-center justify-between rounded-lg bg-slate-950/40 p-2 text-xs">
                                                  <div className="flex items-center gap-2" style={{ color: styleQubeThemeText }}>
                                                    <div className="h-2 w-2 rounded-full bg-purple-400" />
                                                    {module.name}
                                                  </div>
                                                  <div className="text-slate-400">Priority {module.priority}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="breakpoints" className="mt-4">
                                          <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(designQube.structureQube?.breakpoints || {}).map(([breakpoint, config]) => (
                                              <div key={breakpoint} className="flex items-center gap-2 rounded-lg bg-slate-950/40 p-2 text-xs">
                                                {breakpoint === "mobile" && <Smartphone className="h-3 w-3 text-blue-400" />}
                                                {breakpoint === "tablet" && <Tablet className="h-3 w-3 text-green-400" />}
                                                {breakpoint === "desktop" && <MonitorIcon className="h-3 w-3 text-purple-400" />}
                                                {breakpoint === "bigScreen" && <Tv className="h-3 w-3 text-orange-400" />}
                                                <div style={{ color: styleQubeThemeText }}>
                                                  <div className="font-medium capitalize">{breakpoint.replace("bigScreen", "Big Screen")}</div>
                                                  <div className="text-slate-400">
                                                    {(config as any).minWidth && `≥${(config as any).minWidth}px`}
                                                    {(config as any).maxWidth && ` ≤${(config as any).maxWidth}px`}
                                                    {!(config as any).minWidth && !(config as any).maxWidth && "Any"}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </TabsContent>

                                        <TabsContent value="priorities" className="mt-4 space-y-4">
                                          <div className="space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-slate-400">Component Priority Order</div>
                                            <div className="space-y-2">
                                              {Object.entries(designQube.structureQube?.componentPriorities || {}).map(([component, priority]) => (
                                                <div key={component} className="flex items-center justify-between rounded-lg bg-slate-950/40 p-2 text-xs">
                                                  <div className="flex items-center gap-2" style={{ color: styleQubeThemeText }}>
                                                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                                    {component}
                                                  </div>
                                                  <div style={{ color: styleQubeThemeText }}>Priority {priority}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-slate-400">Layout Rules</div>
                                            <div className="space-y-2">
                                              {(designQube.structureQube?.layoutRules || []).slice(0, 6).map((rule, idx) => (
                                                <div key={`${rule}-${idx}`} className="rounded-lg bg-slate-950/40 p-2 text-xs" style={{ color: styleQubeThemeText }}>
                                                  {rule}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </TabsContent>
                                      </Tabs>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="screens" className="mt-4">
                                    <div className="space-y-4 rounded-xl border p-4" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                      <div className="flex items-center justify-between">
                                        <h4 className="flex items-center gap-2 text-sm font-medium text-white">
                                          <MonitorIcon className="h-4 w-4 text-orange-300" />
                                          Screens
                                        </h4>
                                        <button className="flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/20 px-2 py-1 text-xs text-orange-300 hover:bg-orange-500/30">
                                          <Upload className="h-3 w-3" />
                                          Upload
                                        </button>
                                      </div>
                                      <div className="text-xs" style={{ color: styleQubeThemeText }}>
                                        Upload and manage design screens from screenshots, Adobe XD, Figma, or other design tools.
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="text-center p-4 rounded-lg border border-dashed border-slate-600">
                                          <MonitorIcon className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                                          <div className="text-xs text-slate-400">Screenshots</div>
                                        </div>
                                        <div className="text-center p-4 rounded-lg border border-dashed border-slate-600">
                                          <Hexagon className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                                          <div className="text-xs text-slate-400">Adobe XD</div>
                                        </div>
                                        <div className="text-center p-4 rounded-lg border border-dashed border-slate-600">
                                          <LayoutGrid className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                                          <div className="text-xs text-slate-400">Figma</div>
                                        </div>
                                        <div className="text-center p-4 rounded-lg border border-dashed border-slate-600">
                                          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                                          <div className="text-xs text-slate-400">Other Tools</div>
                                        </div>
                                      </div>
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {(designQube.references || []).length > 0 ? (
                                          (designQube.references || []).map((ref, idx) => (
                                            <div
                                              key={ref.id}
                                              className="rounded-xl border p-2"
                                              style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}
                                            >
                                              {ref.dataUrl || ref.thumbnailUrl ? (
                                                <img
                                                  src={ref.dataUrl || ref.thumbnailUrl || DESIGN_QUBE_IMAGE_FALLBACKS[idx % DESIGN_QUBE_IMAGE_FALLBACKS.length]}
                                                  alt={ref.title || ref.file}
                                                  className="h-32 w-full rounded-lg object-cover"
                                                  onError={(event) => {
                                                    event.currentTarget.onerror = null;
                                                    event.currentTarget.src =
                                                      DESIGN_QUBE_IMAGE_FALLBACKS[idx % DESIGN_QUBE_IMAGE_FALLBACKS.length];
                                                  }}
                                                />
                                              ) : (
                                                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">
                                                  {ref.file}
                                                </div>
                                              )}
                                              <div className="mt-2 text-xs text-slate-400">{ref.title || ref.file}</div>
                                            </div>
                                          ))
                                        ) : (
                                          (designQube.sources || []).slice(0, 6).map((source, idx) => (
                                            <div
                                              key={source.id}
                                              className="rounded-xl border p-2"
                                              style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}
                                            >
                                              <img
                                                src={DESIGN_QUBE_IMAGE_FALLBACKS[idx % DESIGN_QUBE_IMAGE_FALLBACKS.length]}
                                                alt={source.label}
                                                className="h-32 w-full rounded-lg object-cover"
                                              />
                                              <div className="mt-2 text-xs text-slate-400">{source.label}</div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="guidance" className="mt-4">
                                    <div className="rounded-xl border p-4" style={{ backgroundColor: styleQubeThemeBg, borderColor: styleQubeThemeBorder }}>
                                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                                        <Bot className="h-4 w-4 text-emerald-300" />
                                        Customization Guidance
                                      </h4>
                                      <div className="space-y-4">
                                        <div className="text-xs" style={{ color: styleQubeThemeText }}>
                                          Get real-time guidance as you customize templates. These copilots provide explanations, options, and automatically capture decisions in your DesignQube and ExperienceQube.
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          {[
                                            {
                                              title: "Visual Customization",
                                              icon: <Eye className="h-4 w-4 text-blue-300" />,
                                              buttonClass: "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30",
                                              placeholder:
                                                "Ask about colors, typography, spacing, animations...\nExample: 'What colors work best for a professional tech theme?'",
                                              helper: "Provides color suggestions, typography recommendations, animation timing",
                                            },
                                            {
                                              title: "Audio Customization",
                                              icon: <Volume2 className="h-4 w-4 text-green-300" />,
                                              buttonClass: "bg-green-500/20 text-green-300 hover:bg-green-500/30",
                                              placeholder:
                                                "Ask about voice personas, sound effects, audio feedback...\nExample: 'What voice persona works for educational content?'",
                                              helper: "Voice persona selection, sound effect timing, TTS configuration",
                                            },
                                            {
                                              title: "Text & Content",
                                              icon: <Type className="h-4 w-4 text-purple-300" />,
                                              buttonClass: "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30",
                                              placeholder:
                                                "Ask about tone, readability, content structure...\nExample: 'How should I write for a technical audience?'",
                                              helper: "Tone adjustment, readability optimization, content structure",
                                            },
                                            {
                                              title: "Layout & Structure",
                                              icon: <LayoutGrid className="h-4 w-4 text-cyan-300" />,
                                              buttonClass: "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30",
                                              placeholder:
                                                "Ask about templates, breakpoints, component arrangement...\nExample: 'What template works best for a dashboard layout?'",
                                              helper: "Template selection, responsive design, component priorities",
                                            },
                                          ].map((assistant) => (
                                            <div key={assistant.title} className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                {assistant.icon}
                                                <span className="text-xs font-medium text-white">{assistant.title}</span>
                                              </div>
                                              <div className="relative">
                                                <textarea
                                                  placeholder={assistant.placeholder}
                                                  className="h-16 w-full resize-none rounded-md border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                                                />
                                                <div className="absolute right-1 top-1">
                                                  <button className={`rounded p-1 ${assistant.buttonClass}`}>
                                                    <Bot className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="text-xs text-slate-400">{assistant.helper}</div>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                                          <div className="flex items-center gap-2 text-xs text-emerald-200">
                                            <ShieldCheck className="h-3 w-3" />
                                            <span className="font-medium">Auto-Capture Enabled</span>
                                          </div>
                                          <div className="mt-1 text-xs text-emerald-300">
                                            All customization decisions are automatically captured and stored in your DesignQube and ExperienceQube for consistency and future reference.
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="text-sm text-slate-400">No DesignQube loaded.</div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="exqubes" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {experiences.map((exp) => {
                    const isSelected = selectedExperienceId === exp.id;
                    return (
                      <div
                        key={exp.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedExperience(exp);
                          setSelectedExperienceId(exp.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedExperience(exp);
                            setSelectedExperienceId(exp.id);
                          }
                        }}
                        className={`rounded-xl border bg-slate-950/60 p-4 transition ${
                          isSelected
                            ? "border-purple-400/60 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]"
                            : "border-slate-800 hover:border-slate-600/60"
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{exp.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-400">{exp.description}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span className="rounded-full border border-slate-700 px-2 py-0.5">{exp.status}</span>
                          {exp.configuration?.wallet_rewards?.unlock_price && (
                            <span className="rounded-full border border-amber-600/60 bg-amber-600/10 px-2 py-0.5 text-amber-300">
                              💰 {exp.configuration.wallet_rewards.unlock_price} Q¢
                            </span>
                          )}
                          {exp.configuration?.wallet_rewards?.reward_amount && (
                            <span className="rounded-full border border-emerald-600/60 bg-emerald-600/10 px-2 py-0.5 text-emerald-300">
                              🎁 +{exp.configuration.wallet_rewards.reward_amount} Q¢
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void launchExperience(exp);
                              }}
                              className="rounded-lg border border-emerald-400/60 bg-emerald-400/10 p-2 text-emerald-200 hover:bg-emerald-400/20"
                              title="Launch Experience"
                            >
                              <Play className="h-3 w-3" />
                            </button>
                            {(() => {
                              const makeBundle = asRecord(exp.configuration?.make_bundle);
                              const blockKinds = Array.isArray(makeBundle?.blockKinds) ? makeBundle.blockKinds as string[] : [];
                              const blockStatuses = asRecord(makeBundle?.block_statuses);
                              if (!blockKinds.includes("image_generation")) return null;
                              if (blockStatuses?.image_generation === "accepted") return null;
                              return (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void launchExperience(exp);
                                  }}
                                  className="rounded-lg border border-violet-400/60 bg-violet-400/10 p-2 text-violet-200 hover:bg-violet-400/20"
                                  title="Generate Images"
                                >
                                  <Sparkles className="h-3 w-3" />
                                </button>
                              );
                            })()}
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openRuntimePreviewForExperience(exp, "Preview");
                              }}
                              className="rounded-lg border border-cyan-400/60 bg-cyan-400/10 p-2 text-cyan-200 hover:bg-cyan-400/20"
                              title="Preview Experience"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openMcpInspector(exp);
                              }}
                              className="rounded-lg border border-fuchsia-400/60 bg-fuchsia-400/10 p-2 text-fuchsia-200 hover:bg-fuchsia-400/20"
                              title="MCP Inspector"
                            >
                              <Code className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedExperience(exp);
                                setExperienceModalTab("metrics");
                                setShowExperienceModal(true);
                              }}
                              className="rounded-lg border border-violet-400/60 bg-violet-400/10 p-2 text-violet-200 hover:bg-violet-400/20"
                              title="View Metrics"
                            >
                              <BarChart className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEditExperience(exp);
                              }}
                              className="rounded-lg border border-amber-400/60 bg-amber-400/10 p-2 text-amber-200 hover:bg-amber-400/20"
                              title="Edit Experience"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setExperienceToDelete(exp);
                                setShowDeleteConfirm(true);
                              }}
                              className="rounded-lg border border-red-400/60 bg-red-400/10 p-2 text-red-200 hover:bg-red-400/20"
                              title="Delete Experience"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {experiences.length === 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                      No ExperienceQubes created yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div aria-hidden className="hidden min-h-[700px] max-h-[700px] lg:block" />
          <div className="pointer-events-none flex h-[700px] w-full justify-end lg:absolute lg:inset-y-0 lg:right-0 lg:z-[85] lg:h-auto">
            {renderRuntimePreviewShell()}
          </div>
        </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 sm:p-4">
            <Tabs
              value={studioAnalysisTab}
              onValueChange={(value) => {
                setStudioAnalysisTab(value as "parity" | "surfaces" | "receipts");
                setIsParityExpanded(true);
              }}
              className="w-full"
            >
              <div className="mb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {parityPanelMeta.icon}
                      <h2 className="text-lg font-semibold text-white">{parityPanelMeta.title}</h2>
                    </div>
                    <p className="text-sm text-slate-400">{parityPanelMeta.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsParityExpanded((prev) => !prev)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/50 text-slate-300 transition hover:border-fuchsia-400/30 hover:text-white"
                    aria-label={isParityExpanded ? "Collapse parity review" : "Expand parity review"}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isParityExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <TabsList className="grid h-10 w-full grid-cols-3 items-center rounded-full border border-white/10 bg-slate-950/60 p-1">
                  <TabsTrigger value="parity" className={configuratorTabTriggerClass}>
                    Design Parity
                  </TabsTrigger>
                  <TabsTrigger value="surfaces" className={configuratorTabTriggerClass}>
                    Surface Planning
                  </TabsTrigger>
                  <TabsTrigger value="receipts" className={configuratorTabTriggerClass}>
                    DVN Receipts
                  </TabsTrigger>
                </TabsList>
              </div>

              {isParityExpanded ? (
                <>
                  <TabsContent value="parity" className="mt-0">
                    <AgenticDesignParityPanel
                      designQube={designQube}
                      activeDesignQubeId={activeStyleQubeId}
                      designTheme={designTheme}
                      experiences={experiences}
                      previewExperience={previewExperience}
                      previewAction={previewAction}
                      routingSummary={routingEnvelope.summary}
                      recommendedTargetLabel={getDeploymentTargetLabel(routingEnvelope.recommendedTarget)}
                      deploymentGuidance={deploymentTargetCards}
                      onOpenExperience={(experienceId) => {
                        router.push(`/studio/composer/experience/${encodeURIComponent(experienceId)}`);
                      }}
                      onOpenRuntimePreview={() => {
                        openRuntimePreviewForExperience(previewExperience, "Preview");
                      }}
                      onApplyRemedy={handleApplyRemedy}
                      onLogAuditEvent={handleLogAuditEvent}
                    />
                  </TabsContent>

                  <TabsContent value="surfaces" className="mt-0">
                    <SurfacePlanningPanel
                      experienceId={previewExperience?.id || selectedExperienceId || undefined}
                      cartridge={tenantId}
                      onSurfacePlanGenerated={() => {
                        // Stub hook for future runtime preview integration.
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="receipts" className="mt-0">
                    <DVNReceiptsPanel
                      experienceId={previewExperience?.id || selectedExperienceId || undefined}
                      autoRefresh={true}
                      refreshInterval={5000}
                    />
                  </TabsContent>
                </>
              ) : null}
            </Tabs>
          </div>
      </div>

      {/* Enhanced ExperienceQube Modal */}
      {showExperienceModal && selectedExperience && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-3">
                <Hexagon className="h-6 w-6 text-cyan-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedExperience.name}</h2>
                  <p className="text-sm text-slate-400">Experience Details</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExperienceModal(false);
                  setSelectedExperience(null);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <ChevronUp className="h-5 w-5 rotate-45" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <Tabs value={experienceModalTab} onValueChange={(value) => setExperienceModalTab(value as "goal" | "mechanics" | "metrics")} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-6">
                  <TabsTrigger value="goal" className="flex items-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    <ShieldCheck className="h-4 w-4" />
                    Goal
                  </TabsTrigger>
                  <TabsTrigger value="mechanics" className="flex items-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    <SlidersHorizontal className="h-4 w-4" />
                    Mechanics
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="flex items-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    <LayoutGrid className="h-4 w-4" />
                    Metrics
                  </TabsTrigger>
                </TabsList>

                {/* Goal Tab */}
                <TabsContent value="goal" className="space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      Primary Goal
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedExperience.goal}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                      <h4 className="text-sm font-medium text-white mb-2">Experience Status</h4>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                          selectedExperience.status === 'active' ? 'bg-emerald-400' : 
                          selectedExperience.status === 'completed' ? 'bg-blue-400' : 'bg-slate-400'
                        }`} />
                        <span className="text-sm text-slate-300 capitalize">{selectedExperience.status}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                      <h4 className="text-sm font-medium text-white mb-2">Category</h4>
                      <span className="text-sm text-slate-300">{selectedExperience.metadata?.category || 'General'}</span>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                      <h4 className="text-sm font-medium text-white mb-2">Cost</h4>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-orange-400/60 bg-orange-400/10 px-2 py-1 text-xs font-medium text-orange-300">
                          25 Q¢
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                      <h4 className="text-sm font-medium text-white mb-2">Reward</h4>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300">
                          10 Q¢
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Mechanics Tab */}
                <TabsContent value="mechanics" className="space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-violet-400" />
                      Experience Mechanics
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {selectedExperience.mechanics}
                      </p>
                      
                      <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="text-center p-4 rounded-lg border border-slate-600 bg-slate-800/20">
                          <Eye className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                          <div className="text-xs text-slate-400">Visual</div>
                          <div className="text-sm font-medium text-white">Enabled</div>
                        </div>
                        <div className="text-center p-4 rounded-lg border border-slate-600 bg-slate-800/20">
                          <Volume2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                          <div className="text-xs text-slate-400">Audio</div>
                          <div className="text-sm font-medium text-white">Enabled</div>
                        </div>
                        <div className="text-center p-4 rounded-lg border border-slate-600 bg-slate-800/20">
                          <LayoutGrid className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                          <div className="text-xs text-slate-400">Spatial</div>
                          <div className="text-sm font-medium text-white">Enabled</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics" className="space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-orange-400" />
                      Success Metrics
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-6">
                      {selectedExperience.metrics}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-slate-600 bg-slate-800/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-400">Engagement Rate</span>
                          <span className="text-sm font-medium text-emerald-400">85%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-emerald-400 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-600 bg-slate-800/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-400">Completion Rate</span>
                          <span className="text-sm font-medium text-blue-400">72%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-blue-400 h-2 rounded-full" style={{ width: '72%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Modal Actions */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>ID: {selectedExperience.id}</span>
                  <span>•</span>
                  <span>Template: {selectedExperience.template_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      openRuntimePreviewForExperience(selectedExperience, "Preview");
                      setShowExperienceModal(false);
                    }}
                    className="rounded-lg border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20"
                  >
                    Preview Experience
                  </button>
                  <button
                    onClick={() => {
                      openMcpInspector(selectedExperience);
                      setShowExperienceModal(false);
                    }}
                    className="rounded-lg border border-fuchsia-400/60 bg-fuchsia-400/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-400/20"
                  >
                    MCP Inspector
                  </button>
                  <button
                    onClick={() => {
                      setShowExperienceModal(false);
                      setSelectedExperience(null);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMcpInspectorModal && mcpExperience && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-5xl w-full max-h-[92vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-3">
                <Code className="h-5 w-5 text-fuchsia-300" />
                <div>
                  <h2 className="text-lg font-semibold text-white">ExperienceQube MCP App Inspector</h2>
                  <p className="text-xs text-slate-400">Experience: {mcpExperience.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMcpInspectorModal(false)}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <ChevronUp className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-90px)] gap-4 overflow-hidden p-5 lg:grid-cols-[420px_1fr]">
              <div className="max-h-[calc(92vh-130px)] space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Deployment Target</label>
                  <select
                    value={mcpDeploymentTarget}
                    onChange={(e) => {
                      const nextTarget = e.target.value as ComposerDeploymentTarget;
                      const supportedVariants = getSupportedVariantsForTarget(nextTarget);
                      setMcpDeploymentTarget(nextTarget);
                      if (!supportedVariants.includes(mcpDeliveryVariant)) {
                        setMcpDeliveryVariant(supportedVariants[0] || "runtime_standard");
                      }
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="studio_preview">Studio Preview</option>
                    <option value="runtime_launch">Runtime Launch</option>
                    <option value="mcp_app">MCP App Deployment</option>
                    <option value="discord_mcp">Discord via MCP</option>
                  </select>
                </div>

                {inspectorUsesMessengerProvider ? (
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Messenger Provider</label>
                    <select
                      value={mcpProvider}
                      onChange={(e) => setMcpProvider(e.target.value as "discord" | "whatsapp" | "telegram")}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="discord">Discord</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                    </select>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                    <div className="font-medium text-white">Deployment Surface</div>
                    <div className="mt-1">
                      {mcpDeploymentTarget === "runtime_launch"
                        ? mcpDeliveryVariant === "runtime_thin_client"
                          ? "metaMe runtime thin client"
                          : "metaMe runtime"
                        : mcpDeploymentTarget === "studio_preview"
                          ? "Studio preview"
                          : "MCP app deployment"}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Delivery Variant</label>
                  <select
                    value={mcpDeliveryVariant}
                    onChange={(e) => setMcpDeliveryVariant(e.target.value as ComposerDeliveryVariant)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {availableDeliveryVariants.map((variant) => (
                      <option key={variant} value={variant}>
                        {getDeliveryVariantLabel(variant)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                    <div className="font-medium">
                      Routing recommendation: {getDeploymentTargetLabel(routingEnvelope.recommendedTarget)}
                    </div>
                    <div className="mt-1 text-cyan-100/80">{routingEnvelope.summary}</div>
                  </div>
                  {deploymentTargetCards.map((target) => (
                    <div
                      key={target.id}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        mcpDeploymentTarget === target.id
                          ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                          : "border-slate-700 bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">{target.label}</span>
                        <span
                          className={
                            target.ready ? "text-emerald-300" : "text-amber-300"
                          }
                        >
                          {target.ready ? "ready" : "blocked"}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-400">{target.note}</div>
                      <div className={`mt-1 text-[11px] ${getCapabilityToneClass(target.capabilityState)}`}>
                        {getCapabilityLabel(target.capabilityState)}: {target.capabilitySummary}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                        <span>trust {target.trustScore}/5</span>
                        <span>cost {target.costScore}/5</span>
                        <span>fit {target.suitabilityScore}</span>
                      </div>
                      {Array.isArray(target.watchouts) && target.watchouts.length > 0 ? (
                        <div className="mt-1 text-[11px] text-amber-300/80">
                          {target.watchouts.join(" · ")}
                        </div>
                      ) : null}
                      {target.latest ? (
                        <div className="mt-1 text-slate-500">
                          Last result: {target.latest.status}
                          {target.latest.mode ? ` · ${target.latest.mode}` : ""}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Dispatch Mode</label>
                  <select
                    value={mcpDispatchMode}
                    onChange={(e) => setMcpDispatchMode(e.target.value as "simulate" | "live")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="simulate">Simulation</option>
                    <option value="live">Live Dispatch</option>
                  </select>
                </div>

                {inspectorUsesDiscordFields ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Channel ID (Discord, numeric)</label>
                      <input
                        value={mcpChannelId}
                        onChange={(e) => setMcpChannelId(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        placeholder="Optional override, e.g. 1234567890123456789"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Discord Invite (optional)</label>
                      <input
                        value={mcpDiscordInvite}
                        onChange={(e) => setMcpDiscordInvite(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        placeholder="https://discord.gg/..."
                      />
                    </div>
                  </>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs text-slate-400">MCP Tool</label>
                  <select
                    value={mcpTool}
                    onChange={(e) =>
                      setMcpTool(
                        e.target.value as
                          | "pill.get"
                          | "capsule.get"
                          | "mini_runtime.get"
                          | "codex.entry"
                          | "invite.create"
                          | "share.compose"
                          | "next.best"
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="next.best">next.best</option>
                    <option value="pill.get">pill.get</option>
                    <option value="capsule.get">capsule.get</option>
                    <option value="mini_runtime.get">mini_runtime.get</option>
                    <option value="codex.entry">codex.entry</option>
                    <option value="invite.create">invite.create</option>
                    <option value="share.compose">share.compose</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Intent / Message</label>
                  <textarea
                    value={mcpMessage}
                    onChange={(e) => setMcpMessage(e.target.value)}
                    className="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="I'd like to watch Qriptopian visual content."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runMcpToolFromInspector()}
                    disabled={mcpLoading}
                    className="rounded-lg border border-cyan-400/60 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-60"
                  >
                    Run MCP Tool
                  </button>
                  <button
                    type="button"
                    onClick={() => void runProviderDispatchSimulation()}
                    disabled={mcpLoading}
                    className="rounded-lg border border-emerald-400/60 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-60"
                  >
                    {mcpDispatchMode === "live"
                      ? `Deploy to ${getDeploymentTargetLabel(mcpDeploymentTarget)}`
                      : `Simulate ${getDeploymentTargetLabel(mcpDeploymentTarget)}`}
                  </button>
                  {routingEnvelope.recommendedTarget !== mcpDeploymentTarget ? (
                    <button
                      type="button"
                      onClick={() => setMcpDeploymentTarget(routingEnvelope.recommendedTarget)}
                      disabled={mcpLoading}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400/50 hover:text-white disabled:opacity-60"
                    >
                      Use recommended target
                    </button>
                  ) : null}
                  {latestSelectedDeploymentResult ? (
                    <button
                      type="button"
                      onClick={() => void runProviderDispatchSimulation()}
                      disabled={mcpLoading}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-fuchsia-400/50 hover:text-white disabled:opacity-60"
                    >
                      Retry target
                    </button>
                  ) : null}
                  {mcpDeploymentTarget === "discord_mcp" ? (
                    <button
                      type="button"
                      onClick={() => void checkDiscordConnectionStatus()}
                      disabled={mcpDiscordStatusLoading}
                      className="rounded-lg border border-violet-400/60 bg-violet-400/10 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-60"
                    >
                      {mcpDiscordStatusLoading ? "Checking Discord..." : "Check Discord Connection"}
                    </button>
                  ) : null}
                </div>

                {mcpDeploymentTarget === "discord_mcp" && mcpDiscordStatus ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">
                        Discord status:{" "}
                        <span className={mcpDiscordStatus.ready ? "text-emerald-300" : "text-amber-300"}>
                          {mcpDiscordStatus.ready ? "Ready" : "Not ready"}
                        </span>
                      </span>
                      {mcpDiscordStatus.details?.channelId ? (
                        <span className="text-slate-400">Channel: {mcpDiscordStatus.details.channelId}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-slate-400">
                      Bot: {mcpDiscordStatus.details?.botName || "unknown"} · Channel Access:{" "}
                      {mcpDiscordStatus.checks?.channelAccess ? "yes" : "no"}
                    </div>
                    {mcpDiscordStatus.errors?.channelAccess ? (
                      <div className="mt-1 text-rose-300">{mcpDiscordStatus.errors.channelAccess}</div>
                    ) : null}
                  </div>
                ) : null}

                {mcpDeploymentTarget === "discord_mcp" ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      mcpDiscordStatusState === "ok"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : mcpDiscordStatusState === "fail"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          : "border-slate-700 bg-slate-900/60 text-slate-300"
                    }`}
                  >
                    {mcpDiscordStatusMessage}
                  </div>
                ) : null}

                {mcpError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {mcpError}
                  </div>
                )}

                <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">Selected target proof</div>
                    <div className="flex items-center gap-3">
                      {latestSelectedDeploymentResult?.capability?.state ? (
                        <span className={getCapabilityToneClass(latestSelectedDeploymentResult.capability.state)}>
                          {getCapabilityLabel(latestSelectedDeploymentResult.capability.state)}
                        </span>
                      ) : null}
                      <span
                        className={
                          latestSelectedDeploymentResult?.status === "failed"
                            ? "text-rose-300"
                            : latestSelectedDeploymentResult
                              ? "text-emerald-300"
                              : "text-slate-400"
                        }
                      >
                        {latestSelectedDeploymentResult?.status || "No result yet"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-slate-400">
                    <div>Target: {getDeploymentTargetLabel(mcpDeploymentTarget)}</div>
                    {latestSelectedDeploymentResult?.capability?.summary ? (
                      <div>Capability: {latestSelectedDeploymentResult.capability.summary}</div>
                    ) : selectedDeploymentCard?.capabilitySummary ? (
                      <div>Capability: {selectedDeploymentCard.capabilitySummary}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.adapterDeclaration ? (
                      <>
                        <div>
                          Adapter: {latestSelectedDeploymentResult.adapterDeclaration.label}
                        </div>
                        <div>
                          Availability: {latestSelectedDeploymentResult.adapterDeclaration.availability}
                        </div>
                        {latestSelectedDeploymentResult.adapterDeclaration.supportedModes.length > 0 ? (
                          <div>
                            Supported modes: {latestSelectedDeploymentResult.adapterDeclaration.supportedModes.join(" · ")}
                          </div>
                        ) : null}
                        {latestSelectedDeploymentResult.adapterDeclaration.supportedVariants.length > 0 ? (
                          <div>
                            Supported variants: {latestSelectedDeploymentResult.adapterDeclaration.supportedVariants.join(" · ")}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {latestSelectedDeploymentResult?.destinationAdapter ? (
                      <div>Destination adapter: {latestSelectedDeploymentResult.destinationAdapter}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.deliveryMode ? (
                      <div>Delivery mode: {latestSelectedDeploymentResult.deliveryMode}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.destinationSurface ? (
                      <div>Surface: {String(latestSelectedDeploymentResult.destinationSurface)}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.provider ? (
                      <div>Provider: {String(latestSelectedDeploymentResult.provider)}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.variant ? (
                      <div>Variant: {String(latestSelectedDeploymentResult.variant)}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.mode ? (
                      <div>Mode: {String(latestSelectedDeploymentResult.mode)}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.deployedAt ? (
                      <div>At: {new Date(String(latestSelectedDeploymentResult.deployedAt)).toLocaleString()}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.warnings && latestSelectedDeploymentResult.warnings.length > 0 ? (
                      <div className="text-amber-200/90">
                        Warnings: {latestSelectedDeploymentResult.warnings.join(" · ")}
                      </div>
                    ) : null}
                    {latestSelectedDeploymentResult?.capability?.constraints &&
                    latestSelectedDeploymentResult.capability.constraints.length > 0 ? (
                      <div className="text-amber-200/90">
                        Constraints: {latestSelectedDeploymentResult.capability.constraints.join(" · ")}
                      </div>
                    ) : selectedDeploymentCard?.capabilityConstraints &&
                      selectedDeploymentCard.capabilityConstraints.length > 0 ? (
                      <div className="text-amber-200/90">
                        Constraints: {selectedDeploymentCard.capabilityConstraints.join(" · ")}
                      </div>
                    ) : null}
                    <div className="text-slate-400">
                      Fallbacks: {resolveDeploymentFallbackGuidance({
                        target: mcpDeploymentTarget,
                        variant: mcpDeliveryVariant,
                      }).join(" · ")}
                    </div>
                    <div className="text-slate-400">
                      Actions: {resolveDeploymentRemediationActions({
                        target: mcpDeploymentTarget,
                        variant: mcpDeliveryVariant,
                      }).join(" · ")}
                    </div>
                    {latestSelectedDeploymentResult?.runtimeProfile ? (
                      <>
                        <div>Intent: {String(latestSelectedDeploymentResult.runtimeProfile.intent)}</div>
                        <div>Quick link: {String(latestSelectedDeploymentResult.runtimeProfile.quickLink)}</div>
                        <div>Codex: {String(latestSelectedDeploymentResult.runtimeProfile.codexContext?.activeCodexName || latestSelectedDeploymentResult.runtimeProfile.codexContext?.activeCodexId || "Unknown")}</div>
                        <div>Cartridge: {String(latestSelectedDeploymentResult.runtimeProfile.runtimeCartridge || "metame")}</div>
                      </>
                    ) : null}
                    {latestSelectedDeploymentResult?.nextActions && latestSelectedDeploymentResult.nextActions.length > 0 ? (
                      <div className="text-cyan-100">
                        Next: {latestSelectedDeploymentResult.nextActions.join(" · ")}
                      </div>
                    ) : null}
                    {latestSelectedDeploymentResult?.error ? (
                      <div className="text-rose-300">Error: {latestSelectedDeploymentResult.error}</div>
                    ) : null}
                    {latestSelectedDeploymentResult?.publishUrl ? (
                      <a
                        href={latestSelectedDeploymentResult.publishUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-200 underline underline-offset-2"
                      >
                        Open publish surface
                      </a>
                    ) : null}
                    {latestSelectedDeploymentResult?.launchUrl ? (
                      <a
                        href={latestSelectedDeploymentResult.launchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-200 underline underline-offset-2"
                      >
                        Open launch surface
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs">
                  <div className="font-medium text-white">Deployment remediation</div>
                  <div className="mt-2 space-y-2 text-slate-300">
                    {inspectorRemediationSteps.map((step, index) => (
                      <div key={`${index}-${step}`} className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-300">{index + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex min-h-[420px] max-h-[calc(92vh-130px)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Inspector Output</h3>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/70 p-0.5">
                      <button
                        type="button"
                        onClick={() => setInspectorRenderMode("card")}
                        className={`rounded px-2 py-1 text-[11px] ${
                          inspectorRenderMode === "card"
                            ? "bg-cyan-500/20 text-cyan-200"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorRenderMode("thread")}
                        className={`rounded px-2 py-1 text-[11px] ${
                          inspectorRenderMode === "thread"
                            ? "bg-cyan-500/20 text-cyan-200"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Thread Mock
                      </button>
                    </div>
                    {mcpLoading && <span className="text-xs text-slate-400">Running...</span>}
                  </div>
                </div>
                <div className="mb-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Destination Preview · {inspectorPreview.providerLabel}
                    </div>
                    {inspectorPreview.depth ? (
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-200">
                        {inspectorPreview.depth}
                      </span>
                    ) : null}
                  </div>
                  {inspectorRenderMode === "card" ? (
                    <div className="min-w-[280px] max-w-[360px] h-[206px] overflow-hidden rounded-2xl border border-white/15">
                      <div className="relative h-full w-full">
                        {inspectorPreview.thumbnailUri ? (
                          inspectorPreview.thumbnailType === "video" ? (
                            <video
                              src={inspectorPreview.thumbnailUri}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={inspectorPreview.thumbnailUri}
                              alt={`${inspectorPreview.title} thumbnail`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/35 to-slate-900/20" />
                        <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              inspectorSourceBadge === "Codex"
                                ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-100"
                              : inspectorSourceBadge === "Experience"
                                  ? "border-violet-300/45 bg-violet-500/20 text-violet-100"
                                  : "border-emerald-300/45 bg-emerald-500/20 text-emerald-100"
                            }`}
                          >
                            {inspectorSourceBadge}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                              title="Launch"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                              title="Preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                              title="Share"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
                          <h4 className="line-clamp-1 text-sm font-semibold text-white">{inspectorPreview.title}</h4>
                          <p className="line-clamp-2 text-[11px] text-slate-200/85">{inspectorPreview.body}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-200/75">
                            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 uppercase tracking-wide">
                              {inspectorPreview.providerLabel}
                            </span>
                            {inspectorPreview.depth ? (
                              <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-cyan-100">
                                {inspectorPreview.depth}
                              </span>
                            ) : null}
                            {inspectorPreview.ctaLabel ? (
                              <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
                                {inspectorPreview.ctaLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                            <div className="h-full w-1/3 bg-gradient-to-r from-cyan-400 to-violet-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/30 text-[10px] font-semibold text-indigo-200">
                            M
                          </span>
                          <span className="font-medium text-slate-300">metaMe Bot</span>
                          <span>just now</span>
                        </div>
                        <div className="max-w-[95%] rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2">
                          {inspectorPreview.thumbnailUri ? (
                            <div className="mb-2 overflow-hidden rounded-md border border-slate-700/90 bg-slate-900">
                              {inspectorPreview.thumbnailType === "video" ? (
                                <video
                                  src={inspectorPreview.thumbnailUri}
                                  className="h-24 w-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={inspectorPreview.thumbnailUri}
                                  alt={`${inspectorPreview.title} thumbnail`}
                                  className="h-24 w-full object-cover"
                                  loading="lazy"
                                />
                              )}
                            </div>
                          ) : null}
                          <div className="text-sm font-semibold text-white">{inspectorPreview.title}</div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-300">{inspectorPreview.body}</div>
                          {inspectorPreview.shareText ? (
                            <div className="mt-2 text-[11px] text-slate-400">{inspectorPreview.shareText}</div>
                          ) : null}
                          {inspectorPreview.ctaLabel ? (
                            <button
                              type="button"
                              className="mt-3 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200"
                            >
                              {inspectorPreview.ctaLabel}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-200">
                    {mcpResult ? JSON.stringify(mcpResult, null, 2) : "Run a tool or dispatch simulation to inspect payloads."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && experienceToDelete && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-md w-full rounded-2xl border border-red-800/50 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-500/10 p-2">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Experience</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-slate-300 mb-2">
                Are you sure you want to delete <span className="font-semibold text-white">"{experienceToDelete.name}"</span>?
              </p>
              <p className="text-xs text-slate-400">
                This will permanently remove the experience and all associated data from the database.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setExperienceToDelete(null);
                }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExperience(experienceToDelete)}
                className="flex-1 rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </div>
                ) : (
                  'Delete Experience'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ComposerStudio;
