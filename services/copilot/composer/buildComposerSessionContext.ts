import type {
  BuildComposerSessionContextInput,
  ComposerSessionContext,
} from "./types";

export function buildComposerSessionContext(
  input: BuildComposerSessionContextInput,
): ComposerSessionContext {
  return {
    sessionIdentity: {
      sessionId: input.sessionId,
      timestamp: input.timestamp ?? new Date().toISOString(),
      tenantId: input.tenantId,
      userId: input.userId,
      personaId: input.personaId,
    },
    userContext: {
      personaContext: input.personaContext,
      activeDataQubes: input.activeDataQubes ?? [],
      activeContentQubes: input.activeContentQubes ?? [],
    },
    studioContext: {
      currentPhase: input.currentPhase ?? "Intent",
      activeExperienceTab: input.activeExperienceTab,
      activeResourceSubTab: input.activeResourceSubTab,
      activeParityTab: input.activeParityTab,
      interactionMode: input.interactionMode ?? "text",
    },
    templateContext: {
      selectedTemplateId: input.selectedTemplateId,
      selectedTemplateName: input.selectedTemplateName,
      candidateTemplateIds: input.candidateTemplateIds ?? [],
      inferredIntent: input.inferredIntent,
      inferredMediaMode: input.inferredMediaMode,
    },
    customizationContext: {
      fields: input.customizationFields ?? {},
      suggestedPrompt: input.suggestedPrompt,
      suggestedPrompts: input.suggestedPrompts,
      unresolvedQuestions: input.unresolvedQuestions ?? [],
    },
    resourceContext: {
      selectedProviders: input.selectedProviders ?? [],
      selectedSkills: input.selectedSkills ?? [],
      selectedResources: input.selectedResources ?? [],
      requiredUserInputs: input.requiredUserInputs ?? [],
      generationCostEnvelope: input.generationCostEnvelope ?? {
        status: "stubbed",
        notes: [],
      },
    },
    designContext: {
      activeDesignQubeId: input.activeDesignQubeId,
      activeDesignQubeName: input.activeDesignQubeName,
      designSummary: input.designSummary ?? [],
      orientationAssetPlan: input.orientationAssetPlan ?? {
        portraitNeeded: false,
        landscapeNeeded: false,
        notes: [],
      },
    },
    experienceContext: {
      selectedExperienceQubeId: input.selectedExperienceQubeId,
      selectedExperienceQubeName: input.selectedExperienceQubeName,
      availableExperienceQubeIds: input.availableExperienceQubeIds ?? [],
    },
    previewContext: {
      device: input.previewDevice,
      orientation: input.previewOrientation,
      runtimeLoaded: input.runtimeLoaded ?? false,
      previewStatus: input.previewStatus ?? "idle",
    },
    reviewContext: {
      parityStatus: input.parityStatus ?? "idle",
      surfacePlanStatus: input.surfacePlanStatus ?? "idle",
      dvnReceiptStatus: input.dvnReceiptStatus ?? "idle",
      blockers: input.blockers ?? [],
    },
    deploymentContext: {
      deploymentTargetState: {
        targets: input.deploymentTargets ?? [],
        recommendedTarget: input.recommendedDeploymentTarget,
      },
      deploymentReady: input.deploymentReady ?? false,
      notes: input.deploymentNotes ?? [],
    },
  };
}

export function renderComposerSessionContext(
  context: ComposerSessionContext,
): string {
  const lines = [
    "[Studio Session Context]",
    `Phase: ${context.studioContext.currentPhase}`,
    context.studioContext.activeExperienceTab
      ? `Active tab: ${context.studioContext.activeExperienceTab}`
      : null,
    context.templateContext.selectedTemplateName
      ? `Selected template: ${context.templateContext.selectedTemplateName}`
      : "Selected template: none",
    context.templateContext.inferredMediaMode
      ? `Inferred media mode: ${context.templateContext.inferredMediaMode}`
      : null,
    context.resourceContext.selectedProviders?.length
      ? `Selected providers: ${context.resourceContext.selectedProviders.join(", ")}`
      : "Selected providers: none",
    context.resourceContext.selectedSkills?.length
      ? `Selected skills: ${context.resourceContext.selectedSkills.join(", ")}`
      : "Selected skills: none",
    context.designContext.activeDesignQubeName
      ? `Active DesignQube: ${context.designContext.activeDesignQubeName}`
      : "Active DesignQube: none",
    context.experienceContext.selectedExperienceQubeName
      ? `Active ExperienceQube: ${context.experienceContext.selectedExperienceQubeName}`
      : "Active ExperienceQube: none",
    context.previewContext.device || context.previewContext.orientation
      ? `Preview: ${[
          context.previewContext.device,
          context.previewContext.orientation,
          context.previewContext.previewStatus,
        ]
          .filter(Boolean)
          .join(" ")}`
      : null,
    `Parity: ${context.reviewContext.parityStatus ?? "idle"}`,
    `Surface plan: ${context.reviewContext.surfacePlanStatus ?? "idle"}`,
    `DVN receipts: ${context.reviewContext.dvnReceiptStatus ?? "idle"}`,
    context.userContext.personaContext?.name
      ? `Persona context: ${context.userContext.personaContext.name}`
      : "Persona context: none",
    context.userContext.activeDataQubes?.length
      ? `Active DataQubes: ${context.userContext.activeDataQubes
          .map((q) => q.name)
          .join(", ")}`
      : "Active DataQubes: none",
    context.userContext.activeContentQubes?.length
      ? `Active ContentQubes: ${context.userContext.activeContentQubes
          .map((q) => q.name)
          .join(", ")}`
      : "Active ContentQubes: none",
  ];

  return lines.filter(Boolean).join("\n");
}
