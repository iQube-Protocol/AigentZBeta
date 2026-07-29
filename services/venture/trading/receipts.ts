/**
 * DVN receipt integration for the venture substrate.
 *
 * Nine consequential events each get an individual receipt (charter R-6):
 * opportunity opened; service work completed; completion assessed; correct
 * refusal recorded; obligation earned; obligation approved; simulated
 * settlement; reversal/dispute; opportunity closed. Ordinary cost lines are
 * checkpointed into a batch COMMITMENT rather than receipted individually —
 * anchoring every keystroke of measured work would drown the consequential
 * events it exists to make findable.
 *
 * ─── The ledger must not become a second receipt system ─────────────────────
 *
 * The ledger is an accounting view composed FROM receipted events. A ledger
 * that can assert what the receipt stream cannot corroborate has forked the
 * record, and the fork would be discovered during audit rather than before. So
 * every obligation carries the `receiptRefs` of the events that created and
 * moved it, and `reconcileRun` checks that correspondence in both directions.
 *
 * ─── What this module does NOT do ───────────────────────────────────────────
 *
 * It does not modify `services/dvn/activityReceiptDvnPipeline.ts`. The nine
 * action types are added to `ANCHORABLE_ACTION_TYPES` (the one unilateral
 * change CLAUDE.md permits) and to the `ActivityActionType` union with its
 * matching CHECK-constraint migration. The payload the pipeline builds, its
 * state machine and `hashPersonaRef` are untouched.
 *
 * In Phase 1 receipts are written to an in-memory run journal rather than to
 * `activity_receipts`: the runs are deterministic simulations replayed eight
 * times per scenario, and writing 24 replays of the same fixture into the
 * production receipt table would pollute the real provenance trail with
 * simulation artifacts. The journal entries are ANCHOR-ELIGIBLE by
 * construction — `assertAnchorableActionTypes` proves every action type used
 * here is in the pipeline's anchorable set — so the same emitter serves the
 * live path when Phase 2 turns it on.
 *
 * T0/T2: every payload field is a commitment. `assertNoRawIdentifiers` fails
 * loudly rather than sanitising, so a leak is a build failure and not a quietly
 * scrubbed value.
 */

import { createHash } from 'crypto';
import type { PartnerServiceCompensationExtension } from './compensationExtension';
import { containsRawIdentifier } from './refs';

/**
 * The nine venture receipt action types. Each is also a member of
 * `ActivityActionType` and of `ANCHORABLE_ACTION_TYPES`; the parity canary
 * checks both directions so a type used here but missing from the pipeline
 * fails the build instead of silently going unanchored.
 */
export const VENTURE_RECEIPT_ACTION_TYPES = [
  'venture_opportunity_opened',
  'venture_service_completed',
  'venture_completion_assessed',
  'venture_refusal_recorded',
  'venture_obligation_earned',
  'venture_obligation_approved',
  'venture_settlement_simulated',
  'venture_obligation_reversed',
  'venture_opportunity_closed',
] as const;

export type VentureReceiptActionType = (typeof VENTURE_RECEIPT_ACTION_TYPES)[number];

export interface VentureReceipt {
  receiptRef: string;
  actionType: VentureReceiptActionType;
  /** Fixture timestamp — never a clock. */
  at: string;
  experimentalCellId: string;
  /** Commitment over the opportunity. */
  opportunityRef: string;
  /** T1-safe description of the act. Never carries an identifier. */
  summary: string;
  evidenceRefs: string[];
  /** Present only on compensation-bearing receipts (R-8). */
  compensation?: PartnerServiceCompensationExtension;
  /**
   * Distinguishes the TWO things a `venture_refusal_recorded` receipt can mean,
   * which must never be conflated:
   *   constitutional-service-refusal — an agent correctly declined to execute.
   *     A COMPLETED service. Compensable under completion-contingency.
   *   compensation-refused-no-valid-completion — the LEDGER declined to create
   *     a liability because the opportunity never completed constitutionally.
   * One action type with no discriminator would let an audit read the second as
   * the first, i.e. read a process failure as a constitutional success.
   */
  refusalKind?: 'constitutional-service-refusal' | 'compensation-refused-no-valid-completion';
}

/**
 * A batch checkpoint over ordinary cost lines: one commitment standing for many
 * events, so the cost stream is tamper-evident without one receipt per line.
 */
export interface CostCheckpoint {
  checkpointRef: string;
  experimentalCellId: string;
  eventCount: number;
  /** sha256 over the ordered event digests — recomputable from the events. */
  commitment: string;
  at: string;
}

export interface VentureReceiptJournal {
  runId: string;
  experimentalCellId: string;
  receipts: VentureReceipt[];
  checkpoints: CostCheckpoint[];
  seq: number;
}

export function createReceiptJournal(runId: string, experimentalCellId: string): VentureReceiptJournal {
  return { runId, experimentalCellId, receipts: [], checkpoints: [], seq: 0 };
}

/**
 * Refuse to emit a receipt carrying a raw identifier. Throwing beats scrubbing:
 * a scrubbed value ships, and the call site keeps the habit.
 */
function assertNoRawIdentifiers(receipt: VentureReceipt): void {
  const { receiptRef: _ref, at: _at, ...payload } = receipt;
  if (containsRawIdentifier(payload)) {
    throw new Error(
      `venture receipt ${receipt.actionType} carries a raw identifier — every id on a receipt must be a commitment (services/venture/trading/refs.ts)`,
    );
  }
}

export function emitVentureReceipt(
  journal: VentureReceiptJournal,
  input: Omit<VentureReceipt, 'receiptRef'>,
): VentureReceipt {
  journal.seq += 1;
  const receipt: VentureReceipt = {
    ...input,
    receiptRef: `${journal.runId}-rcpt-${String(journal.seq).padStart(3, '0')}`,
  };
  assertNoRawIdentifiers(receipt);
  journal.receipts.push(receipt);
  return receipt;
}

/**
 * Pre-allocate the reference a receipt WILL have, so a ledger row and its
 * receipt can name each other without a circular write. The counter advances,
 * so the reference is never reused.
 */
export function reserveReceiptRef(journal: VentureReceiptJournal): string {
  journal.seq += 1;
  return `${journal.runId}-rcpt-${String(journal.seq).padStart(3, '0')}`;
}

export function emitReservedVentureReceipt(
  journal: VentureReceiptJournal,
  receiptRef: string,
  input: Omit<VentureReceipt, 'receiptRef'>,
): VentureReceipt {
  const receipt: VentureReceipt = { ...input, receiptRef };
  assertNoRawIdentifiers(receipt);
  journal.receipts.push(receipt);
  return receipt;
}

/** Checkpoint ordinary cost lines into one recomputable commitment. */
export function checkpointCostEvents(
  journal: VentureReceiptJournal,
  digests: readonly string[],
  at: string,
): CostCheckpoint {
  const commitment = createHash('sha256').update(digests.join('|')).digest('hex').slice(0, 32);
  const checkpoint: CostCheckpoint = {
    checkpointRef: `${journal.runId}-ckpt-${String(journal.checkpoints.length + 1).padStart(2, '0')}`,
    experimentalCellId: journal.experimentalCellId,
    eventCount: digests.length,
    commitment,
    at,
  };
  journal.checkpoints.push(checkpoint);
  return checkpoint;
}

/** Receipts of a given action type — used by reconciliation and the canaries. */
export function receiptsOfType(
  journal: VentureReceiptJournal,
  actionType: VentureReceiptActionType,
): VentureReceipt[] {
  return journal.receipts.filter((r) => r.actionType === actionType);
}
