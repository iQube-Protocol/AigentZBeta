/**
 * Chat-to-Deliberation Bridge — integrates deliberation invocation
 * into the chat response pipeline.
 *
 * When the operator naturally expresses intent to create a report or
 * reintroduction in the chat, this bridge:
 * 1. Detects the intent
 * 2. Initializes a deliberation session
 * 3. Returns an action card suggesting the operator engage the right-pane layout
 */

import {
  detectDeliberationIntent,
  extractBriefContextFromPrompt,
} from './deliberationIntentDetector';
import {
  initializeDeliberation,
  updateBriefSpec,
} from './deliberationSeam';
import type { DeliberationBrief } from '@/types/deliberativeArtifact';
import type { DeliberativeArtifactType } from '@/types/deliberativeArtifact';

export interface SuggestedDeliberationAction {
  /** Unique action ID. */
  id: string;
  /** The deliberation brief that's been initialized. */
  brief: DeliberationBrief;
  /** The artifact type being suggested. */
  artifactType: DeliberativeArtifactType;
  /** Human-readable suggestion text. */
  suggestion: string;
  /** Why this deliberation is being suggested. */
  reason: string;
  /** Confidence that this is the right action (0-1). */
  confidence: number;
}

/**
 * Analyze a user prompt and suggest deliberation if appropriate.
 * Returns null if no deliberation intent is detected.
 */
export function suggestDeliberationFromPrompt(
  userPrompt: string,
  ventureId: string,
  nbeId: string
): SuggestedDeliberationAction | null {
  const intent = detectDeliberationIntent(userPrompt);

  if (!intent.detected || !intent.artifactType) {
    return null;
  }

  // Only suggest if confidence is reasonably high
  if (intent.confidence < 0.7) {
    return null;
  }

  // Initialize a deliberation session
  const brief = initializeDeliberation(intent.artifactType, nbeId);

  // Populate briefSpec with context extracted from prompt
  const extractedContext = extractBriefContextFromPrompt(userPrompt, intent.artifactType);
  const populatedBrief = updateBriefSpec(brief, extractedContext);

  // Generate suggestion text based on artifact type
  let suggestion: string;
  let reason: string;

  if (intent.artifactType === 'venture-report') {
    const audience = intent.context?.audience || 'stakeholders';
    suggestion = `Let me help you create a venture report for ${audience}`;
    reason =
      intent.pattern === 'stakeholder_brief'
        ? `You mentioned needing to brief ${audience}`
        : 'You expressed intent to create a venture report';
  } else {
    const audience = intent.context?.audience || 'a previous contact';
    suggestion = `Let me help you reintroduce the venture to ${audience}`;
    reason =
      intent.pattern === 'relationship_renewal'
        ? `You want to re-engage with ${audience}`
        : 'You expressed intent to reintroduce the venture';
  }

  return {
    id: `deliberation_${brief.deliberationId}`,
    brief: populatedBrief,
    artifactType: intent.artifactType,
    suggestion,
    reason,
    confidence: intent.confidence,
  };
}

/**
 * Render a deliberation action as a suggested card to display in chat.
 * Used by the chat UI to show an action the operator can engage.
 */
export function renderDeliberationActionCard(action: SuggestedDeliberationAction): string {
  const emoji = action.artifactType === 'venture-report' ? '📋' : '🤝';
  return `
${emoji} **${action.suggestion}**

${action.reason}

Would you like to open the deliberation panel to refine the scope and gather evidence?
  `.trim();
}

/**
 * Check if a deliberation session should be auto-engaged based on the chat state.
 * Returns true if the user has been discussing deliberation-relevant topics.
 */
export function shouldAutoEngageDeliberation(
  recentMessagesCount: number,
  deliberationIntentCount: number
): boolean {
  // If user has expressed deliberation intent in the last few messages, auto-engage
  if (deliberationIntentCount >= 2) {
    return true;
  }

  // If they've been discussing for a while and mentioned it once, auto-engage
  if (recentMessagesCount > 5 && deliberationIntentCount >= 1) {
    return true;
  }

  return false;
}
