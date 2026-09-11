import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { generateRuntimeSurfacePlan } from "@/services/metame/surfacePlanningService";
import { surfacePlanToA2UIPayload } from "@/services/a2ui/surfacePlanAdapter";
import {
  a2uiExperienceRenderer,
  A2UI_SURFACE_PLAN,
} from "@/services/a2ui/a2uiExperienceRenderer";

export const a2uiGenerateSurfacePayloadAction = {
  name: "a2ui_generate_surface_payload",
  description: `Generate an A2UI payload from Surface Planning models. This action:
1. Builds a SurfacePlanV0 request from runtime intent/device context
2. Calls the runtime surface planning endpoint
3. Adapts the resulting surface plan into an A2UI declarative payload

Use when user asks to generate/preview A2UI payloads for SmartTriad or Liquid UI flows.`,
  parameters: [
    {
      name: "modules",
      type: "array" as const,
      description: "Module refs: [{ module_id, module_type, source_refs? }] to include in the surface plan.",
      required: true,
    },
    {
      name: "sessionId",
      type: "string" as const,
      description: "Session ID for plan generation.",
      required: true,
    },
    {
      name: "deviceType",
      type: "string" as const,
      description: 'Device type: "mobile", "tablet", or "desktop". Default: "desktop".',
      required: false,
    },
    {
      name: "runtimeIntent",
      type: "string" as const,
      description: 'Runtime intent such as "read", "watch", "play", "share", "make", "earn". Default: "read".',
      required: false,
    },
    {
      name: "cartridge",
      type: "string" as const,
      description: 'Cartridge key. Default: "Qriptopian".',
      required: false,
    },
    {
      name: "codexId",
      type: "string" as const,
      required: false,
    },
    {
      name: "capsuleId",
      type: "string" as const,
      required: false,
    },
    {
      name: "threadId",
      type: "string" as const,
      required: false,
    },
  ],
  handler: async ({
    modules,
    sessionId,
    deviceType = "desktop",
    runtimeIntent = "read",
    cartridge = "Qriptopian",
    codexId,
    capsuleId,
    threadId,
  }: {
    modules: Array<{
      module_id: string;
      module_type: string;
      source_refs?: Array<{ kind: "schema_ref" | "doc_ref" | "uri_ref"; id: string }>;
    }>;
    sessionId: string;
    deviceType?: DeviceType;
    runtimeIntent?: string;
    cartridge?: string;
    codexId?: string;
    capsuleId?: string;
    threadId?: string;
  }) => {
    try {
      // Render through the named seam (CFS-007, Law VI) — the adapter owns
      // plan generation + payload adaptation; this action owns only the
      // CopilotKit result shaping.
      const rendered = await a2uiExperienceRenderer.render(
        {
          surface: A2UI_SURFACE_PLAN,
          props: { modules, runtimeIntent, codexId, capsuleId, threadId },
        },
        { sessionId, cartridge, device: deviceType },
      );

      return {
        success: true,
        message: `Generated A2UI payload with ${rendered.a2uiPayload.modules.length} module nodes`,
        surfacePlan: rendered.surfacePlan,
        a2uiPayload: rendered.a2uiPayload,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to generate A2UI payload",
      };
    }
  },
};

export const a2uiGeneratePayloadFromCapsulesAction = {
  name: "a2ui_generate_payload_from_capsules",
  description: `Generate an A2UI payload directly from runtime capsules. This action:
1. Uses runtime capsule heuristics to map capsules into surface planning modules
2. Builds a SurfacePlanV0 through the existing runtime planning service
3. Adapts the plan into an A2UI declarative payload

Use when user asks to generate A2UI from SmartTriad runtime capsules in one step.`,
  parameters: [
    {
      name: "capsules",
      type: "array" as const,
      description: "Runtime capsules: [{ id, app?, title? }]",
      required: true,
    },
    {
      name: "sessionId",
      type: "string" as const,
      description: "Session ID for plan generation.",
      required: true,
    },
    {
      name: "deviceType",
      type: "string" as const,
      description: 'Device type: "mobile", "tablet", or "desktop". Default: "desktop".',
      required: false,
    },
    {
      name: "runtimeIntent",
      type: "string" as const,
      description: 'Runtime intent such as "read", "watch", "play", "share", "make", "earn". Default: "read".',
      required: false,
    },
    {
      name: "cartridge",
      type: "string" as const,
      description: 'Cartridge key. Default: "Qriptopian".',
      required: false,
    },
    {
      name: "codexId",
      type: "string" as const,
      required: false,
    },
    {
      name: "capsuleId",
      type: "string" as const,
      required: false,
    },
    {
      name: "threadId",
      type: "string" as const,
      required: false,
    },
  ],
  handler: async ({
    capsules,
    sessionId,
    deviceType = "desktop",
    runtimeIntent = "read",
    cartridge = "Qriptopian",
    codexId,
    capsuleId,
    threadId,
  }: {
    capsules: Array<{
      id: string;
      app?: string;
      title?: string;
    }>;
    sessionId: string;
    deviceType?: DeviceType;
    runtimeIntent?: string;
    cartridge?: string;
    codexId?: string;
    capsuleId?: string;
    threadId?: string;
  }) => {
    try {
      const surfacePlan = await generateRuntimeSurfacePlan({
        capsules,
        deviceType,
        runtimeIntent,
        sessionId,
        cartridge,
        codexId,
        capsuleId,
        threadId,
      });

      const a2uiPayload = surfacePlanToA2UIPayload(surfacePlan);

      return {
        success: true,
        message: `Generated A2UI payload from ${capsules.length} capsules with ${a2uiPayload.modules.length} module nodes`,
        surfacePlan,
        a2uiPayload,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to generate A2UI payload from capsules",
      };
    }
  },
};

/**
 * Skill: Surface Planner — optimal rendering config for content type + context + breakpoint.
 * Wraps /api/skills/surface-plan for use inside the runtime copilot.
 */
export const skillSurfacePlanAction = {
  name: "skill_surface_plan",
  description: `Determine the optimal rendering configuration for a piece of content.
Given contentType (video/image/article/carousel/audio/link), displayContext (list/card/modal/detail/preview/embed),
and breakpoint (mobile/tablet/desktop), returns templateId, columns, thumbnailAspect, thumbnailSize, modalSize,
showPlayOverlay, cardDensity, layoutVariant, the CopilotKit copilotAction name to invoke, and a reasoning string.
Use before rendering any content surface to pick the right Liquid UI template and layout.`,
  parameters: [
    {
      name: "contentType",
      type: "string" as const,
      description: "Type of content: video | image | article | carousel | audio | link",
      required: true,
    },
    {
      name: "displayContext",
      type: "string" as const,
      description: "Where the content is being displayed: list | card | modal | detail | preview | embed",
      required: true,
    },
    {
      name: "breakpoint",
      type: "string" as const,
      description: "Active viewport breakpoint: mobile | tablet | desktop",
      required: true,
    },
    {
      name: "itemCount",
      type: "number" as const,
      description: "Number of content items in the collection (affects column count). Default: 10.",
      required: false,
    },
  ],
  handler: async ({
    contentType,
    displayContext,
    breakpoint,
    itemCount = 10,
  }: {
    contentType: string;
    displayContext: string;
    breakpoint: string;
    itemCount?: number;
  }) => {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/skills/surface-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, displayContext, breakpoint, itemCount }),
      });
      if (!res.ok) {
        return { success: false, error: `surface-plan skill returned ${res.status}` };
      }
      const json = await res.json();
      return { success: true, ...json.data };
    } catch (error: any) {
      return { success: false, error: error?.message || "surface-plan skill failed" };
    }
  },
};

export const a2uiActions = [
  a2uiGenerateSurfacePayloadAction,
  a2uiGeneratePayloadFromCapsulesAction,
  skillSurfacePlanAction,
];
