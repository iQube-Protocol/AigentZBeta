import { buildSurfacePlanV0 } from "./surfaceSelector";
import { ContentModuleRenderProfileV0, SurfacePlanV0, type DeviceContext, type Intent } from "@metame/contracts";
import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import type { RuntimeCapsule } from "@/types/smartContent";

// Map existing device types to surface plan device context
export function mapDeviceTypeToDeviceContext(deviceType: DeviceType): DeviceContext {
  const deviceClassMap: Record<DeviceType, DeviceContext["device_class"]> = {
    mobile: "mobile",
    tablet: "tablet", 
    desktop: "desktop",
  };

  // Default orientations for each device type
  const orientationMap: Record<DeviceType, DeviceContext["orientation"]> = {
    mobile: "portrait",
    tablet: "portrait",
    desktop: "any",
  };

  // Real estate estimation based on device type
  const realEstateMap: Record<DeviceType, DeviceContext["real_estate"]> = {
    mobile: "s",
    tablet: "m", 
    desktop: "l",
  };

  return {
    device_class: deviceClassMap[deviceType],
    orientation: orientationMap[deviceType],
    interaction: deviceType === "desktop" ? "pointer" : "touch",
    real_estate: realEstateMap[deviceType],
  };
}

// Map runtime intent to surface plan intent
export function mapRuntimeIntent(intent: string): Intent {
  const intentMap: Record<string, Intent["mode"]> = {
    watch: "play",
    listen: "be", 
    read: "be",
    play: "play",
    find: "make",
    earn: "earn",
    make: "make",
    be: "be",
  };

  return {
    user_ask: `User wants to ${intent}`,
    mode: intentMap[intent] || "be",
    focus: `metaMe runtime experience`,
  };
}

// Convert runtime capsules to surface plan modules
export async function convertCapsulesToModules(
  capsules: RuntimeCapsule[],
  cartridge: string = "Qriptopian"
) {
  // Load available render profiles
  const profilesResponse = await fetch(`/api/metame/runtime/plan?cartridge=${cartridge}`);
  if (!profilesResponse.ok) {
    throw new Error("Failed to load render profiles");
  }
  
  const { available_modules } = await profilesResponse.json();
  
  // Map capsules to module types based on their properties
  return capsules.map((capsule, index) => {
    let moduleType = "Qriptopian.StoryCard"; // default
    
    // Simple heuristic mapping based on capsule properties
    if (capsule.app?.toLowerCase().includes("knyt")) {
      if (capsule.title?.toLowerCase().includes("badge") || capsule.title?.toLowerCase().includes("portal")) {
        moduleType = "KNYT.BadgePortal";
      } else if (capsule.title?.toLowerCase().includes("thread") || capsule.title?.toLowerCase().includes("canon")) {
        moduleType = "KNYT.CanonThread";
      } else if (capsule.title?.toLowerCase().includes("quote")) {
        moduleType = "KNYT.QuotePanel";
      } else if (capsule.title?.toLowerCase().includes("timeline")) {
        moduleType = "KNYT.TimelineStrip";
      } else if (capsule.title?.toLowerCase().includes("map") || capsule.title?.toLowerCase().includes("world")) {
        moduleType = "KNYT.WorldMapPanel";
      } else if (capsule.title?.toLowerCase().includes("quiz") || capsule.title?.toLowerCase().includes("check")) {
        moduleType = "KNYT.CanonCheckQuiz";
      } else if (capsule.title?.toLowerCase().includes("glossary")) {
        moduleType = "KNYT.GlossaryChip";
      }
    } else if (capsule.app?.toLowerCase().includes("qriptopian")) {
      if (capsule.title?.toLowerCase().includes("editor") || capsule.title?.toLowerCase().includes("note")) {
        moduleType = "Qriptopian.EditorNote";
      }
    } else if (capsule.title?.toLowerCase().includes("share") || capsule.title?.toLowerCase().includes("gate")) {
      moduleType = "metaMe.ShareGate";
    }

    return {
      module_id: `capsule_${capsule.id}`,
      module_type: moduleType,
      source_refs: [{
        kind: "schema_ref" as const,
        id: `capsule:${capsule.id}`,
      }],
    };
  });
}

// Generate surface plan for runtime capsules
export async function generateRuntimeSurfacePlan(args: {
  capsules: RuntimeCapsule[];
  deviceType: DeviceType;
  runtimeIntent: string;
  sessionId: string;
  cartridge?: string;
  codexId?: string;
  capsuleId?: string;
  threadId?: string;
}): Promise<SurfacePlanV0> {
  const {
    capsules,
    deviceType,
    runtimeIntent,
    sessionId,
    cartridge = "Qriptopian",
    codexId,
    capsuleId,
    threadId,
  } = args;

  // Convert runtime context to surface plan context
  const deviceContext = mapDeviceTypeToDeviceContext(deviceType);
  const intent = mapRuntimeIntent(runtimeIntent);
  
  // Convert capsules to modules
  const modules = await convertCapsulesToModules(capsules, cartridge);

  // Generate plan ID
  const planId = `runtime_plan_${Date.now()}_${deviceType}_${runtimeIntent}`;

  // Verification refs
  const verification = {
    dis_ref: { kind: "doc_ref" as const, id: `dis:${cartridge}:v0` },
    constraint_manifest_ref: { kind: "doc_ref" as const, id: `constraints:${cartridge}:v0` },
    parity_report_ref: { kind: "doc_ref" as const, id: `parity:pending` },
  };

  // Build surface plan via API
  const response = await fetch("/api/metame/runtime/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      session_id: sessionId,
      cartridge,
      intent,
      device_context: deviceContext,
      codex_id: codexId,
      capsule_id: capsuleId,
      thread_id: threadId,
      modules,
      verification,
    }),
  });

  if (!response.ok) {
    throw new Error(`Surface plan generation failed: ${response.statusText}`);
  }

  return response.json();
}

// Get surface planning info for a cartridge
export async function getSurfacePlanningInfo(cartridge: string = "Qriptopian") {
  const response = await fetch(`/api/metame/runtime/plan?cartridge=${cartridge}`);
  if (!response.ok) {
    throw new Error(`Failed to get surface planning info: ${response.statusText}`);
  }
  return response.json();
}
