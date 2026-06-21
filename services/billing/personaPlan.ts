/**
 * personaPlan — read a persona's plan tier and resolve VentureQube Lite/Pro
 * entitlements. The entitlement layer for metaMe's commercial model (Step 4).
 *
 * Plan families:
 *   - agency plan:        citizen (free) | citizen_plus | sovereign_citizen | first_citizen
 *   - Founder Office tier: none (default) | basic | pro | elite
 *
 * Gating rule: VentureQube Lite (single venture) is free for everyone;
 * VentureQube Pro (multi-venture + premium surfaces) requires Founder Office
 * pro/elite. Best-effort: defaults to the free tier if the plan table is
 * unavailable (so a pending migration never locks anyone out of the free path).
 *
 * Checkout/billing is stubbed — rows are admin/granted until payment rails are
 * wired. The read + gating path here is live.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AgencyPlanTier = 'citizen' | 'citizen_plus' | 'sovereign_citizen' | 'first_citizen';
export type FounderOfficeTier = 'none' | 'basic' | 'pro' | 'elite';

export interface PersonaPlan {
  planTier: AgencyPlanTier;
  founderOfficeTier: FounderOfficeTier;
  status: 'active' | 'past_due' | 'cancelled';
  /** True when the Founder Office tier unlocks VentureQube Pro (multi-venture). */
  ventureProUnlocked: boolean;
  /** Max active VentureQubes this plan may own (Lite = 1, Pro/Elite = unlimited). */
  ventureLimit: number;
}

const FREE_PLAN: PersonaPlan = {
  planTier: 'citizen',
  founderOfficeTier: 'none',
  status: 'active',
  ventureProUnlocked: false,
  ventureLimit: 1,
};

export const PLAN_LABEL: Record<AgencyPlanTier, string> = {
  citizen: 'Citizen',
  citizen_plus: 'Citizen Plus',
  sovereign_citizen: 'Sovereign Citizen',
  first_citizen: 'First Citizen',
};

export const FOUNDER_OFFICE_LABEL: Record<FounderOfficeTier, string> = {
  none: 'Founder Office (Lite)',
  basic: 'Founder Office Basic',
  pro: 'Founder Office Pro',
  elite: 'Founder Office Elite',
};

function resolve(plan: {
  plan_tier?: string;
  founder_office_tier?: string;
  status?: string;
}): PersonaPlan {
  const founderOfficeTier = (plan.founder_office_tier as FounderOfficeTier) ?? 'none';
  const ventureProUnlocked = founderOfficeTier === 'pro' || founderOfficeTier === 'elite';
  return {
    planTier: (plan.plan_tier as AgencyPlanTier) ?? 'citizen',
    founderOfficeTier,
    status: (plan.status as PersonaPlan['status']) ?? 'active',
    ventureProUnlocked,
    // Lite tiers cap at one venture; Pro/Elite are effectively unlimited.
    ventureLimit: ventureProUnlocked ? 9999 : 1,
  };
}

export async function getPersonaPlan(
  admin: SupabaseClient,
  personaId: string,
): Promise<PersonaPlan> {
  try {
    const { data, error } = await admin
      .from('persona_plans')
      .select('plan_tier, founder_office_tier, status')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (error || !data) return { ...FREE_PLAN };
    if (data.status === 'cancelled') return { ...FREE_PLAN };
    return resolve(data);
  } catch {
    return { ...FREE_PLAN };
  }
}
