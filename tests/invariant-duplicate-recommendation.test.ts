/**
 * services/research/invariantDuplicateRecommendation.ts — the Stage 9
 * duplicate-pair survivor resolver (operator ruling, 2026-08-27, "final
 * corrections" pass on the Crystal v2 duplicate-adjudication queue).
 *
 * Pure-function tests only: no DB, no route. `edgeCounts` is caller-supplied
 * so this resolver's behaviour is fully determined by its two arguments.
 */
import { describe, it, expect } from 'vitest';
import { recommendDuplicateSurvivor } from '@/services/research/invariantDuplicateRecommendation';
import type { InvariantRecord } from '@/types/invariants';

function makeInvariant(overrides: Partial<InvariantRecord> = {}): InvariantRecord {
  return {
    id: 'inv-a',
    seedId: null,
    statement: 'A statement.',
    namespace: 'reasoning',
    ontologyClassId: null,
    semanticType: 'principle',
    status: 'validated',
    confidence: 0.8,
    confidenceBasis: 'document_verified',
    standing: 0.5,
    reach: 0.4,
    timesValidated: 2,
    timesContradicted: 0,
    timesReferenced: 1,
    timesUsed: 1,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: {},
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const NO_EDGES = { a: 0, b: 0 };

describe('recommendDuplicateSurvivor — criterion 1: external-provenance-eligibility', () => {
  it('recommends the invariant with Population A provenance over one with none', () => {
    const a = makeInvariant({ id: 'inv-a', provenance: { provenanceClass: 'external-established' } });
    const b = makeInvariant({ id: 'inv-b', provenance: {} });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.otherId).toBe('inv-b');
    expect(rec.confidence).toBe('high');
    expect(rec.reasons).toHaveLength(1);
    expect(rec.reasons[0].criterion).toBe('external-provenance-eligibility');
  });

  it('does NOT distinguish two different provenance classes that are BOTH outside Population A — refuting a PROVENANCE_CLASSES strength ranking', () => {
    // platform-derived and platform-doctrine are both non-Population-A. If
    // PROVENANCE_CLASSES array order were (wrongly) treated as a strength
    // ranking, platform-derived (earlier in the array) would beat
    // platform-doctrine. The ratified vocabulary explicitly refuses that
    // ordering (platform-doctrine is "not a weaker form of evidence"), so
    // this criterion must fall through to the next one instead.
    const a = makeInvariant({ id: 'inv-a', provenance: { provenanceClass: 'platform-derived' }, standing: 0.9 });
    const b = makeInvariant({ id: 'inv-b', provenance: { provenanceClass: 'platform-doctrine' }, standing: 0.3 });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    // Falls through to standing (criterion 3, both statuses/lifecycle equal), not provenance.
    expect(rec.reasons[0].criterion).not.toBe('external-provenance-eligibility');
    expect(rec.recommendedId).toBe('inv-a'); // higher standing
    expect(rec.reasons[0].criterion).toBe('standing');
  });
});

describe('recommendDuplicateSurvivor — criterion 2: lifecycle-status', () => {
  it('recommends canonical over validated when provenance eligibility is tied', () => {
    const a = makeInvariant({ id: 'inv-a', status: 'canonical' });
    const b = makeInvariant({ id: 'inv-b', status: 'validated' });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.confidence).toBe('high');
    expect(rec.reasons[0].criterion).toBe('lifecycle-status');
  });
});

describe('recommendDuplicateSurvivor — criterion 3: standing', () => {
  it('recommends the higher standing when provenance and lifecycle status are tied', () => {
    const a = makeInvariant({ id: 'inv-a', standing: 0.9 });
    const b = makeInvariant({ id: 'inv-b', standing: 0.2 });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.confidence).toBe('medium');
    expect(rec.reasons[0].criterion).toBe('standing');
  });
});

describe('recommendDuplicateSurvivor — criterion 4: live-relationship-count', () => {
  it('recommends the invariant with more live edges when provenance/status/standing are tied', () => {
    const a = makeInvariant({ id: 'inv-a' });
    const b = makeInvariant({ id: 'inv-b' });
    const rec = recommendDuplicateSurvivor(a, b, { a: 5, b: 1 });
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.confidence).toBe('medium');
    expect(rec.reasons[0].criterion).toBe('live-relationship-count');
  });
});

describe('recommendDuplicateSurvivor — criterion 5: ratified-source', () => {
  it('recommends the invariant with a ratifiedSource when every earlier criterion is tied', () => {
    const a = makeInvariant({ id: 'inv-a', ratifiedSource: 'SPEC-AEE-001' });
    const b = makeInvariant({ id: 'inv-b', ratifiedSource: null });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.confidence).toBe('medium');
    expect(rec.reasons[0].criterion).toBe('ratified-source');
  });
});

describe('recommendDuplicateSurvivor — deterministic tiebreak', () => {
  it('recommends the lexically lower id at LOW confidence when every criterion ties, and says so', () => {
    const a = makeInvariant({ id: 'inv-a' });
    const b = makeInvariant({ id: 'inv-b' });
    const rec = recommendDuplicateSurvivor(a, b, NO_EDGES);
    expect(rec.recommendedId).toBe('inv-a');
    expect(rec.otherId).toBe('inv-b');
    expect(rec.confidence).toBe('low');
    expect(rec.reasons).toHaveLength(1);
    expect(rec.reasons[0].criterion).toBe('deterministic-tiebreak');
    expect(rec.reasons[0].detail).toMatch(/equivalent on every available criterion/);
    expect(rec.reasons[0].detail).not.toMatch(/hold-for-review/i);
  });

  it('is symmetric regardless of argument order (always the lexically lower id, never argument-position dependent)', () => {
    const a = makeInvariant({ id: 'inv-z' });
    const b = makeInvariant({ id: 'inv-a' });
    const rec1 = recommendDuplicateSurvivor(a, b, NO_EDGES);
    const rec2 = recommendDuplicateSurvivor(b, a, NO_EDGES);
    expect(rec1.recommendedId).toBe('inv-a');
    expect(rec2.recommendedId).toBe('inv-a');
  });
});

describe('recommendDuplicateSurvivor — determinism', () => {
  it('returns an identical recommendation for identical inputs, called repeatedly', () => {
    const a = makeInvariant({ id: 'inv-a', standing: 0.7 });
    const b = makeInvariant({ id: 'inv-b', standing: 0.4 });
    const first = recommendDuplicateSurvivor(a, b, { a: 2, b: 1 });
    const second = recommendDuplicateSurvivor(a, b, { a: 2, b: 1 });
    expect(second).toEqual(first);
  });
});
