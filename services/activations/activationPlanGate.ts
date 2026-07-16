/**
 * activationPlanGate — the single source of truth for which activation
 * surfaces are gated by the persona's PLAN (the paywall), and which plan tier
 * unlocks each.
 *
 * Both activation services (spineActivations — the live path — and
 * personaActivations) read this map so the eligibility rule and the
 * upgrade-tier hint never drift between them.
 *
 * `entitled(plan)` answers "does this plan already grant the surface?".
 * `requiredTier` is the lowest tier whose checkout unlocks it — used by the
 * Activations catalogue to open the upgrade modal scoped to that tier when the
 * block is plan-based (vs admin-grant / invite / cohort, which route to
 * "Request access" instead).
 */

import type { PersonaPlan } from '@/services/billing/personaPlan';
import type { TierKey } from '@/services/billing/planCheckout';

export interface ActivationPlanGate {
  /** True when the persona's plan already grants self-activation. */
  entitled: (plan: PersonaPlan) => boolean;
  /** Lowest tier whose purchase unlocks the surface (for the upgrade CTA). */
  requiredTier: TierKey;
}

/**
 * Premium cartridge activations gated by plan. All four require entering the
 * Founder Office (any paid venture tier), so the lowest unlock is venture_lite.
 * If a future surface is gated on Sovereignty/Stewardship specifically, set its
 * requiredTier to 'sovereign_citizen' / 'steward'.
 */
export const ACTIVATION_PLAN_GATE: Record<string, ActivationPlanGate> = {
  // Sovereignty tier (T1) — aigentZ lite + developer incubation
  'aigent-z': { entitled: (p) => p.aigentzLiteAccess, requiredTier: 'sovereign_citizen' },
  // Research Copilot (IRL) — the researcher pathway's peer to the aigentZ/DevOn
  // developer copilot, but sold as its OWN unlock with a unique SKU (the
  // dedicated `research_copilot` tier, $29/mo — same stage as Sovereignty).
  // Deliberately its OWN entitlement flag, NOT aigentzLiteAccess: buying aigentZ
  // (Sovereignty) does not grant the Research Copilot, and vice versa.
  'researcher': { entitled: (p) => p.researchCopilotAccess, requiredTier: 'research_copilot' },
  // Founder Office tiers (venture_lite+)
  'venture-lab': { entitled: (p) => p.ventureLabAccess, requiredTier: 'venture_lite' },
  'marketa': { entitled: (p) => p.marketaAccess, requiredTier: 'venture_lite' },
  'metame-studio': { entitled: (p) => p.studioAccess, requiredTier: 'venture_lite' },
  'human-mobility-services': { entitled: (p) => p.hmsAccess, requiredTier: 'venture_lite' },
};

/** True when this activation has a plan-based gate at all. */
export function hasPlanGate(activationId: string): boolean {
  return activationId in ACTIVATION_PLAN_GATE;
}

/** The plan's entitlement for this activation (false when no gate / no plan). */
export function isPlanEntitled(activationId: string, plan: PersonaPlan | null): boolean {
  if (!plan) return false;
  return !!ACTIVATION_PLAN_GATE[activationId]?.entitled(plan);
}

/** The tier that unlocks this activation, or null when it isn't plan-gated. */
export function requiredTierFor(activationId: string): TierKey | null {
  return ACTIVATION_PLAN_GATE[activationId]?.requiredTier ?? null;
}

export interface ActivationPlanGateState {
  /**
   * True when this surface is BLOCKED specifically by the plan — i.e. it has a
   * plan gate, the persona's plan does not satisfy it, and they aren't an admin
   * or already active. This is the signal that drives "Upgrade" (vs "Request
   * access") in the catalogue.
   */
  planGated: boolean;
  /** Tier to upgrade to when planGated. Null otherwise. */
  requiredTier: TierKey | null;
}

/**
 * Resolve the plan-gate UI state for one surface.
 * `alreadyAvailable` covers admin + already-active + open-gate cases, where the
 * surface is reachable regardless of plan, so planGated must be false.
 */
export function resolveActivationPlanGate(
  activationId: string,
  plan: PersonaPlan | null,
  alreadyAvailable: boolean,
): ActivationPlanGateState {
  if (!hasPlanGate(activationId)) return { planGated: false, requiredTier: null };
  if (alreadyAvailable || isPlanEntitled(activationId, plan)) {
    return { planGated: false, requiredTier: requiredTierFor(activationId) };
  }
  return { planGated: true, requiredTier: requiredTierFor(activationId) };
}
