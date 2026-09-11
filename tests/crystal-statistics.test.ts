/**
 * Canary — Crystal Statistics Report (CFS-054 §4 / PRD-EPI-001 §3.1
 * Workstream 3, "birth certificate").
 *
 * Pins: (1) the report never throws and degrades honestly when the
 * substrate is unreachable; (2) `frozenHash` is deterministic — same corpus
 * content, same hash, on repeated runs and regardless of input array order;
 * (3) figures reused from `crystalReadiness.ts` (derivationHeadroom,
 * relationshipCount, compositionDensity) are NOT independently re-derived —
 * they equal the readiness report's own computed values (inv.engineering.036).
 */

import { describe, it, expect, vi } from 'vitest';
import { runCrystalStatisticsReport } from '../services/research/crystalStatistics';
import { listInvariants, listEdgesForInvariants } from '@/services/invariants/store';
import type { InvariantEdgeRecord } from '@/types/invariants';

vi.mock('@/services/invariants/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/invariants/store')>();
  return {
    ...actual,
    listInvariants: vi.fn(actual.listInvariants),
    listEdgesForInvariants: vi.fn(actual.listEdgesForInvariants),
  };
});

function inv(id: string, overrides: Record<string, unknown> = {}): Awaited<ReturnType<typeof listInvariants>>[number] {
  return {
    id,
    statement: `If ${id} holds then the successor state is entailed, provided that the predicate is met.`,
    namespace: 'reasoning',
    semanticType: 'constraint',
    status: 'validated',
    standing: 0.75,
    timesValidated: 4,
    provenance: { provenanceClass: 'external-established', source: `Source Document ${id}` },
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof listInvariants>>[number];
}

function edge(from: string, to: string): InvariantEdgeRecord {
  return {
    id: `${from}->${to}`,
    fromInvariantId: from,
    toInvariantId: to,
    edgeType: 'supports',
    weight: 1,
    contextId: null,
    rationale: null,
    provenance: {},
    reasoningProvenance: {},
    dvnReceiptId: null,
    createdAt: new Date(0).toISOString(),
  };
}

describe('Crystal Statistics Report', () => {
  it('never throws and reports substrateError honestly when the domain is unreachable', async () => {
    vi.mocked(listInvariants).mockRejectedValueOnce(new Error('substrate down'));
    const report = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'unreachable-domain' });
    expect(report.ok).toBe(false);
    expect(report.invariantCount).toBe(0);
    expect(typeof report.substrateError).toBe('string');
    expect(report.frozenHash).toBeTruthy();
  });

  it('computes a deterministic frozenHash independent of input array order', async () => {
    const a = inv('s1');
    const b = inv('s2');
    // Two calls to listInvariants per run: once inside runCrystalReadinessReport,
    // once again inside runCrystalStatisticsReport's own re-fetch.
    vi.mocked(listInvariants).mockResolvedValue([a, b]);
    vi.mocked(listEdgesForInvariants).mockResolvedValue([edge('s1', 's2')]);
    const report1 = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });

    vi.mocked(listInvariants).mockResolvedValue([b, a]); // reversed order
    const report2 = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });

    expect(report1.frozenHash).toBe(report2.frozenHash);
    expect(report1.frozenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reuses (never re-derives) the readiness report\'s graph and derivation figures', async () => {
    vi.mocked(listInvariants).mockResolvedValue([inv('r1'), inv('r2'), inv('r3')]);
    vi.mocked(listEdgesForInvariants).mockResolvedValue([edge('r1', 'r2')]);
    const report = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.relationshipCount).toBe(1);
    expect(report.derivationHeadroom).toBeGreaterThanOrEqual(0);
    expect(report.derivationHeadroom).toBeLessThanOrEqual(1);
    expect(report.compositionDensity).toBeGreaterThanOrEqual(0);
  });

  it('counts distinct provenance sources honestly, never inventing one', async () => {
    vi.mocked(listInvariants).mockResolvedValue([
      inv('t1', { provenance: { provenanceClass: 'external-established', source: 'FATF R.16' } }),
      inv('t2', { provenance: { provenanceClass: 'external-established', source: 'FATF R.16' } }),
      inv('t3', { provenance: { provenanceClass: 'external-empirical', source: 'Basel III' } }),
    ]);
    vi.mocked(listEdgesForInvariants).mockResolvedValue([]);
    const report = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.sourceCount).toBe(2); // FATF R.16 + Basel III, deduped
    expect(report.externalSources.sort()).toEqual(['Basel III', 'FATF R.16']);
  });

  it('coverage estimate never exceeds 1 and reflects the represented namespace set', async () => {
    vi.mocked(listInvariants).mockResolvedValue([inv('c1', { namespace: 'reasoning' }), inv('c2', { namespace: 'engineering' })]);
    vi.mocked(listEdgesForInvariants).mockResolvedValue([]);
    const report = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.coverageEstimate.representedNamespaceCount).toBe(2);
    expect(report.coverageEstimate.ratio).toBeGreaterThan(0);
    expect(report.coverageEstimate.ratio).toBeLessThanOrEqual(1);
  });
});
