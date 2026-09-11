/**
 * KNYTS Bridge campaign — triple-output projector (Gate B).
 *
 * From one verified evidence row, INDEPENDENTLY computes and writes up to
 * three outputs — Reputation (persona), Standing (person), Reward
 * (economic) — per the Canon II doctrine
 * (`codexes/packs/polity-core/constitutional-records/personhood-identity-standing-reputation.md`):
 * "Standing accrues to the person. Reputation accrues to the persona.
 * Evidence is the governed bridge. One event may produce both, but they are
 * different outputs." No lane derives from another; each is gated and
 * recorded on the evidence row separately so a caller can see exactly which
 * legs applied and which were withheld and why.
 *
 * Reuses, never duplicates:
 *   - Reputation: `crm_reputation_events` via `createReputationEvent()`
 *     (services/crm/taskService.ts), RQH-synced via `syncReputationToRQH()`
 *     (services/crm/taskCanisterService.ts) — the existing persona-scoped
 *     reputation substrate, `campaign_contribution` sourceType (additive).
 *   - Standing: `accrueStanding()` (services/crm/standingAccrualService.ts)
 *     unchanged — the existing Standing formula/service.
 *   - Reward: `creditKnyt()` (services/wallet/knyt/knytLedgerService.ts) —
 *     the one deployed KNYT/Knightcoin balance primitive.
 *
 * Person-grade Standing gate: a `crm_personas` row with no
 * `identity_persona_id` linkage is a bare email/anonymous prospect, not yet
 * attributable to a real personhood-anchored identity, so Standing is
 * withheld (never guessed) exactly as spec §9.5 requires. This is the same
 * resolvability precedent every other Standing-accruing call site in this
 * codebase already relies on (`accrueStanding` itself takes only a
 * `crmPersonaId` with no additional Passport/kybe check) — this projector
 * does not invent a stricter gate than the rest of the platform enforces.
 */

import { getCrmClient } from '@/services/crm/crmDataAccess';
import { createReputationEvent } from '@/services/crm/taskService';
import { syncReputationToRQH } from '@/services/crm/taskCanisterService';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';
import {
  KNYTS_BRIDGE_REWARD_MATRIX,
  KNYTS_BRIDGE_REPUTATION_CATEGORY,
} from '@/services/journey/knytsBridgeCampaignConfig';
import {
  markReputationApplied,
  markStandingOutcome,
  markRewardApplied,
  type KnytsBridgeEvidenceRow,
} from '@/services/campaign/knytsBridgeCampaignEvidence';

export interface ProjectionOutcome {
  reputation: { applied: boolean; delta?: number; reason?: string };
  standing: { applied: boolean; cvs?: number; reason?: string };
  reward: { applied: boolean; amountKnyt?: number; reason?: string };
}

/**
 * Project the three outputs for a NEWLY-recorded evidence event. Callers
 * must only invoke this for evidence rows they just inserted
 * (`recordKnytsBridgeEvidence`'s `isNew: true`) — re-projecting an existing
 * evidence row would re-credit rewards. Each lane additionally re-checks its
 * own `*_applied_at` column before writing, so a defensive re-invocation on
 * an already-projected row is a no-op rather than a double-credit.
 */
export async function projectKnytsBridgeEvidenceOutputs(
  evidence: KnytsBridgeEvidenceRow,
): Promise<ProjectionOutcome> {
  const rule = KNYTS_BRIDGE_REWARD_MATRIX[evidence.actionType];
  const outcome: ProjectionOutcome = {
    reputation: { applied: false },
    standing: { applied: false },
    reward: { applied: false },
  };

  // ── Reputation — persona-grade, gated only on a resolved CRM persona ──────
  if (evidence.crmPersonaId && rule.reputationDelta > 0 && !evidence.reputationAppliedAt) {
    try {
      const event = await createReputationEvent({
        tenantId: 'knyt',
        personaId: evidence.crmPersonaId,
        sourceType: 'campaign_contribution',
        sourceId: evidence.id,
        deltaOverall: rule.reputationDelta,
        reason: evidence.actionType,
        metadata: { campaignId: 'knyts-bridge-crossing', actionType: evidence.actionType },
      });
      await markReputationApplied(evidence.id);
      outcome.reputation = { applied: true, delta: rule.reputationDelta };

      // Fire-and-forget RQH sync — best-effort, matches the existing
      // auto-sync pattern in standingAccrualService.ts::writeStanding.
      void (async () => {
        try {
          await syncReputationToRQH({
            personaId: evidence.crmPersonaId!,
            partitionId: evidence.crmPersonaId!,
            reputationEvent: event,
            skillCategory: KNYTS_BRIDGE_REPUTATION_CATEGORY,
          });
        } catch {
          /* best-effort — RQH sync failure never blocks the CRM-side fact */
        }
      })();
    } catch (err) {
      outcome.reputation = { applied: false, reason: err instanceof Error ? err.message : 'reputation write failed' };
    }
  } else if (rule.reputationDelta <= 0) {
    outcome.reputation = { applied: false, reason: 'not-eligible-for-this-action-type' };
  } else if (!evidence.crmPersonaId) {
    outcome.reputation = { applied: false, reason: 'no_crm_persona' };
  }

  // ── Standing — person-grade, requires a resolved identity linkage ────────
  if (!rule.standingEligible) {
    outcome.standing = { applied: false, reason: 'not-eligible-for-this-action-type' };
  } else if (!evidence.crmPersonaId) {
    outcome.standing = { applied: false, reason: 'no_crm_persona' };
    await markStandingOutcome(evidence.id, { applied: false, reason: 'no_crm_persona' });
  } else if (evidence.standingAppliedAt) {
    outcome.standing = { applied: true, cvs: rule.standingCvs };
  } else {
    const client = getCrmClient();
    const { data: crmRow } = await client
      .from('crm_personas')
      .select('identity_persona_id')
      .eq('id', evidence.crmPersonaId)
      .maybeSingle();
    const identityLinked = Boolean((crmRow as Record<string, unknown> | null)?.identity_persona_id);
    if (!identityLinked) {
      outcome.standing = { applied: false, reason: 'person_grade_anchor_unresolved' };
      await markStandingOutcome(evidence.id, { applied: false, reason: 'person_grade_anchor_unresolved' });
    } else {
      try {
        await accrueStanding({
          crmPersonaId: evidence.crmPersonaId,
          cvs: rule.standingCvs,
          standingType: 'personal',
          sourceEventId: evidence.id,
        });
        await markStandingOutcome(evidence.id, { applied: true });
        outcome.standing = { applied: true, cvs: rule.standingCvs };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'standing accrual failed';
        outcome.standing = { applied: false, reason };
        await markStandingOutcome(evidence.id, { applied: false, reason });
      }
    }
  }

  // ── Reward — economic, gated only on a known identity persona wallet ─────
  if (rule.knytcoin <= 0) {
    outcome.reward = { applied: false, reason: 'not-eligible-for-this-action-type' };
  } else if (!evidence.personaId) {
    outcome.reward = { applied: false, reason: 'no_wallet_persona' };
  } else if (evidence.rewardAppliedAt) {
    outcome.reward = { applied: true, amountKnyt: Number(evidence.rewardAppliedAt ? rule.knytcoin : 0) };
  } else {
    try {
      const source = evidence.actionType === 'campaign_referral_converted' ? 'referral' : 'reward';
      const result = await creditKnyt(evidence.personaId, rule.knytcoin, source, {
        campaignId: 'knyts-bridge-crossing',
        actionType: evidence.actionType,
        evidenceId: evidence.id,
      });
      if (result.success) {
        await markRewardApplied(evidence.id, rule.knytcoin);
        outcome.reward = { applied: true, amountKnyt: rule.knytcoin };
      } else {
        outcome.reward = { applied: false, reason: result.error ?? 'credit failed' };
      }
    } catch (err) {
      outcome.reward = { applied: false, reason: err instanceof Error ? err.message : 'reward credit failed' };
    }
  }

  return outcome;
}
