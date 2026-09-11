/**
 * CIRS — the Canonical Invariant Reference Set (CRP-002 / metaMe IRL).
 *
 * INDEPENDENCE PROTOCOL (Aletheon 2026-07-09 — part of the EXP-006 protocol):
 * the principal investigators (the operator, Aletheon, this agent) must NOT
 * author the reference invariant sets. Authoring them would contaminate the
 * experiment with a bias toward the theory we hope to discover. The candidate
 * invariant sets are therefore GENERATED INDEPENDENTLY by a generative agent
 * (services/experiments/cirsGenerator.ts), BLIND to any prior CIRS version, and
 * every entry is `experimental` / `ratified: false` until the constitutional
 * role ratifies it (Law XI). The CIRS is an experimental instrument, not a
 * canonical truth — analogous to an initial scientific hypothesis.
 *
 * This module holds only what is legitimately PROTOCOL (not the answer): the
 * representative spread of intents to project, the version label, and a pure
 * stamping helper. It deliberately does NOT hold hand-authored invariant sets.
 */

import type { CanonicalInvariantReference } from '@/types/invariantIntelligence';

/** The current CIRS version label — experimental until operator-ratified. */
export const CIRS_VERSION = 'v0.1';

/**
 * The representative spread of intents EXP-006 projects (6–8, across intent
 * primitives). Selecting the STIMULI is legitimate experimental design; it is
 * the invariant SETS that must be independently generated, never these prompts.
 */
export const CIRS_INTENTS: readonly string[] = [
  'Design a constitutional onboarding experience', // design
  'Explain a difficult concept to a child', // explain / teach
  'Design an authenticated delegation API', // design
  'Analyse a public policy', // evaluate / govern
  'Diagnose a system failure', // diagnose
  'Negotiate an agreement between two parties', // negotiate
  'Verify a factual claim', // verify
];

/**
 * Stamp an independently-generated projection as an EXPERIMENTAL CIRS entry.
 * Pure — the generative role supplies `candidateInvariants`; this only marks
 * confidence/version/ratified. Never call with PI-authored invariants.
 */
export function buildExperimentalCIRSEntry(
  intent: string,
  candidateInvariants: string[],
  version: string = CIRS_VERSION,
): CanonicalInvariantReference {
  return {
    intent,
    candidateInvariants,
    confidence: 'experimental',
    version,
    ratified: false,
  };
}

/**
 * Parse a model completion into a clean principle-label list (lenient — a JSON
 * array anywhere, or a comma/line list). Shared by the generative role (building
 * the CIRS) and the evaluative role (the prediction under test). Pure.
 */
export function parsePredictedLabels(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to line parsing */
    }
  }
  return text
    .replace(/[[\]"']/g, '')
    .split(/[,\n]/)
    .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter((s) => s.length > 0 && s.length < 40);
}
