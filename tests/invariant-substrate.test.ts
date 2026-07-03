/**
 * Invariant substrate — contract canaries (Chrysalis Foundation Phase 1).
 *
 * Mirrors the canary pattern of tests/access-spine.test.ts: these tests
 * pin the T0 non-serialization contract and the constitutional constants
 * so a refactor cannot silently widen the public surface.
 */

import { describe, expect, it } from 'vitest';
import {
  mapInvariantRow,
  mapContextRow,
  mapEdgeRow,
} from '@/services/invariants/store';
import {
  canonicalizeStatement,
  computeStandingScore,
} from '@/services/invariants/lifecycle';
import { normalizeStatement, similarity } from '@/services/invariants/comparison';
import {
  aggregateConfidence,
  aggregateStanding,
  checkCoherence,
} from '@/services/invariants/publish';
import type { InvariantEdgeRecord } from '@/types/invariants';
import {
  ACYCLIC_EDGE_TYPES,
  CONFIDENCE_BASIS_WEIGHT,
  INVARIANT_EDGE_TYPES,
  INVARIANT_NAMESPACES,
} from '@/types/invariants';

const FULL_ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  seed_id: 'inv.reasoning.001',
  statement: 'Reasoning discovers invariants.',
  namespace: 'reasoning',
  ontology_class_id: null,
  semantic_type: 'principle',
  status: 'proposed',
  confidence: '0.850',
  confidence_basis: 'principal_verified',
  standing: '12.5',
  times_validated: 1,
  times_contradicted: 0,
  times_referenced: 3,
  times_used: 7,
  version: 1,
  supersedes_id: null,
  ratified_source: null,
  provenance: { source: 'appendix-a' },
  reasoning_provenance: {},
  creator_persona_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', // T0 — must never surface
  creator_alias_commitment: 'abc123commitment',
  dvn_receipt_id: null,
  created_at: '2026-07-03T00:00:00Z',
  updated_at: '2026-07-03T00:00:00Z',
};

describe('T0 canary — creator_persona_id never serialises', () => {
  it('mapInvariantRow drops creator_persona_id entirely', () => {
    const record = mapInvariantRow(FULL_ROW);
    const json = JSON.stringify(record);
    expect(json).not.toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(json).not.toContain('personaId');
    expect(json).not.toContain('persona_id');
    expect(record.creatorAliasCommitment).toBe('abc123commitment'); // T2 stays
  });

  it('context and edge mappers expose no persona fields', () => {
    const ctx = mapContextRow({
      id: 'c1', invariant_id: 'i1', domain: 'governance', interpretation: null,
      applicability_conditions: null, retrieval_tags: ['governance'],
      created_at: '2026-07-03T00:00:00Z',
    });
    const edge = mapEdgeRow({
      id: 'e1', from_invariant_id: 'i1', to_invariant_id: 'i2', edge_type: 'supports',
      weight: '1.000', context_id: null, rationale: null, provenance: {},
      reasoning_provenance: {}, dvn_receipt_id: null, created_at: '2026-07-03T00:00:00Z',
    });
    expect(JSON.stringify(ctx)).not.toMatch(/persona/i);
    expect(JSON.stringify(edge)).not.toMatch(/persona/i);
  });
});

describe('constitutional constants (CFS-001/002/003)', () => {
  it('pins the twelve edge types', () => {
    expect(INVARIANT_EDGE_TYPES).toHaveLength(12);
    expect(INVARIANT_EDGE_TYPES).toContain('contradicts');
    expect(INVARIANT_EDGE_TYPES).toContain('composes');
  });

  it('pins the acyclic edge set', () => {
    expect([...ACYCLIC_EDGE_TYPES].sort()).toEqual(['depends_on', 'derives_from', 'supersedes']);
  });

  it('pins the five namespaces and the confidence ladder', () => {
    expect(INVARIANT_NAMESPACES).toHaveLength(5);
    expect(CONFIDENCE_BASIS_WEIGHT.document_verified).toBe(1.0);
    expect(CONFIDENCE_BASIS_WEIGHT.principal_verified).toBe(0.85);
    expect(CONFIDENCE_BASIS_WEIGHT.agent_verified).toBe(0.6);
    expect(CONFIDENCE_BASIS_WEIGHT.unknown).toBe(0.3);
  });
});

describe('canonicalization (CFS-003a §2.4)', () => {
  it('normalises to sentence form', () => {
    const { canonical, issues } = canonicalizeStatement('  reasoning discovers   invariants ');
    expect(canonical).toBe('Reasoning discovers invariants.');
    expect(issues).toHaveLength(0);
  });

  it('flags compound statements', () => {
    const { issues } = canonicalizeStatement('First sentence. Second sentence.');
    expect(issues.some((i) => i.includes('multiple sentences'))).toBe(true);
  });
});

describe('comparison (CFS-003a §2.3)', () => {
  it('detects exact duplicates through normalisation', () => {
    expect(similarity('Authority follows standing.', 'authority follows STANDING')).toBe(1);
    expect(normalizeStatement('Authority follows standing.')).toBe('authority follows standing');
  });

  it('scores related statements below exact', () => {
    const score = similarity('Authority follows standing.', 'Standing follows action.');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe('Invariant Standing (CFS-001 §6)', () => {
  it('is zero with no history', () => {
    expect(
      computeStandingScore({ timesValidated: 0, timesReferenced: 0, timesUsed: 0, timesContradicted: 0 }),
    ).toBe(0);
  });

  it('grows with validation/reference/use, saturating below 100', () => {
    const low = computeStandingScore({ timesValidated: 1, timesReferenced: 2, timesUsed: 5, timesContradicted: 0 });
    const high = computeStandingScore({ timesValidated: 100, timesReferenced: 421, timesUsed: 847, timesContradicted: 0 });
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it('contradictions depress standing but never below zero', () => {
    const clean = computeStandingScore({ timesValidated: 5, timesReferenced: 10, timesUsed: 20, timesContradicted: 0 });
    const contested = computeStandingScore({ timesValidated: 5, timesReferenced: 10, timesUsed: 20, timesContradicted: 3 });
    const buried = computeStandingScore({ timesValidated: 5, timesReferenced: 10, timesUsed: 20, timesContradicted: 50 });
    expect(contested).toBeLessThan(clean);
    expect(buried).toBeGreaterThanOrEqual(0);
  });
});

describe('InvariantQube composition (CFS-003 §5, CFS-004 §3)', () => {
  it('aggregate confidence is the weakest link', () => {
    expect(aggregateConfidence([0.9, 0.85, 0.6])).toBe(0.6);
    expect(aggregateConfidence([])).toBe(0);
    expect(aggregateConfidence([1.0])).toBe(1);
  });

  it('aggregate standing is the mean of member standings', () => {
    expect(aggregateStanding([90, 80, 70])).toBe(80);
    expect(aggregateStanding([])).toBe(0);
    expect(aggregateStanding([95.4])).toBe(95.4);
  });

  const edge = (from: string, to: string, edgeType: InvariantEdgeRecord['edgeType']): InvariantEdgeRecord => ({
    id: `${from}-${to}`, fromInvariantId: from, toInvariantId: to, edgeType,
    weight: 1, contextId: null, rationale: null, provenance: {}, reasoningProvenance: {},
    dvnReceiptId: null, createdAt: '2026-07-03T00:00:00Z',
  });

  it('a bundle is coherent when members do not contradict', () => {
    const result = checkCoherence(['a', 'b', 'c'], [edge('a', 'b', 'supports'), edge('b', 'c', 'depends_on')]);
    expect(result.coherent).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('a bundle is incoherent when two members contradict', () => {
    const result = checkCoherence(['a', 'b', 'c'], [edge('a', 'c', 'contradicts')]);
    expect(result.coherent).toBe(false);
    expect(result.conflicts).toEqual([{ fromInvariantId: 'a', toInvariantId: 'c' }]);
  });

  it('a contradicts edge to a non-member does not break coherence', () => {
    const result = checkCoherence(['a', 'b'], [edge('a', 'z', 'contradicts')]);
    expect(result.coherent).toBe(true);
  });
});
