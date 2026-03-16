import type { ComposerRuntimeDeliveryProfile } from "./runtimeDeliveryProfile";

export type ComposerDeploymentTarget =
  | "studio_preview"
  | "runtime_launch"
  | "runtime_thin_client"
  | "mcp_app"
  | "discord_mcp";

export type ComposerDeploymentMode = "simulate" | "live";
export type ComposerMessengerProvider = "discord" | "whatsapp" | "telegram";
export type ComposerDeliveryVariant =
  | "runtime_standard"
  | "asset_link"
  | "discord_asset_inline"
  | "discord_experience_inline"
  | "runtime_thin_client";
export type ComposerDeploymentCapabilityState = "supported" | "limited" | "scaffolded";
export type ComposerDeploymentAdapter =
  | "studio"
  | "runtime"
  | "thin_client"
  | "mcp_app"
  | "discord_mcp";

export type ComposerDeploymentCapability = {
  adapter: ComposerDeploymentAdapter;
  state: ComposerDeploymentCapabilityState;
  summary: string;
  constraints?: string[];
};

export type ComposerDeploymentRequest = {
  tenantId: string;
  experienceId: string;
  personaId: string;
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
  mode: ComposerDeploymentMode;
  provider?: ComposerMessengerProvider;
  tool?: string;
  message?: string;
  channelId?: string;
  inviteUrl?: string;
  publishUrl?: string;
  thumbnailUrl?: string;
  titleOverride?: string;
  campaignId?: string;
  runtimeProfile?: ComposerRuntimeDeliveryProfile;
};

export type ComposerDeploymentResult = {
  ok: boolean;
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
  mode: ComposerDeploymentMode;
  provider: "discord" | "runtime" | "mcp";
  status: "ready" | "simulated" | "dispatched" | "failed";
  publishUrl?: string;
  launchUrl?: string;
  response?: Record<string, unknown>;
  warnings?: string[];
  error?: string;
  runtimeProfile?: ComposerRuntimeDeliveryProfile;
  capability: ComposerDeploymentCapability;
};

export function resolveDeploymentCapability(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
}): ComposerDeploymentCapability {
  if (params.target === "studio_preview") {
    return {
      adapter: "studio",
      state: "supported",
      summary: "First-class internal proof and review surface.",
    };
  }

  if (params.target === "runtime_thin_client") {
    return {
      adapter: "thin_client",
      state: "limited",
      summary: "Thin-client runtime handoff is available, but media parity still depends on runtime-host support.",
      constraints: [
        "Video rendering and execution still depend on runtime-host parity.",
      ],
    };
  }

  if (params.target === "runtime_launch") {
    if (params.variant === "runtime_thin_client") {
      return {
        adapter: "thin_client",
        state: "limited",
        summary: "Thin-client runtime handoff is available, but media parity still depends on runtime-host support.",
        constraints: [
          "Video rendering and execution still depend on runtime-host parity.",
        ],
      };
    }
    return {
      adapter: "runtime",
      state: "limited",
      summary: "Runtime launch is wired, but media-specific parity still varies by destination surface.",
      constraints: [
        "Video runtime publication remains under active validation.",
      ],
    };
  }

  if (params.target === "mcp_app") {
    return {
      adapter: "mcp_app",
      state: "scaffolded",
      summary: "MCP deployment is a reusable scaffold; downstream adapters still determine final delivery behavior.",
      constraints: [
        "Delivery depends on the selected destination adapter.",
      ],
    };
  }

  if (params.target === "discord_mcp") {
    if (params.variant === "discord_experience_inline") {
      return {
        adapter: "discord_mcp",
        state: "scaffolded",
        summary: "Discord-native experience rendering is scaffolded, not production-ready.",
        constraints: [
          "Experience execution inside Discord is not fully implemented.",
        ],
      };
    }
    if (params.variant === "discord_asset_inline") {
      return {
        adapter: "discord_mcp",
        state: "limited",
        summary: "Discord asset delivery works through shared media URLs, not true native upload or attachment parity.",
        constraints: [
          "Inline video still depends on Discord client behavior for direct media URLs.",
        ],
      };
    }
    return {
      adapter: "discord_mcp",
      state: "supported",
      summary: "External link dispatch is the currently supported Discord delivery mode.",
    };
  }

  return {
    adapter: "mcp_app",
    state: "scaffolded",
    summary: "Deployment adapter capability has not been classified yet.",
  };
}

function buildCapabilityWarnings(capability: ComposerDeploymentCapability): string[] {
  if (capability.state === "supported") return [];
  return [capability.summary, ...(capability.constraints || [])];
}

export function getDeploymentTargetLabel(target: ComposerDeploymentTarget): string {
  switch (target) {
    case "studio_preview":
      return "Studio Preview";
    case "runtime_launch":
      return "Runtime Launch";
    case "runtime_thin_client":
      return "Runtime Thin Client";
    case "mcp_app":
      return "MCP App Deployment";
    case "discord_mcp":
      return "Discord via MCP";
    default:
      return target;
  }
}

export function resolveMessengerProvider(
  target: ComposerDeploymentTarget,
): "discord" | "runtime" | "mcp" {
  switch (target) {
    case "discord_mcp":
      return "discord";
    case "runtime_launch":
    case "runtime_thin_client":
      return "runtime";
    case "mcp_app":
    case "studio_preview":
    default:
      return "mcp";
  }
}

export function buildDeploymentEnvelope(input: ComposerDeploymentRequest) {
  const provider = resolveMessengerProvider(input.target);
  const requestedProvider = input.provider || "discord";
  const variant = input.variant || "runtime_standard";
  const launchUrl = input.publishUrl || `/studio/composer/experience/${encodeURIComponent(input.experienceId)}`;

  return {
    provider,
    requestedProvider,
    variant,
    mode: input.mode,
    target: input.target,
    targetLabel: getDeploymentTargetLabel(input.target),
    launchUrl,
    publishUrl: input.publishUrl || launchUrl,
    payload: {
      provider: requestedProvider,
      target: input.target,
      variant,
      mode: input.mode,
      tool: input.tool || "next.best",
      tenantId: input.tenantId,
      experienceId: input.experienceId,
      personaId: input.personaId,
      message: input.message || "",
      channelId: input.channelId || "",
      inviteUrl: input.inviteUrl || "",
      publishUrl: input.publishUrl || launchUrl,
      thumbnailUrl: input.thumbnailUrl || "",
      titleOverride: input.titleOverride || "",
      campaignId: input.campaignId || "experience-distribution-demo",
      runtimeProfile: input.runtimeProfile,
    },
  };
}

export async function dispatchComposerDeployment(
  input: ComposerDeploymentRequest,
): Promise<ComposerDeploymentResult> {
  const envelope = buildDeploymentEnvelope(input);
  const capability = resolveDeploymentCapability({
    target: input.target,
    variant: envelope.variant,
  });
  const capabilityWarnings = buildCapabilityWarnings(capability);

  if (
    input.target === "studio_preview" ||
    input.target === "runtime_launch" ||
    input.target === "runtime_thin_client"
  ) {
    const destinationSurface =
      input.target === "studio_preview"
        ? "studio_preview"
        : input.target === "runtime_thin_client" || envelope.variant === "runtime_thin_client"
          ? "runtime_thin_client"
          : "runtime";
    return {
      ok: true,
      target: input.target,
      variant: envelope.variant,
      mode: input.mode,
      provider: envelope.provider,
      status: input.target === "studio_preview" ? "ready" : "simulated",
      publishUrl: envelope.publishUrl,
      launchUrl: envelope.launchUrl,
      response: {
        targetLabel: envelope.targetLabel,
        destinationSurface,
        capability,
        note:
          input.target === "studio_preview"
            ? "Deployment is represented by the active Studio preview."
            : input.target === "runtime_thin_client" || envelope.variant === "runtime_thin_client"
              ? "Runtime thin-client launch prepared with content-only shell handoff."
              : "Runtime launch prepared for the full metaMe runtime surface.",
        runtimeProfile: input.runtimeProfile,
        nextActions:
          input.target === "studio_preview"
            ? ["Review in Studio preview"]
            : input.target === "runtime_thin_client" || envelope.variant === "runtime_thin_client"
              ? ["Open in thin client", "Validate read/watch quick link routing"]
              : ["Open in runtime", "Validate runtime cartridge and codex routing"],
      },
      warnings: capabilityWarnings.length > 0 ? capabilityWarnings : undefined,
      runtimeProfile: input.runtimeProfile,
      capability,
    };
  }

  const response = await fetch("/api/messenger/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope.payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    return {
      ok: false,
      target: input.target,
      variant: envelope.variant,
      mode: input.mode,
      provider: envelope.provider,
      status: "failed",
      publishUrl: envelope.publishUrl,
      launchUrl: envelope.launchUrl,
      response: data,
      warnings: capabilityWarnings.length > 0 ? capabilityWarnings : undefined,
      error: data?.error || "Failed to dispatch deployment payload",
      runtimeProfile: input.runtimeProfile,
      capability,
    };
  }

  const responseWarnings = Array.isArray(data?.warnings) ? data.warnings.filter((item): item is string => typeof item === "string") : [];
  return {
    ok: true,
    target: input.target,
    variant: envelope.variant,
    mode: input.mode,
    provider: envelope.provider,
    status: input.mode === "live" ? "dispatched" : "simulated",
    publishUrl: envelope.publishUrl,
    launchUrl: envelope.launchUrl,
    response: {
      ...(data && typeof data === "object" ? data : {}),
      capability,
    },
    warnings: [...responseWarnings, ...capabilityWarnings].filter((value, index, array) => array.indexOf(value) === index),
    runtimeProfile: input.runtimeProfile,
    capability,
  };
}
