/**
 * personaCapacity — the SINGLE canonical resolver for "may this sponsor
 * create one more bounded-delegate agent?" (operator ruling, 2026-09-05,
 * capacity remediation).
 *
 * Replaces the flat `sponsorship_capacity_base: 3` arithmetic that used to be
 * hand-copied into services/agents/sponsorPolityAgent.ts and
 * app/api/homecoming/agent/stand-up/route.ts's GET preflight (Extend-Don't-
 * Duplicate — inv.engineering.037: a parallel implementation of an existing
 * capacity check is a defect, and this was three of them computing the same
 * number from the same table).
 *
 * Canonical rules this resolver enforces:
 *   1. An authenticated administrator is UNBOUNDED, always — never merely
 *      "overridden past an exhausted flat cap". `callerIsAdmin` MUST be
 *      resolved server-side via getActivePersona()'s
 *      `cartridgeFlags.isAdmin` (or the equivalent spine-resolved flag for a
 *      non-persona caller). NEVER pass a request-body flag, a header, or
 *      JWT `user_metadata` here — those are exactly the forgery vectors this
 *      resolver must be immune to.
 *   2. A caller authenticated via a PLATFORM-level credential (e.g. the
 *      CRON_TRIGGER_TOKEN-gated ops routes that provision platform agents
 *      like Factor/Aegis — no human persona session at all) is also
 *      UNBOUNDED. Signalled by `isPlatformAuthority: true`, set ONLY by a
 *      route that has already validated that credential — never inferred.
 *   3. Otherwise, capacity is resolved from the sponsor's existing tier
 *      ladder (services/billing/personaPlan.ts's `boundedDelegateLimit`)
 *      plus any admin-granted `sponsorship_capacity_base` override and any
 *      Standing-earned `sponsorship_capacity_earned` credit — the SAME
 *      inputs the old inline arithmetic used, just computed once.
 *   4. A tier whose `boundedDelegateLimit` is the `UNLIMITED` sentinel
 *      (services/billing/personaPlan.ts) resolves to `bounded: false` here
 *      too — the sentinel is an internal ladder implementation detail; a
 *      resolver caller must never see 9999 and mistake it for a real number.
 *   5. `remaining` is NEVER negative. A legacy account whose `used` count
 *      already exceeds its `limit` reports `remaining: 0, overCapacity: true`
 *      — a fact for the UI/gate to render, not license to invalidate or
 *      delete the agents/personas that put it there.
 *   6. This resolver only gates CREATING one more sponsored agent. It has no
 *      opinion on reading, selecting, or operating agents/personas that
 *      already exist — callers must never wire it into a read path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPersonaPlan, UNLIMITED } from '@/services/billing/personaPlan';

export type PersonaCapacitySource = 'tier' | 'standing' | 'grant' | 'administrator' | 'platform';

export type PersonaCapacity =
  | {
      bounded: true;
      limit: number;
      used: number;
      remaining: number;
      /** True when `used` already exceeds `limit` — a legacy/pre-ruling state, never hidden as a negative `remaining`. */
      overCapacity: boolean;
      source: 'tier' | 'standing' | 'grant';
    }
  | {
      bounded: false;
      limit: null;
      used: number;
      remaining: null;
      /** 'tier' covers a supported tier whose own ladder is the UNLIMITED sentinel (e.g. Portfolio Operator Elite). */
      source: 'administrator' | 'platform' | 'tier';
    };

export interface ResolveAgentSponsorshipCapacityInput {
  admin: SupabaseClient;
  /** The sponsor persona (T0) whose capacity is being resolved — server-internal, never returned raw by callers. */
  sponsorPersonaId: string;
  /**
   * MUST be resolved server-side (getActivePersona().cartridgeFlags.isAdmin
   * or the equivalent canonical admin-grants check) BEFORE calling this
   * resolver. NEVER derive it from a request body, a header, or JWT
   * `user_metadata` — this resolver trusts the caller completely and has no
   * way to detect a forged flag; the forgery immunity comes entirely from
   * every call site resolving this from the protected spine.
   */
  callerIsAdmin: boolean;
  /**
   * Set ONLY by a route that has already authenticated a platform-level
   * credential (e.g. CRON_TRIGGER_TOKEN) with no human persona/session
   * involved at all — the Factor/Aegis-style platform-agent provisioning
   * path. Never set from a persona-derived flag or client input.
   */
  isPlatformAuthority?: boolean;
}

/**
 * The shared "how many agents has this sponsor already sponsored" count —
 * previously duplicated inline in sponsorPolityAgent.ts, the stand-up
 * route's GET preflight, and the sponsored-agents read route.
 */
export async function countSponsoredAgents(admin: SupabaseClient, sponsorPersonaId: string): Promise<number> {
  const { count } = await admin
    .from('agent_root_identity')
    .select('id', { count: 'exact', head: true })
    .eq('sponsor_persona_id', sponsorPersonaId);
  return count ?? 0;
}

export async function resolveAgentSponsorshipCapacity(
  input: ResolveAgentSponsorshipCapacityInput,
): Promise<PersonaCapacity> {
  const { admin, sponsorPersonaId, callerIsAdmin, isPlatformAuthority = false } = input;
  const used = await countSponsoredAgents(admin, sponsorPersonaId);

  // Rules 1-2: administrator or platform authority is UNBOUNDED outright —
  // never a numeric override of an otherwise-bounded number.
  if (isPlatformAuthority) return { bounded: false, limit: null, used, remaining: null, source: 'platform' };
  if (callerIsAdmin) return { bounded: false, limit: null, used, remaining: null, source: 'administrator' };

  // Rule 3: tier ladder + admin-granted base + Standing-earned credit.
  // Capacity COLUMNS soft-fail if their migration is absent (mirrors the
  // prior inline behavior) — the tier-derived limit is always enforced.
  const plan = await getPersonaPlan(admin, sponsorPersonaId);

  // Rule 4: a tier at the UNLIMITED sentinel is unbounded, never reported as 9999.
  if (plan.boundedDelegateLimit >= UNLIMITED) {
    return { bounded: false, limit: null, used, remaining: null, source: 'tier' };
  }

  const { data: capacityRow, error: capacityErr } = await admin
    .from('personas')
    .select('sponsorship_capacity_base, sponsorship_capacity_earned')
    .eq('id', sponsorPersonaId)
    .maybeSingle();
  const migrationMissing =
    capacityErr &&
    (capacityErr.message.includes('sponsorship_capacity_base') || capacityErr.message.includes('sponsorship_capacity_earned'));
  const storedBase = migrationMissing ? 0 : Number(capacityRow?.sponsorship_capacity_base ?? 0);
  const earned = migrationMissing ? 0 : Number(capacityRow?.sponsorship_capacity_earned ?? 0);
  const tierLimit = plan.boundedDelegateLimit;
  const effectiveBase = Math.max(tierLimit, storedBase);
  const limit = effectiveBase + earned;

  // Rule 5: never negative.
  const remaining = Math.max(0, limit - used);
  const overCapacity = used > limit;
  const source: 'tier' | 'standing' | 'grant' = storedBase > tierLimit ? 'grant' : earned > 0 ? 'standing' : 'tier';

  return { bounded: true, limit, used, remaining, overCapacity, source };
}
