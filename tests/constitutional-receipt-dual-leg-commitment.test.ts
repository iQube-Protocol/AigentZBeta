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

  it('the SAME commitment travels on both legs — never two independently derived hashes', () => {
    // Both submitters must derive H through the one shared helper. A second
    // derivation would let the legs drift apart silently (inv.engineering.036/037).
    expect(pipelineSource).toContain('computeReceiptCommitment');
    expect(pipelineSource).toContain('commitmentHash');
    const derivations = pipelineSource.match(/computeReceiptCommitment\(/g) ?? [];
    expect(
      derivations.length,
      'Each leg derives H via the shared receiptCommitment helper; no other hashing path may appear.',
    ).toBeGreaterThanOrEqual(2);
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
