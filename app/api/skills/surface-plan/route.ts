/**
 * POST /api/skills/surface-plan
 *
 * Surface Planning Skill — determines the optimal rendering configuration
 * for a piece of content based on its type, display context, and breakpoint.
 *
 * This skill is available to Know1, Marketa, Aigent C, and Aigent Z.
 * It extends the TemplateRegistry's SelectionContext pattern to answer
 * "how should THIS content be displayed HERE at THIS size?"
 *
 * AG-UI / CopilotKit contract:
 *   The response includes a `copilot_action` field so CopilotKit agents
 *   can directly invoke a Liquid UI render action using the returned config.
 *
 * Input:
 *   contentType   — "video" | "image" | "article" | "carousel" | "audio" | "link"
 *   displayContext — "list" | "card" | "modal" | "detail" | "preview" | "embed"
 *   breakpoint    — "mobile" | "tablet" | "desktop"
 *   contentItems? — optional array count (affects column/density decisions)
 *   contentTitle? — optional string (for reasoning output)
 *
 * Output: SurfacePlan
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "video" | "image" | "article" | "carousel" | "audio" | "link";
type DisplayContext = "list" | "card" | "modal" | "detail" | "preview" | "embed";
type Breakpoint = "mobile" | "tablet" | "desktop";

interface SurfacePlanRequest {
  contentType: ContentType;
  displayContext: DisplayContext;
  breakpoint: Breakpoint;
  itemCount?: number;
  contentTitle?: string;
  agentId?: string;
}

export interface SurfacePlan {
  templateId: string;
  columns: number;
  thumbnailAspect: "16:9" | "4:3" | "1:1" | "2:3" | "9:16";
  thumbnailSize: "xs" | "sm" | "md" | "lg" | "xl" | "full";
  modalSize: "sm" | "md" | "lg" | "xl" | "full";
  showPlayOverlay: boolean;
  showCaption: boolean;
  cardDensity: "compact" | "standard" | "expanded";
  layoutVariant: string;
  copilotAction: string;
  reasoning: string;
}

// ─── Decision matrix ──────────────────────────────────────────────────────────

function resolveThumbnailAspect(contentType: ContentType): SurfacePlan["thumbnailAspect"] {
  if (contentType === "video") return "16:9";
  if (contentType === "image") return "1:1";
  if (contentType === "carousel") return "16:9";
  if (contentType === "audio") return "1:1";
  return "4:3";   // article, link
}

function resolveColumns(
  displayContext: DisplayContext,
  breakpoint: Breakpoint,
  contentType: ContentType,
  itemCount: number
): number {
  // Detail / modal / embed always single column
  if (displayContext === "detail" || displayContext === "modal" || displayContext === "embed") {
    return 1;
  }
  // Preview: 1 item, no grid needed
  if (displayContext === "preview") return 1;

  // List / card in a grid
  if (breakpoint === "mobile") {
    return contentType === "article" ? 1 : 2;
  }
  if (breakpoint === "tablet") {
    return contentType === "article" ? 2 : 3;
  }
  // Desktop
  if (itemCount <= 4) return 2;
  if (contentType === "article") return 2;
  return 3;
}

function resolveThumbnailSize(
  displayContext: DisplayContext,
  breakpoint: Breakpoint,
  columns: number
): SurfacePlan["thumbnailSize"] {
  if (displayContext === "detail") return "xl";
  if (displayContext === "modal") return "lg";
  if (displayContext === "embed") return "md";
  if (displayContext === "preview") return "sm";
  // list / card in grid
  if (columns === 1) return "md";
  if (columns === 2) return "sm";
  return "xs";   // 3+ columns
}

function resolveModalSize(
  displayContext: DisplayContext,
  contentType: ContentType,
  breakpoint: Breakpoint
): SurfacePlan["modalSize"] {
  if (displayContext !== "modal" && displayContext !== "detail") return "md";
  if (contentType === "video") return breakpoint === "mobile" ? "full" : "xl";
  if (contentType === "image") return breakpoint === "mobile" ? "full" : "lg";
  if (contentType === "carousel") return "xl";
  return breakpoint === "mobile" ? "full" : "lg";  // article, audio, link
}

function resolveTemplateId(
  displayContext: DisplayContext,
  contentType: ContentType,
  columns: number
): { templateId: string; layoutVariant: string; copilotAction: string } {
  if (displayContext === "modal" || displayContext === "detail") {
    if (contentType === "video") {
      return {
        templateId: "knyt:motion_stage_v1",
        layoutVariant: "2A",
        copilotAction: "ui_render_liquidui_drawer_grid_2a",
      };
    }
    return {
      templateId: "knyt:drawer_grid_1c",
      layoutVariant: "1C",
      copilotAction: "ui_render_liquidui_drawer_grid_1c",
    };
  }
  if (displayContext === "embed") {
    return {
      templateId: "knyt:drawer_grid_2b",
      layoutVariant: "2B",
      copilotAction: "ui_render_liquidui_drawer_grid_2b",
    };
  }
  // list/card in grid — choose by column count
  const variants: Record<number, { templateId: string; layoutVariant: string; copilotAction: string }> = {
    1: { templateId: "knyt:drawer_grid_1a", layoutVariant: "1A", copilotAction: "ui_render_liquidui_drawer_grid_1a" },
    2: { templateId: "knyt:drawer_grid_2c", layoutVariant: "2C", copilotAction: "ui_render_liquidui_drawer_grid_2c" },
    3: { templateId: "knyt:drawer_grid_3a", layoutVariant: "3A", copilotAction: "ui_render_liquidui_drawer_grid_3a" },
  };
  return variants[columns] ?? variants[2];
}

function buildReasoning(
  contentType: ContentType,
  displayContext: DisplayContext,
  breakpoint: Breakpoint,
  columns: number,
  plan: Partial<SurfacePlan>
): string {
  const parts: string[] = [];

  if (contentType === "video") {
    parts.push(`Video content uses 16:9 aspect with play overlay.`);
  } else if (contentType === "article") {
    parts.push(`Articles prioritise text legibility with wider columns.`);
  }

  if (displayContext === "modal") {
    parts.push(`Modal context expands to ${plan.modalSize} to give content breathing room.`);
  } else if (displayContext === "list") {
    parts.push(`List context uses ${columns}-column grid at ${breakpoint} breakpoint for efficient scanning.`);
  }

  if (breakpoint === "mobile") {
    parts.push(`Mobile: compact density, minimal chrome.`);
  }

  parts.push(`Template ${plan.templateId} (variant ${plan.layoutVariant}) selected.`);
  return parts.join(" ");
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: SurfacePlanRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    contentType,
    displayContext,
    breakpoint,
    itemCount = 10,
  } = body;

  const validContentTypes: ContentType[] = ["video", "image", "article", "carousel", "audio", "link"];
  const validContexts: DisplayContext[] = ["list", "card", "modal", "detail", "preview", "embed"];
  const validBreakpoints: Breakpoint[] = ["mobile", "tablet", "desktop"];

  if (!validContentTypes.includes(contentType)) {
    return NextResponse.json({ ok: false, error: `contentType must be one of: ${validContentTypes.join(", ")}` }, { status: 400 });
  }
  if (!validContexts.includes(displayContext)) {
    return NextResponse.json({ ok: false, error: `displayContext must be one of: ${validContexts.join(", ")}` }, { status: 400 });
  }
  if (!validBreakpoints.includes(breakpoint)) {
    return NextResponse.json({ ok: false, error: `breakpoint must be one of: ${validBreakpoints.join(", ")}` }, { status: 400 });
  }

  const columns = resolveColumns(displayContext, breakpoint, contentType, itemCount);
  const thumbnailAspect = resolveThumbnailAspect(contentType);
  const thumbnailSize = resolveThumbnailSize(displayContext, breakpoint, columns);
  const modalSize = resolveModalSize(displayContext, contentType, breakpoint);
  const { templateId, layoutVariant, copilotAction } = resolveTemplateId(displayContext, contentType, columns);

  const plan: SurfacePlan = {
    templateId,
    columns,
    thumbnailAspect,
    thumbnailSize,
    modalSize,
    showPlayOverlay: contentType === "video" || contentType === "carousel",
    showCaption: displayContext !== "preview",
    cardDensity: breakpoint === "mobile" ? "compact" : columns >= 3 ? "compact" : "standard",
    layoutVariant,
    copilotAction,
    reasoning: "",
  };
  plan.reasoning = buildReasoning(contentType, displayContext, breakpoint, columns, plan);

  return NextResponse.json({ ok: true, data: plan });
}

// ─── GET — capability descriptor (for skill discovery) ───────────────────────

export async function GET() {
  return NextResponse.json({
    ok: true,
    skill: {
      id: "skillqube-platform-surface-planner",
      name: "Surface Planner",
      description:
        "Determines the optimal rendering configuration for content based on type, display context, and breakpoint. Returns template ID, column count, thumbnail size, modal size, and CopilotKit action name.",
      version: "0.1.0",
      inputSchema: {
        contentType: "video | image | article | carousel | audio | link",
        displayContext: "list | card | modal | detail | preview | embed",
        breakpoint: "mobile | tablet | desktop",
        itemCount: "number (optional, default 10)",
      },
      outputSchema: {
        templateId: "string — Liquid UI template to use",
        columns: "number — grid columns",
        thumbnailAspect: "16:9 | 4:3 | 1:1 | 2:3 | 9:16",
        thumbnailSize: "xs | sm | md | lg | xl | full",
        modalSize: "sm | md | lg | xl | full",
        showPlayOverlay: "boolean",
        showCaption: "boolean",
        cardDensity: "compact | standard | expanded",
        layoutVariant: "string — Liquid UI variant code",
        copilotAction: "string — CopilotKit tool name to invoke",
        reasoning: "string — brief human-readable explanation",
      },
      agents: ["aigent-kn0w1", "aigent-marketa", "aigent-c", "aigent-z"],
    },
  });
}
