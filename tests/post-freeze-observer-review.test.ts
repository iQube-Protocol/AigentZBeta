/**
 * Post-Freeze Observer Review Closure (2026-08-09) — canaries for
 * services/research/crystalObserverReview.ts and the authority boundary the
 * whole capability depends on (SPEC point 12: reviewers inspect, comment,
 * propose and submit decisions; they cannot freeze, mutate the corpus,
 * canonize or publish).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from './_lib/sourceAuthority';
import {
  buildObserverReviewPackage,
  validateObserverDecision,
  resolveObserverRound,
  createChangeProposal,
  resolveChangeProposal,
  pinnedObserverRoundPolicy,
  type ObserverDecision,
} from '@/services/research/crystalObserverReview';

const REPO = process.cwd();
const readSource = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

const FROZEN_ARTIFACT = {
  id: 'EXP-TEST/crystal-vTest',
  kind: 'crystal-version' as const,
  lifecycle: 'frozen',
  contentHash: 'a'.repeat(64),
  commitmentHash: 'a'.repeat(64),
  frozenAt: '2026-08-09T00:00:00.000Z',
  signedBy: ['operator-ref'],
};

describe('buildObserverReviewPackage — hash-bound to an ALREADY FROZEN artifact only', () => {
  it('refuses a non-frozen artifact', () => {
    expect(() =>
      buildObserverReviewPackage({
        packageId: 'p1',
        experimentId: 'EXP-TEST',
        artifact: { ...FROZEN_ARTIFACT, lifecycle: 'validated' },
        roundPolicy: 'all-assigned',
        assignedObserverRefs: ['obs-1'],
        createdAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/not 'frozen'/);
  });

  it('refuses a frozen artifact missing a hash', () => {
    expect(() =>
      buildObserverReviewPackage({
        packageId: 'p1',
        experimentId: 'EXP-TEST',
        artifact: { ...FROZEN_ARTIFACT, contentHash: null },
        roundPolicy: 'all-assigned',
        assignedObserverRefs: ['obs-1'],
        createdAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/missing contentHash/);
  });

  it('refuses zero assigned observers', () => {
    expect(() =>
      buildObserverReviewPackage({
        packageId: 'p1',
        experimentId: 'EXP-TEST',
        artifact: FROZEN_ARTIFACT,
        roundPolicy: 'all-assigned',
        assignedObserverRefs: [],
        createdAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/at least one assigned observer/);
  });

  it('is deterministic — the same inputs always produce the same packageHash (no clock read inside)', () => {
    const build = () =>
      buildObserverReviewPackage({
        packageId: 'p1',
        experimentId: 'EXP-TEST',
        artifact: FROZEN_ARTIFACT,
        roundPolicy: 'all-assigned',
        assignedObserverRefs: ['obs-1', 'obs-2'],
        createdAt: '2026-08-09T00:00:00.000Z',
      });
    expect(build().packageHash).toBe(build().packageHash);
  });
});

describe('N assigned observer principals — independent decisions against ONE package hash (SPEC point 5)', () => {
  const pkg = buildObserverReviewPackage({
    packageId: 'p1',
    experimentId: 'EXP-TEST',
    artifact: FROZEN_ARTIFACT,
    roundPolicy: 'all-assigned',
    assignedObserverRefs: ['obs-1', 'obs-2'],
    createdAt: '2026-08-09T00:00:00.000Z',
  });

  it('refuses a decision from an observer the package did not assign', () => {
    expect(() =>
      validateObserverDecision({
        pkg,
        observerRef: 'obs-uninvited',
        decision: 'accepted',
        rationale: 'looks fine',
        decidedAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/not an assigned observer/);
  });

  it("refuses 'changes_requested' with no proposed change", () => {
    expect(() =>
      validateObserverDecision({
        pkg,
        observerRef: 'obs-1',
        decision: 'changes_requested',
        rationale: 'something is off',
        decidedAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/no proposed change/);
  });
});

describe("resolveObserverRound — the explicit 'all-assigned' policy (SPEC point 6)", () => {
  const pkg = buildObserverReviewPackage({
    packageId: 'p1',
    experimentId: 'EXP-TEST',
    artifact: FROZEN_ARTIFACT,
    roundPolicy: 'all-assigned',
    assignedObserverRefs: ['obs-1', 'obs-2'],
    createdAt: '2026-08-09T00:00:00.000Z',
  });
  const decisionOf = (observerRef: string, decision: ObserverDecision['decision']): ObserverDecision => ({
    packageHash: pkg.packageHash,
    observerRef,
    decision,
    rationale: 'reasoned',
    evidenceRefs: [],
    submittedByAgentRef: null,
    decidedAt: '2026-08-09T00:00:00.000Z',
  });

  it('is pending when only ONE of two assigned observers has decided', () => {
    const r = resolveObserverRound({ pkg, decisions: [decisionOf('obs-1', 'accepted')] });
    expect(r.acceptance).toBe('pending');
    expect(r.outstandingObserverRefs).toEqual(['obs-2']);
  });

  it('is accepted only once BOTH assigned observers accept', () => {
    const r = resolveObserverRound({
      pkg,
      decisions: [decisionOf('obs-1', 'accepted'), decisionOf('obs-2', 'accepted')],
    });
    expect(r.acceptance).toBe('accepted');
  });

  it("a single 'changes_requested' blocks the round regardless of the other observer's acceptance", () => {
    const r = resolveObserverRound({
      pkg,
      decisions: [decisionOf('obs-1', 'accepted'), decisionOf('obs-2', 'changes_requested')],
    });
    expect(r.acceptance).toBe('changes_requested');
  });

  it("does not extend R1/R2 to obtain multiplicity — a third+ decision is simply another entry in the SAME decisions array, never a new reviewer slot", () => {
    const pkg3 = buildObserverReviewPackage({
      packageId: 'p3',
      experimentId: 'EXP-TEST',
      artifact: FROZEN_ARTIFACT,
      roundPolicy: 'all-assigned',
      assignedObserverRefs: ['obs-1', 'obs-2', 'obs-3'],
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    expect(pkg3.assignedObserverRefs).toHaveLength(3);
    const r = resolveObserverRound({
      pkg: pkg3,
      decisions: [
        { ...decisionOf('obs-1', 'accepted'), packageHash: pkg3.packageHash },
        { ...decisionOf('obs-2', 'accepted'), packageHash: pkg3.packageHash },
        { ...decisionOf('obs-3', 'accepted'), packageHash: pkg3.packageHash },
      ],
    });
    expect(r.acceptance).toBe('accepted');
    expect(r.assignedCount).toBe(3);
  });
});

describe('changes_requested → a Change Proposal, never a mutation of the frozen artifact (SPEC point 8)', () => {
  const pkg = buildObserverReviewPackage({
    packageId: 'p1',
    experimentId: 'EXP-TEST',
    artifact: FROZEN_ARTIFACT,
    roundPolicy: 'all-assigned',
    assignedObserverRefs: ['obs-1'],
    createdAt: '2026-08-09T00:00:00.000Z',
  });
  const changeDecision: ObserverDecision = {
    packageHash: pkg.packageHash,
    observerRef: 'obs-1',
    decision: 'changes_requested',
    rationale: 'the boundary statement is ambiguous',
    evidenceRefs: [],
    submittedByAgentRef: null,
    decidedAt: '2026-08-09T00:00:00.000Z',
  };

  it('refuses to build a proposal from a non-changes_requested decision', () => {
    expect(() =>
      createChangeProposal({
        proposalId: 'cp1',
        decision: { ...changeDecision, decision: 'accepted' },
        proposedChange: 'x',
        createdAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/only be built from/);
  });

  it('accepting a proposal requires an already-provisioned superseding artifact id, and refuses if it equals the package hash', () => {
    const proposal = createChangeProposal({
      proposalId: 'cp1',
      decision: changeDecision,
      proposedChange: 'clarify the boundary statement',
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    expect(proposal.supersedingArtifactId).toBeNull();
    expect(() =>
      resolveChangeProposal(proposal, {
        outcome: 'accept',
        supersedingArtifactId: proposal.packageHash,
        resolvedByRef: 'steward-ref',
        resolvedAt: '2026-08-09T01:00:00.000Z',
        reason: 'accepted',
      }),
    ).toThrow();
    const resolved = resolveChangeProposal(proposal, {
      outcome: 'accept',
      supersedingArtifactId: 'EXP-TEST/crystal-vTest.v2',
      resolvedByRef: 'steward-ref',
      resolvedAt: '2026-08-09T01:00:00.000Z',
      reason: 'accepted — boundary clarified',
    });
    expect(resolved.status).toBe('accepted');
    expect(resolved.supersedingArtifactId).toBe('EXP-TEST/crystal-vTest.v2');
  });

  it('declining leaves no superseding artifact', () => {
    const proposal = createChangeProposal({
      proposalId: 'cp2',
      decision: changeDecision,
      proposedChange: 'clarify the boundary statement',
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    const resolved = resolveChangeProposal(proposal, {
      outcome: 'decline',
      resolvedByRef: 'steward-ref',
      resolvedAt: '2026-08-09T01:00:00.000Z',
      reason: 'the frozen crystal already addresses this',
    });
    expect(resolved.status).toBe('declined');
    expect(resolved.supersedingArtifactId).toBeNull();
  });
});

describe('authority boundary — reviewers may propose, they may not act (SPEC point 12)', () => {
  it('crystalObserverReview.ts never imports freezeArtifact — it cannot freeze anything', () => {
    const src = readSource('services/research/crystalObserverReview.ts');
    expect(src).not.toMatch(/freezeArtifact/);
  });

  it('the self-service decision route never imports freezeArtifact, upsertArtifact, or any canonize/publish path', () => {
    const src = readSource('app/api/research/observer-review/[experimentId]/decision/route.ts');
    expect(src).not.toMatch(/freezeArtifact|upsertArtifact|canonize|publishResult/);
  });

  it('assigning a round and accepting a change proposal require a steward/PI/admin grant — never the bare reviewer role', () => {
    const assignSrc = readSource('app/api/research/observer-review/[experimentId]/route.ts');
    expect(assignSrc).toMatch(/STEWARD_ROLES/);
    expect(assignSrc).toMatch(/research-steward/);
    const proposalSrc = readSource('app/api/research/observer-review/[experimentId]/change-proposal/route.ts');
    expect(proposalSrc).toMatch(/STEWARD_ROLES/);
  });

  it('accepting a change proposal provisions the superseding artifact at draft only — never frozen directly', () => {
    const src = readSource('app/api/research/observer-review/[experimentId]/change-proposal/route.ts');
    expect(src).toMatch(/lifecycle:\s*'draft'/);
    expect(src).not.toMatch(/lifecycle:\s*'frozen'/);
  });
});

describe('EXP-P1 round policy is PINNED, not merely defaulted (verification, 2026-08-09)', () => {
  it('pinnedObserverRoundPolicy declares EXP-P1 as all-assigned', () => {
    expect(pinnedObserverRoundPolicy('EXP-P1')).toBe('all-assigned');
  });

  it('an unpinned experiment has no declared policy — the caller default still governs there', () => {
    expect(pinnedObserverRoundPolicy('EXP-P2')).toBeNull();
  });

  it('the assign route refuses a caller-supplied roundPolicy that disagrees with a pin, rather than silently honouring or overriding it', () => {
    const src = readSource('app/api/research/observer-review/[experimentId]/route.ts');
    expect(src).toMatch(/pinnedObserverRoundPolicy/);
    expect(src).toMatch(/pinned && typeof body\.roundPolicy === 'string' && body\.roundPolicy !== pinned/);
  });
});

describe('changes_requested and the frozen-state wire vocabulary (verification, 2026-08-09)', () => {
  it('the crystal route derives crystalStatus from the persisted artifact rather than a hardcoded literal', () => {
    const src = readSource('app/api/research/crystal/[experimentId]/route.ts');
    expect(src).not.toMatch(/crystalStatus:\s*'candidate',/);
    expect(src).toMatch(/crystalStatus:\s*crystalArtifact\?\.lifecycle === 'frozen'/);
  });

  it('the crystal route overrides reviewStage once frozen — never the stale pre-freeze INDEPENDENT_REVIEW_OPEN object', () => {
    const src = readSource('app/api/research/crystal/[experimentId]/route.ts');
    expect(src).toMatch(/crystalArtifact\?\.lifecycle === 'frozen'\s*\n\s*\?\s*\{\s*\n\s*state: 'FROZEN'/);
  });

  it("IndependentReviewPanel never renders a bare READY_FOR_FREEZE badge once frozen", () => {
    const src = readSource('components/composer/IndependentReviewPanel.tsx');
    expect(src).toMatch(/isFrozen\s*\?\s*`FROZEN \(was: \$\{recommendation\.verdict\}\)`/);
  });

  it('accepting a change proposal receipts the acceptance and the candidate constitution as two DISTINCT acts', () => {
    const src = readSource('app/api/research/observer-review/[experimentId]/change-proposal/route.ts');
    const receiptCalls = src.match(/await writeLifecycleReceipt\(/g) ?? [];
    // decline (1) + accept's two acts (2) = 3 call sites in the file.
    expect(receiptCalls.length).toBe(3);
    expect(src).toMatch(/Change Proposal '\$\{proposalId\}' accepted by \$\{stewardRef\}/);
    expect(src).toMatch(/superseding candidate artifact '\$\{supersedingArtifactId\}' constituted at draft/);
  });

  it('a change-proposal resolution is attributed to the real caller, never a generic per-experiment placeholder', () => {
    // stripComments — the fix's own explanatory comment names the OLD
    // placeholder pattern in prose; scoping to executable source only is
    // what this file's other structural checks already do.
    const src = stripComments(readSource('app/api/research/observer-review/[experimentId]/change-proposal/route.ts'));
    expect(src).not.toMatch(/steward:\$\{experimentId\}/);
    expect(src).toMatch(/personaPublicRef\(persona\.personaId\)/);
  });
});
