/**
 * ventureOutcomeAccrual — the venture → Standing accrual edge (Phase 2).
 *
 * Standing must NEVER accrue from self-declared outcomes — that invites
 * inflation. A `ProofOfOutcomeClaim` therefore begins life self-declared
 * (`verificationStatus: 'claimed'`) and accrues NOTHING until a verifier moves
 * it to `'verified'`. This module is the seam that, given a verified-but-not-
 * yet-accrued claim, credits the venture owner's Personal Standing once.
 *
 * The credited amount is Net Value Acceleration (the refined PoTS):
 *   NVA hours = max(0, timeSavedHours − riskRepairHours)
 *   CVS       = NVA × confidence (confidence defaults to 1)
 * i.e. time-to-value saved NET OF the time spent repairing the risk the venture
 * introduced. Proof-of-Time-Saved is one dimension of outcome accrual, not the
 * whole story — the claim also carries claimedValue + riskProfile for the human
 * verifier; only the time-net-of-risk figure feeds the Standing number today.
 *
 * Idempotency: each accrued claim is stamped `accruedAt`, and only claims that
 * are verified AND not-yet-accrued are summed, so re-running is a no-op.
 *
 * Reuse: this calls the existing `accrueStanding()` keystone (Personal lane);
 * it does not build a parallel Standing path. Sponsor Delegated/Stewardship
 * credit + capacity flow through that service exactly as for task completion.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import type { ProofOfOutcomeClaim, VentureQubeV1 } from '@/types/ventureQube';

/** Net Value Acceleration in hours = time-to-value saved net of risk repair. */
export function netValueAccelerationHours(claim: ProofOfOutcomeClaim): number {
  const saved = claim.timeSavedHours ?? 0;
  const repair = claim.riskRepairHours ?? 0;
  return Math.max(0, saved - repair);
}

/** CVS contributed by a single verified claim = NVA × confidence (default 1). */
export function claimContributionScore(claim: ProofOfOutcomeClaim): number {
  const confidence = claim.confidence == null ? 1 : Math.max(0, Math.min(1, claim.confidence));
  return netValueAccelerationHours(claim) * confidence;
}

export interface OutcomeAccrualResult {
  ok: true;
  ventureId: string;
  /** Number of claims newly accrued in this run (0 when nothing was pending). */
  accruedClaims: number;
  /** Sum of Net Value Acceleration (hours) across the newly-accrued claims. */
  netValueAccelerationHours: number;
  /** Contribution Value Score sent to the Standing keystone (NVA × confidence). */
  cvsAccrued: number;
  /** Resulting Personal/overall Standing, when accrual ran; null when skipped. */
  standingOverall: number | null;
  standingThresholdCrossed: boolean;
}

/**
 * Sweep a venture's verified-but-unaccrued ProofOfOutcomeClaims, credit the
 * owner's Personal Standing once for the aggregate Net Value Acceleration, and
 * stamp each accrued claim `accruedAt`. Best-effort and idempotent.
 */
export async function accrueVentureOutcomes(
  ventureId: string,
): Promise<OutcomeAccrualResult | { ok: false; error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'database unavailable' };

  const { data: row, error } = await admin
    .from('venture_qubes')
    .select('id, owner_persona_id, layers')
    .eq('id', ventureId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? 'venture not found' };

  const ownerPersonaId = String(row.owner_persona_id ?? '');
  const layers = (row.layers ?? {}) as VentureQubeV1;
  const claims = layers.outcome?.proofOfOutcomeClaims ?? [];

  const pending = claims.filter(
    (c) => c.verificationStatus === 'verified' && !c.accruedAt,
  );
  if (pending.length === 0) {
    return {
      ok: true,
      ventureId,
      accruedClaims: 0,
      netValueAccelerationHours: 0,
      cvsAccrued: 0,
      standingOverall: null,
      standingThresholdCrossed: false,
    };
  }

  const nvaTotal = pending.reduce((sum, c) => sum + netValueAccelerationHours(c), 0);
  const cvsTotal = pending.reduce((sum, c) => sum + claimContributionScore(c), 0);

  // Resolve the owner's CRM persona (the keystone is CRM-persona-keyed).
  let standingOverall: number | null = null;
  let thresholdCrossed = false;
  if (cvsTotal > 0 && ownerPersonaId) {
    const crm = getCrmClient();
    const { data: crmPersona } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', ownerPersonaId)
      .maybeSingle();
    const crmPersonaId = crmPersona?.id ? String(crmPersona.id) : null;
    if (crmPersonaId) {
      const accrual = await accrueStanding({
        crmPersonaId,
        cvs: cvsTotal,
        standingType: 'personal',
      });
      if (accrual) {
        standingOverall = accrual.overall;
        thresholdCrossed = accrual.thresholdCrossed;
      }
    }
  }

  // Stamp accrued claims (idempotent) and persist the layers in place. Done
  // even when no CRM persona was found, so a later CRM link doesn't double-count
  // — verification is the accrual gate, and these claims are verified.
  const accruedAt = new Date().toISOString();
  const nextClaims = claims.map((c) =>
    c.verificationStatus === 'verified' && !c.accruedAt ? { ...c, accruedAt } : c,
  );
  const nextLayers: VentureQubeV1 = {
    ...layers,
    outcome: { ...layers.outcome, proofOfOutcomeClaims: nextClaims },
  };
  await admin.from('venture_qubes').update({ layers: nextLayers }).eq('id', ventureId);

  return {
    ok: true,
    ventureId,
    accruedClaims: pending.length,
    netValueAccelerationHours: nvaTotal,
    cvsAccrued: cvsTotal,
    standingOverall,
    standingThresholdCrossed: thresholdCrossed,
  };
}
