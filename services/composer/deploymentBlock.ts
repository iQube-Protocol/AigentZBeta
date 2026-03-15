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
};

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
      runtimeProfile: input.runtimeProfile,
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
      error: data?.error || "Failed to dispatch deployment payload",
      runtimeProfile: input.runtimeProfile,
    };
  }

  return {
      ok: true,
      target: input.target,
      variant: envelope.variant,
      mode: input.mode,
    provider: envelope.provider,
    status: input.mode === "live" ? "dispatched" : "simulated",
    publishUrl: envelope.publishUrl,
    launchUrl: envelope.launchUrl,
    response: data,
    warnings: Array.isArray(data?.warnings) ? data.warnings : undefined,
    runtimeProfile: input.runtimeProfile,
  };
}
