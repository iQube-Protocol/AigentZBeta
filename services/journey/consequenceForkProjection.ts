/**
 * Consequence Fork projection — the fork's three-tier presentation state,
 * derived EXCLUSIVELY from authoritative journey state + receipt status
 * (Horizen Journey correction, 2026-08-09: "do not invent a new source of
 * truth"). This module classifies; it reads nothing and writes nothing.
 *
 * Three tiers, never collapsed into a plain complete/incomplete boolean:
 *
 *   'proven-consequence'        — the stage's own act is done AND, where an
 *                                 external consequence exists to observe
 *                                 (a DVN-anchored receipt), that consequence
 *                                 has reached finality (`dvn_recorded`).
 *   'pending-observer-active'   — the stage's own act is done, but its
 *                                 external consequence has not yet reached
 *                                 finality. NEVER rendered as a failure —
 *                                 "your action is complete; the external
 *                                 consequence is still being observed," and
 *                                 the background reconciler/finalizer
 *                                 (services/dvn/activityReceiptDvnPipeline.ts)
 *                                 advances it without the originating browser
 *                                 session.
 *   'refused-unresolved'        — the stage's own act has not (yet) happened,
 *                                 or was explicitly refused. Rendered
 *                                 neutrally when merely not-yet-started
 *                                 (Stand for an agent still earning it) —
 *                                 this tier is never itself a "red" failure
 *                                 signal; a genuine REFUSED stage state is
 *                                 what supplies that.
 *
 * ── THE DISTINCTIONS THIS PRESERVES (operator instruction, 2026-08-09) ────
 *
 *   submitted ≠ confirmed             — 'local'/'dvn_pending' vs 'dvn_recorded'
 *   authorized ≠ independently verified — Ratify's operator authorization is
 *                                         the stage's OWN completion; DVN
 *                                         anchoring of that authorization is
 *                                         the separate external consequence
 *                                         this module classifies
 *   evidence present ≠ DVN final      — a receipt existing is not the same
 *                                         claim as that receipt's
 *                                         `receipt_status` reaching
 *                                         'dvn_recorded'
 *   Standing seed ≠ performance       — this module makes no performance
 *                                         claim; Stand's own copy
 *                                         (horizenMoneyPennyJourney.ts) is
 *                                         what already keeps that distinction
 */

import type { JourneyStageState } from '@/types/journey';
import type { ReceiptStatus } from '@/services/receipts/activityReceiptService';

export type ConsequenceProngTier = 'proven-consequence' | 'pending-observer-active' | 'refused-unresolved';

export interface ConsequenceProngInput {
  /** The prong's own resolved stage state — never re-derived here. */
  stageState: JourneyStageState;
  /**
   * The BEST (highest-ranked) `receipt_status` across every receipt that
   * constitutes this prong's external consequence, or `null` when the
   * stage's completion has no external leg to observe (a pure DB/operator
   * act with nothing further to confirm).
   */
  bestAnchorReceiptStatus: ReceiptStatus | null;
}

/**
 * CONFIRMATION OUTRANKS EARLIER PENDING/FAILED STATE, and a later pending
 * resubmission can never erase an earlier finalized one — the ratchet a
 * caller applies via `bestReceiptStatus` below before calling the classifier.
 */
const RECEIPT_STATUS_RANK: Record<ReceiptStatus, number> = {
  local: 0,
  dvn_failed: 0,
  dvn_pending: 1,
  dvn_recorded: 2,
};

/**
 * The ratchet: given every matching receipt's status for one prong, returns
 * the single BEST status reached — never the most recent, never the first.
 * `dvn_recorded` achieved once stays reported even if a later resubmission
 * for the same stage is only `dvn_pending`.
 */
export function bestReceiptStatus(statuses: readonly ReceiptStatus[]): ReceiptStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((best, s) => (RECEIPT_STATUS_RANK[s] > RECEIPT_STATUS_RANK[best] ? s : best));
}

export function classifyConsequenceProng(input: ConsequenceProngInput): ConsequenceProngTier {
  if (input.stageState !== 'COMPLETE') {
    // Not yet established — includes a genuine REFUSED as well as simply
    // NOT_STARTED/READY/IN_PROGRESS/BLOCKED. Rendering distinguishes a real
    // refusal from "not yet reached"; this classification does not.
    return 'refused-unresolved';
  }
  if (input.bestAnchorReceiptStatus === null || input.bestAnchorReceiptStatus === 'dvn_recorded') {
    return 'proven-consequence';
  }
  // 'local' | 'dvn_pending' | 'dvn_failed' — the operator's own act is done;
  // the external consequence is still being observed (or a failed anchor
  // attempt awaits retry, services/dvn's own retry route) — never a failure
  // of the underlying constitutional fact.
  return 'pending-observer-active';
}

export interface ConsequenceProngCopy {
  tier: ConsequenceProngTier;
  label: string;
  detail: string;
}

/**
 * The ONE place this fork's tier copy is written, so no renderer improvises
 * a second phrasing of "pending must never read as failure."
 */
export function consequenceProngCopy(tier: ConsequenceProngTier): ConsequenceProngCopy {
  switch (tier) {
    case 'proven-consequence':
      return { tier, label: 'Proven', detail: 'This consequence is established and, where anchored, finalized.' };
    case 'pending-observer-active':
      return {
        tier,
        label: 'Pending',
        detail: 'Your action is complete. The external consequence is still being observed.',
      };
    case 'refused-unresolved':
      return { tier, label: 'Unresolved', detail: 'Not yet established.' };
  }
}
