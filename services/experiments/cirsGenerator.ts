/**
 * CIRS generator — the GENERATIVE INTELLIGENCE role (CRP-002 / metaMe IRL,
 * Aletheon independence protocol 2026-07-09).
 *
 * Proposes the candidate invariant sets for the CIRS, INDEPENDENTLY and BLIND to
 * any prior CIRS version — the principal investigators never author them. This
 * is a DISTINCT cognitive role from the evaluator (IRL-EXP-001's prediction
 * under test): the generator routes through the `draft` reasoning stage while
 * the evaluator routes through `classification`, so the two resolve to DIFFERENT
 * providers/models by construction. The deltas between an independent reference
 * and an independent prediction are therefore real cross-model disagreements,
 * not a model agreeing with itself.
 *
 * Every entry it emits is `experimental` / `ratified: false` (Law XI — only the
 * constitutional role ratifies). Server-only (calls a provider).
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import {
  buildExperimentalCIRSEntry,
  parsePredictedLabels,
  CIRS_INTENTS,
  CIRS_VERSION,
} from '@/services/experiments/cirs';
import type { CanonicalInvariantReference } from '@/types/invariantIntelligence';

/**
 * Independently propose the reference invariant set for a single intent. Blind:
 * the prompt carries ONLY the intent — no prior reference, no evaluator output.
 */
export async function generateInvariantsForIntent(intent: string, maxTokens = 300): Promise<string[]> {
  const system =
    'You are proposing a REFERENCE set of governing INVARIANTS (principles) for an intent — ' +
    'the minimal principles any faithful response to that intent must honour. You have NO ' +
    'access to any prior reference; propose independently, from first principles. Return ONLY ' +
    'a JSON array of short lowercase principle labels (1-2 words each). Be minimal.';
  const user = `Intent: ${intent}`;
  // 'draft' → the `context` reasoning stage → a DIFFERENT provider than the
  // evaluator's 'classification' → `capability` stage: independence by routing.
  const result = await callSovereign('draft', system, user, maxTokens, 0);
  return parsePredictedLabels(result.text);
}

/**
 * Generate an independent, experimental CIRS over the intent spread (default
 * CIRS_INTENTS). This IS CIRS-v0.1 when first run — an experimental instrument,
 * never authored by the PIs. A per-intent generation failure yields an empty
 * candidate set (recorded honestly, never masked).
 */
export async function generateCandidateCIRS(
  intents: readonly string[] = CIRS_INTENTS,
  version: string = CIRS_VERSION,
): Promise<CanonicalInvariantReference[]> {
  const out: CanonicalInvariantReference[] = [];
  for (const intent of intents) {
    let labels: string[] = [];
    try {
      labels = await generateInvariantsForIntent(intent);
    } catch {
      labels = [];
    }
    out.push(buildExperimentalCIRSEntry(intent, labels, version));
  }
  return out;
}
