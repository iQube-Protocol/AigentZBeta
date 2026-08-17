/**
 * Deliberation Intent Detector — identifies when operators naturally express intent
 * to create venture reports or reintroductions from conversational prompts.
 *
 * Detects natural language patterns like:
 * - "create a report for the board"
 * - "I need to reintroduce the venture to..."
 * - "let's document where we are"
 * - "help me brief the investors"
 */

import type { DeliberativeArtifactType } from '@/types/deliberativeArtifact';

export interface DetectedDeliberationIntent {
  /** Whether a deliberation intent was detected. */
  detected: boolean;
  /** The artifact type if detected (venture-report or venture-reintroduction). */
  artifactType?: DeliberativeArtifactType;
  /** Confidence score (0-1) that this is a genuine deliberation request. */
  confidence: number;
  /** The specific pattern that triggered this detection. */
  pattern?: string;
  /** Extracted context from the user's prompt (audience, purpose, etc.). */
  context?: Record<string, string>;
}

/**
 * Detect if the user is asking for a venture report or reintroduction.
 * Analyzes prompt for keywords, intent patterns, and contextual clues.
 */
export function detectDeliberationIntent(prompt: string): DetectedDeliberationIntent {
  if (!prompt || prompt.length < 10) {
    return { detected: false, confidence: 0 };
  }

  const lowerPrompt = prompt.toLowerCase();
  const context: Record<string, string> = {};

  // ─── Venture Report Patterns ────────────────────────────────────────────────

  // Pattern 1: Explicit "report" intent (create + report/summary, optionally scoped to venture)
  if (
    lowerPrompt.includes('create') &&
    (lowerPrompt.includes('report') || lowerPrompt.includes('summary'))
  ) {
    // Extract audience if mentioned
    const audienceMatch = prompt.match(/(?:for|to)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i);
    if (audienceMatch) {
      context.audience = audienceMatch[1];
    }

    return {
      detected: true,
      artifactType: 'venture-report',
      confidence: 0.95,
      pattern: 'explicit_report_request',
      context,
    };
  }

  // Pattern 2: "Brief the X" (board, investors, partners)
  if (
    (lowerPrompt.includes('brief') || lowerPrompt.includes('update')) &&
    (lowerPrompt.includes('board') ||
      lowerPrompt.includes('investor') ||
      lowerPrompt.includes('partner') ||
      lowerPrompt.includes('team') ||
      lowerPrompt.includes('stakeholder'))
  ) {
    const audienceMatch = prompt.match(
      /(?:brief|update)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
    );
    if (audienceMatch) {
      context.audience = audienceMatch[1];
    }

    return {
      detected: true,
      artifactType: 'venture-report',
      confidence: 0.9,
      pattern: 'stakeholder_brief',
      context,
    };
  }

  // Pattern 3: "Help me document" or "Let's document where we are"
  if (
    (lowerPrompt.includes('document') || lowerPrompt.includes('where we are')) &&
    (lowerPrompt.includes('venture') || lowerPrompt.includes('status'))
  ) {
    return {
      detected: true,
      artifactType: 'venture-report',
      confidence: 0.8,
      pattern: 'documentation_intent',
      context,
    };
  }

  // ─── Venture Reintroduction Patterns ────────────────────────────────────────

  // Pattern 1: Explicit reintroduction
  if (
    lowerPrompt.includes('reintroduc') &&
    (lowerPrompt.includes('venture') || lowerPrompt.includes('startup') || lowerPrompt.includes('company'))
  ) {
    // Extract audience (who are we reintroducing to)
    const audienceMatch = prompt.match(/(?:to|for)\s+([^.!?]+)/i);
    if (audienceMatch) {
      context.audience = audienceMatch[1].trim().substring(0, 50); // Limit to 50 chars
    }

    return {
      detected: true,
      artifactType: 'venture-reintroduction',
      confidence: 0.95,
      pattern: 'explicit_reintroduction',
      context,
    };
  }

  // Pattern 2: "Help me re-engage" or "Win back"
  if (
    (lowerPrompt.includes('re-engage') ||
      lowerPrompt.includes('reengage') ||
      lowerPrompt.includes('win back') ||
      lowerPrompt.includes('reconnect')) &&
    (lowerPrompt.includes('investor') ||
      lowerPrompt.includes('partner') ||
      lowerPrompt.includes('contact') ||
      lowerPrompt.includes('relationship'))
  ) {
    return {
      detected: true,
      artifactType: 'venture-reintroduction',
      confidence: 0.85,
      pattern: 'relationship_renewal',
      context,
    };
  }

  // Pattern 3: "What should I tell X about our changes?"
  if (
    (lowerPrompt.includes('what should i') || lowerPrompt.includes('how do i')) &&
    (lowerPrompt.includes('tell') || lowerPrompt.includes('explain')) &&
    (lowerPrompt.includes('changed') || lowerPrompt.includes('evolved') || lowerPrompt.includes('pivoted'))
  ) {
    const audienceMatch = prompt.match(/tell\s+([^?]+)/i);
    if (audienceMatch) {
      context.audience = audienceMatch[1].trim().substring(0, 50);
    }

    return {
      detected: true,
      artifactType: 'venture-reintroduction',
      confidence: 0.8,
      pattern: 'change_narrative_request',
      context,
    };
  }

  // Pattern 4: "Last time they heard about us..." (implies time gap / reintroduction)
  if (
    (lowerPrompt.includes('last time') ||
      lowerPrompt.includes('it\'s been') ||
      lowerPrompt.includes('since we last') ||
      lowerPrompt.includes('heard about us'))
  ) {
    return {
      detected: true,
      artifactType: 'venture-reintroduction',
      confidence: 0.75,
      pattern: 'time_gap_indicator',
      context,
    };
  }

  // No deliberation intent detected
  return { detected: false, confidence: 0 };
}

/**
 * Extract suggested brief spec fields from the user's prompt.
 * Returns partial spec based on detected context.
 */
export function extractBriefContextFromPrompt(
  prompt: string,
  artifactType: DeliberativeArtifactType | string
): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  const lowerPrompt = prompt.toLowerCase();

  // Common fields for both report and reintroduction
  if (
    lowerPrompt.includes('internal') ||
    lowerPrompt.includes('just us') ||
    lowerPrompt.includes('confidential')
  ) {
    spec.disclosure = 'internal';
  } else if (lowerPrompt.includes('partner') || lowerPrompt.includes('partnership')) {
    spec.disclosure = 'partner';
  } else if (lowerPrompt.includes('investor')) {
    spec.disclosure = 'investor';
  } else if (lowerPrompt.includes('public') || lowerPrompt.includes('external')) {
    spec.disclosure = 'public';
  }

  // Extract date range for reports
  if (artifactType === 'venture-report') {
    if (lowerPrompt.includes('last quarter') || lowerPrompt.includes('q3') || lowerPrompt.includes('q4')) {
      spec.periodStart = 'last-quarter';
    } else if (lowerPrompt.includes('last month') || lowerPrompt.includes('past month')) {
      spec.periodStart = 'last-month';
    } else if (lowerPrompt.includes('current') || lowerPrompt.includes('where we are now')) {
      spec.periodStart = 'current';
    }
  }

  // Extract reintroduction specifics
  if (artifactType === 'venture-reintroduction') {
    // Try to determine when they last interacted
    if (
      lowerPrompt.includes('year ago') ||
      lowerPrompt.includes('12 months') ||
      lowerPrompt.includes('last year')
    ) {
      spec.lastInteractionDateHint = '1-year-ago';
    } else if (
      lowerPrompt.includes('6 months') ||
      lowerPrompt.includes('half a year')
    ) {
      spec.lastInteractionDateHint = '6-months-ago';
    }
  }

  return spec;
}
