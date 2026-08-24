/**
 * Backward Compatibility Adapters — Journey Spine evolution without breaking changes.
 *
 * These adapters allow existing Guided Journey Runtime journeys to work unchanged
 * while optionally consuming Journey Spine features. They are NOT applied
 * automatically; journeys must explicitly opt in to new features.
 *
 * SPEC-JS-001 §13: "Do not perform a risky estate-wide migration in the first
 * increment. Build compatibility, then migrate journeys incrementally."
 *
 * For Stage 1, these adapters demonstrate that backward compatibility is
 * possible; Stage 2 will use them to migrate existing journeys.
 */

import type {
  JourneyDefinition,
  JourneyStageDefinition,
  ConditionExpression,
  StepRequirement,
} from '@/types/journey';
import { receiptCondition, andCondition } from './conditionEvaluator';

/**
 * Adapt a legacy Guided Journey Runtime journey definition to Journey Spine.
 *
 * Creates a new definition that:
 * 1. Maps completionEvidence → satisfactionCondition (preserves existing behavior)
 * 2. Maps prerequisites → dependencies (DAG-compatible representation)
 * 3. Infers requirement types from evidence structure
 *
 * Returns a new definition; does NOT modify the original.
 *
 * Usage:
 *   const legacyJourney = HORIZEN_MONEYPENNY_JOURNEY;
 *   const adaptedJourney = adaptLegacyJourneyDefinition(legacyJourney);
 *   // adaptedJourney is fully functional with Journey Spine features
 */
export function adaptLegacyJourneyDefinition(
  legacy: JourneyDefinition
): JourneyDefinition {
  return {
    ...legacy,
    stages: legacy.stages.map((stage) => adaptLegacyStageDefinition(stage)),
  };
}

/**
 * Adapt a legacy stage definition to Journey Spine.
 * Maps evidence requirements to satisfaction conditions.
 */
function adaptLegacyStageDefinition(
  legacy: JourneyStageDefinition
): JourneyStageDefinition {
  // Build satisfactionCondition from completionEvidence
  const satisfactionCondition = buildSatisfactionFromEvidence(legacy.completionEvidence);

  // Build dependencies from prerequisites
  // For now, this is a direct mapping; later it can be enhanced with more
  // sophisticated dependency expressions
  const dependencies = legacy.prerequisites.length > 0
    ? legacy.prerequisites.map((prereqId) => ({
        type: 'boolean' as const,
        value: prereqId,
      }))
    : undefined;

  // Infer requirement type from evidence structure
  const requirement = inferRequirement(legacy);

  return {
    ...legacy,
    satisfactionCondition,
    dependencies,
    requirement,
  };
}

/**
 * Build a satisfactionCondition from completionEvidence array.
 *
 * The adapted condition is logically equivalent: "all evidence fields
 * present and truthy". Using receipt conditions for now since most
 * completionEvidence fields map to receipt types.
 */
function buildSatisfactionFromEvidence(
  evidence: string[]
): ConditionExpression | undefined {
  if (!evidence || evidence.length === 0) return undefined;

  if (evidence.length === 1) {
    return receiptCondition(evidence[0]);
  }

  // Multiple evidence fields: all must be present (AND condition)
  return andCondition(...evidence.map((field) => receiptCondition(field)));
}

/**
 * Infer step requirement type from existing stage structure.
 *
 * Heuristics:
 * - If completionEvidence is empty → likely optional/presentation (OPTIONAL)
 * - If has nextStageId → likely required (REQUIRED)
 * - If in a branch → likely optional (OPTIONAL)
 * - Default → REQUIRED
 */
function inferRequirement(stage: JourneyStageDefinition): StepRequirement {
  if (!stage.completionEvidence || stage.completionEvidence.length === 0) {
    return 'optional'; // No evidence requirements = optional/presentation stage
  }

  if (stage.branch) {
    return 'optional'; // Branch stages are parallel, not required
  }

  if (stage.nextStageId) {
    return 'required'; // Has a next stage = required to progress
  }

  return 'required'; // Default assumption
}

/**
 * Check if a journey definition has been adapted to Journey Spine.
 * Returns true if it has satisfactionCondition or dependencies fields set.
 */
export function isAdaptedToJourneySpine(journey: JourneyDefinition): boolean {
  return journey.stages.some(
    (stage) => stage.satisfactionCondition !== undefined || stage.dependencies !== undefined
  );
}

/**
 * Create a minimal Journey Spine adapter for testing/debugging.
 * Takes only the essential fields; caller supplies the rest.
 */
export function createMinimalJourneySpineAdapter(
  journeyId: string,
  version: string
): {
  journeyId: string;
  version: string;
  label: string;
  destination?: string;
  subjectRef: string;
  stages: JourneyStageDefinition[];
} {
  return {
    journeyId,
    version,
    label: `Journey Spine v${version}`,
    subjectRef: 'participant',
    stages: [],
  };
}
