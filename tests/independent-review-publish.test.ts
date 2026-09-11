import { describe, it, expect } from 'vitest';
import { validateAndBuildPublishedReview, type CompletedReviewArtifacts } from '../services/research/independentReviewPublish';
import { verifyPackageHash, buildReviewPackage } from '../services/research/review/reviewPackage';
import { commit } from '../services/research/review/deterministic';
import { upsertReview, markReviewSuperseded, getReview, type ReviewRecord } from '../services/research/independentReviewStore';

// Governed-import canaries (operator ruling 2026-07-31): a completed CLI
// result must be importable into the store the Review Result panel reads,
// but ONLY when every artifact hash and internal tally cross-check passes,
// and the import must never itself act as a governed resolution.

const REVIEW_ID = 'review.vP1.4e379af743c8';

function buildFixturePackage() {
  return buildReviewPackage({
    packageId: `pkg.${REVIEW_ID}`,
    reviewId: REVIEW_ID,
    assetRef: 'crystal-vP1',
    assetCommitment: commit({ subjects: ['s1', 's2'] }),
    targetDefinition: 'Independence from the target system under test.',
    nonTargets: ['adjacent-system-x'],
    rubricRef: 'rubric.independence-contamination',
    rubricVersion: '1.0.0',
    sourceRefs: ['src-1'],
    chronology: [],
    evidenceSummaries: [],
    subjects: [
      { subjectRef: 's1', kind: 'invariant' } as any,
      { subjectRef: 's2', kind: 'invariant' } as any,
    ],
    blockDecisions: [],
    exclusionsFromPackage: [],
    createdAt: '2026-07-30T00:00:00.000Z',
  });
}

function buildFixtureArtifacts(overrides?: { contested?: number }): CompletedReviewArtifacts {
  const pkg = buildFixturePackage();
  const resolutions = [
    { reviewId: REVIEW_ID, subjectRef: 's1', status: 'agreed' as const },
    { reviewId: REVIEW_ID, subjectRef: 's2', status: overrides?.contested ? ('contested' as const) : ('agreed' as const) },
  ];
  const tally = {
    agreed: resolutions.filter((r) => r.status === 'agreed').length,
    contested: resolutions.filter((r) => r.status === 'contested').length,
    rejected: 0,
    unknown: 0,
  };
  const receiptPayload = {
    reviewId: REVIEW_ID,
    assetRef: 'crystal-vP1',
    assetCommitment: pkg.assetCommitment,
    packageHash: pkg.packageHash,
    rubricRef: pkg.rubricRef,
    rubricVersion: pkg.rubricVersion,
    reviewMode: 'dual' as const,
    reviewers: [
      { reviewerSlot: 'r1', reviewerType: 'model', provider: 'anthropic', requestedModelId: 'claude', resolvedModelId: 'claude', modelFamily: 'claude', humanReviewerRef: null },
      { reviewerSlot: 'r2', reviewerType: 'model', provider: 'openai', requestedModelId: 'gpt', resolvedModelId: 'gpt', modelFamily: 'gpt', humanReviewerRef: null },
    ],
    stewardRef: 'steward-operator',
    stewardInterim: true,
    agreedCount: tally.agreed,
    contestedCount: tally.contested,
    rejectedCount: tally.rejected,
    unknownCount: tally.unknown,
    reviewStartedAt: '2026-07-30T01:00:00.000Z',
    reviewCompletedAt: '2026-07-30T02:00:00.000Z',
    ratifiesAsset: false,
    grantsStanding: false,
    changesLifecycle: false,
    freezesAsset: false,
  };
  const receipt = { actionType: 'independent_review_completed', summary: 'test', payload: receiptPayload, payloadCommitment: commit(receiptPayload) };
  return {
    package: pkg,
    decisions: {
      r1: [{ reviewId: REVIEW_ID, reviewerSlot: 'r1', subjectRef: 's1', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: '', rawOutputRef: '', outputHash: '', reviewerRef: 'r1' } as any],
      r2: [{ reviewId: REVIEW_ID, reviewerSlot: 'r2', subjectRef: 's1', decision: 'independent', reason: 'x', evidenceRefs: [], limitations: [], reviewedAt: '', rawOutputRef: '', outputHash: '', reviewerRef: 'r2' } as any],
    },
    resolutions: { resolutions, contested: [], tally },
    receipt,
  };
}

const IMPORTED_FROM = { artifactDir: '/tmp/fixture-reviews', importedAt: '2026-07-31T00:00:00.000Z' };

describe('validateAndBuildPublishedReview — refuses on any hash-invalid or incomplete artifact set', () => {
  it('refuses when the reviewId does not match the artifacts', () => {
    const artifacts = buildFixtureArtifacts();
    const result = validateAndBuildPublishedReview(artifacts, 'review.vP1.someOtherId', IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('review-id-mismatch');
  });

  it('refuses when the package hash does not verify (hand-edited artifact)', () => {
    const artifacts = buildFixtureArtifacts();
    const corrupted = { ...artifacts, package: { ...artifacts.package, targetDefinition: 'tampered' } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('package-hash-invalid');
  });

  it('refuses when the receipt payloadCommitment does not verify', () => {
    const artifacts = buildFixtureArtifacts();
    const corrupted = { ...artifacts, receipt: { ...artifacts.receipt, payload: { ...artifacts.receipt.payload, agreedCount: 999 } } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('receipt-commitment-invalid');
  });

  it('refuses when the receipt references a different packageHash than the supplied package', () => {
    const artifacts = buildFixtureArtifacts();
    const mismatchedPayload = { ...artifacts.receipt.payload, packageHash: 'not-the-real-hash' };
    const corrupted = { ...artifacts, receipt: { ...artifacts.receipt, payload: mismatchedPayload, payloadCommitment: commit(mismatchedPayload) } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('package-receipt-hash-mismatch');
  });

  it('refuses when the receipt claims ratification/Standing/lifecycle/freeze authority', () => {
    const artifacts = buildFixtureArtifacts();
    const forgedPayload = { ...artifacts.receipt.payload, ratifiesAsset: true as unknown as false };
    const corrupted = { ...artifacts, receipt: { ...artifacts.receipt, payload: forgedPayload, payloadCommitment: commit(forgedPayload) } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('receipt-claims-authority');
  });

  it('refuses when the tally disagrees across resolutions/receipt', () => {
    const artifacts = buildFixtureArtifacts();
    const corrupted = { ...artifacts, resolutions: { ...artifacts.resolutions, tally: { ...artifacts.resolutions.tally, agreed: 999 } } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('tally-mismatch');
  });

  it('refuses on empty R1 or R2 decisions', () => {
    const artifacts = buildFixtureArtifacts();
    const corrupted = { ...artifacts, decisions: { r1: [], r2: artifacts.decisions.r2 } };
    const result = validateAndBuildPublishedReview(corrupted, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('empty-decisions');
  });
});

describe('validateAndBuildPublishedReview — a valid completed review publishes as non-ratifying evidence', () => {
  it('accepts a fully consistent artifact set and preserves the reviewId (never mints a new one)', () => {
    const artifacts = buildFixtureArtifacts();
    const result = validateAndBuildPublishedReview(artifacts, REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.reviewId).toBe(REVIEW_ID);
  });

  it('labels the source as cli-independent-review and records the artifact path + import timestamp', () => {
    const result = validateAndBuildPublishedReview(buildFixtureArtifacts(), REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.record as any).source).toBe('cli-independent-review');
      expect((result.record as any).importedFrom).toEqual(IMPORTED_FROM);
    }
  });

  it('never sets action/actionReason/actionByRef — a publish is a receipt import, not a governed resolution', () => {
    const result = validateAndBuildPublishedReview(buildFixtureArtifacts(), REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.action).toBeNull();
      expect(result.record.actionReason).toBeNull();
      expect(result.record.actionByRef).toBeNull();
    }
  });

  it('sets queueState to "contested" when any subject is contested, "completed" otherwise', () => {
    const clean = validateAndBuildPublishedReview(buildFixtureArtifacts(), REVIEW_ID, IMPORTED_FROM);
    expect(clean.ok && clean.record.queueState).toBe('completed');

    const withContested = buildFixtureArtifacts({ contested: 1 });
    const contestedResult = validateAndBuildPublishedReview(withContested, REVIEW_ID, IMPORTED_FROM);
    expect(contestedResult.ok && contestedResult.record.queueState).toBe('contested');
  });

  it('preserves the real resolved subject count (never fabricated from console output)', () => {
    const result = validateAndBuildPublishedReview(buildFixtureArtifacts(), REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.resolutions.length).toBe(2);
  });
});

// ── Store-level: supersede + idempotency, against a minimal in-memory fake ──

interface FakeRow { object_kind: string; object_id: string; payload: unknown; lifecycle_state: string; receipt_id: string | null; created_at: string; updated_at: string }

function makeFakeAdmin() {
  const rows = new Map<string, FakeRow>();
  const admin: any = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_k1: string, _v1: string) => ({
            eq: (_k2: string, objectId: string) => ({
              maybeSingle: async () => ({ data: rows.get(objectId) ?? null, error: null }),
            }),
          }),
        }),
        upsert: async (row: Partial<FakeRow>, _opts: unknown) => {
          const existing = rows.get(row.object_id as string);
          rows.set(row.object_id as string, {
            object_kind: 'review',
            object_id: row.object_id as string,
            payload: row.payload,
            lifecycle_state: row.lifecycle_state as string,
            receipt_id: (row.receipt_id as string | null) ?? null,
            created_at: existing?.created_at ?? (row.updated_at as string),
            updated_at: row.updated_at as string,
          });
          return { error: null };
        },
        update: (patch: Partial<FakeRow>) => ({
          eq: (_k1: string, _v1: string) => ({
            eq: (_k2: string, objectId: string) => {
              const existing = rows.get(objectId);
              if (existing) rows.set(objectId, { ...existing, ...patch });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    },
  };
  return { admin, rows };
}

describe('Review store — supersede marks, never deletes', () => {
  it('marks the prior row with supersededBy without deleting it', async () => {
    const { admin, rows } = makeFakeAdmin();
    const oldRecord: Omit<ReviewRecord, 'createdAt' | 'updatedAt' | 'receiptId'> & { receiptId?: string | null } = {
      reviewId: 'review.vP1.0eeba9fd8910',
      queueState: 'planned',
      request: {} as any,
      package: {} as any,
      assignments: [],
      steward: {} as any,
      blockDecisions: [],
      r1Decisions: [],
      r2Decisions: [],
      resolutions: [],
      action: null,
      actionReason: null,
      actionByRef: null,
      actionAt: null,
      receiptId: null,
    };
    await upsertReview(admin, oldRecord);
    expect(rows.has('review.vP1.0eeba9fd8910')).toBe(true);

    await markReviewSuperseded(admin, 'review.vP1.0eeba9fd8910', REVIEW_ID, 'later operator-executed package with different governed population');

    expect(rows.has('review.vP1.0eeba9fd8910')).toBe(true); // never deleted
    const superseded = await getReview(admin, 'review.vP1.0eeba9fd8910');
    expect(superseded?.supersededBy).toBe(REVIEW_ID);
    expect(superseded?.supersededReason).toBeTruthy();
    expect(superseded?.queueState).toBe('planned'); // untouched — history stays honest
  });
});

describe('Review store — publishing the same review twice is idempotent', () => {
  it('upserting the identical reviewId twice results in one row, not two', async () => {
    const { admin, rows } = makeFakeAdmin();
    const result = validateAndBuildPublishedReview(buildFixtureArtifacts(), REVIEW_ID, IMPORTED_FROM);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await upsertReview(admin, result.record);
    await upsertReview(admin, result.record);

    expect(rows.size).toBe(1);
    const stored = await getReview(admin, REVIEW_ID);
    expect(stored?.resolutions.length).toBe(2);
  });
});
