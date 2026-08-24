/**
 * Journey Spine -> Adaptive Experience Engine adapter (SPEC-AEE-001 Part XI
 * §22).
 *
 * Converts an existing, authoritative `JourneyRuntimeState` +
 * `InteractionContext` (types/journey.ts, built by Journey Spine —
 * services/journey/resolveJourneyState.ts +
 * services/journey/interactionContextAssembly.ts) into the provider-neutral
 * `AdaptiveInteractionContext` the engine consumes.
 *
 * This module NEVER re-derives journey state — it only re-shapes what
 * Journey Spine already computed. Journey Spine remains authoritative
 * (SPEC-AEE-001 §5). Capability refs are built from each stage's own
 * `surfaces` (types/journey.ts's JourneySurfaceRef), never invented.
 *
 * `sensitive` is set true for any stage whose actorRole is PRINCIPAL or
 * whose surfaces are empty (internal-only) — a conservative default that
 * errs toward `NATIVE_ONLY` per the Financial Services Surface Residency
 * Matrix audit (codexes/packs/agentiq/updates/
 * 2026-08-24_aee-differ-phase0-audit-financial-services.md §2). Callers may
 * override per-stage via `sensitiveStageIds` for stages the audit has
 * explicitly classified otherwise (e.g. `orient`, `standing`).
 */

import { createHash } from 'crypto';
import type { InteractionContext, JourneyDefinition, JourneyRuntimeState } from '@/types/journey';
import type {
  AdaptiveInteractionContext,
  CapabilityProjectionRef,
  JourneyProjectionContext,
  ProjectionConstraint,
} from '@/types/adaptiveExperience';

export interface JourneySpineAdapterInput {
  journeyDefinition: JourneyDefinition;
  journeyState: JourneyRuntimeState;
  interactionContext: InteractionContext;
  hostId: string;
  /** Stage ids the caller has verified are NOT sensitive (safe for external
   *  render per the residency audit) despite the conservative default. */
  nonSensitiveStageIds?: string[];
  generatedAt: string;
}

function contextIdFor(journeyId: string, participantRef: string, generatedAt: string): string {
  return createHash('sha256')
    .update(`aee-context:${journeyId}:${participantRef}:${generatedAt}`)
    .digest('hex')
    .slice(0, 16);
}

export function buildJourneyProjectionContext(
  journeyState: JourneyRuntimeState,
  interactionContext: InteractionContext,
): JourneyProjectionContext {
  return {
    journeyId: journeyState.journeyId,
    journeyVersion: journeyState.journeyVersion,
    currentStageId: journeyState.currentStageId,
    targetStageId: journeyState.targetStageId,
    completedStageIds: interactionContext.completedStageIds,
    readyStageIds: interactionContext.readyStageIds,
    optionalStageIds: interactionContext.optionalStageIds,
    waitingStageIds: interactionContext.waitingStageIds,
    blockedStageIds: interactionContext.blockedStageIds,
    futureStageIds: interactionContext.futureStageIds,
  };
}

export function buildCapabilityRefsFromJourney(
  journeyDefinition: JourneyDefinition,
  nonSensitiveStageIds: Set<string>,
): CapabilityProjectionRef[] {
  return journeyDefinition.stages.map((stage) => {
    const isSensitiveByDefault = stage.actorRole === 'principal' || stage.actor === 'operator' || stage.surfaces.length === 0;
    const sensitive = nonSensitiveStageIds.has(stage.id) ? false : isSensitiveByDefault;

    return {
      capabilityId: stage.id,
      label: stage.label,
      description: stage.description,
      surfaceTypes: stage.surfaces.length
        ? [mapSurfaceMode(stage.surfaces[0].mode)]
        : ['component'],
      hostRefs: (stage.surfaces.length ? { native: stage.surfaces[0].ref } : {}) as Record<string, string>,
      actor: stage.actor,
      requiredState: stage.completionEvidence,
      sensitive,
    };
  });
}

function mapSurfaceMode(
  mode: string,
): 'component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action' {
  switch (mode) {
    case 'modal':
      return 'modal';
    case 'drawer':
      return 'modal';
    case 'iframe':
      return 'embed';
    case 'component':
      return 'component';
    case 'receipt-view':
      return 'component';
    case 'external-url':
      return 'embed';
    default:
      return 'component';
  }
}

/**
 * SPEC-AEE-001 Part III's hard constitutional boundary, encoded as
 * always-applied constraints rather than left to convention.
 */
export const CONSTITUTIONAL_PROJECTION_CONSTRAINTS: ProjectionConstraint[] = [
  { id: 'no-fabricated-completion', description: 'A projection may not mark a journey requirement satisfied.', hard: true },
  { id: 'no-fabricated-authority', description: 'A projection may not grant authority or create authorization.', hard: true },
  { id: 'no-optional-to-mandatory-inversion', description: 'A projection may not change a mandatory dependency into an optional one.', hard: true },
  { id: 'no-inferred-consent', description: 'A projection may not infer consent from convenience.', hard: true },
  { id: 'no-principal-delegation-by-presentation', description: 'A projection may not present a principal-only act as delegate-executable.', hard: true },
];

export function buildAdaptiveInteractionContext(input: JourneySpineAdapterInput): AdaptiveInteractionContext {
  const { journeyDefinition, journeyState, interactionContext, hostId, generatedAt } = input;
  const nonSensitive = new Set(input.nonSensitiveStageIds ?? []);

  return {
    contextId: contextIdFor(journeyState.journeyId, interactionContext.participantRef, generatedAt),
    participantRef: interactionContext.participantRef,
    journey: buildJourneyProjectionContext(journeyState, interactionContext),
    targetState: journeyState.targetStageId,
    capabilityRefs: buildCapabilityRefsFromJourney(journeyDefinition, nonSensitive),
    authorityContext: interactionContext.authorityContext,
    delegationContext: interactionContext.delegationContext,
    experienceIntent: interactionContext.experienceIntent,
    companion: interactionContext.companionGuidance
      ? {
          currentPhase: interactionContext.companionGuidance.currentPhase,
          explanation: interactionContext.companionGuidance.explanation,
          nextSteps: interactionContext.companionGuidance.nextSteps,
        }
      : undefined,
    host: { hostId, surfaceTypesSupported: ['component', 'modal', 'route', 'cartridge-tab', 'embed', 'companion-action'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
    generatedAt,
  };
}
