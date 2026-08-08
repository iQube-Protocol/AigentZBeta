/**
 * ONE CONSTITUTIONAL EVENT → ONE COMMITMENT → TWO INDEPENDENT LEGS
 * (operator ruling, 2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `enqueueActivityReceiptAnchor` submitted the DVN leg ONLY. No code path in
 * this repo ever passed a constitutional receipt to
 * `proof_of_state.issue_receipt`, so the Bitcoin half of the spine was absent
 * for the system's entire history while the Ops dashboard reported it green.
 *
 * Proven live 2026-08-08 by reading the canisters directly:
 *   - cross_chain_service's own candid:service exposes nine methods and NONE
 *     bridge to proof_of_state; the documented `create_proof_of_state_receipt`
 *     does not exist on the deployed canister.
 *   - 710 DVN messages drained through attestation while
 *     `PoS.get_pending_count()` stayed at 0 — no internal bridge either.
 *   - Of 624 receipts in the PoS canister's BTC-anchored batches, 461 were
 *     synthetic (`sync_*`/`test_*`/`anchor*`) and zero were activity receipts.
 *   - `dvn_recorded` was 0 across all 1,290 rows.
 *
 * The repair is NOT "add a second write". Two writes with no shared identity
 * are two unrelated facts that merely get counted together — which is the
 * defect, restated. The rule is one deterministic commitment H carried on both
 * legs, so they reconcile by identity rather than by queue arithmetic.
 *
 * Source-scan canaries follow this repo's existing convention
 * (tests/observability-does-not-provide-liveness.test.ts) — comments are
 * stripped first, because this file's subject matter means the sources now
 * carry doc comments quoting the very calls being asserted about.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { computeReceiptCommitment, type ReceiptCommitmentInput } from '@/services/receipts/receiptCommitment';
import { isRealBitcoinTxid } from '@/services/dvn/activityReceiptDvnPipeline';

const pipelineSource = stripComments(readSource('services/dvn/activityReceiptDvnPipeline.ts'));
const repairSource = stripComments(readSource('app/api/ops/sync/repair/route.ts'));

function input(overrides: Partial<ReceiptCommitmentInput> = {}): ReceiptCommitmentInput {
  return {
    receiptId: 'r-1',
    personaRef: 'a1b2c3d4e5f60718', // hashPersonaRef output shape: 16 hex chars
    activeCartridge: 'agentiq',
    actionType: 'agent_delegated',
    summary: 'Bounded delegation granted',
    agentsInvoked: ['did:agent:root:x'],
    toolsUsed: [],
    iqubesUsed: [],
    contextShared: [],
    artifactsCreated: [],
    approvalsGranted: [],
    timestamp: 1_754_000_000_000,
    ...overrides,
  };
}

describe('the canonical commitment H', () => {
  it('is deterministic — the same receipt always commits to the same value', () => {
    expect(computeReceiptCommitment(input())).toBe(computeReceiptCommitment(input()));
  });

  it('is stable under array ordering, which carries no meaning in these fields', () => {
    const a = computeReceiptCommitment(input({ agentsInvoked: ['b', 'a'], toolsUsed: ['z', 'y'] }));
    const b = computeReceiptCommitment(input({ agentsInvoked: ['a', 'b'], toolsUsed: ['y', 'z'] }));
    expect(a).toBe(b);
  });

  it('changes when the constitutional content changes — it is a commitment, not an id', () => {
    expect(computeReceiptCommitment(input({ actionType: 'agent_delegation_revoked' }))).not.toBe(
      computeReceiptCommitment(input()),
    );
    expect(computeReceiptCommitment(input({ summary: 'something else' }))).not.toBe(computeReceiptCommitment(input()));
  });

  /*
   * PARAMOUNT. H is handed to a canister and anchored to Bitcoin — it is the
   * most chain-bound value in the system. CLAUDE.md's Identity & Access Spine
   * forbids serialising `personaId` (T0) to anything network- or chain-bound.
   * A caller reaching for the raw field must fail loudly at the call site
   * rather than have it silently hashed into permanent provenance.
   */
  it('REFUSES a raw persona UUID rather than silently anchoring a T0 identifier', () => {
    expect(() => computeReceiptCommitment(input({ personaRef: '3195064c-6f16-4560-b9d8-891dadd343b7' }))).toThrow(
      /T0|raw persona/i,
    );
  });

  it('produces a hex sha256 — the shape proof_of_state.issue_receipt(text) expects', () => {
    expect(computeReceiptCommitment(input())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('both legs are written, and neither is mistaken for the other', () => {
  it('the pipeline submits the PoS leg, not the DVN leg alone', () => {
    expect(
      pipelineSource.includes('issue_receipt'),
      'activityReceiptDvnPipeline never calls proof_of_state.issue_receipt. The Bitcoin leg of the ' +
        'constitutional spine is missing — the exact defect that left 0 activity receipts in 161 ' +
        'BTC-anchored batches.',
    ).toBe(true);
    expect(pipelineSource).toContain('submitActivityReceiptToPos');
  });

  it('the dual-leg path computes H ONCE and hands the identical value to both legs', () => {
    /*
     * Stronger than "both legs derive the same H". Two derivations agreeing is
     * a coincidence the code does not enforce; passing one value to both is a
     * fact. It also closes a real hole in the first version: if the PoS leg
     * threw before deriving anything, H was never persisted at all, even
     * though the DVN leg had already carried one on-chain — leaving a message
     * committing to an H the database could not name.
     */
    expect(pipelineSource).toContain('computeReceiptCommitment');
    expect(pipelineSource).toMatch(/submitActivityReceiptToDvn\(record,\s*personaId,\s*commitmentHash\)/);
    expect(pipelineSource).toMatch(/submitActivityReceiptToPos\(record,\s*personaId,\s*commitmentHash\)/);
  });

  it('persists H BEFORE either leg runs, never from a leg result', () => {
    const enqueueStart = pipelineSource.indexOf('export function enqueueActivityReceiptAnchor');
    expect(enqueueStart).toBeGreaterThan(-1);
    const body = pipelineSource.slice(enqueueStart);
    const persistIdx = body.indexOf('commitment_hash: commitmentHash');
    const legsIdx = body.indexOf('Promise.allSettled');
    expect(persistIdx).toBeGreaterThan(-1);
    expect(
      persistIdx < legsIdx,
      'H must be persisted before either leg is attempted, so a leg that throws cannot leave the ' +
        'row unable to name the commitment its sibling already carried on-chain.',
    ).toBe(true);
    // And never sourced from a leg's own result object.
    expect(pipelineSource).not.toMatch(/commitment_hash:\s*posResult\./);
  });

  it('offers a per-leg retry entry point that does NOT consult the legacy receipt_status', () => {
    /*
     * DVN-ok + PoS-failed flips receipt_status to dvn_pending, which makes the
     * row permanently ineligible for the `=== 'local'` hot path. Without a
     * per-leg entry point the PoS leg is stranded with no route back.
     */
    expect(pipelineSource).toContain('export async function enqueueReceiptLeg');
    const legStart = pipelineSource.indexOf('export async function enqueueReceiptLeg');
    const legBody = pipelineSource.slice(legStart, pipelineSource.indexOf('export function enqueueActivityReceiptAnchor'));
    expect(
      /receiptStatus\s*!==\s*'local'/.test(legBody),
      'the per-leg entry point must not gate on the legacy DVN-only flag',
    ).toBe(false);
    // It gates on the leg's OWN durable evidence instead.
    expect(legBody).toContain('pos_receipt_id');
    expect(legBody).toContain('dvn_receipt_id');
  });

  /*
   * PROVEN AGAINST THE DEPLOYED CANISTER, 2026-08-08. `issue_receipt` derives
   * its id from the clock and never looks up an existing receipt by data_hash,
   * so calling it twice with the same H creates TWO receipts, not a no-op.
   * Any retry driver must therefore gate on our own record.
   */
  it('never claims PoS retries are idempotent — the canister does not deduplicate by data_hash', () => {
    expect(pipelineSource).not.toMatch(/idempotent/i);
  });

  it('records the PoS leg on its own column, never folded into receipt_status', () => {
    expect(pipelineSource).toContain('pos_status');
    expect(pipelineSource).toContain('pos_receipt_id');
    // receipt_status must never be set to a PoS outcome — it describes the DVN
    // leg alone, or "anchored" becomes ambiguous all over again.
    expect(pipelineSource).not.toMatch(/receipt_status:\s*['"]pos_/);
  });

  it('neither leg can block or fail the other', () => {
    expect(
      /Promise\.allSettled\(\s*\[\s*\n?\s*submitActivityReceiptToDvn/.test(pipelineSource) ||
        (pipelineSource.includes('Promise.allSettled') && pipelineSource.includes('submitActivityReceiptToPos')),
      'The two legs must be settled independently — a PoS failure must never suppress a DVN ' +
        'submission that would otherwise have succeeded, or vice versa.',
    ).toBe(true);
  });
});

describe('sync/repair must never fabricate constitutional provenance', () => {
  /*
   * The `balance` strategy issued `pos.issue_receipt('sync_repair_...')` to
   * make the drift counter agree. Those receipts are not inert: they enter the
   * genuine Merkle-batch → Bitcoin-anchor path. 263 of the 624 receipts ever
   * anchored were `sync_*` — the single largest population in the system's
   * Bitcoin provenance stream was filler written to satisfy a metric.
   */
  it('never CONSTRUCTS a synthetic sync_repair identifier to anchor', () => {
    /*
     * Tests the ACT, not the vocabulary. The route legitimately NAMES
     * `sync_repair_*` inside its refusal message, explaining the capability
     * that was removed — that string is the fix, not the defect. Fabrication
     * looks different: building an identifier by interpolation
     * (`sync_repair_${Date.now()}_${i}`) to hand to a canister. Matching the
     * bare phrase would have failed the very change that removed the
     * behaviour, which is a canary testing the wrong thing.
     */
    const fabricationPattern = /`sync_repair_\$\{|'sync_repair_'\s*\+|"sync_repair_"\s*\+/;
    expect(
      fabricationPattern.test(repairSource),
      'sync/repair still constructs `sync_repair_*` identifiers. Anchoring filler to Bitcoin to ' +
        'equalise two unrelated counters is not reconciliation.',
    ).toBe(false);
  });

  it('never submits a SYNC_REPAIR DVN message to equalise the other direction', () => {
    // The mirror-image fabrication: when PoS led DVN, the route invented
    // SYNC_REPAIR messages instead. Same defect, opposite leg.
    expect(repairSource).not.toMatch(/action:\s*['"]SYNC_REPAIR['"]/);
  });

  it('never calls pos.issue_receipt at all — reconciliation is per-commitment, not per-count', () => {
    expect(repairSource).not.toMatch(/pos\.issue_receipt\s*\(/);
  });

  it('refuses the balance strategy explicitly rather than silently ignoring it', () => {
    expect(repairSource).toContain('BALANCE_STRATEGY_REMOVED');
  });
});

/*
 * ── THE POS LEG IS NOT YET CONSTITUTIONAL EVIDENCE ─────────────────────────
 *
 * Read-only probe of the DEPLOYED canister n2hhv-aaaaa-aaaas-qccza-cai,
 * 2026-08-08 (scripts/probe-pos-btc-anchoring.ts):
 *   - all 76 anchored batches carry `mock_btc_txid_<root[..8]>`, not a txid
 *   - btc_block_height is the constant 800000 on every one
 *   - root == sha256(receipt_ids) on 20/20; == sha256(data_hashes) on 0/20
 *   - merkle_proof empty on all 186 receipts
 *
 * So Bitcoin anchoring does not exist, and even if it did the anchored root
 * would not commit to H. These canaries stop the code from ever claiming
 * otherwise.
 */
describe('the PoS leg may not claim Bitcoin evidence it does not have', () => {
  it('rejects the deployed canister\'s mock txid as Bitcoin evidence', () => {
    expect(isRealBitcoinTxid('mock_btc_txid_b0a5b693')).toBe(false);
    expect(isRealBitcoinTxid('btc_anchor_b0a5b693')).toBe(false);
    expect(isRealBitcoinTxid(null)).toBe(false);
    expect(isRealBitcoinTxid(undefined)).toBe(false);
  });

  it('accepts only a well-formed 64-hex Bitcoin txid', () => {
    expect(isRealBitcoinTxid('a'.repeat(64))).toBe(true);
    expect(isRealBitcoinTxid('A'.repeat(64))).toBe(false); // uppercase is not the canonical form
    expect(isRealBitcoinTxid('a'.repeat(63))).toBe(false);
    expect(isRealBitcoinTxid('a'.repeat(65))).toBe(false);
  });

  it('no code path writes pos_status anchored — nothing on chain justifies it today', () => {
    expect(
      /pos_status:\s*'anchored'/.test(pipelineSource),
      'A receipt may not be marked Bitcoin-anchored while the canister emits synthesised txids and ' +
        'the batch root does not commit to H. That is the false green this investigation removed.',
    ).toBe(false);
  });
});
