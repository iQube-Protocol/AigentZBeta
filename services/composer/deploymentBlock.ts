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
export type ComposerDeploymentDeliveryMode =
  | "asset_link"
  | "inline_asset"
  | "inline_experience"
  | "browser_launch"
  | "thin_client_handoff";
export type ComposerDeploymentCapabilityState = "supported" | "limited" | "scaffolded";
export type ComposerDeploymentAdapter =
  | "studio"
  | "runtime"
  | "thin_client"
  | "mcp_app"
  | "discord_mcp"
  | "aa_api"
  | "xmtp";

export type ComposerDeploymentAdapterDeclaration = {
  adapter: ComposerDeploymentAdapter;
  label: string;
  availability: "active" | "planned";
  supportedModes: ComposerDeploymentMode[];
  supportedTargets: ComposerDeploymentTarget[];
  supportedVariants: ComposerDeliveryVariant[];
  note: string;
  onboarding?: string[];
};

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
  adapterDeclaration: ComposerDeploymentAdapterDeclaration;
  deliveryMode: ComposerDeploymentDeliveryMode;
  destinationAdapter: ComposerDeploymentAdapter;
};

export const DEPLOYMENT_ADAPTER_DECLARATIONS: Record<
  ComposerDeploymentAdapter,
  ComposerDeploymentAdapterDeclaration
> = {
  studio: {
    adapter: "studio",
    label: "Studio Preview",
    availability: "active",
    supportedModes: ["simulate", "live"],
    supportedTargets: ["studio_preview"],
    supportedVariants: ["runtime_standard"],
    note: "Internal proof and review surface for Composer iterations.",
    onboarding: ["Use Studio Preview as the baseline proof loop before external deployment."],
  },
  runtime: {
    adapter: "runtime",
    label: "metaMe Runtime",
    availability: "active",
    supportedModes: ["simulate", "live"],
    supportedTargets: ["runtime_launch"],
    supportedVariants: ["runtime_standard"],
    note: "Primary runtime handoff for full-surface launches.",
    onboarding: ["Use Runtime Launch once the artifact is verified in Studio and codex routing is set."],
  },
  thin_client: {
    adapter: "thin_client",
    label: "metaMe Runtime Thin Client",
    availability: "active",
    supportedModes: ["simulate", "live"],
    supportedTargets: ["runtime_launch", "runtime_thin_client"],
    supportedVariants: ["runtime_thin_client"],
    note: "Thin-client handoff with content-only runtime chrome.",
    onboarding: ["Use thin-client handoff when you want the runtime shell minimized and content-first rendering."],
  },
  mcp_app: {
    adapter: "mcp_app",
    label: "ExperienceQube MCP App",
    availability: "active",
    supportedModes: ["simulate", "live"],
    supportedTargets: ["mcp_app"],
    supportedVariants: ["asset_link", "runtime_standard", "runtime_thin_client"],
    note: "Reusable scaffold that hands off to downstream delivery adapters.",
    onboarding: ["Use MCP App as an intermediate adapter when the final delivery destination is still being selected."],
  },
  discord_mcp: {
    adapter: "discord_mcp",
    label: "Discord via MCP",
    availability: "active",
    supportedModes: ["simulate", "live"],
    supportedTargets: ["discord_mcp"],
    supportedVariants: ["asset_link", "discord_asset_inline", "discord_experience_inline"],
    note: "Discord transport adapter with external-link support and partial inline media support.",
    onboarding: ["Use Discord via MCP for distribution workflows after the artifact and destination channel are confirmed."],
  },
  aa_api: {
    adapter: "aa_api",
    label: "AA API",
    availability: "planned",
    supportedModes: [],
    supportedTargets: [],
    supportedVariants: [],
    note: "Planned structured runtime/app adapter for post-3D expansion.",
    onboarding: [
      "Planned onboarding: define AA API payload schema and transport contract.",
      "Planned onboarding: map deployment proof into AA API response envelopes.",
    ],
  },
  xmtp: {
    adapter: "xmtp",
    label: "XMTP",
    availability: "planned",
    supportedModes: [],
    supportedTargets: [],
    supportedVariants: [],
    note: "Planned messaging adapter for wallet-native distribution.",
    onboarding: [
      "Planned onboarding: define wallet-address routing and transport envelope requirements.",
      "Planned onboarding: map proof/receipt payloads into XMTP message semantics.",
    ],
  },
};

export function getDeploymentAdapterDeclaration(
  adapter: ComposerDeploymentAdapter,
): ComposerDeploymentAdapterDeclaration {
  return DEPLOYMENT_ADAPTER_DECLARATIONS[adapter];
}

export function listDeploymentAdapterDeclarations(): ComposerDeploymentAdapterDeclaration[] {
  const orderedAdapters: ComposerDeploymentAdapter[] = [
    "studio",
    "runtime",
    "thin_client",
    "mcp_app",
    "discord_mcp",
    "aa_api",
    "xmtp",
  ];
  return orderedAdapters.map((adapter) => DEPLOYMENT_ADAPTER_DECLARATIONS[adapter]);
}

export function getSupportedVariantsForTarget(
  target: ComposerDeploymentTarget,
): ComposerDeliveryVariant[] {
  switch (target) {
    case "studio_preview":
      return ["runtime_standard"];
    case "runtime_launch":
      return ["runtime_standard", "runtime_thin_client"];
    case "runtime_thin_client":
      return ["runtime_thin_client"];
    case "mcp_app":
      return ["asset_link", "runtime_standard", "runtime_thin_client"];
    case "discord_mcp":
      return ["asset_link", "discord_asset_inline", "discord_experience_inline"];
    default:
      return ["runtime_standard"];
  }
}

export function resolveDeploymentDeliveryMode(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
}): ComposerDeploymentDeliveryMode {
  if (params.target === "studio_preview") return "browser_launch";
  if (params.target === "runtime_thin_client" || params.variant === "runtime_thin_client") {
    return "thin_client_handoff";
  }
  if (params.variant === "discord_asset_inline") return "inline_asset";
  if (params.variant === "discord_experience_inline") return "inline_experience";
  if (params.variant === "asset_link") return "asset_link";
  return "browser_launch";
}

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

export function resolveDeploymentAdapterDeclaration(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
}): ComposerDeploymentAdapterDeclaration {
  const capability = resolveDeploymentCapability(params);
  return getDeploymentAdapterDeclaration(capability.adapter);
}

export function validateDeploymentSupport(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
  mode: ComposerDeploymentMode;
}): {
  ok: boolean;
  error?: string;
  warnings: string[];
  capability: ComposerDeploymentCapability;
  adapterDeclaration: ComposerDeploymentAdapterDeclaration;
  deliveryMode: ComposerDeploymentDeliveryMode;
  destinationAdapter: ComposerDeploymentAdapter;
} {
  const resolvedVariant =
    params.variant || getSupportedVariantsForTarget(params.target)[0] || "runtime_standard";
  const capability = resolveDeploymentCapability({
    target: params.target,
    variant: resolvedVariant,
  });
  const adapterDeclaration = getDeploymentAdapterDeclaration(capability.adapter);
  const deliveryMode = resolveDeploymentDeliveryMode({
    target: params.target,
    variant: resolvedVariant,
  });
  const warnings = buildCapabilityWarnings(capability);

  if (!adapterDeclaration.supportedTargets.includes(params.target)) {
    return {
      ok: false,
      error: `${adapterDeclaration.label} does not support the ${params.target} target.`,
      warnings,
      capability,
      adapterDeclaration,
      deliveryMode,
      destinationAdapter: capability.adapter,
    };
  }

  if (!adapterDeclaration.supportedVariants.includes(resolvedVariant)) {
    return {
      ok: false,
      error: `${adapterDeclaration.label} does not support the ${resolvedVariant} delivery variant.`,
      warnings,
      capability,
      adapterDeclaration,
      deliveryMode,
      destinationAdapter: capability.adapter,
    };
  }

  if (!adapterDeclaration.supportedModes.includes(params.mode)) {
    return {
      ok: false,
      error: `${adapterDeclaration.label} does not support ${params.mode} mode.`,
      warnings,
      capability,
      adapterDeclaration,
      deliveryMode,
      destinationAdapter: capability.adapter,
    };
  }

  return {
    ok: true,
    warnings,
    capability,
    adapterDeclaration,
    deliveryMode,
    destinationAdapter: capability.adapter,
  };
}

export function resolveDeploymentFallbackGuidance(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
}): string[] {
  const capability = resolveDeploymentCapability(params);
  if (capability.state === "supported") {
    return ["This adapter is fully supported for the selected delivery mode."];
  }

  if (capability.adapter === "thin_client") {
    return [
      "Fallback: use Studio Preview for proof loops while thin-client parity catches up.",
      "Fallback: use Runtime Launch when full runtime behavior is acceptable.",
    ];
  }

  if (capability.adapter === "runtime") {
    return [
      "Fallback: use Studio Preview to verify artifacts before runtime handoff.",
      "Fallback: use Discord asset link for external distribution while runtime parity is stabilised.",
    ];
  }

  if (capability.adapter === "discord_mcp") {
    if (params.variant === "discord_experience_inline") {
      return [
        "Fallback: switch to Asset link outside Discord for the supported path.",
        "Fallback: use Runtime Launch if the experience should execute outside Discord.",
      ];
    }
    if (params.variant === "discord_asset_inline") {
      return [
        "Fallback: switch to Asset link outside Discord for the reliable distribution path.",
      ];
    }
  }

  if (capability.adapter === "mcp_app") {
    return [
      "Fallback: choose Runtime Launch or Discord via MCP for an active downstream adapter.",
    ];
  }

  if (capability.adapter === "aa_api" || capability.adapter === "xmtp") {
    return ["Planned adapter only. Use Runtime Launch or Discord via MCP for active delivery today."];
  }

  return ["Fallback: use Studio Preview while this adapter path is refined."];
}

export function resolveDeploymentRemediationActions(params: {
  target: ComposerDeploymentTarget;
  variant?: ComposerDeliveryVariant;
}): string[] {
  const capability = resolveDeploymentCapability(params);
  const adapterDeclaration = getDeploymentAdapterDeclaration(capability.adapter);

  if (adapterDeclaration.availability === "planned") {
    return adapterDeclaration.onboarding || ["Planned adapter. No active remediation path yet."];
  }

  if (capability.adapter === "discord_mcp") {
    if (params.variant === "discord_experience_inline") {
      return [
        "Switch to Asset link outside Discord for the supported path.",
        "Use Check Discord Connection before live dispatch.",
      ];
    }
    if (params.variant === "discord_asset_inline") {
      return [
        "Confirm the media URL is directly accessible before dispatch.",
        "Fallback to Asset link outside Discord if inline client behavior is inconsistent.",
      ];
    }
    return [
      "Confirm the destination channel or invite is valid before live dispatch.",
    ];
  }

  if (capability.adapter === "thin_client") {
    return [
      "Verify codex, tab, and cartridge routing before dispatch.",
      "Fallback to full Runtime Launch if thin-client parity is incomplete.",
    ];
  }

  if (capability.adapter === "runtime") {
    return [
      "Validate runtime proof and codex routing in Studio before live handoff.",
      "Fallback to Studio Preview if runtime media behavior is still under review.",
    ];
  }

  if (capability.adapter === "mcp_app") {
    return [
      "Select a downstream active adapter before treating MCP deployment as final delivery.",
    ];
  }

  return adapterDeclaration.onboarding || ["No additional remediation required."];
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
  const support = validateDeploymentSupport({
    target: input.target,
    variant: envelope.variant,
    mode: input.mode,
  });
  const capability = support.capability;
  const adapterDeclaration = support.adapterDeclaration;
  const capabilityWarnings = support.warnings;
  const deliveryMode = support.deliveryMode;
  const destinationAdapter = support.destinationAdapter;

  if (!support.ok) {
    return {
      ok: false,
      target: input.target,
      variant: envelope.variant,
      mode: input.mode,
      provider: envelope.provider,
      status: "failed",
      publishUrl: envelope.publishUrl,
      launchUrl: envelope.launchUrl,
      response: {
        targetLabel: envelope.targetLabel,
        capability,
        adapterDeclaration,
        deliveryMode,
        destinationAdapter,
      },
      warnings: capabilityWarnings.length > 0 ? capabilityWarnings : undefined,
      error: support.error || "Unsupported deployment combination",
      runtimeProfile: input.runtimeProfile,
      capability,
      adapterDeclaration,
      deliveryMode,
      destinationAdapter,
    };
  }

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
        adapterDeclaration,
        deliveryMode,
        destinationAdapter,
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
      adapterDeclaration,
      deliveryMode,
      destinationAdapter,
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
      adapterDeclaration,
      deliveryMode,
      destinationAdapter,
    };
  }

  const responseWarnings = Array.isArray(data?.warnings)
    ? (data.warnings as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
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
      adapterDeclaration,
      deliveryMode,
      destinationAdapter,
    },
    warnings: [...responseWarnings, ...capabilityWarnings].filter((value, index, array) => array.indexOf(value) === index),
    runtimeProfile: input.runtimeProfile,
    capability,
    adapterDeclaration,
    deliveryMode,
    destinationAdapter,
  };
}
