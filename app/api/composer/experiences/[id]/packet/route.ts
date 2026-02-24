/**
 * Composer ExperienceQube Packet API
 * GET /api/composer/experiences/[id]/packet - Build a minimal UI packet
 */

import { NextRequest, NextResponse } from "next/server";
import { composerService } from "@/services/composer/composerService";
import { getTemplateRegistry } from "@/services/agui/TemplateRegistry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

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

function buildPacket(experience: any) {
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
      return NextResponse.json({ error: "ExperienceQube ID is required" }, { status: 400 });
    }

    const experienceQube = await composerService.getExperienceQube(id);
    if (!experienceQube) {
      return NextResponse.json({ error: "ExperienceQube not found" }, { status: 404 });
    }

    const packet = buildPacket(experienceQube);
    return NextResponse.json({ ok: true, packet });
  } catch (error: any) {
    console.error("Composer packet GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to build packet" },
      { status: 500 }
    );
  }
}
