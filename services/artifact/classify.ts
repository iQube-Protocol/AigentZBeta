/**
 * Artifact Runtime — the classify step (CFS-025 Phase 1).
 *
 * Consequence Engineering's FIRST question is not "should this be constitutional?"
 * but "what is the consequence CLASS?" (types/artifactRuntime.ts §8, invariant
 * `consequence-classification-first`). This module implements `ClassifyFn`: given
 * a profile + the composition input + the invoking context, it returns the
 * consequence tier the artifact runs under. Classification NEVER publishes and
 * NEVER promotes — it only decides which lifecycle `runArtifact` will walk.
 *
 * ── The Phase-1 heuristic (deliberately simple + honest; NOT a learned model) ──
 * The tiers are, in ascending consequence: disposable | operational | constitutional.
 * The rules are applied IN ORDER; the first that matches wins:
 *
 *   1. EXPLICIT PUBLISH INTENT → constitutional.
 *      The caller set `context.mode === 'publish'` — an explicit intent to publish
 *      canonically. This is the honest signal that an artifact is meant to become
 *      authoritative. (Actual publication is still gated downstream in runArtifact;
 *      classifying constitutional only selects the full lifecycle.)
 *
 *   2. NO PERSISTENCE INTENT → disposable.
 *      Nothing has been composed and nothing is referenced (`result === null` AND
 *      `compositionRef === null`) and there is no publish intent. This is a
 *      scratch / propose-only run — a notebook. It incurs NO receipts, Standing,
 *      Registry, or audit.
 *
 *   3. INHERENTLY-CANONICAL PROFILE (with ratification governing it) → constitutional.
 *      The profile is one whose artifacts ARE canonical by nature — a policy, a
 *      standard, or an agreement — AND the profile requires ratification. Such an
 *      artifact, once it carries real content (rule 2 did not fire), enters the
 *      constitutional lifecycle. (Again: entering the lifecycle ≠ publishing; the
 *      publish gate stays in runArtifact.)
 *
 *   4. DEFAULT → operational.
 *      Everything else — real content, no canonical mandate, no publish intent —
 *      is GitHub-grade: versioned/reviewed but not constitutional.
 *
 * This is a heuristic, not an oracle. It errs toward the LOWER tier (operational,
 * not constitutional) unless an explicit signal (publish intent, or a
 * canonical-by-nature profile) justifies the ceremony — the anti-over-governance
 * stance CFS-025 exists to protect. Promotion between tiers is a separate,
 * deliberate act (`canPromote`), never a side effect of classification.
 *
 * Pure-ish: async to satisfy the `ClassifyFn` seam, but no I/O, no clock, no
 * randomness — deterministic for a given (profile, input, context).
 *
 * TIER DISCIPLINE: the context carries only a T2-safe `actorCommitment`; no T0
 * identifier is read or expressible here.
 */

import type {
  ClassifyFn,
  ConsequenceClass,
  ArtifactProfileId,
  ArtifactCompositionInput,
  ArtifactContext,
} from '@/types/artifactRuntime';
import { resolveProfile } from '@/services/artifact/profiles';

/**
 * The profiles whose artifacts are CANONICAL BY NATURE. A policy, a published
 * standard, and an executed agreement are consequential the moment they carry
 * real content. This set is the classify-local heuristic named in rule 3 above —
 * it is intentionally NOT a field on ArtifactProfile (the contract stays clean);
 * it is the runtime's editorial judgement about which profiles skip straight to
 * the constitutional tier once composed.
 */
const INHERENTLY_CANONICAL_PROFILES: ReadonlySet<ArtifactProfileId> = new Set<ArtifactProfileId>([
  'policy',
  'standard',
  'agreement',
]);

/** True when the run carries neither a composed result nor a composition ref —
 *  a scratch / propose-only run with no persistence intent. Pure. */
function hasNoPersistenceIntent(input: ArtifactCompositionInput): boolean {
  return input.result === null && input.compositionRef === null;
}

/**
 * Classify an artifact's consequence tier. Implements `ClassifyFn`. See the
 * module header for the ordered heuristic each branch corresponds to.
 */
export const classifyArtifact: ClassifyFn = async (
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
): Promise<ConsequenceClass> => {
  const config = resolveProfile(profile);

  // Rule 1 — explicit intent to publish canonically.
  if (context.mode === 'publish') return 'constitutional';

  // Rule 2 — no persistence intent (scratch / propose-only): a notebook.
  if (hasNoPersistenceIntent(input)) return 'disposable';

  // Rule 3 — canonical-by-nature profile that ratification governs.
  if (INHERENTLY_CANONICAL_PROFILES.has(profile) && config.ratificationRequired) {
    return 'constitutional';
  }

  // Rule 4 — default: operational (GitHub-grade, not canonical).
  return 'operational';
};

export default classifyArtifact;
