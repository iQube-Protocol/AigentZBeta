/**
 * Interaction Context Assembly — Journey Spine's bounded mutual awareness projection.
 *
 * SPEC-JS-001 §5, JS-LAW-004: Journey Spine, Companion, Experience Qube, and future
 * Differ may consume each other's bounded state, but each retains independent ownership.
 *
 * This service builds InteractionContext — what Companion, Experience, and other
 * systems can observe about the journey — while explicitly preserving:
 *
 *   `recommendation ≠ authorization` — Journey Spine suggests what to do;
 *   Constitutional Computing decides what you can do.
 *
 * InteractionContext exposes:
 * - What stages are READY, COMPLETE, WAITING, BLOCKED, OPTIONAL, FUTURE
 * - What conditions must be satisfied for progression (the requirements)
 * - What authority says about permission (from the owning capability)
 * - What Companion can explain and navigate to
 * - What Experience signals exist (with provenance)
 * - What Differ might later optimize (presentation hints)
 *
 * It does NOT expose:
 * - Authorization decisions (that stays with Constitutional Computing)
 * - Policy rules (only the outcomes, never the engine)
 * - Companion's own reasoning (only Companion owns that)
 */

import type {
  JourneyDefinition,
  JourneyRuntimeState,
  JourneyStageRuntimeState,
  InteractionContext,
  AuthorityProjection,
  DelegationProjection,
  ExperienceIntentProjection,
} from '@/types/journey';

/**
 * Assemble the InteractionContext from journey state, authority, and experience.
 *
 * @param journey The journey definition (static structure)
 * @param state The journey runtime state (where the participant is now)
 * @param authority Authority context from the owning capability (can they act?)
 * @param delegation Current delegation info if applicable
 * @param experience Experience intent signals if available
 * @returns InteractionContext ready for Companion, Experience, Differ consumption
 */
export function assembleInteractionContext(
  journey: JourneyDefinition,
  state: JourneyRuntimeState,
  authority?: AuthorityProjection,
  delegation?: DelegationProjection,
  experience?: ExperienceIntentProjection
): InteractionContext {
  // Extract stage IDs from the state — these are canonical
  const readyStages = state.stages
    .filter((s) => s.state === 'READY')
    .map((s) => s.stageId);

  const completeStages = state.stages
    .filter((s) => s.state === 'COMPLETE')
    .map((s) => s.stageId);

  const waitingStages = state.stages
    .filter((s) => s.state === 'WAITING')
    .map((s) => s.stageId);

  const blockedStages = state.stages
    .filter((s) => s.state === 'BLOCKED')
    .map((s) => s.stageId);

  const optionalStages = state.stages
    .filter((s) => s.state === 'OPTIONAL' || s.state === 'QUARANTINED')
    .map((s) => s.stageId);

  const futureStages = state.stages
    .filter((s) => s.state === 'NOT_STARTED')
    .map((s) => s.stageId);

  // Build the context
  const context: InteractionContext = {
    participantRef: state.subjectRef,
    personaRef: state.subjectRef, // May be enhanced by caller with real persona ID
    journeyId: journey.id,
    journeyVersion: journey.version,
    currentStageId: state.currentStageId,
    targetStageId: state.targetStageId || journey.destination,

    // Canonical stage states (never computed; always from authoritative resolver)
    readyStageIds: readyStages,
    completedStageIds: completeStages,
    waitingStageIds: waitingStages,
    blockedStageIds: blockedStages,
    optionalStageIds: optionalStages,
    futureStageIds: futureStages,

    // Available capabilities (surface references from the current journey)
    availableCapabilities: extractCapabilities(journey, state),

    // Required conditions for progression (what must be true)
    requiredConditions: extractRequiredConditions(journey, state),

    // Authority — from the owning capability, never from Journey Spine
    // CRITICAL: This is what constitutional computing says, not a recommendation
    authorityContext: authority || {
      permitted: false,
      reason: 'No authority context provided',
    },

    // Delegation context if applicable
    ...(delegation && { delegationContext: delegation }),

    // Experience signals with explicit provenance
    ...(experience && { experienceIntent: experience }),

    // Recommendations — clearly labeled as such
    recommendedNextActions: deriveRecommendations(journey, state, readyStages),
  };

  return context;
}

/**
 * Extract the list of available capability references from a journey.
 * These are the surfaces the journey can navigate to.
 */
function extractCapabilities(
  journey: JourneyDefinition,
  state: JourneyRuntimeState
): string[] {
  const capabilities = new Set<string>();

  // Add all capability references from all stages
  journey.stages.forEach((stage) => {
    stage.surfaces.forEach((surface) => {
      if (surface.ref) {
        capabilities.add(surface.ref);
      }
    });
  });

  return Array.from(capabilities);
}

/**
 * Extract the required conditions for progression.
 * These are the conditions that must be satisfied to reach the target state.
 */
function extractRequiredConditions(
  journey: JourneyDefinition,
  state: JourneyRuntimeState
) {
  const conditions: typeof state.interactionContext['requiredConditions'] = [];

  // For each READY or IN_PROGRESS stage, extract what must be satisfied next
  const activeStages = state.stages.filter(
    (s) => s.state === 'READY' || s.state === 'IN_PROGRESS'
  );

  activeStages.forEach((activeStage) => {
    const stageDef = journey.stages.find((s) => s.id === activeStage.stageId);
    if (!stageDef) return;

    // If the stage has a satisfactionCondition, that's the primary requirement
    if (stageDef.satisfactionCondition) {
      conditions.push(stageDef.satisfactionCondition);
    }

    // If the stage has dependencies, those are also requirements
    if (stageDef.dependencies) {
      conditions.push(...stageDef.dependencies);
    }
  });

  return conditions;
}

/**
 * Derive recommendations for next actions based on journey state.
 * These are what Journey Spine suggests; authority says whether they're possible.
 */
function deriveRecommendations(
  journey: JourneyDefinition,
  state: JourneyRuntimeState,
  readyStages: string[]
): string[] {
  const recommendations: string[] = [];

  // Recommend the ready stages (in order they appear in the definition)
  journey.stages.forEach((stage) => {
    if (readyStages.includes(stage.id)) {
      recommendations.push(stage.id);
    }
  });

  // If nothing is ready, recommend the next unblocked stage
  if (recommendations.length === 0) {
    const nextStage = journey.stages.find(
      (s) =>
        !state.stages
          .filter((st) => st.state === 'BLOCKED' || st.state === 'REFUSED')
          .map((st) => st.stageId)
          .includes(s.id)
    );
    if (nextStage) {
      recommendations.push(nextStage.id);
    }
  }

  return recommendations;
}

/**
 * Enrich an InteractionContext with Companion guidance.
 * This is called by Companion when it wants to provide guidance.
 */
export function addCompanionGuidance(
  context: InteractionContext,
  guidance: {
    currentPhase: string;
    explanation: string;
    nextSteps?: string[];
  }
): InteractionContext {
  return {
    ...context,
    companionGuidance: guidance,
  };
}

/**
 * Enrich an InteractionContext with presentation hints for Differ.
 * This is called when preparing to pass to an adaptive rendering engine.
 */
export function addPresentationHints(
  context: InteractionContext,
  hints: Array<{
    layout?: 'linear' | 'dag' | 'graph';
    density?: 'compact' | 'normal' | 'detailed';
    mode?: 'modal' | 'embedded' | 'cartridge';
  }>
): InteractionContext {
  return {
    ...context,
    presentationHints: hints,
  };
}
