import type {
  ComposerDeploymentMode,
  ComposerDeploymentTarget,
  ComposerMessengerProvider,
} from "./deploymentBlock";

export type RoutingCandidate = {
  target: ComposerDeploymentTarget;
  provider: ComposerMessengerProvider | "runtime";
  ready: boolean;
  trustScore: number;
  costScore: number;
  suitabilityScore: number;
  reasons: string[];
  watchouts: string[];
};

export type ComposerRoutingEnvelope = {
  recommendedTarget: ComposerDeploymentTarget;
  recommendedProvider: ComposerMessengerProvider | "runtime";
  summary: string;
  candidates: RoutingCandidate[];
};

export type ComposerRoutingEnvelopeInput = {
  mode: ComposerDeploymentMode;
  selectedTarget: ComposerDeploymentTarget;
  selectedProvider: ComposerMessengerProvider;
  discordReady: boolean;
  runtimeReady: boolean;
  hasPlayableMedia: boolean;
};

function buildCandidate(params: {
  target: ComposerDeploymentTarget;
  provider: ComposerMessengerProvider | "runtime";
  ready: boolean;
  trustScore: number;
  costScore: number;
  reasons: string[];
  watchouts: string[];
}): RoutingCandidate {
  const readinessBonus = params.ready ? 2 : 0;
  const suitabilityScore = params.trustScore + params.costScore + readinessBonus;
  return {
    ...params,
    suitabilityScore,
  };
}

export function buildComposerRoutingEnvelope(
  input: ComposerRoutingEnvelopeInput,
): ComposerRoutingEnvelope {
  const studioPreview = buildCandidate({
    target: "studio_preview",
    provider: "runtime",
    ready: true,
    trustScore: 5,
    costScore: 5,
    reasons: [
      "No external dispatch required",
      "Best target for proof and review loops",
    ],
    watchouts: ["Not a public delivery target"],
  });

  const runtimeLaunch = buildCandidate({
    target: "runtime_launch",
    provider: "runtime",
    ready: input.runtimeReady && input.hasPlayableMedia,
    trustScore: 4,
    costScore: 4,
    reasons: [
      "Closest to end-user runtime delivery",
      "Good fit once media and proof are stable",
    ],
    watchouts: [
      input.hasPlayableMedia ? "" : "Best after media outputs are confirmed",
      input.runtimeReady ? "" : "Runtime preview is not yet ready",
    ].filter(Boolean),
  });

  const mcpApp = buildCandidate({
    target: "mcp_app",
    provider: input.selectedProvider,
    ready: input.hasPlayableMedia,
    trustScore: 4,
    costScore: input.mode === "live" ? 3 : 4,
    reasons: [
      "Reusable deployment surface for ExperienceQubes",
      "Fits the standalone deployment block model",
    ],
    watchouts: [input.hasPlayableMedia ? "" : "Prefer after artifact generation is complete"].filter(Boolean),
  });

  const discord = buildCandidate({
    target: "discord_mcp",
    provider: "discord",
    ready: input.discordReady && input.hasPlayableMedia,
    trustScore: 3,
    costScore: 4,
    reasons: [
      "Good for distribution and audience reach",
      "Strong fit for shareable runtime experiences",
    ],
    watchouts: [
      input.discordReady ? "" : "Discord connection is not ready",
      input.mode === "live" ? "Live dispatch depends on provider/channel readiness" : "",
    ].filter(Boolean),
  });

  const candidates = [studioPreview, runtimeLaunch, mcpApp, discord].sort(
    (a, b) => b.suitabilityScore - a.suitabilityScore,
  );

  const recommended = candidates[0];
  const summary = recommended.ready
    ? `Recommended path: ${recommended.target} via ${recommended.provider} based on current readiness, trust, and cost posture.`
    : `Current best candidate is ${recommended.target}, but it still has blockers that should be addressed before dispatch.`;

  return {
    recommendedTarget: recommended.target,
    recommendedProvider: recommended.provider,
    summary,
    candidates,
  };
}
