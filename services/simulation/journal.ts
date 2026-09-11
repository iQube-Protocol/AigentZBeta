/**
 * The simulation-journal primitives — ONE definition, two substrates.
 *
 * The VL-CT-001 venture substrate (`services/venture/trading/`) and the
 * QriptoCENT cross-denomination settlement substrate
 * (`services/qriptocent/settlement/`) are both deterministic, replayable
 * simulations that generate DVN-shaped receipt objects and must NEVER let those
 * objects reach the operational `activity_receipts` trail. Three mechanisms are
 * common to both, and all three are the kind that fail silently if forked:
 *
 *   1. **Canonical JSON** — key-ordered at every depth, so two structurally
 *      identical records hash identically regardless of construction order. Two
 *      copies of this that drift by one `undefined`-filtering rule produce two
 *      different hashes for the same record, and the divergence is invisible
 *      until someone compares a replay against an anchor.
 *   2. **The record hash** — sha256 over the canonical form. A second hashing
 *      scheme is exactly what `inv.engineering.036/037` prohibits.
 *   3. **The fixture-mode egress guard** — a THROW, not a boolean, on any
 *      attempt to persist or anchor a fixture journal. A forked guard is a
 *      guard that one of the two substrates eventually loses.
 *
 * This module was extracted from `services/venture/trading/receipts.ts` when
 * the settlement substrate needed the same three mechanisms; venture delegates
 * here and keeps its own `VentureFixtureModeViolation` subclass so its existing
 * `instanceof` contract is unchanged. That is a MOVE, not a copy — there is no
 * second implementation of any of the three.
 *
 * Deterministic by construction: no clock, no randomness, no I/O.
 */

import { createHash } from 'crypto';

/**
 * `fixture` — a deterministic replay. Objects and hashes only; persistence and
 * anchoring are REFUSED at runtime, not merely avoided by discipline.
 * `live`    — a real operator action, gated separately by each substrate.
 */
export type SimulationMode = 'fixture' | 'live';

/** The two ways a receipt object can leave memory. */
export type JournalEgress = 'persist' | 'anchor';

/** The minimum a journal must expose for the guard to rule on it. */
export interface SimulationJournalIdentity {
  runId: string;
  mode: SimulationMode;
}

/**
 * Thrown when something tries to move a FIXTURE journal out of memory. A
 * distinct class so a caller can tell "the substrate refused on principle" from
 * "the database was unreachable" — the two need opposite responses.
 */
export class FixtureModeViolation extends Error {
  readonly runId: string;
  readonly operation: JournalEgress;
  constructor(runId: string, operation: JournalEgress, detail: string) {
    super(detail);
    this.name = 'FixtureModeViolation';
    this.runId = runId;
    this.operation = operation;
  }
}

/** The default message, used when a substrate supplies no subclass. */
function defaultViolation(runId: string, operation: JournalEgress): FixtureModeViolation {
  return new FixtureModeViolation(
    runId,
    operation,
    `simulation journal ${runId} is in FIXTURE mode and must not be ${operation === 'persist' ? 'persisted' : 'DVN-anchored'}. ` +
      'These are deterministic replays; writing them to activity_receipts would put simulation artifacts in the operational provenance trail.',
  );
}

/**
 * ── THE HARD GUARD ──
 *
 * Every path that would move a receipt out of memory calls this FIRST. It
 * throws; it does not warn, log, no-op, or return false. A guard that returns a
 * boolean is a guard a caller can ignore, and the whole point is that a future
 * refactor cannot quietly wire a replay path to the live writer.
 *
 * `violation` lets a substrate throw its own subclass without reimplementing
 * the decision — the decision itself lives here, once.
 */
export function assertJournalCanLeaveMemory(
  journal: SimulationJournalIdentity,
  operation: JournalEgress,
  violation: (runId: string, operation: JournalEgress) => FixtureModeViolation = defaultViolation,
): void {
  if (journal.mode === 'fixture') {
    throw violation(journal.runId, operation);
  }
}

/** Stable JSON: object keys sorted at every depth, arrays left in order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * A record's own hash — deterministic over its canonical form. This is the
 * "hash computed" state: it exists, and it is NOT an anchor. Nothing about
 * having a hash implies anything was written anywhere.
 */
export function simulationRecordHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
