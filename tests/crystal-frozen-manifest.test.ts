/**
 * Frozen Crystal Manifest (services/research/crystalFrozenManifest.ts) —
 * canaries for the Validation Programme JSON Agent Package's External
 * Review Completeness Pass (2026-08-09), point 2 and point 10's required
 * canary: "the frozen manifest hash matches the reviewed artifact" and "no
 * live-corpus substitution can silently change the reviewed object."
 */

import { describe, it, expect, vi } from 'vitest';

const FIXTURE_INVARIANTS = [
  {
    id: 'inv-001',
    seedId: null,
    statement: 'If a market clears, price equals marginal cost at equilibrium.',
    namespace: 'financial-risk',
    ontologyClassId: null,
    semanticType: 'law',
    status: 'validated',
    confidence: 0.9,
    confidenceBasis: 'validated',
    standing: 0.7,
    reach: 3,
    timesValidated: 4,
    timesContradicted: 0,
    timesReferenced: 2,
    timesUsed: 1,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: { evidenceProvenance: 'external-established', source: 'Test Source A' },
    reasoningProvenance: {},
    creatorAliasCommitment: 'commit-abc',
    dvnReceiptId: 'receipt-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'inv-002',
    seedId: null,
    statement: 'Liquidity risk increases as bid-ask spread widens.',
    namespace: 'financial-risk',
    ontologyClassId: null,
    semanticType: 'constraint',
    status: 'canonical',
    confidence: 0.95,
    confidenceBasis: 'canonical',
    standing: 0.9,
    reach: 5,
    timesValidated: 6,
    timesContradicted: 0,
    timesReferenced: 4,
    timesUsed: 2,
    version: 1,
    supersedesId: null,
    ratifiedSource: 'operator ruling 2026-01-02',
    provenance: { evidenceProvenance: 'external-empirical', source: 'Test Source B' },
    reasoningProvenance: {},
    creatorAliasCommitment: 'commit-def',
    dvnReceiptId: 'receipt-2',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

vi.mock('@/services/invariants/store', () => ({
  listInvariants: vi.fn(async () => FIXTURE_INVARIANTS),
  listEdgesForInvariants: vi.fn(async () => []),
}));

describe('buildFrozenCrystalManifest — hash-verified against the persisted freeze', () => {
  it('is UNVERIFIED and withholds members when the artifact carries no contentHash', async () => {
    const { buildFrozenCrystalManifest } = await import('@/services/research/crystalFrozenManifest');
    const manifest = await buildFrozenCrystalManifest({
      experimentId: 'EXP-P1',
      artifact: { id: 'EXP-P1/crystal-vP1', contentHash: null, commitmentHash: null, frozenAt: '2026-01-03T00:00:00.000Z', signedBy: ['operator'], receiptId: null },
    });
    expect(manifest.verifiedAgainstFreeze).toBe(false);
    expect(manifest.members).toBeNull();
    expect(manifest.verificationDetail).toMatch(/no contentHash/);
  });

  it('VERIFIES and serves the full member list when the live corpus reproduces the frozen hash exactly', async () => {
    const { runCrystalStatisticsReport } = await import('@/services/research/crystalStatistics');
    const { buildFrozenCrystalManifest } = await import('@/services/research/crystalFrozenManifest');
    // The frozen artifact's contentHash IS the frozenHash a real operator would
    // have passed to freezeArtifact() at the moment of freeze — recompute it
    // here the same way, over the SAME (mocked) live corpus, to get a
    // genuinely matching hash rather than a hand-typed one.
    const stats = await runCrystalStatisticsReport({ experimentId: 'EXP-P1' });
    const manifest = await buildFrozenCrystalManifest({
      experimentId: 'EXP-P1',
      artifact: { id: 'EXP-P1/crystal-vP1', contentHash: stats.frozenHash, commitmentHash: stats.frozenHash, frozenAt: '2026-01-03T00:00:00.000Z', signedBy: ['operator-ref'], receiptId: 'receipt-freeze' },
    });
    expect(manifest.verifiedAgainstFreeze).toBe(true);
    expect(manifest.recomputedLiveHash).toBe(stats.frozenHash);
    expect(manifest.members).not.toBeNull();
    expect(manifest.members).toHaveLength(2);
    const byId = new Map(manifest.members!.map((m) => [m.id, m]));
    expect(byId.get('inv-001')?.statement).toBe(FIXTURE_INVARIANTS[0].statement);
    expect(byId.get('inv-002')?.supplementary.standing).toBe(0.9);
  });

  it('REFUSES to serve members as the frozen set when the live corpus has DRIFTED from the persisted hash — no silent substitution', async () => {
    const { buildFrozenCrystalManifest } = await import('@/services/research/crystalFrozenManifest');
    const manifest = await buildFrozenCrystalManifest({
      experimentId: 'EXP-P1',
      artifact: {
        id: 'EXP-P1/crystal-vP1',
        // A hash that does NOT match what the live (mocked) corpus produces —
        // simulating "the corpus moved since freeze".
        contentHash: 'a'.repeat(64),
        commitmentHash: 'a'.repeat(64),
        frozenAt: '2026-01-03T00:00:00.000Z',
        signedBy: ['operator-ref'],
        receiptId: 'receipt-freeze',
      },
    });
    expect(manifest.verifiedAgainstFreeze).toBe(false);
    expect(manifest.members).toBeNull();
    expect(manifest.intraCrystalEdges).toBeNull();
    expect(manifest.verificationDetail).toMatch(/does NOT reproduce the frozen contentHash/);
    // The live hash IS still reported, so a reader can see the two values
    // and judge the drift themselves rather than trusting a bare boolean.
    expect(manifest.recomputedLiveHash).not.toBe('');
    expect(manifest.recomputedLiveHash).not.toBe(manifest.frozenContentHash);
  });

  it('never exposes creatorAliasCommitment or any other identity-adjacent field not requested for review', async () => {
    const { runCrystalStatisticsReport } = await import('@/services/research/crystalStatistics');
    const { buildFrozenCrystalManifest } = await import('@/services/research/crystalFrozenManifest');
    const stats = await runCrystalStatisticsReport({ experimentId: 'EXP-P1' });
    const manifest = await buildFrozenCrystalManifest({
      experimentId: 'EXP-P1',
      artifact: { id: 'EXP-P1/crystal-vP1', contentHash: stats.frozenHash, commitmentHash: stats.frozenHash, frozenAt: '2026-01-03T00:00:00.000Z', signedBy: ['operator-ref'], receiptId: null },
    });
    const serialized = JSON.stringify(manifest.members);
    expect(serialized).not.toContain('creatorAliasCommitment');
    expect(serialized).not.toContain('commit-abc');
    expect(serialized).not.toContain('commit-def');
  });

  it('honestly discloses that freeze-ceremony fields (rationale, population, exclusions) were never persisted, rather than recomputing them as if they were', async () => {
    const { runCrystalStatisticsReport } = await import('@/services/research/crystalStatistics');
    const { buildFrozenCrystalManifest } = await import('@/services/research/crystalFrozenManifest');
    const stats = await runCrystalStatisticsReport({ experimentId: 'EXP-P1' });
    const manifest = await buildFrozenCrystalManifest({
      experimentId: 'EXP-P1',
      artifact: { id: 'EXP-P1/crystal-vP1', contentHash: stats.frozenHash, commitmentHash: stats.frozenHash, frozenAt: '2026-01-03T00:00:00.000Z', signedBy: ['operator-ref'], receiptId: null },
    });
    expect(manifest.freezeDisclosure.captured).toBe(false);
    expect(manifest.freezeDisclosure.reason).toMatch(/never persisted|not linked/i);
    expect(manifest.domainBoundary.length).toBeGreaterThan(0);
  });
});
