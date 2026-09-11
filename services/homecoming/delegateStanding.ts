/**
 * delegateStanding — the Standing loop (CFS-023 × CFS-025 flywheel).
 *
 * A constitutional delegate EARNS its climb by producing consequential
 * artifacts: when a non-disposable production succeeds, standing accrues to the
 * DELEGATE (the producing agent), in the `delegated` lane, through the ONE
 * canonical accrual service (services/crm/standingAccrualService — no fork).
 * As standing accumulates, the delegate's trust-band CEILING rises
 * (L2≥20 · L3≥50 · L4≥75 · L5≥100), which is what unlocks the Homecoming
 * ladder's L3–L5 rungs — earned, never granted on demand.
 *
 * Resolution chain (same as /api/persona/sponsored-agents Sprint-4 standing):
 *   agent_root_identity.agent_id → crm_personas.identity_persona_id → crm id
 *   → accrueStanding(crmPersonaId, cvs, 'delegated', receiptId).
 *
 * Best-effort + honest: if the delegate has no CRM persona yet, the accrual is
 * SKIPPED with a stated reason (never faked). CVS weights are design values,
 * documented here: operational production = 2, constitutional publication = 5.
 */

import { getCrmClient } from '@/services/crm/crmDataAccess';
import { accrueStanding, type StandingAccrual } from '@/services/crm/standingAccrualService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

/** Resolve a Homecoming delegate slug (agent_card_slug) → its agent_id. */
export async function resolveDelegateAgentId(delegateSlug: string): Promise<string | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data } = await admin
    .from('agent_root_identity')
    .select('agent_id')
    .eq('agent_card_slug', delegateSlug)
    .maybeSingle();
  return data?.agent_id ? String(data.agent_id) : null;
}

/** Resolve an agent Root DID (did_uri) → its agent_id — the delegation grant
 *  route identifies delegates by DID, standing is keyed on agent_id. */
export async function resolveDelegateAgentIdByDid(didUri: string): Promise<string | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data } = await admin
    .from('agent_root_identity')
    .select('agent_id')
    .eq('did_uri', didUri)
    .maybeSingle();
  return data?.agent_id ? String(data.agent_id) : null;
}

/** Contribution Value Score per consequence tier (design values, CFS-025). */
export const PRODUCTION_CVS: Record<'operational' | 'constitutional', number> = {
  operational: 2,
  constitutional: 5,
};

/** The trust-band ceiling a standing score earns (mirrors BAND_MIN_SCORE). Pure. */
export function trustBandCeilingFor(overall: number): string {
  if (overall >= 100) return 'L5_CORE_SOVEREIGN';
  if (overall >= 75) return 'L4_PRODUCTION_APPROVED';
  if (overall >= 50) return 'L3_PRODUCTION_CANDIDATE';
  if (overall >= 20) return 'L2_VERIFIED_COMMUNITY';
  return 'L1_EXPERIMENTAL';
}

/** Trust bands lowest → highest (the delegation route's vocabulary). Pure. */
export const TRUST_BAND_ORDER = [
  'L1_EXPERIMENTAL',
  'L2_VERIFIED_COMMUNITY',
  'L3_PRODUCTION_CANDIDATE',
  'L4_PRODUCTION_APPROVED',
  'L5_CORE_SOVEREIGN',
] as const;

/** Rank of a band in the ladder (unknown band → -1, always refused above floor). Pure. */
export function trustBandRank(band: string): number {
  return TRUST_BAND_ORDER.indexOf(band as (typeof TRUST_BAND_ORDER)[number]);
}

/**
 * The DELEGATE side of the dual grant gate (operator decision 2026-07-12,
 * option (c)): bands up to the ENTRY band (L2) are grantable on the grantor's
 * reputation alone — the bootstrap floor, so a new agent can be delegated at
 * all and then EARN its climb by producing. L3 and above additionally require
 * the delegate's own earned trust-band ceiling to reach the requested band.
 * Pure — the caller supplies the server-resolved ceiling.
 */
export function delegateStandingAllowsBand(requestedBand: string, earnedCeiling: string): boolean {
  const requested = trustBandRank(requestedBand);
  if (requested < 0) return false; // unknown band — never allowed by this gate
  if (requested <= trustBandRank('L2_VERIFIED_COMMUNITY')) return true; // bootstrap floor
  return trustBandRank(earnedCeiling) >= requested;
}

export interface ProductionStandingResult {
  accrued: boolean;
  /** Why not, when accrued=false — honest, never silent. */
  reason?: string;
  cvs?: number;
  lane?: 'delegated';
  overall?: number;
  bucket?: number;
  trustBandCeiling?: string;
}

/**
 * Accrue an arbitrary CVS to a delegate through the ONE canonical accrual
 * service (delegated lane). `delegateAgentId` is agent_root_identity.agent_id
 * (e.g. 'polity-bound:aletheon'). Best-effort — a failure/absence never blocks
 * the calling flow. Shared by production accrual and the admin accelerator.
 */
export async function accrueDelegateStanding(input: {
  delegateAgentId: string;
  cvs: number;
  receiptId?: string | null;
}): Promise<ProductionStandingResult> {
  try {
    const crm = getCrmClient();
    const { data: crmPersona } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', input.delegateAgentId)
      .maybeSingle();
    if (!crmPersona?.id) {
      return {
        accrued: false,
        reason: `delegate has no CRM persona yet (identity_persona_id=${input.delegateAgentId}) — standing accrues once its CRM persona exists`,
      };
    }
    const accrual: StandingAccrual | null = await accrueStanding({
      crmPersonaId: String(crmPersona.id),
      cvs: input.cvs,
      standingType: 'delegated', // acting under bounded delegation
      sourceEventId: input.receiptId ?? null,
    });
    if (!accrual) {
      return { accrued: false, reason: 'accrual service returned null (see server logs)' };
    }
    return {
      accrued: true,
      cvs: input.cvs,
      lane: 'delegated',
      overall: accrual.overall,
      bucket: accrual.bucket,
      trustBandCeiling: trustBandCeilingFor(accrual.overall),
    };
  } catch (e) {
    return { accrued: false, reason: e instanceof Error ? e.message : 'standing accrual failed' };
  }
}

/**
 * Accrue production standing to a delegate — the Standing-loop entrypoint the
 * produce/promote routes call. Thin wrapper over `accrueDelegateStanding` with
 * the CFS-025 design CVS per consequence tier.
 */
export async function accrueProductionStanding(input: {
  delegateAgentId: string;
  consequenceClass: 'operational' | 'constitutional';
  receiptId?: string | null;
}): Promise<ProductionStandingResult> {
  return accrueDelegateStanding({
    delegateAgentId: input.delegateAgentId,
    cvs: PRODUCTION_CVS[input.consequenceClass],
    receiptId: input.receiptId,
  });
}

/** Read a delegate's current standing (overall + the band ceiling it earns). */
export async function readDelegateStanding(delegateAgentId: string): Promise<{ overall: number; bucket: number; trustBandCeiling: string } | null> {
  try {
    const crm = getCrmClient();
    const { data: crmPersona } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', delegateAgentId)
      .maybeSingle();
    if (!crmPersona?.id) return null;
    const { data: rep } = await crm
      .from('crm_persona_reputation')
      .select('standing_overall, standing_bucket')
      .eq('persona_id', String(crmPersona.id))
      .maybeSingle();
    if (!rep) return null;
    const overall = Number(rep.standing_overall ?? 0);
    return { overall, bucket: Number(rep.standing_bucket ?? 0), trustBandCeiling: trustBandCeilingFor(overall) };
  } catch {
    return null;
  }
}
