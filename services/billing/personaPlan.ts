/**
 * personaPlan — read a persona's plan tier and resolve Venture Lab entitlements.
 * The entitlement layer for metaMe's commercial model (Step 4, revised).
 *
 * Two independent axes:
 *   - plan_tier (citizen ladder, free today): citizen | citizen_plus |
 *     sovereign_citizen | first_citizen — room for future premium citizen levels.
 *   - venture_tier (gates Venture Lab access):
 *       none  → free Citizen: NO Venture Lab cartridge, 0 ventures (glimpse only)
 *       lite  → 1 venture + Venture Lab + Marketa
 *       pro   → 3 ventures
 *       elite → unlimited ventures
 *
 * Venture Lab cartridge ACCESS is the paywall (venture_tier != none). A free
 * citizen still gets the persona-anchored experience + a venture *glimpse* badge
 * on aigentMe, but cannot open the Venture Lab cartridge — the first upgrade CTA.
 *
 * Best-effort: defaults to free Citizen if the plan table is unavailable.
 * Checkout/billing is stubbed — rows are admin/granted until payment rails land.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AgencyPlanTier = 'citizen' | 'citizen_plus' | 'sovereign_citizen' | 'first_citizen';
export type VentureTier = 'none' | 'lite' | 'pro' | 'elite';
export type StandingTier = 'standing' | 'professional';

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
  /** Max active VentureQubes this plan may own (none=0, lite=1, pro=3, elite=unlimited). */
  ventureLimit: number;
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
  ventureLimit: 0,
};

export const PLAN_LABEL: Record<AgencyPlanTier, string> = {
  citizen: 'Citizen',
  citizen_plus: 'Citizen Plus',
  sovereign_citizen: 'Sovereign Citizen',
  first_citizen: 'First Citizen',
};

export const VENTURE_TIER_LABEL: Record<VentureTier, string> = {
  none: 'Citizen (free)',
  lite: 'Venture Lab Lite',
  pro: 'Venture Lab Pro',
  elite: 'Venture Lab Elite',
};

export const STANDING_TIER_LABEL: Record<StandingTier, string> = {
  standing: 'Standing (free)',
  professional: 'Professional Standing',
};

const VENTURE_LIMIT: Record<VentureTier, number> = {
  none: 0,
  lite: 1,
  pro: 3,
  elite: 9999,
};

function resolve(row: {
  plan_tier?: string;
  venture_tier?: string;
  standing_tier?: string;
  status?: string;
}): PersonaPlan {
  const ventureTier = (row.venture_tier as VentureTier) ?? 'none';
  const standingTier = (row.standing_tier as StandingTier) ?? 'standing';
  const paid = ventureTier !== 'none';
  // Professional Standing: own subscription OR bundled with Founder Office Pro/Elite.
  const professionalStanding =
    standingTier === 'professional' || ventureTier === 'pro' || ventureTier === 'elite';
  return {
    planTier: (row.plan_tier as AgencyPlanTier) ?? 'citizen',
    ventureTier,
    standingTier,
    status: (row.status as PersonaPlan['status']) ?? 'active',
    ventureLabAccess: paid,
    marketaAccess: paid,
    studioAccess: paid,
    hmsAccess: paid,
    professionalStanding,
    ventureLimit: VENTURE_LIMIT[ventureTier] ?? 0,
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
