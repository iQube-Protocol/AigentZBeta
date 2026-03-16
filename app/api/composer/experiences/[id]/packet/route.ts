/**
 * Composer ExperienceQube Packet API
 * GET /api/composer/experiences/[id]/packet - Build a minimal UI packet
 */

import { NextRequest, NextResponse } from "next/server";
import { composerService } from "@/services/composer/composerService";
import { getTemplateRegistry } from "@/services/agui/TemplateRegistry";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

const DRAWER_GRID_VARIANTS = new Set([
  "1a",
  "1b",
  "1c",
  "2a",
  "2b",
  "2c",
  "3a",
  "3b",
]);

function mapGoalToIntent(goal?: string) {
  if (!goal) return "browse";
  const normalized = goal.toLowerCase();
  if (normalized.includes("watch")) return "watch";
  if (normalized.includes("quest") || normalized.includes("reward")) return "questing";
  if (normalized.includes("character")) return "character_deep_dive";
  if (normalized.includes("realm")) return "realm_navigation";
  return "browse";
}

function selectDrawerGridVariant(preference?: string, supportingCount = 0) {
  const raw = String(preference || "").toLowerCase();
  if (DRAWER_GRID_VARIANTS.has(raw)) {
    return `liquidui:drawer_grid_${raw}`;
  }
  return "liquidui:drawer_grid_2a";
}

function selectPrimaryTemplate(experience: any) {
  const config = experience.configuration || {};
  const intent = config.intent_timebox || {};
  const content = config.content_selection || {};
  const uiPrefs = config.ui_preferences || {};

  const registry = getTemplateRegistry();
  const candidateTemplate = registry.selectTemplate({
    userIntent: uiPrefs.user_intent || mapGoalToIntent(intent.goal),
    device: uiPrefs.device || "desktop",
    contentMix: uiPrefs.content_mix || "mixed",
    realm: uiPrefs.realm,
    taskState: uiPrefs.task_state,
    businessGoal: uiPrefs.business_goal,
  });

  if (candidateTemplate === "liquidui:drawer_grid_v1") {
    const supportingCount = Array.isArray(content.supporting_item_ids)
      ? content.supporting_item_ids.length
      : 0;
    const variant = selectDrawerGridVariant(uiPrefs.layout_variant, supportingCount);
    return { templateId: variant, reason: "TemplateRegistry drawer grid variant" };
  }

  return { templateId: candidateTemplate, reason: "TemplateRegistry selection" };
}

function isSkillBacked(experience: any): boolean {
  const templateId = experience.template_id || "";
  const config = experience.configuration || {};
  const metadata = experience.metadata || {};
  const generatedAssets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  const hasSavedVideo = generatedAssets.some((asset: any) => isVideoAsset(asset) && Boolean(getAssetUrl(asset)));
  const hasVideoPrompt =
    typeof config.video_prompt?.prompt === "string" && config.video_prompt.prompt.trim().length > 0;
  return templateId === "sora-video-generation" || !!config.skill_selection?.skill_id || hasSavedVideo || hasVideoPrompt;
}

function hasImageGeneration(experience: any): boolean {
  const config = experience.configuration || {};
  const imageGeneration = config.image_generation || {};
  return Boolean(
    (typeof imageGeneration.portrait_prompt === "string" && imageGeneration.portrait_prompt.trim()) ||
      (typeof imageGeneration.landscape_prompt === "string" && imageGeneration.landscape_prompt.trim())
  );
}

function getVideoSkillSubhead(skillId: string) {
  if (!skillId) {
    return "Select a video skill before generating";
  }
  if (skillId === "venice_video_gen") {
    return "Venice Video Generation";
  }
  if (skillId === "sora_video_gen_community") {
    return "Community Video Generation";
  }
  return "OpenAI Sora Video Generation";
}

function getAssetUrl(asset: any): string | null {
  if (typeof asset?.asset_url === "string" && asset.asset_url.trim()) {
    return asset.asset_url.trim();
  }
  if (typeof asset?.assetUrl === "string" && asset.assetUrl.trim()) {
    return asset.assetUrl.trim();
  }
  if (typeof asset?.image_url === "string" && asset.image_url.trim()) {
    return asset.image_url.trim();
  }
  if (typeof asset?.video_url === "string" && asset.video_url.trim()) {
    return asset.video_url.trim();
  }
  return null;
}

function getAssetReceiptRef(asset: any): string | null {
  if (typeof asset?.receipt_ref === "string" && asset.receipt_ref.trim()) {
    return asset.receipt_ref.trim();
  }
  if (typeof asset?.receiptRef === "string" && asset.receiptRef.trim()) {
    return asset.receiptRef.trim();
  }
  return null;
}

function isVideoUri(value: unknown): boolean {
  return typeof value === "string" && /\.(mp4|m4v|mov|webm|ogg)(\?|$)/i.test(value.trim());
}

function isImageUri(value: unknown): boolean {
  return typeof value === "string" && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(value.trim());
}

function isImageAsset(asset: any): boolean {
  return (
    asset?.type === "image" ||
    asset?.media_type === "image" ||
    isImageUri(getAssetUrl(asset)) ||
    isImageUri(asset?.storage_path)
  );
}

function isVideoAsset(asset: any): boolean {
  return (
    asset?.type === "video" ||
    asset?.media_type === "video" ||
    isVideoUri(getAssetUrl(asset)) ||
    isVideoUri(asset?.storage_path)
  );
}

function getGeneratedReceipts(metadata: any): Array<Record<string, any>> {
  if (!metadata?.generated_receipts || typeof metadata.generated_receipts !== "object") {
    return [];
  }
  return Object.values(metadata.generated_receipts).filter(
    (receipt): receipt is Record<string, any> => Boolean(receipt && typeof receipt === "object")
  );
}

type PersonaGeneratedMediaRecord = {
  id: string;
  experienceId?: string;
  personaId?: string;
  type?: "image" | "video";
  label?: string;
  provider?: string;
  orientation?: "portrait" | "landscape";
  assetUrl?: string;
  storagePath?: string;
  receiptRef?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedInExperienceId?: string;
  pinnedToExperienceId?: string;
};

async function loadPersonaGeneratedMediaLibrary(personaId?: string) {
  const normalizedPersonaId = typeof personaId === "string" ? personaId.trim() : "";
  if (!normalizedPersonaId) return [] as PersonaGeneratedMediaRecord[];

  const supabase = getSupabaseServer();
  if (!supabase) return [] as PersonaGeneratedMediaRecord[];

  const { data, error } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", normalizedPersonaId)
    .eq("category", "workflow")
    .eq("key", "composer_generated_media_library_v1")
    .maybeSingle();

  if (error) {
    const code = (error as any).code;
    const message = (error as any).message || "";
    if (code === "PGRST205" || message.includes("user_preferences")) {
      return [] as PersonaGeneratedMediaRecord[];
    }
    console.error("Failed to load persona generated media library:", error);
    return [] as PersonaGeneratedMediaRecord[];
  }

  const raw = data?.value;
  if (!Array.isArray(raw)) return [] as PersonaGeneratedMediaRecord[];

  return raw.filter(
    (item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object")
  );
}

function resolveCreatorPersonaId(experience: any) {
  if (typeof experience?.metadata?.creator_persona?.id === "string" && experience.metadata.creator_persona.id.trim()) {
    return experience.metadata.creator_persona.id.trim();
  }
  if (typeof experience?.creator_id === "string" && experience.creator_id.trim()) {
    return experience.creator_id.trim();
  }
  return undefined;
}

function getPersonaLibraryAssetsForExperience(
  library: PersonaGeneratedMediaRecord[],
  experienceId: string
) {
  return library
    .filter(
      (item) =>
        Boolean(item.assetUrl) &&
        (item.experienceId === experienceId ||
          item.lastUsedInExperienceId === experienceId ||
          item.pinnedToExperienceId === experienceId)
    )
    .map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      provider: item.provider,
      orientation: item.orientation,
      asset_url: item.assetUrl,
      storage_path: item.storagePath,
      receipt_ref: item.receiptRef,
      prompt: item.prompt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));
}

function buildImageAssetsFromReceipts(metadata: any, imageGeneration: any, providerId: string) {
  const receipts = getGeneratedReceipts(metadata);
  const images: Array<{
    orientation: "portrait" | "landscape";
    prompt: string;
    ok: true;
    mode: "live";
    image_url: string;
    model: string;
    receipt_id?: string;
  }> = [];

  for (const receipt of receipts) {
    const outputs = Array.isArray(receipt?.payload?.outputs) ? receipt.payload.outputs : [];
    for (const output of outputs) {
      const orientation =
        output?.orientation === "portrait" || output?.orientation === "landscape"
          ? output.orientation
          : null;
      const imageUrl =
        typeof output?.image_url === "string" && output.image_url.trim()
          ? output.image_url.trim()
          : null;
      if (!orientation || !imageUrl) continue;
      if (images.some((item) => item.orientation === orientation && item.image_url === imageUrl)) {
        continue;
      }
      images.push({
        orientation,
        prompt:
          orientation === "portrait"
            ? imageGeneration.portrait_prompt || ""
            : imageGeneration.landscape_prompt || "",
        ok: true,
        mode: "live",
        image_url: imageUrl,
        model:
          (typeof output?.model === "string" && output.model) ||
          (typeof receipt?.payload?.provider === "string" && receipt.payload.provider) ||
          providerId,
        receipt_id:
          typeof receipt?.receipt_id === "string" && receipt.receipt_id.trim()
            ? receipt.receipt_id.trim()
            : undefined,
      });
    }
  }

  return images;
}

function getAssetTimestamp(asset: any): number {
  const raw =
    (typeof asset?.created_at === "string" && asset.created_at) ||
    (typeof asset?.createdAt === "string" && asset.createdAt) ||
    (typeof asset?.timestamp === "string" && asset.timestamp) ||
    null;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssetPriority(asset: any): number {
  const url = getAssetUrl(asset) || "";
  if (/\/api\/skills\/video\//i.test(url)) return -10;
  if (/supabase\.co\/storage\/v1\/object\/public\//i.test(url)) return 10;
  if (/^https?:\/\//i.test(url)) return 5;
  return 0;
}

function buildSkillPacket(experience: any, personaLibraryAssets: any[] = []) {
  const config = experience.configuration || {};
  const metadata = experience.metadata || {};
  const intent = config.intent_timebox || {};
  const skillSel = config.skill_selection || {};
  const videoPrompt = config.video_prompt || {};
  const wallet = config.wallet_rewards || {};
  const rewardAmount = Number(wallet.reward_amount || 0);
  const skillId =
    typeof skillSel.skill_id === "string" && skillSel.skill_id.trim() ? skillSel.skill_id.trim() : "";
  const generatedAssets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  const candidateVideoAssets = [...generatedAssets, ...personaLibraryAssets].filter(
    (asset: any) => isVideoAsset(asset) && Boolean(getAssetUrl(asset))
  );
  const videoAsset = candidateVideoAssets.sort((a: any, b: any) => {
    const priorityDelta = getAssetPriority(b) - getAssetPriority(a);
    if (priorityDelta !== 0) return priorityDelta;
    return getAssetTimestamp(b) - getAssetTimestamp(a);
  })[0];
  const videoUrl = getAssetUrl(videoAsset);
  const videoReceiptRef = getAssetReceiptRef(videoAsset);

  return {
    packet_version: "1.0",
    packet_id: `pkt_${experience.id}`,
    tenant_id: experience.tenant_id,
    packet_type: "skill_video",
    intent: {
      verb: "generate_video",
      target_type: "skill_invocation",
      target_ids: skillId ? [skillId] : [],
      constraints: {
        experience_id: experience.id,
        goal: intent.goal,
        creative_pack: intent.creative_pack,
      },
    },
    context: {
      working_set: {
        reward_amount: rewardAmount,
      },
    },
    skill: {
      skill_id: skillId,
      trust_override: skillSel.trust_override === true,
      venice_model: skillSel.venice_model || null,
      prompt: videoPrompt.prompt || "",
      duration: videoPrompt.duration || 10,
      aspect_ratio: videoPrompt.aspect_ratio || "16:9",
      style: videoPrompt.style || "cinematic",
      creative_pack: intent.creative_pack || null,
      video_url: videoUrl,
      },
    ui: {
      primary_template: "skill:video_player_v1",
      layout: "centered",
      title: experience.name,
      subhead: getVideoSkillSubhead(skillId),
      template_selection: {
        template_id: "skill:video_player_v1",
        reason: "Skill-backed experience — SkillVideoPlayer",
      },
      components: [
        {
          type: "SkillVideoPlayer",
          binding: { source: "skill", path: `invoke/${skillId}` },
          props: {
            skill_id: skillId,
            prompt: videoPrompt.prompt || "",
            duration: videoPrompt.duration || 10,
            aspect_ratio: videoPrompt.aspect_ratio || "16:9",
            style: videoPrompt.style || "cinematic",
            creative_pack: intent.creative_pack || null,
            autoInvoke: false,
            venice_model: skillSel.venice_model || undefined,
            video_url: videoUrl || undefined,
            initial_receipt:
              videoReceiptRef && metadata.generated_receipts
                ? metadata.generated_receipts[videoReceiptRef] || undefined
                : undefined,
          },
        },
      ],
      overlays: [],
    },
    risk: {
      tier: "medium",
      required_gates: ["skill_admission", "studio_hydrate"],
    },
  };
}

function buildImagePacket(experience: any, personaLibraryAssets: any[] = []) {
  const config = experience.configuration || {};
  const metadata = experience.metadata || {};
  const intent = config.intent_timebox || {};
  const imageGeneration = config.image_generation || {};
  const providerId = imageGeneration.provider_id || "venice";
  const generatedAssets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  const combinedAssets = [...generatedAssets, ...personaLibraryAssets];
  const imageAssets = combinedAssets.filter(
    (asset: any) =>
      isImageAsset(asset) &&
      (asset?.orientation === "portrait" || asset?.orientation === "landscape") &&
      Boolean(getAssetUrl(asset))
  );
  const receiptBackfilledImages = buildImageAssetsFromReceipts(metadata, imageGeneration, providerId);
  const savedImagesFromAssets = generatedAssets
    .filter((asset: any) => imageAssets.includes(asset))
    .map((asset: any) => ({
      orientation: asset.orientation,
      prompt:
        asset.orientation === "portrait"
          ? imageGeneration.portrait_prompt || ""
          : imageGeneration.landscape_prompt || "",
      ok: true,
      mode: "live" as const,
      image_url: getAssetUrl(asset) as string,
      model: asset.provider || providerId,
      receipt_id: getAssetReceiptRef(asset) || undefined,
    }));
  const initialImagesByOrientation = new Map<string, (typeof receiptBackfilledImages)[number]>();
  for (const image of receiptBackfilledImages) {
    initialImagesByOrientation.set(image.orientation, image);
  }
  for (const image of savedImagesFromAssets) {
    const existing = initialImagesByOrientation.get(image.orientation);
    const existingTs = existing ? getAssetTimestamp(existing) : 0;
    const currentTs = getAssetTimestamp(image);
    if (!existing || currentTs >= existingTs) {
      initialImagesByOrientation.set(image.orientation, image);
    }
  }
  const initialImages = Array.from(initialImagesByOrientation.values()).sort((a, b) =>
    a.orientation === b.orientation ? 0 : a.orientation === "portrait" ? -1 : 1
  );
  const imageReceiptRef =
    getAssetReceiptRef(imageAssets.find((asset: any) => Boolean(getAssetReceiptRef(asset)))) ||
    receiptBackfilledImages.find((asset) => typeof asset.receipt_id === "string")?.receipt_id ||
    null;

  return {
    packet_version: "1.0",
    packet_id: `pkt_${experience.id}`,
    tenant_id: experience.tenant_id,
    packet_type: "skill_image",
    intent: {
      verb: "generate_image",
      target_type: "skill_invocation",
      target_ids: [providerId],
      constraints: {
        experience_id: experience.id,
        goal: intent.goal,
      },
    },
    context: {
      working_set: {
        provider_id: providerId,
        portrait_prompt: imageGeneration.portrait_prompt || null,
        landscape_prompt: imageGeneration.landscape_prompt || null,
      },
    },
    image_generation: {
      provider_id: providerId,
      portrait_prompt: imageGeneration.portrait_prompt || "",
      landscape_prompt: imageGeneration.landscape_prompt || "",
      visual_style: imageGeneration.visual_style || "editorial",
      auto_invoke: false,
      initial_images: initialImages,
      initial_receipt:
        initialImages.length > 0 && metadata.generated_receipts
          ? metadata.generated_receipts[imageReceiptRef || ""] || undefined
          : undefined,
    },
    ui: {
      primary_template: "skill:image_player_v1",
      layout: "centered",
      title: experience.name,
      subhead: providerId === "venice" ? "Venice Article Imagery" : "OpenAI Article Imagery",
      template_selection: {
        template_id: "skill:image_player_v1",
        reason: "Image-backed experience — SkillImagePlayer",
      },
      components: [
        {
          type: "SkillImagePlayer",
          binding: { source: "skill", path: `generate/${providerId}` },
          props: {
            provider_id: providerId,
            portrait_prompt: imageGeneration.portrait_prompt || "",
            landscape_prompt: imageGeneration.landscape_prompt || "",
            visual_style: imageGeneration.visual_style || "editorial",
            autoInvoke: false,
            initial_images: initialImages,
            initial_receipt:
              initialImages.length > 0 && metadata.generated_receipts
                ? metadata.generated_receipts[imageReceiptRef || ""] || undefined
                : undefined,
          },
        },
      ],
      overlays: [],
    },
    risk: {
      tier: "medium",
      required_gates: ["studio_hydrate"],
    },
  };
}

async function buildPacket(experience: any) {
  const creatorPersonaId = resolveCreatorPersonaId(experience);
  const personaLibrary = await loadPersonaGeneratedMediaLibrary(creatorPersonaId);
  const personaLibraryAssets = getPersonaLibraryAssetsForExperience(personaLibrary, experience.id);

  if (isSkillBacked(experience)) {
    return buildSkillPacket(experience, personaLibraryAssets);
  }
  if (hasImageGeneration(experience)) {
    return buildImagePacket(experience, personaLibraryAssets);
  }

  const config = experience.configuration || {};
  const intent = config.intent_timebox || {};
  const content = config.content_selection || {};
  const wallet = config.wallet_rewards || {};
  const copilot = config.copilot_output || {};
  const primaryTemplate = selectPrimaryTemplate(experience);

  const featureId = content.feature_item_id;
  const supportingIds = Array.isArray(content.supporting_item_ids) ? content.supporting_item_ids : [];
  const unlockPrice = Number(wallet.unlock_price || 0);
  const rewardAmount = Number(wallet.reward_amount || 0);
  const requiresConnect = wallet.require_wallet_connect !== false;

  const overlays = [];
  if (unlockPrice > 0 && featureId) {
    overlays.push({
      type: "UnlockOverlay",
      trigger: "on_missing_entitlement",
      binding: { source: "wallet", path: `entitlements/items/${featureId}` },
      props: {
        itemId: featureId,
        price: { amount: unlockPrice.toFixed(2), currency: "Qc" },
        ctaLabel: "Unlock full article",
      },
    });
  }

  return {
    packet_version: "1.0",
    packet_id: `pkt_${experience.id}`,
    tenant_id: experience.tenant_id,
    intent: {
      verb: "read",
      target_type: "codex_item",
      target_ids: featureId ? [featureId] : [],
      constraints: {
        experience_id: experience.id,
        goal: intent.goal,
        time_available: intent.time_available,
        depth: intent.depth,
        issue_slug: content.issue_slug,
      },
    },
    context: {
      working_set: {
        feature_item_id: featureId,
        supporting_item_ids: supportingIds,
        reward_amount: rewardAmount,
      },
    },
    ui: {
      primary_template: primaryTemplate.templateId,
      layout: "split",
      title: experience.name,
      subhead: "Reading Sprint",
      template_selection: {
        template_id: primaryTemplate.templateId,
        reason: primaryTemplate.reason,
      },
      components: [
        {
          type: "Reader",
          binding: { source: "codex", path: featureId ? `items/${featureId}` : "items" },
          props: { renderMode: content.preview_enabled ? "preview" : "full", showProgress: true },
        },
        {
          type: "CopilotPanel",
          binding: { source: "tool", path: "copilot://qriptopian-reading-sprint" },
          props: {
            outputs: copilot.outputs || [],
            takeawaysCount: copilot.takeaways_count || 3,
          },
        },
        {
          type: "WorkspaceNotesPanel",
          binding: { source: "codex", path: `workspace/${experience.id}/notes` },
          props: { autosave: true },
        },
      ],
      overlays,
    },
    risk: {
      tier: unlockPrice > 0 ? "medium" : "low",
      required_gates: requiresConnect ? ["connect", ...(unlockPrice > 0 ? ["pay"] : [])] : [],
    },
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return jsonNoStore({ error: "ExperienceQube ID is required" }, { status: 400 });
    }

    const experienceQube = await composerService.getExperienceQube(id);
    if (!experienceQube) {
      return jsonNoStore({ error: "ExperienceQube not found" }, { status: 404 });
    }

    const packet = await buildPacket(experienceQube);
    return jsonNoStore({ ok: true, packet });
  } catch (error: any) {
    console.error("Composer packet GET error:", error);
    return jsonNoStore(
      { error: error.message || "Failed to build packet" },
      { status: 500 }
    );
  }
}
