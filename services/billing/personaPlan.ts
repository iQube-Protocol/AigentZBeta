/**
 * personaPlan — read a persona's plan tier and resolve Venture Lab entitlements.
 * The entitlement layer for metaMe's commercial model (Step 4, revised).
 *
 * Two independent axes:
 *   - plan_tier (citizen ladder, free today): citizen | citizen_plus |
 *     sovereign_citizen | first_citizen — room for future premium citizen levels.
 *   - venture_tier (gates Venture Lab access):
 *       none  → free Citizen: NO Founder Office. Venture Light only — the
 *               freemium experience-card extension: 1 venture, idea incubation,
 *               the v0.x wrapper. No 13-layer schema, no operating model.
 *       lite  → "Operator": Founder Office tier 1. The VentureQube Pro 13-layer
 *               schema + operating model, for 1 venture. NO portfolio.
 *       pro   → "Operator Pro": 3 ventures + portfolio.
 *               (Tier names use "Operator", not "Founder", to avoid colliding
 *               with the Founder Operator archetype/class.)
 *       elite → "Operator Elite": unlimited ventures + portfolio.
 *
 * The line of demarcation is the FOUNDER OFFICE, not the portfolio: the moment a
 * citizen enters the Founder Office (any paid tier) they are on the Pro schema
 * AND get the operating model. The portfolio (multi-venture thesis/priorities)
 * is a second unlock at Founder Pro/Elite. "Light" never appears inside the
 * Founder Office — it is purely the freemium, pre-Founder-Office tier.
 *
 * Venture Lab cartridge ACCESS is the paywall (venture_tier != none). A free
 * citizen still gets the persona-anchored experience + a venture *glimpse* badge
 * on aigentMe, but cannot open the Venture Lab cartridge — the first upgrade CTA.
 *
 * Best-effort: defaults to free Citizen if the plan table is unavailable.
 * Checkout/billing is stubbed — rows are admin/granted until payment rails land.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AgencyPlanTier = 'citizen' | 'citizen_plus' | 'sovereign_citizen' | 'steward' | 'first_citizen';
export type VentureTier = 'none' | 'lite' | 'pro' | 'elite';
export type StandingTier = 'standing' | 'professional';

/**
 * Which Standing/Venture wizard templates a persona may launch.
 *   - core          → Standing Core wizard (every citizen, free)
 *   - light         → Venture Light wizard (every citizen, free — 1 light venture,
 *                     OUTSIDE the Founder Office)
 *   - pro           → Venture Pro wizard + the 13-layer VentureQube Pro schema
 *                     (unlocks on entering the Founder Office — "Founder" tier 1+)
 *   - operatingModel→ the operating brief (Chief-of-Staff layer). Unlocks WITH the
 *                     Founder Office (tier 1+) — it ships with the Pro schema, NOT
 *                     gated behind the portfolio.
 *   - portfolio     → Venture Portfolio wizard, cross-venture (Founder Pro/Elite)
 * The schema a persona may WRITE follows from this: `pro` access ⇒ may write the
 * Pro schema; otherwise the Light schema only.
 */
export interface WizardAccess {
  core: boolean;
  light: boolean;
  pro: boolean;
  operatingModel: boolean;
  portfolio: boolean;
}

export interface PersonaPlan {
  planTier: AgencyPlanTier;
  ventureTier: VentureTier;
  standingTier: StandingTier;
  status: 'active' | 'past_due' | 'cancelled';
  /** True when the plan unlocks the Venture Lab cartridge (any paid venture tier). */
  ventureLabAccess: boolean;
  /** True when the plan unlocks Marketa (any paid venture tier). */
  marketaAccess: boolean;
  /** True when the plan unlocks metaMe Studio (any paid venture tier). */
  studioAccess: boolean;
  /** True when the plan unlocks Human Mobility Services (any paid venture tier). */
  hmsAccess: boolean;
  /** True when Tier 3 Professional Standing is unlocked (subscription OR bundled
   *  with Founder Office Pro/Elite). */
  professionalStanding: boolean;
  /** Max active VentureQubes this plan may own (none=1 light, lite=1, pro=3, elite=unlimited). */
  ventureLimit: number;
  /** Which wizard templates the persona may launch (see WizardAccess). */
  wizardAccess: WizardAccess;
  /** The richest VentureQube schema the persona may write ('pro' at lite+, else 'lite'). */
  ventureSchemaTier: 'lite' | 'pro';
  /**
   * True at Tier 1 (sovereign_citizen) and above.
   * Unlocks: standing history/analytics, archetype-tagged standing scores,
   * Sonnet AI tier, enhanced experience model, early Founder Office preview,
   * DevOn/AigentZ lite (for developers to incubate pre-Founder-Office projects).
   */
  sovereignAccess: boolean;
  /**
   * True at Tier 2 (steward) and above.
   * Unlocks: professional standing, steward privileges on passport_citizen_privileges,
   * "Act as Aigent" delegation (evolves to deeper specialisation / consultant-for-hire),
   * HMS discovery, community leadership roles.
   */
  stewardAccess: boolean;
  /**
   * True at Tier 1 (sovereign_citizen) and above.
   * DevOn/AigentZ lite access — developers can incubate projects before
   * entering the Founder Office, then graduate them as ventures when ready.
   * Full DevOn operational access is Founder Office (venture_tier != none).
   */
  aigentzLiteAccess: boolean;
}

const FREE_PLAN: PersonaPlan = {
  planTier: 'citizen',
  ventureTier: 'none',
  standingTier: 'standing',
  status: 'active',
  ventureLabAccess: false,
  marketaAccess: false,
  studioAccess: false,
  hmsAccess: false,
  professionalStanding: false,
  // Free Citizens may incubate ONE venture with the Venture Light wizard.
  ventureLimit: 1,
  wizardAccess: { core: true, light: true, pro: false, operatingModel: false, portfolio: false },
  ventureSchemaTier: 'lite',
  sovereignAccess: false,
  stewardAccess: false,
  aigentzLiteAccess: false,
};

export const PLAN_LABEL: Record<AgencyPlanTier, string> = {
  citizen: 'Citizen',
  citizen_plus: 'Citizen Plus',
  sovereign_citizen: 'Sovereign Citizen',
  steward: 'Steward',
  first_citizen: 'First Citizen',
};

// Display labels. "Light" is reserved for the freemium, pre-Founder-Office tier;
// the three Founder Office tiers never use it. We use "Operator" (not "Founder")
// to avoid colliding with the Founder Operator archetype/class. The surface
// itself stays "Founder Office".
export const VENTURE_TIER_LABEL: Record<VentureTier, string> = {
  none: 'Venture Light',
  lite: 'Operator',
  pro: 'Operator Pro',
  elite: 'Operator Elite',
};

export const STANDING_TIER_LABEL: Record<StandingTier, string> = {
  standing: 'Standing (free)',
  professional: 'Professional Standing',
};

const VENTURE_LIMIT: Record<VentureTier, number> = {
  none: 1, // Venture Light: one venture, idea incubation, outside the Founder Office
  lite: 1, // Operator: one venture on the Pro schema + operating model
  pro: 3, // Operator Pro: three ventures + portfolio
  elite: 9999, // Operator Elite: unlimited ventures + portfolio
};

const SOVEREIGN_TIERS = new Set<string>(['sovereign_citizen', 'steward', 'first_citizen']);
const STEWARD_TIERS = new Set<string>(['steward', 'first_citizen']);

function resolve(row: {
  plan_tier?: string;
  venture_tier?: string;
  standing_tier?: string;
  status?: string;
}): PersonaPlan {
  const planTier = (row.plan_tier as AgencyPlanTier) ?? 'citizen';
  const ventureTier = (row.venture_tier as VentureTier) ?? 'none';
  const standingTier = (row.standing_tier as StandingTier) ?? 'standing';
  const paid = ventureTier !== 'none'; // any Founder Office tier
  // Citizen-ladder upgrade flags. Founder Office (paid) implies all citizen privileges.
  const sovereignAccess = paid || SOVEREIGN_TIERS.has(planTier);
  const stewardAccess = paid || STEWARD_TIERS.has(planTier);
  // DevOn/AigentZ lite: Sovereignty tier + for developers to incubate pre-FO projects;
  // full operational DevOn is Founder Office only.
  const aigentzLiteAccess = sovereignAccess;
  // Professional Standing: steward tier, own professional subscription, or FO Pro/Elite bundle.
  const professionalStanding =
    stewardAccess || standingTier === 'professional' || ventureTier === 'pro' || ventureTier === 'elite';
  // Pro schema + operating model unlock on entering the Founder Office (any paid
  // tier = "Founder" and up); the Portfolio is a second unlock at Founder
  // Pro/Elite. The operating model is NOT gated behind the portfolio.
  const proWizard = paid; // Operator | Operator Pro | Operator Elite
  const operatingModel = paid; // ships with the Founder Office (tier 1+)
  const portfolioWizard = ventureTier === 'pro' || ventureTier === 'elite';
  return {
    planTier,
    ventureTier,
    standingTier,
    status: (row.status as PersonaPlan['status']) ?? 'active',
    ventureLabAccess: paid,
    marketaAccess: paid,
    studioAccess: paid,
    hmsAccess: paid,
    professionalStanding,
    ventureLimit: VENTURE_LIMIT[ventureTier] ?? 1,
    wizardAccess: { core: true, light: true, pro: proWizard, operatingModel, portfolio: portfolioWizard },
    ventureSchemaTier: proWizard ? 'pro' : 'lite',
    sovereignAccess,
    stewardAccess,
    aigentzLiteAccess,
  };
}

export async function getPersonaPlan(
  admin: SupabaseClient,
  personaId: string,
): Promise<PersonaPlan> {
  try {
    const { data, error } = await admin
      .from('persona_plans')
      .select('plan_tier, venture_tier, standing_tier, status')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (error || !data) return { ...FREE_PLAN };
    if (data.status === 'cancelled') return { ...FREE_PLAN };
    return resolve(data);
  } catch {
    return { ...FREE_PLAN };
  }
}
