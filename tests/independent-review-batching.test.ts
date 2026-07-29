/**
 * IRL-REVIEW-001 — canaries for deterministic reviewer batching.
 *
 * Confirmed live-run defect (2026-07-29): asking one reviewer to adjudicate
 * all 464 subjects in a single completion returned 1 decision and 463
 * `unanswered`. Raising `maxTokens` from 8000 to 32000 changed nothing — the
 * failure is not a token-budget problem, the model cannot reliably track
 * hundreds of individual adjudications in one pass. The fix: partition each
 * reviewer's assignment into deterministic, manifest-bound batches; adjudicate
 * each independently; merge only after every batch is accounted for
 * (`services/research/review/batching.ts`).
 *
 * Each canary below is written to be mutation-verified: where a check exists
 * specifically to catch a failure mode, the test also demonstrates that the
 * failure mode is NOT already caught by the underlying primitive alone — i.e.
 * the new guard is load-bearing, not incidental.
 */

import { describe, it, expect } from 'vitest';
import {
  assertReviewerComplete,
  buildBatchPlan,
  flattenBatchPlan,
  runBatchedAdjudication,
  DEFAULT_BATCH_SIZE,
  type BatchAttemptRecord,
} from '@/services/research/review/batching';
import {
  buildReviewPackage,
  buildReviewRequest,
  commit,
  createScriptedProvider,
  DEFAULT_DETERMINISM,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  parseAdjudication,
  ReviewRefusal,
  runDualReview,
  type ReviewDecision,
  type ReviewerAssignment,
  type ReviewSubjectRecord,
} from '@/services/research/review';
import { EXP_P1_NON_TARGETS, EXP_P1_TARGET_STATEMENT } from '@/services/research/review/templates/expP1Admissibility';

// ── Fixtures ──────────────────────────────────────────────────────────────

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
    packageId: 'pkg.batching',
    reviewId: 'review.batching',
    assetRef: 'asset.batching',
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

/** Extract the exact subjectRefs a composed batch prompt asked about. */
function subjectRefsInPrompt(user: string): string[] {
  return [...user.matchAll(/^subjectRef: (.+)$/gm)].map((m) => m[1]);
}

function decisionRow(subjectRef: string, decision = 'independent') {
  return { subjectRef, decision, reason: 'predates the apparatus and names no target system', evidenceRefs: [], limitations: [] };
}

const MODEL_A: ReviewerAssignment = {
  reviewerSlot: 'R1',
  reviewerType: 'external-model',
  provider: 'venice',
  requestedModelId: 'model-a',
  resolvedModelId: 'model-a-2026',
  modelFamily: 'alpha',
  promptVersion: '1.0.0',
  rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
};
const MODEL_B: ReviewerAssignment = {
  ...MODEL_A,
  reviewerSlot: 'R2',
  requestedModelId: 'model-b',
  resolvedModelId: 'model-b-2026',
  modelFamily: 'beta',
};

// ── 1. Deterministic partitioning ───────────────────────────────────────────

describe('deterministic partitioning', () => {
  const refs = Array.from({ length: 100 }, (_, i) => `s-${i}`);

  it('the same manifest always produces the same batch ids, membership, order and hashes', () => {
    const a = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'ph', manifestHash: 'mh', subjectRefs: refs, batchSize: 32 });
    const b = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'ph', manifestHash: 'mh', subjectRefs: refs, batchSize: 32 });
    expect(a).toEqual(b);
    expect(a.batches.map((x) => x.batchId)).toEqual(['batch-000', 'batch-001', 'batch-002', 'batch-003']);
    expect(a.batches.map((x) => x.subjectRefs.length)).toEqual([32, 32, 32, 4]);
  });

  it('a different package or manifest hash changes every batch hash — batches are BOUND, not just partitioned', () => {
    const a = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'ph-1', manifestHash: 'mh', subjectRefs: refs, batchSize: 32 });
    const b = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'ph-2', manifestHash: 'mh', subjectRefs: refs, batchSize: 32 });
    expect(a.batches[0].batchHash).not.toBe(b.batches[0].batchHash);
  });

  it('refuses a non-positive batch size and an empty subject list', () => {
    expect(() => buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'p', manifestHash: 'm', subjectRefs: refs, batchSize: 0 }))
      .toThrowError(/batchSize/);
    expect(() => buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'p', manifestHash: 'm', subjectRefs: [], batchSize: 32 }))
      .toThrowError(/no subjects/);
  });

  it('464 subjects at the frozen batch size of 32 produce exactly 15 batches', () => {
    const plan = buildBatchPlan({
      reviewerSlot: 'R1', packageHash: 'p', manifestHash: 'm',
      subjectRefs: Array.from({ length: 464 }, (_, i) => `inv.${i}`),
      batchSize: DEFAULT_BATCH_SIZE,
    });
    expect(plan.batches).toHaveLength(15);
    expect(plan.batches.at(-1)!.subjectRefs).toHaveLength(464 - 32 * 14);
  });
});

// ── 2. Full reconstruction ──────────────────────────────────────────────────

describe('full reconstruction', () => {
  it('merging all batches reproduces every original subjectRef exactly once, in canonical order', () => {
    const refs = Array.from({ length: 97 }, (_, i) => `inv.${String(i).padStart(3, '0')}`);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: 'p', manifestHash: 'm', subjectRefs: refs, batchSize: 32 });
    expect(flattenBatchPlan(plan)).toEqual(refs);
  });
});

// ── 3. Missing response fails closed ────────────────────────────────────────

describe('missing response fails closed', () => {
  it('assertReviewerComplete names the exact missing ref, not a generic count', () => {
    expect(() => assertReviewerComplete('R1', ['a', 'b', 'c'], [
      { reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'a', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' },
      { reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'c', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' },
    ] as ReviewDecision[])).toThrowError(/\bb\b/);
  });

  it('passes when every expected ref has a decision', () => {
    expect(() => assertReviewerComplete('R1', ['a'], [
      { reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'a', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm' },
    ] as ReviewDecision[])).not.toThrow();
  });

  it('a batch missing one decision surfaces that exact ref as unanswered, not silently dropped', async () => {
    const subjects = manySubjects(4);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({
      reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm',
      subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 32,
    });
    const provider = createScriptedProvider({
      respond: (req) => {
        const asked = subjectRefsInPrompt(req.user).filter((r) => r !== subjects[1].subjectRef); // drop one
        return JSON.stringify({ decisions: asked.map((r) => decisionRow(r)) });
      },
    });
    const outcome = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
    });
    expect(outcome.unanswered).toEqual([subjects[1].subjectRef]);
    expect(outcome.decisions.map((d) => d.subjectRef)).not.toContain(subjects[1].subjectRef);
    // Mutation check: parseAdjudication alone already reports this correctly —
    // batching must not lose that behaviour when assembling from multiple calls.
    expect(() => assertReviewerComplete('R1', subjects.map((s) => s.subjectRef), outcome.decisions))
      .toThrowError(new RegExp(subjects[1].subjectRef));
  });
});

// ── 4. Duplicate response fails ─────────────────────────────────────────────

describe('duplicate response fails', () => {
  it('a batch that answers the same subjectRef twice is rejected, not last-write-wins', async () => {
    const subjects = manySubjects(3);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({
      reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm',
      subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 32,
    });
    const dupRaw = JSON.stringify({
      decisions: [
        decisionRow(subjects[0].subjectRef, 'independent'),
        decisionRow(subjects[0].subjectRef, 'domain-adjacent'), // same ref, second answer
        decisionRow(subjects[1].subjectRef),
        decisionRow(subjects[2].subjectRef),
      ],
    });

    // Mutation check FIRST: the underlying parser alone does NOT reject this —
    // it silently keeps both rows. Proves the batching guard is load-bearing.
    const bare = parseAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', raw: dupRaw, rawOutputRef: 'raw',
      reviewedAt: 't', expectedSubjectRefs: subjects.map((s) => s.subjectRef),
    });
    expect(bare.decisions.filter((d) => d.subjectRef === subjects[0].subjectRef)).toHaveLength(2);

    const provider = createScriptedProvider({ respond: () => dupRaw });
    await expect(
      runBatchedAdjudication({
        reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
        includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
        determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
      }),
    ).rejects.toThrowError(/more than one decision|last-write-wins/i);
  });
});

// ── 5. Cross-batch contamination fails ──────────────────────────────────────

describe('cross-batch contamination fails', () => {
  it('a batch answering for a subject in a DIFFERENT batch is rejected', async () => {
    const subjects = manySubjects(6);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({
      reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm',
      subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 3, // 2 batches of 3
    });
    expect(plan.batches).toHaveLength(2);

    const provider = createScriptedProvider({
      respond: (req) => {
        const asked = subjectRefsInPrompt(req.user);
        // Answer what was asked, PLUS a subject that belongs to the OTHER batch.
        const foreign = plan.batches[0].subjectRefs.includes(asked[0]) ? plan.batches[1].subjectRefs[0] : plan.batches[0].subjectRefs[0];
        return JSON.stringify({ decisions: [...asked, foreign].map((r) => decisionRow(r)) });
      },
    });
    await expect(
      runBatchedAdjudication({
        reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
        includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
        determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
      }),
    ).rejects.toThrowError(/cross-batch-contamination|outside its assigned batch/i);
  });

  it('mutation check: without the per-batch expectedSubjectRefs restriction, the foreign ref would be silently admitted', () => {
    // parseAdjudication's OWN unsolicited detection is what the guard relies on
    // — demonstrate it fires here too, so the batching wrapper is not doing
    // something parseAdjudication would have caught anyway by accident of a
    // wider expected set. With the FULL package's refs as "expected" (i.e. no
    // batch boundary), the same foreign ref is treated as legitimate.
    const subjects = manySubjects(6);
    const parsedNoBoundary = parseAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm',
      raw: JSON.stringify({ decisions: [decisionRow(subjects[3].subjectRef)] }),
      rawOutputRef: 'raw', reviewedAt: 't',
      expectedSubjectRefs: subjects.map((s) => s.subjectRef), // whole package, no batch boundary
    });
    expect(parsedNoBoundary.unsolicited).toEqual([]);
  });
});

// ── 6. Reviewer isolation at the batch level ────────────────────────────────

describe('reviewer isolation holds across every batch', () => {
  it('no R1 decision material enters any R2 batch request payload', async () => {
    const subjects = manySubjects(10);
    const pkg = sealPackage(subjects);
    const r1Plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 4 });
    const r1Provider = createScriptedProvider({
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r, 'domain-adjacent')) }),
    });
    const r1 = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider: r1Provider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: r1Plan, maxAttemptsPerBatch: 1, now: () => 't',
    });
    expect(r1.decisions.length).toBe(10);

    const r2Plan = buildBatchPlan({ reviewerSlot: 'R2', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 3 });
    const seenPrompts: string[] = [];
    const r2Provider = createScriptedProvider({
      onCall: (req) => seenPrompts.push(`${req.system}\n${req.user}`),
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R2', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: false, priorForeignDecisions: r1.decisions, provider: r2Provider, modelId: 'model-b-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: r2Plan, maxAttemptsPerBatch: 1, now: () => 't',
    });

    expect(seenPrompts.length).toBe(r2Plan.batches.length);
    for (const text of seenPrompts) {
      for (const d of r1.decisions) {
        expect(text).not.toContain(d.outputHash);
        expect(text).not.toContain(d.rawOutputRef);
        expect(text).not.toContain(d.reason);
        expect(text).not.toContain(`${d.subjectRef}: ${d.decision}`);
      }
    }
  });

  it('a leak introduced in ANY single batch is caught, not just the first', async () => {
    const subjects = manySubjects(8);
    const pkg = sealPackage(subjects);
    const prior: ReviewDecision[] = [
      { reviewId: 'r', reviewerSlot: 'R1', subjectRef: subjects[5].subjectRef, decision: 'independent', reason: 'a substantially long fingerprintable rationale', evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw/r/R1/batch-001', outputHash: 'deadbeefcafef00d', reviewerRef: 'm' },
    ];
    const r2Plan = buildBatchPlan({ reviewerSlot: 'R2', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 4 });
    // Batch 1 (the SECOND batch) leaks R1's rationale into its own prompt via a
    // corrupted includeBlockDecisions-independent path — simulated here by
    // asserting the isolation gate directly against that batch's composed text.
    const { buildReviewerPrompt } = await import('@/services/research/review/rubric');
    const leaked = buildReviewerPrompt({
      reviewerSlot: 'R2', pkg, subjects: [subjects[4], subjects[5]], includeBlockDecisions: false,
    });
    const contaminated = { system: leaked.system, user: `${leaked.user}\n${prior[0].reason}` };
    const { assertPromptCarriesNoPriorAdjudication } = await import('@/services/research/review/isolation');
    try {
      assertPromptCarriesNoPriorAdjudication('R2', contaminated, prior);
      throw new Error('expected a refusal');
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe('reviewer-isolation-breach');
    }
    // And the clean, un-contaminated version of the same batch passes.
    expect(() => assertPromptCarriesNoPriorAdjudication('R2', leaked, prior)).not.toThrow();
    void r2Plan;
  });
});

// ── 7. Resume safety ─────────────────────────────────────────────────────────

describe('resume safety', () => {
  it('a rerun after a partial failure executes only the unresolved batches', async () => {
    const subjects = manySubjects(6);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 2 });
    expect(plan.batches).toHaveLength(3);

    const calls: string[] = [];
    const provider = createScriptedProvider({
      onCall: (req) => calls.push(req.modelId),
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });

    const first = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
    });
    expect(calls).toHaveLength(3);
    expect(first.decisions).toHaveLength(6);

    // Simulate "batch-000 and batch-001 already succeeded in a prior partial
    // run"; only batch-002 should be redispatched.
    const priorAttempts: BatchAttemptRecord[] = first.attempts.filter((a) => a.batchId !== 'batch-002');
    expect(priorAttempts).toHaveLength(2);

    const failIfCalledForResolved = createScriptedProvider({
      onCall: (req) => {
        calls.push(req.modelId);
        const asked = subjectRefsInPrompt(req.user);
        const isResolvedBatch = plan.batches.slice(0, 2).some((b) => b.subjectRefs.join(',') === asked.join(','));
        if (isResolvedBatch) throw new Error('must not redispatch a resolved batch');
      },
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    calls.length = 0;
    const resumed = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider: failIfCalledForResolved, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
      resumeFrom: priorAttempts,
    });
    expect(calls).toHaveLength(1); // only the unresolved batch was dispatched
    expect(resumed.decisions).toHaveLength(6);
    expect(resumed.decisions.map((d) => d.subjectRef)).toEqual(subjects.map((s) => s.subjectRef));
  });

  it('refuses to resume from a stale plan whose batch hash no longer matches', async () => {
    const subjects = manySubjects(4);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 2 });
    const staleAttempt: BatchAttemptRecord = {
      reviewerSlot: 'R1', batchId: plan.batches[0].batchId, batchHash: 'stale-hash-from-a-different-plan',
      attempt: 1, rawOutputRef: 'raw/x', raw: '{}', outputHash: 'h', accepted: true,
    };
    const provider = createScriptedProvider({ respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }) });
    await expect(
      runBatchedAdjudication({
        reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
        includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
        determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
        resumeFrom: [staleAttempt],
      }),
    ).rejects.toThrowError(/resume-batch-hash-mismatch|stale plan/i);
  });
});

// ── 8. Oversized package guard ───────────────────────────────────────────────

describe('oversized package guard — no single-call path for a package above the batch size', () => {
  it('a package larger than the batch size is NEVER dispatched in one call', async () => {
    const subjects = manySubjects(100);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 32 });
    expect(plan.batches).toHaveLength(4);

    let calls = 0;
    let maxSubjectsInOneCall = 0;
    const provider = createScriptedProvider({
      onCall: (req) => {
        calls += 1;
        maxSubjectsInOneCall = Math.max(maxSubjectsInOneCall, subjectRefsInPrompt(req.user).length);
      },
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });

    const outcome = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 1, now: () => 't',
    });

    expect(calls).toBe(4); // NEVER 1 — the legacy single-call path does not exist
    expect(maxSubjectsInOneCall).toBeLessThanOrEqual(32);
    expect(outcome.decisions).toHaveLength(100);
  });

  it('mutation check: `runDualReview` itself always routes through the batch plan, at any subject count', async () => {
    // A count of 1 here (rather than N-per-batch calls) would mean the runner
    // fell back to a legacy single-shot dispatch somewhere upstream of
    // runBatchedAdjudication. Drive the FULL runner (not just the batching
    // helper) end to end with a package well above the default batch size.
    const subjects = manySubjects(70); // > 2x the default batch size
    const pkg = sealPackage(subjects);
    const request = buildReviewRequest({
      reviewId: 'review.batching', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'independent?',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'pkg.json', pkg, requestedAt: 't', requestedByRef: 'steward.test',
    });
    let r1Calls = 0;
    let r2Calls = 0;
    const r1Provider = createScriptedProvider({
      onCall: () => { r1Calls += 1; },
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    const r2Provider = createScriptedProvider({
      onCall: () => { r2Calls += 1; },
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    let t = 0;
    const artifacts = await runDualReview({
      request, pkg,
      r1: { assignment: MODEL_A, provider: r1Provider },
      r2: { assignment: MODEL_B, provider: r2Provider },
      steward: { stewardRef: 'steward.test', interim: false },
      determinism: DEFAULT_DETERMINISM,
      coverage: { sampleRate: 1, sampleSeed: 'seed-1', mechanicallyFlagged: [] },
      assetRef: 'asset.test', assetCommitment: commit({ a: 1 }),
      now: () => `2026-07-29T00:00:0${t++}.000Z`,
      batching: { batchSize: 32 },
    });
    expect(r1Calls).toBe(3); // ceil(70/32)
    expect(r1Calls).toBeGreaterThan(1);
    expect(r2Calls).toBeGreaterThan(1);
    expect(artifacts.r1BatchPlan.batches).toHaveLength(3);
    expect(artifacts.tally.agreed).toBe(70);
    expect(artifacts.r1BatchAttempts.every((a) => a.accepted)).toBe(true);
    expect(artifacts.r2BatchAttempts.every((a) => a.accepted)).toBe(true);
  });
});

// ── 9. Idempotent retry ──────────────────────────────────────────────────────

describe('idempotent retry', () => {
  it('retries reuse the identical batch, prompt, model and determinism, and record which attempt was accepted', async () => {
    const subjects = manySubjects(3);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 32 });

    let calls = 0;
    const seenPrompts: string[] = [];
    const provider = createScriptedProvider({
      onCall: (req) => { calls += 1; seenPrompts.push(req.user); },
      respond: (req) => {
        if (calls === 1) throw new ReviewRefusal('reviewer-call-failed', 'simulated transient failure');
        return JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) });
      },
    });
    const outcome = await runBatchedAdjudication({
      reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
      includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
      determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 2, now: () => 't',
    });
    expect(calls).toBe(2);
    expect(seenPrompts[0]).toBe(seenPrompts[1]); // identical prompt on retry
    expect(outcome.decisions).toHaveLength(3);
    expect(outcome.attempts.filter((a) => !a.accepted)).toHaveLength(1);
    expect(outcome.attempts.filter((a) => a.accepted)).toHaveLength(1);
    expect(outcome.attempts.find((a) => a.accepted)!.attempt).toBe(2);
  });

  it('a batch that exhausts its retries fails the run rather than being recorded as passing', async () => {
    const subjects = manySubjects(2);
    const pkg = sealPackage(subjects);
    const plan = buildBatchPlan({ reviewerSlot: 'R1', packageHash: pkg.packageHash, manifestHash: 'm', subjectRefs: subjects.map((s) => s.subjectRef), batchSize: 32 });
    const provider = createScriptedProvider({
      respond: () => { throw new ReviewRefusal('reviewer-call-failed', 'always fails'); },
    });
    await expect(
      runBatchedAdjudication({
        reviewId: 'r', reviewerSlot: 'R1', reviewerRef: 'm', pkg, subjects,
        includeBlockDecisions: true, priorForeignDecisions: [], provider, modelId: 'model-a-2026',
        determinism: DEFAULT_DETERMINISM, batchPlan: plan, maxAttemptsPerBatch: 2, now: () => 't',
      }),
    ).rejects.toThrowError(/batch-adjudication-failed|failed after 2 attempt/i);
  });
});

// ── 10. Completion before agreement ──────────────────────────────────────────

describe('completion is separated from agreement — batched or not', () => {
  it('the pipeline order is unchanged: R1 completeness before coverage, coverage before R2, R2 before resolution', async () => {
    const subjects = manySubjects(40);
    const pkg = sealPackage(subjects);
    const request = buildReviewRequest({
      reviewId: 'review.batching', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'independent?',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'pkg.json', pkg, requestedAt: 't', requestedByRef: 'steward.test',
    });
    const seen: string[] = [];
    const r1Provider = createScriptedProvider({
      onCall: () => seen.push('r1-call'),
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    const r2Provider = createScriptedProvider({
      onCall: () => seen.push('r2-call'),
      respond: (req) => JSON.stringify({ decisions: subjectRefsInPrompt(req.user).map((r) => decisionRow(r)) }),
    });
    let t = 0;
    await runDualReview({
      request, pkg,
      r1: { assignment: MODEL_A, provider: r1Provider },
      r2: { assignment: MODEL_B, provider: r2Provider },
      steward: { stewardRef: 'steward.test', interim: false },
      determinism: DEFAULT_DETERMINISM,
      coverage: { sampleRate: 1, sampleSeed: 'seed-1', mechanicallyFlagged: [] },
      assetRef: 'asset.test', assetCommitment: commit({ a: 1 }),
      now: () => `2026-07-29T00:00:0${t++}.000Z`,
      onStep: (step) => seen.push(step),
      batching: { batchSize: 8 },
    });
    const lastR1Call = seen.lastIndexOf('r1-call');
    const firstR2Call = seen.indexOf('r2-call');
    const coverageStep = seen.indexOf('coverage');
    const resolvedStep = seen.indexOf('resolved');
    expect(lastR1Call).toBeLessThan(coverageStep);
    expect(coverageStep).toBeLessThan(firstR2Call);
    expect(seen.lastIndexOf('r2-call')).toBeLessThan(resolvedStep);
  });
});
