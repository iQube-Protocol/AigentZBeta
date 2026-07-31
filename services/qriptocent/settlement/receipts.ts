/**
 * DVN receipts for QriptoCENT cross-denomination settlement.
 *
 * The constitution's rule: *every debit, message, credit, exception, and
 * reconciliation must produce attributable DVN receipts.* Nine consequential
 * events, one receipt each, forming the evidence chain:
 *
 *   passport-backed authority
 *     → payment instruction
 *     → source ledger debit
 *     → DVN message
 *     → destination ledger credit
 *     → bilateral reconciliation
 *     → settlement receipts
 *
 * ─── WHY THE RECEIPTS ARE LOAD-BEARING HERE, NOT DECORATIVE ─────────────────
 *
 * In a lock-and-mint bridge, the lock contract is the evidence: anyone can read
 * the locked balance and check it against the wrapped supply. This architecture
 * has NO lock pool, so there is no on-chain object standing for "this credit was
 * backed". The receipt chain IS that evidence. A destination credit whose source
 * debit produced no receipt is indistinguishable, after the fact, from value
 * created out of nothing — which is precisely the failure the accounting
 * invariant exists to prevent. Losing a receipt here is not losing an audit
 * log; it is losing the only proof that a payment was a payment.
 *
 * ─── FIXTURE MODE ───────────────────────────────────────────────────────────
 *
 * Phase 1 is deterministic simulation. Four DISTINCT states, and conflating any
 * two of them IS the defect:
 *
 *     receipt object generated   — YES
 *     receipt hash computed      — YES (`settlementReceiptHash`)
 *     receipt persisted          — NO
 *     receipt DVN-anchored       — NO
 *
 * The last two are held by a RUNTIME GUARD shared with the venture substrate
 * (`services/simulation/journal.ts`), not by a convention: a journal carries its
 * `mode`, and every persistence/anchoring path funnels through
 * `assertSettlementJournalCanLeaveMemory`, which THROWS on a fixture journal.
 *
 * ─── DVN pipeline ───────────────────────────────────────────────────────────
 *
 * The nine action types are added to `ANCHORABLE_ACTION_TYPES` (the ONE change
 * CLAUDE.md permits in that pipeline without prior approval) and to the
 * `ActivityActionType` union with its matching CHECK-constraint migration. The
 * payload shape, the state machine, `hashPersonaRef` and principal resolution
 * are untouched.
 */

import {
  assertJournalCanLeaveMemory,
  FixtureModeViolation,
  simulationRecordHash,
  type JournalEgress,
  type SimulationMode,
} from '@/services/simulation/journal';
import { containsRawIdentifier } from './refs';
import {
  assertSixCategoriesDistinguished,
  type SettlementValueBreakdown,
} from './classification';

/**
 * The twelve consequential events. Nine belong to SETTLEMENT; three belong to
 * the two other constitutionally separate mechanisms — liquidity assurance
 * (`qriptocent_liquidity_proof_verified`) and ISSUANCE
 * (`qriptocent_replenishment_authorised`, `qriptocent_native_issuance_executed`).
 *
 * The issuance pair carries DISTINCT action types on purpose. A mint recorded
 * under a settlement action type would let new supply be read as a payment,
 * which is precisely the "never disguised as settlement" prohibition. Each is
 * also a member of
 * `ActivityActionType` and of `ANCHORABLE_ACTION_TYPES`; the repo's
 * action-type parity canary checks both directions, so a type used here but
 * missing from the constraint fails the build instead of silently losing a
 * receipt at write time.
 */
export const SETTLEMENT_RECEIPT_ACTION_TYPES = [
  'qriptocent_payment_instruction_accepted',
  'qriptocent_settlement_authority_verified',
  'qriptocent_source_debit_initiated',
  'qriptocent_source_debit_finalised',
  'qriptocent_settlement_message_verified',
  'qriptocent_destination_liquidity_reserved',
  'qriptocent_destination_credit_completed',
  'qriptocent_settlement_reconciled',
  'qriptocent_settlement_exception_recorded',
  // ── Liquidity assurance (mechanism 2) ──────────────────────────────────
  'qriptocent_liquidity_proof_verified',
  // ── Issuance (mechanism 3) — NEVER a settlement action type ────────────
  'qriptocent_replenishment_authorised',
  'qriptocent_native_issuance_executed',
] as const;

/** The nine that are settlement acts. Used by the mechanism-separation canary. */
export const SETTLEMENT_ONLY_ACTION_TYPES = [
  'qriptocent_payment_instruction_accepted',
  'qriptocent_settlement_authority_verified',
  'qriptocent_source_debit_initiated',
  'qriptocent_source_debit_finalised',
  'qriptocent_settlement_message_verified',
  'qriptocent_destination_liquidity_reserved',
  'qriptocent_destination_credit_completed',
  'qriptocent_settlement_reconciled',
  'qriptocent_settlement_exception_recorded',
] as const;

/** The two that create native supply. Never emitted by the settlement path. */
export const ISSUANCE_ACTION_TYPES = [
  'qriptocent_replenishment_authorised',
  'qriptocent_native_issuance_executed',
] as const;

export type SettlementReceiptActionType = (typeof SETTLEMENT_RECEIPT_ACTION_TYPES)[number];

export interface SettlementReceipt {
  receiptRef: string;
  actionType: SettlementReceiptActionType;
  /** Fixture timestamp — never a clock. */
  at: string;
  /**
   * Commitment over the settlement this receipt attests — or, on an issuance
   * receipt, the replenishment authorisation reference. One field, because a
   * receipt always names the ONE act it attests; the action type says which
   * kind of act that is.
   */
  settlementRef: string;
  /** Which ledger this event happened on. Both networks receipt their own side. */
  network: 'bitcoin' | 'base' | 'both';
  /** T1-safe description of the act. Never carries an identifier. */
  summary: string;
  evidenceRefs: string[];
  /**
   * The amount this event moved, when it moved one. Present on debit, credit and
   * reversal receipts; absent on message and authority receipts, which move
   * nothing. Recording it lets a reader check the cent-for-cent claim from the
   * receipt stream alone, without trusting the settlement record.
   */
  amountMinorUnits?: string;
  /**
   * ─── SIX DISTINGUISHABLE THINGS, NEVER ONE NET FIGURE ────────────────────
   *
   *   principal · network fees · service fees · liquidity/finality fees ·
   *   observed market deviation · any externally authorised execution rate
   *
   * `amountMinorUnits` above is a SUMMARY, and on the debit receipt it is a
   * blended total. A receipt may present such a total only alongside this
   * breakdown, so the total can always be taken apart again — otherwise a fee
   * and a market observation become indistinguishable from each other and from
   * the principal, which is the whole failure the classification ruling closes.
   *
   * `emitSettlementReceipt` refuses a breakdown that has lost a category.
   */
  valueBreakdown?: SettlementValueBreakdown;
  /**
   * On an exception receipt: whether value had already left the payer. The
   * single most consequential bit in the whole stream — it is the difference
   * between "nothing happened" and "someone is owed".
   */
  valueCommitted?: boolean;
}

export type SettlementReceiptMode = SimulationMode;

export interface SettlementReceiptJournal {
  runId: string;
  mode: SettlementReceiptMode;
  receipts: SettlementReceipt[];
  seq: number;
}

export function createSettlementJournal(
  runId: string,
  mode: SettlementReceiptMode = 'fixture',
): SettlementReceiptJournal {
  return { runId, mode, receipts: [], seq: 0 };
}

/** Thrown when something tries to move a FIXTURE settlement journal out of memory. */
export class SettlementFixtureModeViolation extends FixtureModeViolation {
  constructor(runId: string, operation: JournalEgress) {
    super(
      runId,
      operation,
      `settlement journal ${runId} is in FIXTURE mode and must not be ${operation === 'persist' ? 'persisted' : 'DVN-anchored'}. ` +
        'These are deterministic replays of simulated inter-ledger settlements; writing them to activity_receipts would put ' +
        'simulation artifacts in the operational provenance trail — and a simulated settlement receipt is indistinguishable, ' +
        'downstream, from evidence that real value moved. Receipt objects and hashes are available via settlementJournalArtifacts().',
    );
    this.name = 'SettlementFixtureModeViolation';
  }
}

/**
 * ── THE HARD GUARD ──
 *
 * Throws; never warns, logs, no-ops or returns false. The decision lives once,
 * in `services/simulation/journal.ts`, shared with the venture substrate — this
 * only supplies the settlement subclass.
 */
export function assertSettlementJournalCanLeaveMemory(
  journal: SettlementReceiptJournal,
  operation: JournalEgress,
): void {
  assertJournalCanLeaveMemory(
    journal,
    operation,
    (runId, op) => new SettlementFixtureModeViolation(runId, op),
  );
}

/**
 * Persist a settlement receipt through a caller-supplied writer. The writer is
 * NEVER invoked for a fixture journal — the guard throws before it is reached.
 */
export async function persistSettlementReceipt<T>(
  journal: SettlementReceiptJournal,
  receipt: SettlementReceipt,
  writer: (receipt: SettlementReceipt) => Promise<T>,
): Promise<T> {
  assertSettlementJournalCanLeaveMemory(journal, 'persist');
  return writer(receipt);
}

/** DVN anchoring, under the same gate and for the same reason. */
export async function anchorSettlementReceipt<T>(
  journal: SettlementReceiptJournal,
  receipt: SettlementReceipt,
  anchorer: (receipt: SettlementReceipt) => Promise<T>,
): Promise<T> {
  assertSettlementJournalCanLeaveMemory(journal, 'anchor');
  return anchorer(receipt);
}

/**
 * The receipt's own hash — deterministic over the receipt body, keys ordered at
 * every depth. Shares ONE canonicalisation and ONE hashing scheme with the
 * venture substrate. Having a hash implies nothing was written anywhere.
 */
export function settlementReceiptHash(receipt: SettlementReceipt): string {
  return simulationRecordHash(receipt);
}

export interface SettlementReceiptArtifact {
  receipt: SettlementReceipt;
  receiptHash: string;
}

export interface SettlementJournalArtifacts {
  runId: string;
  mode: SettlementReceiptMode;
  generated: true;
  hashed: true;
  persisted: boolean;
  dvnAnchored: boolean;
  artifacts: SettlementReceiptArtifact[];
}

/**
 * The complete receipt artifacts of a run, each with its hash, plus the four
 * states spelled out. `persisted` and `dvnAnchored` are reported as FALSE rather
 * than omitted: an absent field reads as "unknown", and "unknown" is how
 * "generated" gets reported as "anchored" downstream.
 */
export function settlementJournalArtifacts(
  journal: SettlementReceiptJournal,
): SettlementJournalArtifacts {
  return {
    runId: journal.runId,
    mode: journal.mode,
    generated: true,
    hashed: true,
    persisted: false,
    dvnAnchored: false,
    artifacts: journal.receipts.map((receipt) => ({
      receipt,
      receiptHash: settlementReceiptHash(receipt),
    })),
  };
}

/**
 * Refuse to emit a receipt carrying a raw identifier. Throwing beats scrubbing:
 * a scrubbed value ships, and the call site keeps the habit.
 */
function assertNoRawIdentifiers(receipt: SettlementReceipt): void {
  const { receiptRef: _ref, at: _at, ...payload } = receipt;
  if (containsRawIdentifier(payload)) {
    throw new Error(
      `settlement receipt ${receipt.actionType} carries a raw identifier — every id on a receipt must be a commitment (services/qriptocent/settlement/refs.ts)`,
    );
  }
}

export function emitSettlementReceipt(
  journal: SettlementReceiptJournal,
  input: Omit<SettlementReceipt, 'receiptRef'>,
): SettlementReceipt {
  journal.seq += 1;
  const receipt: SettlementReceipt = {
    ...input,
    receiptRef: `${journal.runId}-rcpt-${String(journal.seq).padStart(3, '0')}`,
  };
  assertNoRawIdentifiers(receipt);
  if (receipt.valueBreakdown) {
    assertSixCategoriesDistinguished(
      receipt.valueBreakdown,
      `settlement receipt ${receipt.actionType}`,
    );
  }
  journal.receipts.push(receipt);
  return receipt;
}

/** Receipts of a given action type — used by reconciliation and the canaries. */
export function settlementReceiptsOfType(
  journal: SettlementReceiptJournal,
  actionType: SettlementReceiptActionType,
): SettlementReceipt[] {
  return journal.receipts.filter((r) => r.actionType === actionType);
}

/** Receipts attesting one settlement, in emission order. */
export function receiptsForSettlement(
  journal: SettlementReceiptJournal,
  settlementRef: string,
): SettlementReceipt[] {
  return journal.receipts.filter((r) => r.settlementRef === settlementRef);
}
