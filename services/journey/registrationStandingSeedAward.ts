/**
 * The production wiring for `services/journey/registrationStandingSeed.ts`'s
 * documented caller contract (Horizen Pilot Closure item 2, 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * registrationStandingSeed.ts fully specified the nominal one-time Standing
 * seed — amount, basis, the settle-then-award contract, idempotency via
 * `settleFact` — but was a pure spec module with ZERO production callers. The
 * journey `state` route READ the settled fact (`registry_standing_seeded`)
 * but nothing ever WROTE it, so `initialStandingAwarded` was always 0 for
 * every agent, forever. See RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.
 *
 * ── WHY THIS IS ITS OWN FILE, NOT INLINE IN THE ROUTE ────────────────────────
 *
 * Same reasoning as `registrationConfirmationDeps.ts` (item 1 of this same
 * closure pass): a canonical mechanism gets ONE implementation, callable from
 * wherever the completion boundary is observed — the journey `state` route
 * today, and generically any future caller that observes the same boundary
 * (a Deploy-stage action route, a reconciler) without re-deriving the
 * settle-then-award sequence a second time.
 *
 * ── CONTRACT ──────────────────────────────────────────────────────────────
 *
 * The CALLER establishes eligibility (factory ingestion observed true) and
 * supplies the evidence refs — this function never re-derives eligibility
 * from a second, parallel query. It only ever does two things, in order:
 *   1. `settleFact(..., 'registry_standing_seeded')` — idempotent by
 *      construction; a second call after the first returns
 *      `alreadySettled: true` and writes nothing.
 *   2. On a genuinely first settlement, writes ONE `standing_accrued`
 *      receipt, attributed to the real operator persona, tagged with the
 *      seed's own basis/tier so it is forever distinguishable from earned
 *      performance Standing (operator's own safeguard, registrationStandingSeed.ts).
 *
 * Generic for every eligible agent: nothing here names MoneyPenny or
 * Nakamoto — the caller supplies `agent`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { settleFact, type SettleResult } from './settledFacts';
import { REGISTRATION_SEED_STANDING, REGISTRATION_SEED_BASIS, shouldAwardRegistrationSeed } from './registrationStandingSeed';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export interface StandingSeedEligibility {
  /** Already true — nothing to do. The caller's own settled-fact read (never re-derived here). */
  alreadySeeded: boolean;
  /** Factory ingestion observed true by the caller — the completion boundary. */
  factoryIngestedNow: boolean;
  /** capability_registered receipt ids, if any — carried as the settlement's evidenceRefs. */
  evidenceReceiptIds: string[];
}

export interface StandingSeedAwardOutcome {
  awarded: boolean;
  alreadySettled: boolean;
  skippedReason: 'already-seeded' | 'not-eligible' | 'settle-failed' | null;
  receiptId: string | null;
}

export async function awardRegistrationStandingSeedIfEligible(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  actorPersonaId: string,
  eligibility: StandingSeedEligibility,
): Promise<StandingSeedAwardOutcome> {
  if (eligibility.alreadySeeded) {
    return { awarded: false, alreadySettled: true, skippedReason: 'already-seeded', receiptId: null };
  }
  if (!eligibility.factoryIngestedNow) {
    return { awarded: false, alreadySettled: false, skippedReason: 'not-eligible', receiptId: null };
  }

  let settlement: SettleResult;
  try {
    settlement = await settleFact(admin, agent.aigentQubeId, {
      subject: agent.runtimeAgentId,
      predicate: 'registry_standing_seeded',
      object: { amount: REGISTRATION_SEED_STANDING, basis: REGISTRATION_SEED_BASIS, tier: 'initial' },
      evidenceRefs: eligibility.evidenceReceiptIds,
      resolutionAuthority: actorPersonaId,
    });
  } catch {
    return { awarded: false, alreadySettled: false, skippedReason: 'settle-failed', receiptId: null };
  }
  if (!settlement.ok) {
    return { awarded: false, alreadySettled: false, skippedReason: 'settle-failed', receiptId: null };
  }
  if (!shouldAwardRegistrationSeed(settlement)) {
    // A concurrent request settled it first, between our read and our write.
    return { awarded: false, alreadySettled: true, skippedReason: 'already-seeded', receiptId: null };
  }

  const receipt = await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'standing_accrued',
    summary: `Standing accrued: +${REGISTRATION_SEED_STANDING} (${REGISTRATION_SEED_BASIS}) — nominal registration seed for ${agent.displayName}, admission eligibility only, not performance`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: {
      basis: REGISTRATION_SEED_BASIS,
      tier: 'initial',
      amount: REGISTRATION_SEED_STANDING,
      repeatable: false,
      impliesPerformance: false,
      aigentQubeId: agent.aigentQubeId,
    },
  });

  return { awarded: true, alreadySettled: false, skippedReason: null, receiptId: receipt?.id ?? null };
}
