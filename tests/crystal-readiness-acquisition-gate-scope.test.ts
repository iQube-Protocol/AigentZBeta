/**
 * runCrystalReadinessReport({ scope: 'acquisition-gate' }) — the bounded
 * acquisition-precondition projection (2026-08-31, "targeted-acquisition
 * approval timeout" repair). Confirms it skips exactly the two expensive
 * computations acquisitionBriefApplies/buildCrystalAcquisitionBrief never
 * read (the intra-crystal edge fetch + three graph checks, and duplicate-
 * detection's O(n²) lexical/semantic passes), while computing every field
 * those two functions DO read identically to 'full' scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crystalReadiness from '@/services/research/crystalReadiness';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import * as invariantStore from '@/services/invariants/store';
import * as semanticStructure from '@/services/research/crystalSemanticStructure';
import type { InvariantRecord } from '@/types/invariants';

function invariant(id: string, overrides: Partial<InvariantRecord> = {}): InvariantRecord {
  return {
    id,
    seedId: null,
    statement: `Statement ${id}.`,
    namespace: 'constitutional',
    ontologyClassId: null,
    semanticType: 'principle',
    status: 'canonical',
    confidence: 0.9,
    confidenceBasis: 'document_verified',
    standing: 50,
    reach: 0,
    timesValidated: 1,
    timesContradicted: 0,
    timesReferenced: 0,
    timesUsed: 0,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: {},
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

const CORPUS = Array.from({ length: 12 }, (_, i) => invariant(`inv-${i}`));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('acquisition-gate scope — skips the two expensive, brief-irrelevant computations', () => {
  it('never fetches intra-crystal edges (I/O skipped)', async () => {
    const spy = vi.spyOn(invariantStore, 'listEdgesForInvariants');
    await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('full scope DOES fetch intra-crystal edges — proves the gate scope is a genuine skip, not a pre-existing no-op', async () => {
    const spy = vi.spyOn(invariantStore, 'listEdgesForInvariants').mockResolvedValue([]);
    await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });
    expect(spy).toHaveBeenCalled();
  });

  it('never runs the O(n²) semantic duplicate-detection pass', async () => {
    const spy = vi.spyOn(semanticStructure, 'findSemanticDuplicatePairs');
    await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('full scope DOES run the semantic duplicate-detection pass', async () => {
    const spy = vi.spyOn(semanticStructure, 'findSemanticDuplicatePairs');
    await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });
    expect(spy).toHaveBeenCalled();
  });

  it('never pushes duplicate-detection, relationship-density, graph-connectivity, or orphan-detection checks', async () => {
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const names = report.checks.map((c) => c.name);
    expect(names).not.toContain('duplicate-detection');
    expect(names).not.toContain('relationship-density');
    expect(names).not.toContain('graph-connectivity');
    expect(names).not.toContain('orphan-detection');
  });

  it('STILL pushes the three checks acquisitionBriefApplies/buildCrystalAcquisitionBrief actually read', async () => {
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const names = report.checks.map((c) => c.name);
    expect(names).toContain('selection-space');
    expect(names).toContain('derivation-headroom');
    expect(names).toContain('boundary-coverage');
  });

  it('report.scope names the projection — never mistakable for the full picture', async () => {
    const gated = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const full = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });
    expect(gated.scope).toBe('acquisition-gate');
    expect(full.scope).toBe('full');
  });

  it('duplicates/duplicatePairCount/graph are honest zero placeholders, never a guessed or partial value', async () => {
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    expect(report.duplicatePairCount).toBe(0);
    expect(report.duplicates).toEqual({
      lexicalPairCount: 0,
      semanticPairCount: 0,
      unionPairCount: 0,
      semanticOnlyPairCount: 0,
      distinctStatementEstimate: 0,
      semanticPairs: [],
    });
    expect(report.graph).toEqual({
      relationshipCount: 0,
      relationshipDensity: 0,
      componentCount: 0,
      largestComponentSize: 0,
      connectivityRatio: 0,
      orphanCount: 0,
      orphanFraction: 0,
    });
  });

  it('defaults to full scope when omitted — every existing caller is completely unaffected', async () => {
    const spy = vi.spyOn(invariantStore, 'listEdgesForInvariants').mockResolvedValue([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS });
    expect(report.scope).toBe('full');
    expect(spy).toHaveBeenCalled();
  });
});

describe('acquisition-gate scope — identical brief-relevant facts to full scope, same corpus', () => {
  it('selection-space, derivation-headroom, and boundary-coverage report the SAME passed/detail/remedy in both scopes', async () => {
    const gated = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const full = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });
    for (const name of ['selection-space', 'derivation-headroom', 'boundary-coverage']) {
      const g = gated.checks.find((c) => c.name === name);
      const f = full.checks.find((c) => c.name === name);
      expect(g).toBeTruthy();
      expect(f).toBeTruthy();
      expect(g).toEqual(f);
    }
  });

  it('invariantCount, populationRequirement, inferentialCapacity, and coverage — every field buildCrystalAcquisitionBrief reads — are identical', async () => {
    const gated = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const full = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });
    expect(gated.invariantCount).toBe(full.invariantCount);
    expect(gated.populationRequirement).toEqual(full.populationRequirement);
    expect(gated.inferentialCapacity).toEqual(full.inferentialCapacity);
    expect(gated.coverage).toEqual(full.coverage);
  });

  it('acquisitionBriefApplies and buildCrystalAcquisitionBrief produce the SAME verdict/brief from either scope\'s report', async () => {
    const { acquisitionBriefApplies, buildCrystalAcquisitionBrief } = await import('@/services/research/crystalAcquisitionBrief');
    const { crystalDomainForExperiment } = await import('@/services/research/crystalDomains');
    const declaration = crystalDomainForExperiment('EXP-P1');
    if (!declaration) throw new Error('EXP-P1 must have a declared crystal domain for this test to be meaningful');

    const gated = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'acquisition-gate' });
    const full = await runCrystalReadinessReport({ experimentId: 'EXP-P1', invariants: CORPUS, scope: 'full' });

    expect(acquisitionBriefApplies(gated)).toBe(acquisitionBriefApplies(full));

    const briefFromGated = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1', crystalGeneration: 'gen-1', domain: declaration, report: gated, admittedInvariantIds: [],
      now: () => new Date('2026-08-31T00:00:00Z'),
    });
    const briefFromFull = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1', crystalGeneration: 'gen-1', domain: declaration, report: full, admittedInvariantIds: [],
      now: () => new Date('2026-08-31T00:00:00Z'),
    });
    expect(briefFromGated).toEqual(briefFromFull);
  });
});
