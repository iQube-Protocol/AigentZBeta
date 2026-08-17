/**
 * Deliberation Seam — lifecycle manager for deliberative artifacts.
 *
 * Handles state transitions and brief completeness checks.
 */

import { generateId } from '@/utils/ids';
import type {
  DeliberationBrief,
  DeliberationState,
  VentureReportBriefSpec,
  VentureReintroductionBriefSpec,
} from '@/types/deliberativeArtifact';

// ─── Deliberation Lifecycle ─────────────────────────────────────────────────

/**
 * Create a new deliberation session.
 */
export function initializeDeliberation(
  artifactType: string,
  nbeId: string
): DeliberationBrief {
  return {
    deliberationId: generateId('delibr'),
    artifactType,
    nbeId,
    state: 'proposed',
    briefSpec: {},
    unresolvedQuestions: [],
    isComplete: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition deliberation to context-assembling state.
 * Called when AigentMe begins gathering evidence and asking initial questions.
 */
export function transitionToContextAssembling(
  brief: DeliberationBrief
): DeliberationBrief {
  return {
    ...brief,
    state: 'context_assembling',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition to deliberating state.
 * Called when evidence is assembled and operator is answering clarifying questions.
 */
export function transitionToDeliberating(
  brief: DeliberationBrief
): DeliberationBrief {
  return {
    ...brief,
    state: 'deliberating',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update the brief spec with operator input.
 * Parses natural language answers where possible, updates structured fields.
 */
export function updateBriefSpec(
  brief: DeliberationBrief,
  updates: Record<string, unknown>
): DeliberationBrief {
  return {
    ...brief,
    briefSpec: { ...brief.briefSpec, ...updates },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update unresolved questions based on what's been answered.
 */
export function updateUnresolvedQuestions(
  brief: DeliberationBrief,
  remainingQuestions: string[]
): DeliberationBrief {
  return {
    ...brief,
    unresolvedQuestions: remainingQuestions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition to brief-ready state after operator confirms scope.
 */
export function transitionToBriefReady(
  brief: DeliberationBrief
): DeliberationBrief {
  return {
    ...brief,
    state: 'brief_ready',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition to approved-for-draft after operator approves the brief.
 */
export function transitionToApprovedForDraft(
  brief: DeliberationBrief
): DeliberationBrief {
  return {
    ...brief,
    state: 'approved_for_draft',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition to drafted after artifact generation completes.
 */
export function transitionToDrafted(
  brief: DeliberationBrief,
  artifactId: string
): DeliberationBrief {
  return {
    ...brief,
    state: 'drafted',
    briefSpec: { ...brief.briefSpec, generatedArtifactId: artifactId },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Cancel deliberation (operator dismissal or error).
 */
export function cancelDeliberation(
  brief: DeliberationBrief,
  error?: string
): DeliberationBrief {
  return {
    ...brief,
    state: 'cancelled',
    error,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Completeness Checks ────────────────────────────────────────────────────

/**
 * Check if a venture-report brief is sufficiently complete for draft generation.
 * Requires: purpose, disclosure, scope, period/current-state indicator.
 */
export function isVentureReportBriefComplete(spec: VentureReportBriefSpec): boolean {
  const hasPurpose = spec.purpose !== undefined;
  const hasDisclosure = spec.disclosure !== undefined;
  const hasScope = spec.scope && spec.scope.length > 0;
  const hasPeriodOrCurrent =
    (spec.periodStart !== undefined && spec.periodEnd !== undefined) ||
    spec.periodStart === 'current';

  return hasPurpose && hasDisclosure && hasScope && hasPeriodOrCurrent;
}

/**
 * Check if a venture-reintroduction brief is sufficiently complete.
 * Requires: purpose, audience/context, desired outcome, current-scope.
 * Prior understanding: either explicit record or operator-stated as unknown.
 */
export function isVentureReintroductionBriefComplete(
  spec: VentureReintroductionBriefSpec
): boolean {
  const hasPurpose = spec.purpose !== undefined;
  const hasAudience = spec.audience !== undefined;
  const hasOutcome = spec.reintroductionGoal !== undefined;
  const hasScope = spec.scope && spec.scope.length > 0;
  const hasPriorUnderstanding =
    spec.priorUnderstandingSource &&
    (spec.priorUnderstandingSource === 'unknown' ||
      spec.likelyPriorUnderstanding !== undefined);

  return hasPurpose && hasAudience && hasOutcome && hasScope && hasPriorUnderstanding;
}

/**
 * Generic completeness check — delegates to type-specific checks.
 */
export function isBriefComplete(brief: DeliberationBrief): boolean {
  switch (brief.artifactType) {
    case 'venture-report':
      return isVentureReportBriefComplete(brief.briefSpec as VentureReportBriefSpec);
    case 'venture-reintroduction':
      return isVentureReintroductionBriefComplete(
        brief.briefSpec as VentureReintroductionBriefSpec
      );
    default:
      // Unknown types are considered complete (no deliberation expected)
      return true;
  }
}

/**
 * Update completeness flag.
 */
export function updateBriefCompleteness(brief: DeliberationBrief): DeliberationBrief {
  return {
    ...brief,
    isComplete: isBriefComplete(brief),
  };
}
