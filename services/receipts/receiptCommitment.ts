/**
 * THE CANONICAL CONSTITUTIONAL COMMITMENT — one event, one H, two legs
 * (operator ruling, 2026-08-08).
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The constitutional receipt spine was built to write BOTH legs of every
 * anchorable act:
 *
 *     activity_receipt ──► H ──┬──► proof_of_state.issue_receipt(H)
 *                              │        └─► Merkle batch ─► Bitcoin anchor
 *                              └──► DVN message carrying H
 *                                       └─► attest / quorum ─► LayerZero
 *
 * It had drifted to writing only the DVN leg. `enqueueActivityReceiptAnchor`
 * called `dvn.submit_dvn_message` and nothing else; no code path anywhere in
 * this repo passed a constitutional receipt to `pos.issue_receipt`. Proven
 * live 2026-08-08: of 624 receipts in the PoS canister's Bitcoin-anchored
 * batches, 461 were `sync_*`/`test_*`/`anchor*` synthetic entries and NOT ONE
 * was an activity receipt. The Bitcoin card stayed green because it was
 * anchoring a different population, not because constitutional acts were
 * reaching it.
 *
 * Meanwhile the Ops dashboard defined `drift = |PoS_pending − DVN_pending|`,
 * which only means something if both canisters hold representations of the
 * SAME acts — and `sync/repair`'s `balance` strategy "fixed" that number by
 * issuing `sync_repair_*` receipts into the real Bitcoin stream.
 *
 * ── THE RULE THIS ENCODES ──────────────────────────────────────────────────
 *
 *   One constitutional event → one deterministic commitment → two
 *   independently tracked representations.
 *
 * Two writes without a shared commitment would be two unrelated facts that
 * happen to be counted together — exactly the defect being repaired. The
 * SAME H must be the `data_hash` given to PoS, must travel inside the DVN
 * payload, and must be persisted on the row, so the legs reconcile BY
 * IDENTITY rather than by queue arithmetic.
 *
 * ── PRIVACY (PARAMOUNT) ────────────────────────────────────────────────────
 *
 * H is computed over T2-safe fields ONLY. `personaId` is a T0 identifier that
 * CLAUDE.md forbids serialising anywhere network- or chain-bound; H is
 * literally handed to a canister and anchored to Bitcoin, so it is the most
 * chain-bound value in the system. The commitment therefore consumes the
 * already-hashed `personaRef` (`hashPersonaRef`'s output, the same T2 form the
 * DVN payload has always carried) and NEVER the raw persona id. Passing a raw
 * personaId here is refused, not silently hashed — a caller that reaches for
 * the wrong field must find out at the call site.
 */

import { commit } from '@/services/research/review/deterministic';
import type { ActivityReceiptRecord } from '@/services/receipts/activityReceiptService';

/**
 * The immutable, T2-safe projection of a receipt that H commits to.
 *
 * Deliberately NOT the whole record: `receiptStatus`, `dvnReceiptId` and the
 * per-leg anchoring columns all change as the legs progress, and a commitment
 * that moved when its own anchoring state moved could never be recomputed and
 * checked. Only fields fixed at the moment the constitutional act happened
 * appear here.
 */
export interface ReceiptCommitmentInput {
  receiptId: string;
  /** T2 form ONLY — `hashPersonaRef(personaId)`, never the raw persona id. */
  personaRef: string;
  activeCartridge: string;
  actionType: string;
  summary: string | null;
  agentsInvoked: string[];
  toolsUsed: string[];
  iqubesUsed: string[];
  contextShared: string[];
  artifactsCreated: string[];
  approvalsGranted: string[];
  /** Epoch millis of the act itself — parsed once, never "now". */
  timestamp: number;
}

/** A raw persona UUID must never reach the commitment. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Version tag baked into the committed structure. If the committed field set
 * ever changes, this changes with it, so an old H and a new H are visibly
 * different commitments rather than silently incomparable ones.
 */
export const RECEIPT_COMMITMENT_VERSION = 'aigentme.receipt.v1';

/**
 * Derives the canonical commitment H for one constitutional receipt.
 *
 * Deterministic: same receipt ⇒ same H, forever, regardless of key order
 * (`canonicalJson` sorts at every depth) or of how many times it is called.
 * That is what makes the PoS leg and the DVN leg reconcilable, and what lets
 * a stalled receipt be re-submitted idempotently rather than duplicated.
 */
export function computeReceiptCommitment(input: ReceiptCommitmentInput): string {
  if (UUID_RE.test(input.personaRef)) {
    throw new Error(
      'computeReceiptCommitment: personaRef looks like a raw persona UUID (T0). ' +
        'Pass hashPersonaRef(personaId) — the commitment is anchored to Bitcoin and ' +
        'must never carry a T0 identifier.',
    );
  }
  return commit({
    v: RECEIPT_COMMITMENT_VERSION,
    receiptId: input.receiptId,
    personaRef: input.personaRef,
    activeCartridge: input.activeCartridge,
    actionType: input.actionType,
    summary: input.summary,
    // Sorted so that two receipts differing only in the ORDER a caller happened
    // to collect these arrays commit identically. Order carries no meaning in
    // any of them; treating it as significant would make H unstable for no gain.
    agentsInvoked: [...input.agentsInvoked].sort(),
    toolsUsed: [...input.toolsUsed].sort(),
    iqubesUsed: [...input.iqubesUsed].sort(),
    contextShared: [...input.contextShared].sort(),
    artifactsCreated: [...input.artifactsCreated].sort(),
    approvalsGranted: [...input.approvalsGranted].sort(),
    timestamp: input.timestamp,
  });
}

/**
 * The commitment input for a stored record. One place builds this projection,
 * so the DVN payload, the PoS `data_hash` and any later re-derivation cannot
 * drift apart by each assembling their own idea of the receipt
 * (inv.engineering.036/037).
 */
export function receiptCommitmentInput(
  record: ActivityReceiptRecord,
  personaRef: string,
): ReceiptCommitmentInput {
  return {
    receiptId: record.id,
    personaRef,
    activeCartridge: record.activeCartridge,
    actionType: record.actionType,
    summary: record.summary ?? null,
    agentsInvoked: record.agentsInvoked ?? [],
    toolsUsed: record.toolsUsed ?? [],
    iqubesUsed: record.iqubesUsed ?? [],
    contextShared: record.contextShared ?? [],
    artifactsCreated: record.artifactsCreated ?? [],
    approvalsGranted: record.approvalsGranted ?? [],
    timestamp: Date.parse(record.createdAt) || 0,
  };
}
