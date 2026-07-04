/**
 * stewardPrivileges — the single authoritative "is this persona a steward?"
 * resolver, composing the two sources of steward standing:
 *
 *   1. Subscription steward — a Tier 2 (Stewardship) plan grants steward
 *      privileges (plan.stewardAccess === true).
 *   2. Bureau steward — the Polity Passport Bureau cartridge admin grant
 *      (operational stewards who run the admission queue).
 *
 * It also reflects the resolved role onto the citizen's passport privileges row
 * (steward_role column) so other surfaces can read it without re-deriving.
 *
 * Steward standing unlocks (gates live on the consuming surfaces, not here):
 *   - recommendation rights into the Bureau review queue
 *   - "Act as Aigent" — steward-grade delegation that deepens over time
 *   - professional-standing affordances
 *
 * Extend-don't-duplicate: this does NOT introduce a parallel role system. Bureau
 * steward status still comes from the cartridge-admin grant; subscription
 * steward status still comes from the plan resolver. This unifies the read.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPersonaPlan } from '@/services/billing/personaPlan';

export type StewardRole = 'subscription_steward' | 'bureau_steward' | 'both';

export interface StewardStatus {
  isSteward: boolean;
  /** Persisted role string (null when not a steward). */
  role: StewardRole | null;
  subscriptionSteward: boolean;
  bureauSteward: boolean;
  /** Steward-gated capabilities (read by the consuming surfaces). */
  canRecommend: boolean;
  canActAsAigent: boolean;
}

function roleFor(subscription: boolean, bureau: boolean): StewardRole | null {
  if (subscription && bureau) return 'both';
  if (subscription) return 'subscription_steward';
  if (bureau) return 'bureau_steward';
  return null;
}

/**
 * Resolve steward status. `bureauSteward` is passed in by the caller from the
 * spine-resolved cartridge flags (server-authoritative) — we don't re-resolve
 * grants here to avoid a parallel admin checker.
 */
export async function resolveStewardStatus(
  admin: SupabaseClient,
  personaId: string,
  bureauSteward: boolean,
): Promise<StewardStatus> {
  const plan = await getPersonaPlan(admin, personaId).catch(() => null);
  const subscriptionSteward = plan?.stewardAccess ?? false;
  const role = roleFor(subscriptionSteward, bureauSteward);
  const isSteward = role !== null;
  return {
    isSteward,
    role,
    subscriptionSteward,
    bureauSteward,
    canRecommend: isSteward,
    canActAsAigent: isSteward,
  };
}

/**
 * Best-effort: reflect the resolved steward role onto the persona's active
 * citizen passport privileges row. Non-fatal — a persona without a citizen
 * passport simply has no row to stamp, and a pending migration is tolerated.
 */
export async function syncStewardRole(
  admin: SupabaseClient,
  personaId: string,
  role: StewardRole | null,
): Promise<void> {
  try {
    // Find the persona's active citizen passport record.
    const { data: record } = await admin
      .from('polity_passport_records')
      .select('id')
      .eq('persona_id', personaId)
      .eq('passport_class', 'citizen')
      .in('citizen_status', ['active', 'renewal_due', 'verified_citizen'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!record?.id) return;

    await admin
      .from('passport_citizen_privileges')
      .update({ steward_role: role, steward_role_updated_at: new Date().toISOString() })
      .eq('passport_record_id', record.id);
  } catch {
    /* additive column / migration pending — non-fatal */
  }
}
