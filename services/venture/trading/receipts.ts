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
 * ─── FIXTURE MODE — four states, and only two of them hold (RULING 2) ───────
 *
 * The 24 deterministic replays MUST NEVER write to the production
 * `activity_receipts` trail. These are four DISTINCT states and conflating any
 * two of them IS the defect — a report that says "the receipts exist" when it
 * means "receipt objects were generated" claims provenance that does not exist:
 *
 *     receipt object generated   — YES
 *     receipt hash computed      — YES (`ventureReceiptHash`, over the receipt
 *                                  body; the cost stream has its own batch
 *                                  commitment)
 *     receipt persisted          — NO
 *     receipt DVN-anchored       — NO
 *
 * The last two are held by a RUNTIME GUARD, not by a convention. A journal
 * carries its `mode`, every persistence and anchoring path funnels through
 * `assertVentureJournalCanLeaveMemory`, and that function THROWS on a fixture
 * journal. A future refactor that wires the live writer into the replay path
 * therefore fails loudly at the first receipt instead of silently contaminating
 * the operational trail — which is the failure that would be discovered months
 * later, in an audit, as unexplained fixture rows.
 *
 * The receipt artifacts and their hashes are PRESERVED — `ventureJournalArtifacts`
 * returns the complete set, so "not persisted" costs nothing evidentially. The
 * journal entries are also ANCHOR-ELIGIBLE by construction (every action type
 * used here is in the pipeline's anchorable set), so the same emitter serves
 * the live path when Phase 2 turns it on with `mode: 'live'`.
 *
 * T0/T2: every payload field is a commitment. `assertNoRawIdentifiers` fails
 * loudly rather than sanitising, so a leak is a build failure and not a quietly
 * scrubbed value.
 */

import { createHash } from 'crypto';
import type { PartnerServiceCompensationExtension } from './compensationExtension';
import {
  assertVentureReceiptConstraintCompatible,
  type VentureConstraintLoader,
} from './receiptCompatibility';
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

/**
 * `fixture` — a deterministic replay. Objects and hashes only; persistence and
 * anchoring are REFUSED at runtime, not merely avoided by discipline.
 * `live`    — a real operator action. Phase 2 only, and it must additionally
 * pass the deployment compatibility check before any write.
 */
export type VentureReceiptMode = 'fixture' | 'live';

export interface VentureReceiptJournal {
  runId: string;
  experimentalCellId: string;
  /** Which trail this journal is allowed to reach. Defaults to `fixture`. */
  mode: VentureReceiptMode;
  receipts: VentureReceipt[];
  checkpoints: CostCheckpoint[];
  seq: number;
}

export function createReceiptJournal(
  runId: string,
  experimentalCellId: string,
  mode: VentureReceiptMode = 'fixture',
): VentureReceiptJournal {
  return { runId, experimentalCellId, mode, receipts: [], checkpoints: [], seq: 0 };
}

/**
 * Thrown when something tries to move a FIXTURE journal out of memory. A
 * distinct class so a caller can tell "the substrate refused on principle" from
 * "the database was unreachable" — the two need opposite responses.
 */
export class VentureFixtureModeViolation extends Error {
  readonly runId: string;
  readonly operation: 'persist' | 'anchor';
  constructor(runId: string, operation: 'persist' | 'anchor') {
    super(
      `venture journal ${runId} is in FIXTURE mode and must not be ${operation === 'persist' ? 'persisted' : 'DVN-anchored'}. ` +
        'These are deterministic replays of the same fixtures; writing them to activity_receipts would put simulation ' +
        'artifacts in the operational provenance trail. Receipt objects and hashes are available via ventureJournalArtifacts().',
    );
    this.name = 'VentureFixtureModeViolation';
    this.runId = runId;
    this.operation = operation;
  }
}

/**
 * ── THE HARD GUARD ──
 *
 * Every path that would move a receipt out of memory calls this FIRST. It
 * throws; it does not warn, log, no-op, or return false. A guard that returns
 * a boolean is a guard a caller can ignore, and the whole point of Ruling 2 is
 * that a future refactor cannot quietly wire the replay path to the live
 * writer.
 */
export function assertVentureJournalCanLeaveMemory(
  journal: VentureReceiptJournal,
  operation: 'persist' | 'anchor',
): void {
  if (journal.mode === 'fixture') {
    throw new VentureFixtureModeViolation(journal.runId, operation);
  }
}

/**
 * Persist a venture receipt through a caller-supplied writer. The writer is
 * NEVER invoked for a fixture journal — the guard throws before it is reached,
 * and the canary asserts the writer was not called, not merely that a throw
 * occurred (a guard placed after the write would still throw).
 */
export async function persistVentureReceipt<T>(
  journal: VentureReceiptJournal,
  receipt: VentureReceipt,
  writer: (receipt: VentureReceipt) => Promise<T>,
  opts: VentureEmissionOptions = {},
): Promise<T> {
  assertVentureJournalCanLeaveMemory(journal, 'persist');
  // RULING 5 — verify the deployed action-type vocabulary BEFORE the write.
  // Discovering it from the insert failure is too quiet for this pipeline.
  await assertVentureReceiptConstraintCompatible(opts.loadConstraintDefinition);
  return writer(receipt);
}

/** DVN anchoring, under the same two gates and for the same reasons. */
export async function anchorVentureReceipt<T>(
  journal: VentureReceiptJournal,
  receipt: VentureReceipt,
  anchorer: (receipt: VentureReceipt) => Promise<T>,
  opts: VentureEmissionOptions = {},
): Promise<T> {
  assertVentureJournalCanLeaveMemory(journal, 'anchor');
  await assertVentureReceiptConstraintCompatible(opts.loadConstraintDefinition);
  return anchorer(receipt);
}

export interface VentureEmissionOptions {
  /** Injectable probe, so the compatibility gate is testable without a database. */
  loadConstraintDefinition?: VentureConstraintLoader;
}

/**
 * The receipt's own hash — deterministic over the receipt body, with keys
 * ordered so two structurally identical receipts hash identically regardless of
 * construction order. This is the "receipt hash computed" state: it exists, and
 * it is NOT an anchor. Nothing about having a hash implies anything was written
 * anywhere.
 */
export function ventureReceiptHash(receipt: VentureReceipt): string {
  return createHash('sha256').update(canonicalise(receipt)).digest('hex');
}

/** Stable JSON: object keys sorted at every depth, arrays left in order. */
function canonicalise(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * The complete receipt artifacts of a run, each with its hash, plus the four
 * states spelled out. This is what a fixture run PRESERVES in place of a
 * database row — so refusing to persist costs no evidence, and any report
 * reading this cannot accidentally claim the receipts were anchored.
 */
export interface VentureReceiptArtifact {
  receipt: VentureReceipt;
  receiptHash: string;
}

export interface VentureJournalArtifacts {
  runId: string;
  experimentalCellId: string;
  mode: VentureReceiptMode;
  generated: true;
  hashed: true;
  persisted: boolean;
  dvnAnchored: boolean;
  artifacts: VentureReceiptArtifact[];
  checkpoints: CostCheckpoint[];
}

export function ventureJournalArtifacts(journal: VentureReceiptJournal): VentureJournalArtifacts {
  return {
    runId: journal.runId,
    experimentalCellId: journal.experimentalCellId,
    mode: journal.mode,
    generated: true,
    hashed: true,
    // Phase 1 writes nothing. These are reported as FALSE rather than omitted:
    // an absent field reads as "unknown", and "unknown" is how "generated" gets
    // reported as "anchored" downstream.
    persisted: false,
    dvnAnchored: false,
    artifacts: journal.receipts.map((receipt) => ({ receipt, receiptHash: ventureReceiptHash(receipt) })),
    checkpoints: [...journal.checkpoints],
  };
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
