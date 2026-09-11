/**
 * IRL-REVIEW-001 — checkpoint persistence + resume canaries (2026-07-30
 * resilience amendment).
 *
 * Confirmed live-run defect: the vP1 batch-011 run lost R1's full decision
 * set and 11 accepted R2 batches on an HTTP 429, because nothing was
 * persisted until the whole run finished. That run is recorded as
 * permanently `REFUSED — NON-RECOVERABLE EXECUTION`. This file canaries the
 * fix: `onBatchAccepted` fires per accepted batch (`batching.ts`),
 * checkpoint identity/verification is pure and IO-free (`checkpoint.ts`),
 * and a resumed run reusing checkpointed decisions produces a
 * byte-identical final result to an uninterrupted run.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildBatchPlan,
  runBatchedAdjudication,
  buildReviewPackage,
  buildReviewRequest,
  commit,
  createScriptedProvider,
  DEFAULT_DETERMINISM,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  ReviewRefusal,
  runDualReview,
  buildRunIdentity,
  buildBatchCheckpoint,
  verifyCheckpointCompatible,
  assertValidTransition,
  transitionRunManifest,
  CHECKPOINT_SCHEMA_VERSION,
  type BatchAttemptRecord,
  type BatchCheckpoint,
  type ReviewDecision,
  type ReviewerAssignment,
  type ReviewSubjectRecord,
  type RunManifestRecord,
  type RunState,
} from '@/services/research/review';
import { EXP_P1_NON_TARGETS, EXP_P1_TARGET_STATEMENT } from '@/services/research/review/templates/expP1Admissibility';
import { createFileReviewCheckpointStore } from '@/scripts/_lib/reviewCheckpointStore';

// ── Fixtures (mirrors independent-review-batching.test.ts) ────────────────

function subject(ref: string, namespace = 'constitutional'): ReviewSubjectRecord {
  return {
    subjectRef: ref,
    statement: `A constitutional statement about ${ref}.`,
    namespace,
    sourceProvenance: 'platform-doctrine',
    sourceRefs: ['docs/source-a.md'],
    derivationRefs: ['ratified 2026-05-01'],
    createdAt: '2026-05-01T00:00:00.000Z',
    revisedAt: null,
    lifecycleStatus: 'canonical',
  };
}
function manySubjects(n: number): ReviewSubjectRecord[] {
  return Array.from({ length: n }, (_, i) => subject(`inv.constitutional.${String(i).padStart(3, '0')}`));
}
function sealPackage(subjects: ReviewSubjectRecord[]) {
  return buildReviewPackage({
    packageId: 'pkg.checkpoint',
    reviewId: 'review.checkpoint',
    assetRef: 'asset.checkpoint',
    assetCommitment: commit({ a: 1 }),
    targetDefinition: EXP_P1_TARGET_STATEMENT,
    nonTargets: EXP_P1_NON_TARGETS,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    sourceRefs: ['spec.md'],
    chronology: ['the corpus predates the apparatus'],
    evidenceSummaries: [],
    subjects,
    blockDecisions: [],
    exclusionsFromPackage: [],
    createdAt: '2026-07-29T00:00:00.000Z',
  });
}
function subjectRefsInPrompt(user: string): string[] {
  return [...user.matchAll(/^subjectRef: (.+)$/gm)].map((m) => m[1]);
}
function decisionRow(subjectRef: string, decision = 'independent') {
  return { subjectRef, decision, reason: 'predates the apparatus and names no target system', evidenceRefs: [], limitations: [] };
}
const MODEL_A: ReviewerAssignment = {
  reviewerSlot: 'R1', reviewerType: 'external-model', provider: 'venice',
  requestedModelId: 'model-a', resolvedModelId: 'model-a-2026', modelFamily: 'alpha',
  promptVersion: '1.0.0', rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
};
const MODEL_B: ReviewerAssignment = { ...MODEL_A, reviewerSlot: 'R2', requestedModelId: 'model-b', resolvedModelId: 'model-b-2026', modelFamily: 'beta' };

/** A full accepted BatchAttemptRecord — `buildBatchCheckpoint`'s `attempt` param needs the whole record, not just the number. */
function okAttempt(batchId: string, batchHash: string, attempt: number, outputHash = 'h'): BatchAttemptRecord {
  return { reviewerSlot: 'R1', batchId, batchHash, attempt, rawOutputRef: `raw/${batchId}`, raw: '{}', outputHash, accepted: true };
}

function batchAttemptFromCheckpoint(cp: BatchCheckpoint): BatchAttemptRecord {
  return {
    reviewerSlot: cp.reviewerSlot, batchId: cp.batchId, batchHash: cp.batchHash, attempt: cp.attemptCount,
    rawOutputRef: `checkpoint:${cp.reviewerSlot}/${cp.batchId}`, raw: '', outputHash: cp.rawResponseHash,
    accepted: true, decisions: cp.decisions,
  };
}

const RUN_IDENTITY = buildRunIdentity({ packageId: 'pkg.checkpoint', packageHash: 'hash-A', preRunManifestHash: 'manifest-A' });
const REVIEWER_IDENTITY_R1 = { reviewerSlot: 'R1' as const, requestedModelId: 'model-a', resolvedModelId: 'model-a-2026', modelFamily: 'alpha' };

// ── 1. Interruption preserves completed batches ────────────────────────────

describe('interruption after a completed batch preserves that batch', () => {
  it('onBatchAccepted fires for the successful batch before the run throws on a later one', async () => {
    const subjects = manySubjects(4);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 2 });
    expect(plan.batches).toHaveLength(2);

    const accepted: BatchCheckpoint[] = [];
    const provider = createScriptedProvider({
      respond: (req) => {
        const asked = subjectRefsInPrompt(req.user);
        if (asked[0] === plan.batches[1].subjectRefs[0]) throw new Error('permanent failure on batch-001');
        return JSON.stringify({ decisions: asked.map((r) => decisionRow(r)) });
      },
    });

    await expect(
      runBatchedAdjudication({
        reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
        includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
        determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
        onBatchAccepted: ({ batchId, batchHash, attempt, decisions }) => {
          accepted.push(
            buildBatchCheckpoint({
              runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId, batchHash,
              orderedSubjectIds: plan.batches.find((b) => b.batchId === batchId)!.subjectRefs,
              attempt, decisions, completedAt: 't',
            }),
          );
        },
      }),
    ).rejects.toThrowError(/failed after 1 attempt/);

    // batch-000 was preserved even though the run as a whole failed.
    expect(accepted).toHaveLength(1);
    expect(accepted[0].batchId).toBe('batch-000');
    expect(accepted[0].decisions.map((d) => d.subjectRef)).toEqual(plan.batches[0].subjectRefs);
  });
});

// ── 2 & 3. Resume skips verified batches, retries the failed one ───────────

describe('resume skips verified batches and retries only the failed one', () => {
  it('a batch supplied via resumeFrom.decisions is never redispatched; an uncheckpointed batch is', async () => {
    const subjects = manySubjects(6);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 2 });
    expect(plan.batches).toHaveLength(3);

    // First pass: everything succeeds; capture checkpoints for batch-000 and batch-001 only.
    const checkpoints: BatchCheckpoint[] = [];
    const firstProvider = createScriptedProvider({
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider: firstProvider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
      onBatchAccepted: ({ batchId, batchHash, attempt, decisions }) => {
        if (batchId === 'batch-002') return; // pretend this one never completed
        checkpoints.push(
          buildBatchCheckpoint({
            runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId, batchHash,
            orderedSubjectIds: plan.batches.find((b) => b.batchId === batchId)!.subjectRefs,
            attempt, decisions, completedAt: 't',
          }),
        );
      },
    });
    expect(checkpoints).toHaveLength(2);

    // Second pass: only batch-002 should be dispatched.
    const dispatchedBatchIds = new Set<string>();
    const resumingProvider = createScriptedProvider({
      onCall: (req) => {
        const asked = subjectRefsInPrompt(req.user);
        const batch = plan.batches.find((b) => b.subjectRefs.join(',') === asked.join(','));
        if (batch) dispatchedBatchIds.add(batch.batchId);
      },
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    const resumed = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider: resumingProvider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
      resumeFrom: checkpoints.map(batchAttemptFromCheckpoint),
    });

    expect(dispatchedBatchIds.has('batch-000')).toBe(false);
    expect(dispatchedBatchIds.has('batch-001')).toBe(false);
    expect(dispatchedBatchIds.has('batch-002')).toBe(true); // the uncheckpointed one WAS retried
    expect(resumed.decisions).toHaveLength(6);
    expect(resumed.decisions.map((d) => d.subjectRef)).toEqual(subjects.map((s) => s.subjectRef));
  });
});

// ── 4-7. Identity mismatches refuse checkpoint reuse ───────────────────────

describe('checkpoint verification refuses reuse on any identity mismatch', () => {
  const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'ph', manifestHash: 'mh', subjectRefs: ['a', 'b'], batchSize: 2 });
  const decisions: ReviewDecision[] = [
    { reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'a', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' },
    { reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'b', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' },
  ];
  function freshCheckpoint(): BatchCheckpoint {
    return buildBatchCheckpoint({
      runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId: plan.batches[0].batchId,
      batchHash: plan.batches[0].batchHash, orderedSubjectIds: plan.batches[0].subjectRefs,
      attempt: okAttempt(plan.batches[0].batchId, plan.batches[0].batchHash, 1), decisions, completedAt: 't',
    });
  }
  const expectedGood = { runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId: plan.batches[0].batchId, batchHash: plan.batches[0].batchHash, orderedSubjectIds: plan.batches[0].subjectRefs };

  it('a matching checkpoint verifies clean', () => {
    expect(verifyCheckpointCompatible(freshCheckpoint(), expectedGood)).toEqual({ compatible: true, mismatches: [] });
  });

  it('altered package hash refuses reuse', () => {
    const alteredIdentity = buildRunIdentity({ packageId: 'pkg.checkpoint', packageHash: 'DIFFERENT-HASH', preRunManifestHash: 'manifest-A' });
    const { compatible, mismatches } = verifyCheckpointCompatible(freshCheckpoint(), { ...expectedGood, runIdentity: alteredIdentity });
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'packageHash')).toBe(true);
  });

  it('altered rubric hash refuses reuse (a checkpoint recorded before a rubric edit)', () => {
    const cp = { ...freshCheckpoint(), rubricHash: 'stale-rubric-hash' };
    const { compatible, mismatches } = verifyCheckpointCompatible(cp, expectedGood);
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'rubricHash')).toBe(true);
  });

  it('altered prompt hash refuses reuse', () => {
    const cp = { ...freshCheckpoint(), promptHash: 'stale-prompt-hash' };
    const { compatible, mismatches } = verifyCheckpointCompatible(cp, expectedGood);
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'promptHash')).toBe(true);
  });

  it('altered model identity (resolvedModelId) refuses reuse', () => {
    const { compatible, mismatches } = verifyCheckpointCompatible(freshCheckpoint(), {
      ...expectedGood,
      reviewerIdentity: { ...REVIEWER_IDENTITY_R1, resolvedModelId: 'a-different-model-2027' },
    });
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'resolvedModelId')).toBe(true);
  });

  it('reordered subject membership refuses reuse', () => {
    const { compatible, mismatches } = verifyCheckpointCompatible(freshCheckpoint(), {
      ...expectedGood,
      orderedSubjectIds: [...plan.batches[0].subjectRefs].reverse(),
    });
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'orderedSubjectIds')).toBe(true);
  });

  it('a tampered decisions array (hash no longer matches) refuses reuse', () => {
    const cp = freshCheckpoint();
    const tampered: BatchCheckpoint = { ...cp, decisions: [...cp.decisions, { ...cp.decisions[0], subjectRef: 'injected' }] };
    const { compatible, mismatches } = verifyCheckpointCompatible(tampered, expectedGood);
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'parsedDecisionHash')).toBe(true);
  });

  it('checkpoint schema version drift refuses reuse', () => {
    const cp = { ...freshCheckpoint(), checkpointSchemaVersion: '0.0.1' };
    const { compatible, mismatches } = verifyCheckpointCompatible(cp, expectedGood);
    expect(compatible).toBe(false);
    expect(mismatches.some((m) => m.field === 'checkpointSchemaVersion')).toBe(true);
    expect(CHECKPOINT_SCHEMA_VERSION).not.toBe('0.0.1');
  });
});

// ── 8. Corrupt checkpoint refuses reuse ─────────────────────────────────────

describe('a corrupt checkpoint file refuses reuse rather than being silently skipped', () => {
  let dir: string;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('readBatchCheckpoint throws CorruptCheckpointError on unparseable JSON', () => {
    dir = mkdtempSync(join(tmpdir(), 'review-checkpoint-test-'));
    const store = createFileReviewCheckpointStore(dir);
    writeFileSync(join(dir, 'r1', 'batch-000.json'), '{ not valid json');
    expect(() => store.readBatchCheckpoint('R1', 'batch-000')).toThrowError(/corrupt/i);
  });

  it('a well-formed checkpoint round-trips through the file store unchanged', () => {
    dir = mkdtempSync(join(tmpdir(), 'review-checkpoint-test-'));
    const store = createFileReviewCheckpointStore(dir);
    const cp = buildBatchCheckpoint({
      runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId: 'batch-000', batchHash: 'h',
      orderedSubjectIds: ['a', 'b'], attempt: okAttempt('batch-000', 'h', 1),
      decisions: [{ reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'a', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' }],
      completedAt: 't',
    });
    store.writeBatchCheckpoint(cp);
    expect(store.readBatchCheckpoint('R1', 'batch-000')).toEqual(cp);
    expect(store.readBatchCheckpoint('R1', 'nonexistent-batch')).toBeNull();
  });
});

// ── 9. Incomplete batch is never accepted ───────────────────────────────────

describe('an incomplete batch attempt can never become a checkpoint', () => {
  it('buildBatchCheckpoint refuses an unaccepted attempt', () => {
    const failedAttempt: BatchAttemptRecord = {
      reviewerSlot: 'R1', batchId: 'batch-000', batchHash: 'h', attempt: 1,
      rawOutputRef: 'raw', raw: '', outputHash: 'h', accepted: false, failureReason: 'timeout',
    };
    expect(() =>
      buildBatchCheckpoint({
        runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId: 'batch-000', batchHash: 'h',
        orderedSubjectIds: ['a'], attempt: failedAttempt, decisions: [], completedAt: 't',
      } as never),
    ).toThrowError(/non-accepted attempt/);
  });
});

// ── 10. Final output only after both passes complete ───────────────────────

describe('the run-state machine forbids reaching COMPLETE except via a completed R2 pass', () => {
  const invalidPaths: Array<[RunState, RunState]> = [
    ['CREATED', 'COMPLETE'],
    ['R1_IN_PROGRESS', 'COMPLETE'],
    ['R1_COMPLETE', 'COMPLETE'],
  ];
  it.each(invalidPaths)('%s -> %s is refused', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrowError(/invalid run-state transition/);
  });

  it('R2_IN_PROGRESS -> COMPLETE is the only valid path to completion', () => {
    expect(() => assertValidTransition('R2_IN_PROGRESS', 'COMPLETE')).not.toThrow();
  });

  it('transitionRunManifest refuses to advance a manifest through an invalid path', () => {
    const manifest: RunManifestRecord = {
      runId: 'r', state: 'CREATED', runIdentity: RUN_IDENTITY, packageCreatedAt: 't',
      preRunManifest: {} as never, reviewers: { r1: REVIEWER_IDENTITY_R1, r2: REVIEWER_IDENTITY_R1 },
      r1BatchPlan: { reviewerSlot: 'R1', batchSize: 2, packageHash: 'p', manifestHash: 'm', batches: [] },
      r2BatchPlan: null, createdAt: 't', updatedAt: 't',
    };
    expect(() => transitionRunManifest(manifest, 'COMPLETE', 't2')).toThrowError(/invalid run-state transition/);
    expect(transitionRunManifest(manifest, 'R1_IN_PROGRESS', 't2').state).toBe('R1_IN_PROGRESS');
  });
});

// ── 11. A resumed run is byte-identical to an uninterrupted one ────────────

describe('a resumed final result is byte-identical to an uninterrupted run', () => {
  it('reusing checkpointed R1 decisions for some batches produces the same tally/resolutions as a straight-through run', async () => {
    const subjects = manySubjects(8);
    const pkg = sealPackage(subjects);
    const request = buildReviewRequest({
      reviewId: 'review.checkpoint', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'independent?',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'pkg.json', pkg, requestedAt: 't', requestedByRef: 'steward.test',
    });
    const deterministicRespond = (req: { user: string }) =>
      JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) });

    // Uninterrupted, straight-through run. A fixed clock (not an incrementing
    // counter) on purpose: a REAL resumed run legitimately completes at a
    // different wall-clock instant than an uninterrupted one (fewer batches
    // are actually dispatched), so comparing real timestamps between the two
    // would be comparing the wrong thing. What must be byte-identical is the
    // DECISION CONTENT and resolution LOGIC — a fixed clock isolates exactly
    // that.
    const FIXED_NOW = '2026-07-29T00:00:00.000Z';
    const straight = await runDualReview({
      request, pkg,
      r1: { assignment: MODEL_A, provider: createScriptedProvider({ respond: deterministicRespond }) },
      r2: { assignment: MODEL_B, provider: createScriptedProvider({ respond: deterministicRespond }) },
      steward: { stewardRef: 'steward.test', interim: false },
      determinism: DEFAULT_DETERMINISM,
      coverage: { sampleRate: 1, sampleSeed: 'seed-1', mechanicallyFlagged: [] },
      assetRef: 'asset.test', assetCommitment: commit({ a: 1 }),
      now: () => FIXED_NOW,
      startedAt: FIXED_NOW,
      batching: { batchSize: 4 },
    });

    // Capture R1's checkpoints from that same run (as a real CLI would have).
    const r1Checkpoints = straight.r1BatchAttempts
      .filter((a) => a.accepted)
      .map((a) => {
        const batchDecisions = straight.r1Decisions.filter((d) =>
          straight.r1BatchPlan.batches.find((b) => b.batchId === a.batchId)!.subjectRefs.includes(d.subjectRef),
        );
        return buildBatchCheckpoint({
          runIdentity: RUN_IDENTITY, reviewerIdentity: REVIEWER_IDENTITY_R1, batchId: a.batchId, batchHash: a.batchHash,
          orderedSubjectIds: straight.r1BatchPlan.batches.find((b) => b.batchId === a.batchId)!.subjectRefs,
          attempt: a, decisions: batchDecisions, completedAt: 't',
        });
      });

    // Resumed run: R1 is served ENTIRELY from checkpoints (its provider must
    // never be called); R2 dispatches fresh.
    let r1Calls = 0;
    const resumed = await runDualReview({
      request, pkg,
      r1: { assignment: MODEL_A, provider: createScriptedProvider({ onCall: () => { r1Calls += 1; }, respond: deterministicRespond }) },
      r2: { assignment: MODEL_B, provider: createScriptedProvider({ respond: deterministicRespond }) },
      steward: { stewardRef: 'steward.test', interim: false },
      determinism: DEFAULT_DETERMINISM,
      coverage: { sampleRate: 1, sampleSeed: 'seed-1', mechanicallyFlagged: [] },
      assetRef: 'asset.test', assetCommitment: commit({ a: 1 }),
      now: () => FIXED_NOW,
      startedAt: FIXED_NOW,
      batching: { batchSize: 4 },
      resumeFrom: { r1: r1Checkpoints.map(batchAttemptFromCheckpoint) },
    });

    expect(r1Calls).toBe(0); // every R1 batch was served from a checkpoint
    expect(resumed.resolutions).toEqual(straight.resolutions);
    expect(resumed.tally).toEqual(straight.tally);
    expect(resumed.r1Decisions).toEqual(straight.r1Decisions);
    expect(resumed.r2Decisions).toEqual(straight.r2Decisions);
  });
});
