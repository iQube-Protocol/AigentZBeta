/**
 * The ONE canonical, correction-aware Standing-evidence projection (Horizen
 * Pilot Closure — Final Standing + DVN Closure, operator directive,
 * 2026-08-09).
 *
 * ── THE TWO DEFECTS THIS CLOSES ─────────────────────────────────────────────
 *
 * 1. DOUBLE-COUNTING THE NOMINAL SEED. `resolveAgentStateAxes`
 *    (services/journey/agentStateAxes.ts) already documents its own contract
 *    correctly — `standingReceipts` is "receipts evidencing qualifying,
 *    validated action. NOT the ingestion receipt" — but every caller
 *    (app/api/journey/moneypenny-horizen/state/route.ts) violated it by
 *    passing EVERY agent-scoped `standing_accrued` receipt id into
 *    `standingReceipts`, including the nominal registration seed's own
 *    receipt. Since `initialStandingAwarded` is ALSO derived from that same
 *    seed (via the `registry_standing_seeded` settled fact), the one seed
 *    receipt counted once as `initialAccrued` and again as
 *    `contributionAccrued` — Nakamoto's single nominal accrual reading as
 *    `accrued: 2`. The seed's own receipt (services/journey/
 *    registrationStandingSeedAward.ts) already carries the structured
 *    `action_input: { basis: 'iqube_registry_registration', tier: 'initial' }`
 *    needed to classify it — this module reads THAT, never amount, timing or
 *    summary text.
 *
 * 2. A SUPERSEDED RECEIPT STILL COUNTING AS CURRENT EVIDENCE. The forensic
 *    correction (`/api/ops/journey/correct-premature-standing-seed`)
 *    correctly preserves a premature `standing_accrued` receipt as immutable
 *    history while writing a `reconciliation_discrepancy_recorded` receipt
 *    naming it superseded and invalidating `registry_standing_seeded`. But
 *    `stages.standing.standingGatewayEnabled` in the state route still read
 *    bare receipt PRESENCE (`hasReceipt('standing_accrued')`), so the
 *    preserved-but-superseded receipt immediately re-completed Stand the
 *    next time the journey state was read — constitutional history remained
 *    immutable, but its CURRENT CONSEQUENCE did not actually stop. This
 *    module is what makes "preserve historical evidence; invalidate its
 *    present consequence" real: every consumer of Standing evidence
 *    (`standingGatewayEnabled`, the axis's `standingReceipts`, and the
 *    consequence fork's `receiptStatuses['standing_accrued']`) now reads
 *    THIS projection's `effective*` sets, never the raw receipt list.
 *
 * 3. SEQUENCING: an accrual receipt that predates any genuine
 *    `capability_registered` receipt is excluded from the effective set
 *    even absent a discrepancy correction — the same ordering check the
 *    forensic routes already perform, generalized here so a future
 *    mis-issued accrual (from any source, not only the AigentQube-presence
 *    defect already fixed) cannot establish Stand merely because
 *    `resolveJourneyState` lets established completion evidence outrank an
 *    unmet prerequisite (services/journey/resolveJourneyState.ts). This is
 *    additive scope-narrowing only — a genuinely-ordered accrual is
 *    unaffected.
 *
 * Generic for every agent — nothing here names MoneyPenny or Nakamoto.
 */

import { findAgentReceiptRefs, type AgentReceiptRef, type ReceiptStatus } from '@/services/receipts/activityReceiptService';
import { REGISTRATION_SEED_BASIS } from './registrationStandingSeed';

export interface StandingEvidenceProjection {
  /** Non-superseded, sequencing-valid receipts tagged as the nominal admission seed. Normally 0 or 1. */
  effectiveInitialReceipts: AgentReceiptRef[];
  /** Non-superseded, sequencing-valid receipts NOT tagged as the seed — genuine contribution accrual. */
  effectiveContributionReceipts: AgentReceiptRef[];
  /** Receipt ids excluded because a reconciliation_discrepancy_recorded receipt named them superseded. */
  supersededReceiptIds: string[];
  /** Receipt ids excluded because they predate any genuine capability_registered receipt for this agent. */
  sequencingViolationReceiptIds: string[];
}

/** A `standing_accrued` receipt is the nominal seed IFF its own action_input says so — never inferred otherwise. */
function isSeedReceipt(actionInput: Record<string, unknown> | null): boolean {
  return actionInput?.basis === REGISTRATION_SEED_BASIS && actionInput?.tier === 'initial';
}

/**
 * A `standing_corrected` receipt is an ATTRIBUTION correction IFF its own
 * `actionInput.correctionKind` says so — the same type also carries the
 * unrelated Capability Standing formula re-baseline shape
 * (`rebaselineCapabilityStanding`'s `{fromFormulaVersion, ...}`), which this
 * projection must never mistake for Standing evidence. Never inferred from
 * summary text or timing.
 */
function isAttributionCorrectionReceipt(actionInput: Record<string, unknown> | null): boolean {
  return actionInput?.correctionKind === 'standing_attribution';
}

export async function resolveStandingEvidence(runtimeAgentId: string): Promise<StandingEvidenceProjection> {
  const [standingRows, ingestRows, discrepancyRows, correctionRows] = await Promise.all([
    findAgentReceiptRefs(runtimeAgentId, ['standing_accrued'], { limit: 50 }),
    findAgentReceiptRefs(runtimeAgentId, ['capability_registered'], { limit: 50 }),
    findAgentReceiptRefs(runtimeAgentId, ['reconciliation_discrepancy_recorded'], { limit: 50 }),
    // 2026-08-23 operator directive — attribution reconciliation for
    // already-misattributed live receipts (`agentsInvoked: ['aigent-z']`
    // regardless of which agent was actually credited). A
    // `standing_corrected` receipt tagged `agentsInvoked: [runtimeAgentId]`
    // and `actionInput.correctionKind === 'standing_attribution'` is genuine
    // evidence THIS agent's Standing was credited — see
    // `app/api/ops/journey/correct-standing-attribution/route.ts`, which
    // NEVER mutates the original misattributed receipt and NEVER re-accrues
    // Standing (the numeric score already lives correctly in
    // crm_persona_reputation; only the evidence's discoverability was
    // broken).
    findAgentReceiptRefs(runtimeAgentId, ['standing_corrected'], { limit: 50 }),
  ]);

  const superseded = new Set<string>();
  for (const row of discrepancyRows) {
    const ids = row.actionInput?.standingAccruedReceiptIds;
    if (Array.isArray(ids)) {
      for (const id of ids) if (typeof id === 'string') superseded.add(id);
    }
  }

  const earliestGenuineIngestAt = ingestRows.map((r) => r.createdAt).sort()[0] ?? null;

  const effectiveInitialReceipts: AgentReceiptRef[] = [];
  const effectiveContributionReceipts: AgentReceiptRef[] = [];
  const sequencingViolationReceiptIds: string[] = [];

  for (const row of standingRows) {
    if (superseded.has(row.id)) continue; // preserved in history; excluded from present consequence

    const seed = isSeedReceipt(row.actionInput);
    // Sequencing check applies to the SEED specifically — the seed's own
    // eligibility contract (registrationStandingSeedAward.ts) requires
    // genuine factory ingestion first. A contribution accrual is not
    // ingestion-gated at all (services/journey/agentStateAxes.ts's own
    // FactoryAxis doctrine: ingestion confers Standing ELIGIBILITY, never
    // Standing itself) — so it is never subject to this specific check,
    // though it still passes through the supersession check above.
    if (seed && (!earliestGenuineIngestAt || row.createdAt < earliestGenuineIngestAt)) {
      sequencingViolationReceiptIds.push(row.id);
      continue;
    }

    if (seed) effectiveInitialReceipts.push(row);
    else effectiveContributionReceipts.push(row);
  }

  // Attribution-correction receipts (see the query above) — genuine evidence
  // for THIS agent, additive to (never a substitute for) any correctly-
  // attributed standing_accrued receipt already counted above. A correction
  // is excluded if the ORIGINAL misattributed receipt it names was ITSELF
  // later superseded via reconciliation_discrepancy_recorded — a correction
  // cannot outlive the discrepancy correction of the fact it corrects.
  for (const row of correctionRows) {
    if (!isAttributionCorrectionReceipt(row.actionInput)) continue; // the unrelated Capability-Standing re-baseline shape
    const originalReceiptId = row.actionInput?.originalReceiptId;
    if (typeof originalReceiptId === 'string' && superseded.has(originalReceiptId)) continue;
    effectiveContributionReceipts.push(row);
  }

  return {
    effectiveInitialReceipts,
    effectiveContributionReceipts,
    supersededReceiptIds: Array.from(superseded),
    sequencingViolationReceiptIds,
  };
}

/** The single boolean the `standing` stage's own completionEvidence consumes — never bare receipt presence. */
export function hasEffectiveStandingEvidence(projection: StandingEvidenceProjection): boolean {
  return projection.effectiveInitialReceipts.length > 0 || projection.effectiveContributionReceipts.length > 0;
}

/** The receipt-status set the consequence fork's `bestReceiptStatus` must reduce over — effective receipts only. */
export function effectiveStandingReceiptStatuses(projection: StandingEvidenceProjection): ReceiptStatus[] {
  return [...projection.effectiveInitialReceipts, ...projection.effectiveContributionReceipts].map((r) => r.receiptStatus);
}
