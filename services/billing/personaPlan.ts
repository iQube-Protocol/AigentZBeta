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
   * Sonnet AI tier, enhanced experience model (goals 5 / KPIs 7 / cartridges 5),
   * DevOn/AigentZ lite (for developers to incubate pre-Founder-Office projects).
   */
  sovereignAccess: boolean;
  /**
   * True at Tier 2 (steward) and above.
   * Unlocks: professional standing, steward privileges on passport_citizen_privileges,
   * "Act as Aigent" delegation (evolves to deeper specialisation / consultant-for-hire),
   * HMS discovery, community leadership roles, early Founder Office preview,
   * unlimited experience-model (goals / KPIs / cartridges).
   */
  stewardAccess: boolean;
  /**
   * True at Tier 1 (sovereign_citizen) and above.
   * DevOn/AigentZ lite access — developers can incubate projects before
   * entering the Founder Office, then graduate them as ventures when ready.
   * Full DevOn operational access is Founder Office (venture_tier != none).
   */
  aigentzLiteAccess: boolean;
  /**
   * True when the persona has Research Copilot (IRL) access. As of the IRL OS
   * payment model (2026-07-19) this is granted three ways: Steward (both
   * services), a Sovereign subscriber who SELECTED research (sovereign_selection
   * = 'research'), or the standalone `research_tier` add-on ('active'). The
   * `researcher` activation gate reads this flag. See resolve() for the exact
   * derivation and grandfathering.
   */
  researchCopilotAccess: boolean;
  /**
   * Monthly experiment-run allowance (IRL OS payment model, 2026-07-19).
   *   0                       → no research access (free / aigentZ-only sovereign)
   *   RESEARCH_LIGHT (3)      → Research Copilot light (sovereign-selected research
   *                             OR the standalone research add-on)
   *   STEWARD_EXPERIMENT_CAP  → Steward (full) — a high cap, not unlimited.
   * Enforced at the experiment-run chokepoint via experimentQuota.
   */
  experimentMonthlyCap: number;
  /**
   * Experience-model soft-caps. Tier 0 (free Citizen) is deliberately bounded
   * so the experience model is a focused starter; Tier 1 (sovereignAccess)
   * lifts the caps. Enforced at the experience-model write path.
   *   experienceGoalLimit — max primary goals (free: 1)
   *   kpiLimit            — max active KPIs (free: 3)
   *   cartridgeLimit      — max active cartridges (free: 1)
   * UNLIMITED (9999) once sovereignAccess is true.
   */
  experienceGoalLimit: number;
  kpiLimit: number;
  cartridgeLimit: number;
  /**
   * Max personas this plan may own. Free 1 → Sovereign 3 → Steward 8 →
   * Operator 10 → Operator+ 15 → Portfolio Operator unlimited (9999).
   * Enforced at the persona-creation path; over-limit personas are flagged
   * (not auto-deleted) when a subscription lapses.
   */
  personaLimit: number;
  /**
   * Max active bounded delegate aigents this plan may hold. Free 3 →
   * Sovereign 10 → Steward 28 → Operator 35 → Operator+ 50 → Portfolio
   * unlimited (9999). Enforced at the delegation-grant path.
   */
  boundedDelegateLimit: number;
}

/** Sentinel for "no practical cap". */
const UNLIMITED = 9999;

// Experiment-run monthly caps (IRL OS payment model, 2026-07-19). Steward is a
// HIGH cap, deliberately not unlimited (operator direction). Adjust here.
export const RESEARCH_LIGHT_EXPERIMENT_CAP = 3;
export const STEWARD_EXPERIMENT_CAP = 50;

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
  researchCopilotAccess: false,
  experimentMonthlyCap: 0,
  // Tier 0 soft-caps: a focused starter experience model.
  experienceGoalLimit: 1,
  kpiLimit: 3,
  cartridgeLimit: 1,
  personaLimit: 1,
  boundedDelegateLimit: 3,
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
  research_tier?: string;
  sovereign_selection?: string | null;
  aigentz_tier?: string;
  status?: string;
}): PersonaPlan {
  const planTier = (row.plan_tier as AgencyPlanTier) ?? 'citizen';
  const ventureTier = (row.venture_tier as VentureTier) ?? 'none';
  const standingTier = (row.standing_tier as StandingTier) ?? 'standing';
  const paid = ventureTier !== 'none'; // any Founder Office tier
  // Citizen-ladder upgrade flags. Founder Office (paid) implies all citizen privileges.
  const sovereignAccess = paid || SOVEREIGN_TIERS.has(planTier);
  const stewardAccess = paid || STEWARD_TIERS.has(planTier);
  // IRL OS payment model (operator 2026-07-19): the Sovereign tier grants
  // EITHER aigentZ OR Research Copilot (light) — the subscriber picks one
  // (sovereign_selection). Steward grants BOTH. Either service is also
  // available as a standalone add-on (aigentz_tier / research_tier) so a
  // subscriber on one path can bolt the other on without going to Steward.
  //
  // Grandfathering: sovereign_selection NULL reads as 'aigentz', so every
  // existing Sovereign subscriber keeps aigentZ until they explicitly switch;
  // research_tier === 'active' holders keep Research Copilot (add-on clause).
  const sovereignSelection = (row.sovereign_selection as string | null) ?? 'aigentz';
  const aigentzAddon = row.aigentz_tier === 'active';
  const researchAddon = row.research_tier === 'active';
  const aigentzLiteAccess =
    stewardAccess || (sovereignAccess && sovereignSelection === 'aigentz') || aigentzAddon;
  const researchCopilotAccess =
    stewardAccess || (sovereignAccess && sovereignSelection === 'research') || researchAddon;
  // Monthly experiment allowance: Steward high cap; light (research via
  // sovereign selection OR add-on) = 3; otherwise none.
  const experimentMonthlyCap = stewardAccess
    ? STEWARD_EXPERIMENT_CAP
    : researchCopilotAccess
      ? RESEARCH_LIGHT_EXPERIMENT_CAP
      : 0;
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
    researchCopilotAccess,
    experimentMonthlyCap,
    // Experience-model soft-caps ladder:
    //   Free      → goals 1, KPIs 3, cartridges 1
    //   Sovereign → goals 5, KPIs 7, cartridges 5
    //   Steward+  → unlimited (steward tier or any paid Founder Office tier)
    experienceGoalLimit: stewardAccess ? UNLIMITED : sovereignAccess ? 5 : 1,
    kpiLimit: stewardAccess ? UNLIMITED : sovereignAccess ? 7 : 3,
    cartridgeLimit: stewardAccess ? UNLIMITED : sovereignAccess ? 5 : 1,
    // Persona + bounded-delegate ladder (Founder Office tiers resolve first
    // because a paid venture tier outranks the citizen plan_tier):
    //   Free 1/3 · Sovereign 3/10 · Steward 8/28
    //   Operator 10/35 · Operator+ 15/50 · Portfolio ∞/∞
    personaLimit:
      ventureTier === 'elite' ? UNLIMITED
      : ventureTier === 'pro' ? 15
      : ventureTier === 'lite' ? 10
      : STEWARD_TIERS.has(planTier) ? 8
      : SOVEREIGN_TIERS.has(planTier) ? 3
      : 1,
    boundedDelegateLimit:
      ventureTier === 'elite' ? UNLIMITED
      : ventureTier === 'pro' ? 50
      : ventureTier === 'lite' ? 35
      : STEWARD_TIERS.has(planTier) ? 28
      : SOVEREIGN_TIERS.has(planTier) ? 10
      : 3,
  };
}

export async function getPersonaPlan(
  admin: SupabaseClient,
  personaId: string,
): Promise<PersonaPlan> {
  try {
    const { data, error } = await admin
      .from('persona_plans')
      .select('plan_tier, venture_tier, standing_tier, research_tier, sovereign_selection, aigentz_tier, status')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (error || !data) return { ...FREE_PLAN };
    if (data.status === 'cancelled') return { ...FREE_PLAN };
    return resolve(data);
  } catch {
    return { ...FREE_PLAN };
  }
}

/**
 * Subscriber-scoped persona allowance. The persona-count cap is a per-HUMAN
 * concept, but persona_plans is keyed per-persona, so a subscriber's effective
 * personaLimit is the highest active plan across all personas they own
 * (auth_profile_id). past_due plans keep their tier (grace); cancelled plans
 * fall to free. Returns the free baseline (1) when no active paid plan exists.
 */
export async function getSubscriberPersonaLimit(
  admin: SupabaseClient,
  authProfileId: string,
): Promise<{ personaLimit: number; planLabel: string }> {
  const free = { personaLimit: FREE_PLAN.personaLimit, planLabel: PLAN_LABEL.citizen };
  if (!authProfileId) return free;
  try {
    const { data: personas } = await admin
      .from('personas')
      .select('id')
      .eq('auth_profile_id', authProfileId);
    const ids = (personas ?? []).map((p) => (p as { id: string }).id).filter(Boolean);
    if (ids.length === 0) return free;

    const { data: plans } = await admin
      .from('persona_plans')
      .select('plan_tier, venture_tier, standing_tier, research_tier, sovereign_selection, aigentz_tier, status')
      .in('persona_id', ids);

    let best = free;
    for (const row of (plans ?? []) as Array<{ status?: string }>) {
      // cancelled → free (no contribution); past_due → grace, keep tier.
      if (row.status === 'cancelled') continue;
      const plan = resolve(row);
      if (plan.personaLimit > best.personaLimit) {
        best = { personaLimit: plan.personaLimit, planLabel: PLAN_LABEL[plan.planTier] };
      }
    }
    return best;
  } catch {
    return free;
  }
}
