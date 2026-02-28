import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import {
  generateRuntimeSurfacePlan,
  mapDeviceTypeToDeviceContext,
  mapRuntimeIntent,
} from "@/services/metame/surfacePlanningService";
import { surfacePlanToA2UIPayload } from "@/services/a2ui/surfacePlanAdapter";

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
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const planId = `a2ui_plan_${Date.now()}_${deviceType}_${runtimeIntent}`;

      const surfacePlanResponse = await fetch(`${baseUrl}/api/metame/runtime/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: planId,
          session_id: sessionId,
          cartridge,
          intent: mapRuntimeIntent(runtimeIntent),
          device_context: mapDeviceTypeToDeviceContext(deviceType),
          codex_id: codexId,
          capsule_id: capsuleId,
          thread_id: threadId,
          modules,
          verification: {
            dis_ref: { kind: "doc_ref", id: `dis:${cartridge}:v0` },
            constraint_manifest_ref: { kind: "doc_ref", id: `constraints:${cartridge}:v0` },
            parity_report_ref: { kind: "doc_ref", id: "parity:pending" },
          },
        }),
      });

      if (!surfacePlanResponse.ok) {
        const errorText = await surfacePlanResponse.text();
        return {
          success: false,
          error: `Surface plan generation failed: ${errorText}`,
        };
      }

      const surfacePlan = await surfacePlanResponse.json();
      const a2uiPayload = surfacePlanToA2UIPayload(surfacePlan);

      return {
        success: true,
        message: `Generated A2UI payload with ${a2uiPayload.modules.length} module nodes`,
        surfacePlan,
        a2uiPayload,
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

export const a2uiActions = [a2uiGenerateSurfacePayloadAction, a2uiGeneratePayloadFromCapsulesAction];
