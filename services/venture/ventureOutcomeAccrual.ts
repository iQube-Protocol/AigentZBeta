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
 *
 * Sprint 2 — Delegation chain accrual:
 * The delegation layer of the VentureQube carries the agentType + agentId for
 * each bounded agent (aigentMe delegate, devon/marketa workers). When present,
 * their identity persona IDs are resolved to CRM personas and credited at the
 * delegation-lane multipliers:
 *   Delegate (aigentMe)        → Delegated Standing  × 0.5 of CVS
 *   Worker  (devon, marketa…)  → Stewardship Standing × 0.25 of CVS
 * This flows verified venture outcomes through the full fulfilment chain as
 * privacy-preserving Standing signals anchored on-chain via DVN receipts.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import type { ProofOfOutcomeClaim, VentureQubeV1, VentureDelegationLayer } from '@/types/ventureQube';

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

/** Delegation-lane multipliers per CLAUDE.md Standing architecture. */
const DELEGATED_CVS_FACTOR = 0.5;
const STEWARDSHIP_CVS_FACTOR = 0.25;

/** VentureAgentConsumer values that map to the Delegated lane. */
const DELEGATE_AGENT_TYPES = new Set(['aigentMe']);
/** VentureAgentConsumer values that map to the Stewardship lane. */
const WORKER_AGENT_TYPES = new Set(['devon', 'marketa', 'venture-lab', 'investor-office']);

export interface OutcomeAccrualResult {
  ok: true;
  ventureId: string;
  /** Number of claims newly accrued in this run (0 when nothing was pending). */
  accruedClaims: number;
  /** Sum of Net Value Acceleration (hours) across the newly-accrued claims. */
  netValueAccelerationHours: number;
  /** Contribution Value Score sent to the Standing keystone (NVA × confidence). */
  cvsAccrued: number;
  /** Resulting Personal/overall Standing for the owner, when accrual ran; null when skipped. */
  standingOverall: number | null;
  standingThresholdCrossed: boolean;
  /**
   * Sprint 2 — per-participant accrual results for the delegation chain.
   * Array is empty when no delegation layer is populated on the venture.
   */
  delegationChainAccruals: Array<{
    agentType: string;
    agentId: string;
    lane: 'delegated' | 'stewardship';
    cvsAccrued: number;
    standingOverall: number | null;
  }>;
}

/**
 * Resolve a CRM persona ID from an identity persona ID. Best-effort — returns
 * null when the agent has no CRM record (common during Alpha for system agents).
 */
async function crmPersonaIdForIdentityPersonaId(identityPersonaId: string): Promise<string | null> {
  try {
    const crm = getCrmClient();
    const { data } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', identityPersonaId)
      .maybeSingle();
    return data?.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

/**
 * Sweep a venture's verified-but-unaccrued ProofOfOutcomeClaims, credit the
 * owner's Personal Standing once for the aggregate Net Value Acceleration, and
 * stamp each accrued claim `accruedAt`. Best-effort and idempotent.
 *
 * Sprint 2 (corrected Sprint 4): delegation chain participants each earn
 * Personal Standing — the keystone auto-resolves their citizen sponsor via the
 * identity spine and credits the citizen Delegated (0.5×) + Stewardship (0.25×)
 * implicitly. CVS portions: delegate = 0.5× cvsTotal, workers = 0.25×.
 * This avoids double-counting: citizen owner already earned the full cvsTotal
 * in the Personal lane above; the fractions here represent the agent's own
 * contribution signal, not a duplicate of the citizen's.
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
      delegationChainAccruals: [],
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

  // Sprint 4 (corrects Sprint 2) — Delegation chain accrual.
  // Each agent earns Personal Standing for their portion of the verified CVS.
  // The standing keystone auto-resolves their citizen sponsor via the identity
  // spine (agent_root_identity → sponsor_persona_id → crm_persona) and credits
  // the citizen Delegated/Stewardship implicitly — no double-counting of the
  // citizen's own Personal accrual above.
  // Delegate (aigentMe): 0.5× cvsTotal. Workers: 0.25× cvsTotal.
  const delegationLayer = layers.delegation as VentureDelegationLayer | undefined;
  const chainAccruals: OutcomeAccrualResult['delegationChainAccruals'] = [];
  if (cvsTotal > 0 && Array.isArray(delegationLayer?.assignments)) {
    for (const assignment of delegationLayer!.assignments) {
      const agentPersonaId = assignment.agentId;
      if (!agentPersonaId) continue;

      const isDelegate = DELEGATE_AGENT_TYPES.has(assignment.agentType);
      const isWorker = WORKER_AGENT_TYPES.has(assignment.agentType);
      if (!isDelegate && !isWorker) continue;

      // Lane tag returned to the caller for audit; the actual accrual is always
      // Personal (the agent earns their own signal; citizen sponsor gets credit
      // through the keystone's auto-resolved sponsor logic).
      const lane: 'delegated' | 'stewardship' = isDelegate ? 'delegated' : 'stewardship';
      const factor = isDelegate ? DELEGATED_CVS_FACTOR : STEWARDSHIP_CVS_FACTOR;
      const agentCvs = cvsTotal * factor;

      const agentCrmId = await crmPersonaIdForIdentityPersonaId(agentPersonaId);
      if (!agentCrmId) continue; // no CRM record — skip silently

      const accrual = await accrueStanding({
        crmPersonaId: agentCrmId,
        cvs: agentCvs,
        standingType: 'personal', // agent earns Personal; keystone auto-credits citizen sponsor
      }).catch(() => null);

      chainAccruals.push({
        agentType: assignment.agentType,
        agentId: agentPersonaId,
        lane,
        cvsAccrued: agentCvs,
        standingOverall: accrual?.overall ?? null,
      });
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
    delegationChainAccruals: chainAccruals,
  };
}
