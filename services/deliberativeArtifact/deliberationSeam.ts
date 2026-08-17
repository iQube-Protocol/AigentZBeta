/**
 * Deliberation Seam — lifecycle manager for deliberative artifacts.
 *
 * Handles state transitions, brief completeness checks, and evidence assembly
 * for deliberative artifact composition.
 */

// Generate a unique ID for deliberation sessions
function generateDeliberationId(): string {
  return `delibr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
import type {
  DeliberationBrief,
  DeliberationState,
  VentureReportBriefSpec,
  VentureReintroductionBriefSpec,
  ReportEvidenceItem,
} from '@/types/deliberativeArtifact';
import {
  assembleVentureReportEvidence,
  assembleVentureReintroductionEvidence,
} from '@/services/venture/assembleVentureReportEvidence';
import type { NarrativeGap, ReintroductionBundle } from '@/services/venture/assembleVentureReportEvidence';

// ─── Deliberation Lifecycle ─────────────────────────────────────────────────

/**
 * Create a new deliberation session.
 */
export function initializeDeliberation(
  artifactType: string,
  nbeId: string
): DeliberationBrief {
  return {
    deliberationId: generateDeliberationId(),
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
 * Gather evidence for a venture report.
 * Called during context_assembling phase to fetch platform-native artifacts.
 * Stores evidence array in brief for display in the deliberation panel.
 */
export async function gatherVentureReportEvidence(
  brief: DeliberationBrief,
  ventureId: string,
  personaId: string
): Promise<{ brief: DeliberationBrief; evidence: ReportEvidenceItem[] }> {
  if (brief.artifactType !== 'venture-report') {
    return { brief, evidence: [] };
  }

  try {
    const bundle = await assembleVentureReportEvidence(ventureId, personaId);

    const updatedBrief: DeliberationBrief = {
      ...brief,
      briefSpec: {
        ...brief.briefSpec,
        assembledEvidenceCount: bundle.artifacts.length,
        maturityDistribution: bundle.maturityDistribution,
      },
      updatedAt: new Date().toISOString(),
    };

    return { brief: updatedBrief, evidence: bundle.artifacts };
  } catch (error) {
    // Soft failure — continue with empty evidence rather than blocking the brief
    console.error('[Gate D] Error assembling venture evidence:', error);
    return { brief, evidence: [] };
  }
}

/**
 * Gather evidence for a venture reintroduction.
 * Called during context_assembling phase to fetch platform-native artifacts
 * plus analyze narrative gaps between prior understanding and current state.
 */
export async function gatherVentureReintroductionEvidence(
  brief: DeliberationBrief,
  ventureId: string,
  personaId: string
): Promise<{
  brief: DeliberationBrief;
  evidence: ReportEvidenceItem[];
  narrativeGaps: NarrativeGap[];
  narrativeAlignment: number;
}> {
  if (brief.artifactType !== 'venture-reintroduction') {
    return { brief, evidence: [], narrativeGaps: [], narrativeAlignment: 1.0 };
  }

  try {
    // Extract last interaction date from briefSpec if available
    const spec = brief.briefSpec as Record<string, unknown>;
    const lastInteractionDate = (spec.lastInteraction as string) || undefined;

    const bundle = await assembleVentureReintroductionEvidence(
      ventureId,
      personaId,
      lastInteractionDate
    );

    const updatedBrief: DeliberationBrief = {
      ...brief,
      briefSpec: {
        ...brief.briefSpec,
        assembledEvidenceCount: bundle.artifacts.length,
        maturityDistribution: bundle.maturityDistribution,
        narrativeGapCount: bundle.narrativeGaps.length,
        narrativeAlignment: Math.round(bundle.narrativeAlignment * 100), // Store as percentage
      },
      updatedAt: new Date().toISOString(),
    };

    return {
      brief: updatedBrief,
      evidence: bundle.artifacts,
      narrativeGaps: bundle.narrativeGaps,
      narrativeAlignment: bundle.narrativeAlignment,
    };
  } catch (error) {
    // Soft failure — continue with empty evidence rather than blocking the brief
    console.error('[Gate E] Error assembling reintroduction evidence:', error);
    return { brief, evidence: [], narrativeGaps: [], narrativeAlignment: 1.0 };
  }
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
  const hasScope = !!(spec.scope && spec.scope.length > 0);
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
  const hasScope = !!(spec.scope && spec.scope.length > 0);
  const hasPriorUnderstanding = !!(
    spec.priorUnderstandingSource &&
    (spec.priorUnderstandingSource === 'unknown' ||
      spec.likelyPriorUnderstanding !== undefined)
  );

  return hasPurpose && hasAudience && hasOutcome && hasScope && hasPriorUnderstanding;
}

/**
 * Generic completeness check — delegates to type-specific checks.
 */
export function isBriefComplete(brief: DeliberationBrief): boolean {
  if (!brief.briefSpec) return false;

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
  const isComplete: boolean = isBriefComplete(brief);
  return {
    ...brief,
    isComplete,
  };
}
