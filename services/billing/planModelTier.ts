/**
 * Plan-to-model routing — maps a resolved PersonaPlan to the appropriate
 * Anthropic model ID for aigentMe LLM calls.
 *
 * Tier → Model:
 *   Free (citizen, venture=none)  → Haiku  (low-cost inference)
 *   Sovereignty ($29) and above   → Sonnet (higher quality)
 *   Portfolio Operator ($2,999)   → Opus   (executive aigentMe)
 *
 * The `sovereignAccess` flag is the gate: it is true at sovereign_citizen and
 * above (including all Founder Office tiers), so Sonnet applies to every
 * paying citizen. Only the free Citizen tier receives Haiku.
 * Opus is reserved for venture_tier='elite' (Portfolio Operator) only.
 *
 * Call sites: nbeLlmRerank, specialistRecommender, briefBuilder.
 * Override the result via env (NBE_RERANK_LLM_MODEL_ANTHROPIC etc.) if
 * a workstream needs a different family for a specific call site.
 */

import type { PersonaPlan } from './personaPlan';

/** Canonical model IDs for the three tiers. */
export const PLAN_MODELS = {
  free:      'claude-haiku-4-5-20251001',
  sovereign: 'claude-sonnet-4-6',
  executive: 'claude-opus-4-6',
} as const;

export type PlanModelTier = keyof typeof PLAN_MODELS;

/**
 * Returns the Anthropic model ID appropriate for the persona's plan tier.
 * Pass `null` or `undefined` when the plan is unknown — falls back to Haiku.
 */
export function getPlanModelId(plan: PersonaPlan | null | undefined): string {
  if (!plan) return PLAN_MODELS.free;
  // Portfolio Operator: Executive aigentMe — Opus
  if (plan.ventureTier === 'elite') return PLAN_MODELS.executive;
  // Sovereignty tier and above (sovereign_citizen, steward, all FO tiers): Sonnet
  if (plan.sovereignAccess) return PLAN_MODELS.sovereign;
  // Free Citizen: Haiku
  return PLAN_MODELS.free;
}

/** Human-readable tier name for logging / receipts. */
export function getPlanModelTierLabel(plan: PersonaPlan | null | undefined): PlanModelTier {
  if (!plan) return 'free';
  if (plan.ventureTier === 'elite') return 'executive';
  if (plan.sovereignAccess) return 'sovereign';
  return 'free';
}
