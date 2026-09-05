/**
 * Canary — "Frozen generations are immutable; Crystal lineages are
 * evolutionary" (operator ruling, EXP-P1/crystal-vP2 internal-pilot
 * authorization; generalized Crystal-wide in types/research.ts's
 * ArtifactExecutionDesignation doc comment).
 *
 * Pins the exact distinction the ruling draws:
 *
 *   1. `executionDesignation` defaults to 'confirmatory' — every existing
 *      caller that never supplies it sees IDENTICAL behavior to before this
 *      change (readiness.ok required, unconditionally).
 *   2. Under 'internal-pilot', a freeze may proceed past FAILING
 *      scientific-readiness checks ONLY when every one of them is
 *      individually named in `scientificDeviations` — an unnamed failing
 *      check still blocks the freeze even in pilot mode.
 *   3. The persisted `readinessReportAtFreeze` and each `ScientificDeviation`
 *      always carry the REAL, server-computed measurement — never a
 *      caller-supplied value, and the readiness report's own `ok` is never
 *      flipped to `true` to "pass" a pilot freeze.
 *   4. `nextGovernedActionForFrozenCrystal` exposes "Run EXP-P1 internally"
 *      as available once frozen under 'internal-pilot' — and never claims to
 *      have executed anything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRunCrystalReadinessReport = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  runCrystalReadinessReport: (...args: unknown[]) => mockRunCrystalReadinessReport(...args),
}));

const mockListResearchObjects = vi.fn();
const mockUpsertResearchObject = vi.fn();
const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: (...args: unknown[]) => mockUpsertResearchObject(...args),
  writeLifecycleReceipt: (...args: unknown[]) => mockWriteLifecycleReceipt(...args),
}));

import {
  checkFreezeGate,
  freezeArtifact,
  nextGovernedActionForFrozenCrystal,
} from '@/services/research/artifacts';
import type { FrozenArtifact } from '@/types/research';

function baseArtifact(overrides: Partial<FrozenArtifact> = {}): FrozenArtifact {
  return {
    id: 'EXP-P1/crystal-vP2',
    kind: 'crystal-version',
    phase: 'protocol',
    experimentId: 'EXP-P1',
    lifecycle: 'validated',
    contentHash: 'hash-abc',
    commitmentHash: null,
    frozenAt: null,
    signedBy: ['operator-ref-1'],
    receiptId: null,
    ...overrides,
  };
}

function readinessWith(failingNames: string[]) {
  const names = ['selection-space', 'derivation-headroom', 'boundary-coverage', 'duplicate-detection'];
  const checks = names.map((name) => ({
    name,
    tier: 'scientific-readiness' as const,
    passed: !failingNames.includes(name),
    detail: failingNames.includes(name) ? `${name} MEASURED FAILURE detail` : `${name} ok`,
    remedy: failingNames.includes(name) ? `fix ${name}` : null,
  }));
  return {
    ok: failingNames.length === 0,
    scope: 'full' as const,
    checks,
    maturity: { checks: [], passedCount: 0, totalCount: 0, band: 'bronze' as const },
    invariantCount: 63,
    eligibleCount: 63,
    populations: { A: 63, B: 0, C: 0, unclassified: 0, ablationCount: 63 },
    derivationEligibleFraction: 0.3,
    duplicatePairCount: 0,
    duplicates: { lexicalPairCount: 0, semanticPairCount: 0, unionPairCount: 0, semanticOnlyPairCount: 0, distinctStatementEstimate: 63, semanticPairs: [] },
    inferentialCapacity: {} as any,
    coverage: { boundaryNamespaceCount: 15, representedNamespaceCount: 2, ratio: 2 / 15, representedNamespaces: [], missingNamespaces: [] },
    populationRequirement: {} as any,
    graph: { relationshipCount: 0, relationshipDensity: 0, componentCount: 1, largestComponentSize: 63, connectivityRatio: 1, orphanCount: 0, orphanFraction: 0 },
    excludedFromCrystal: null,
  };
}

beforeEach(() => {
  mockRunCrystalReadinessReport.mockReset();
  mockListResearchObjects.mockReset();
  mockUpsertResearchObject.mockReset();
  mockUpsertResearchObject.mockResolvedValue({ ok: true });
  mockWriteLifecycleReceipt.mockReset();
  mockWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'receipt-1' });
});

describe('checkFreezeGate — executionDesignation defaults to confirmatory (unaffected historical behavior)', () => {
  it('refuses a freeze with failing scientific-readiness checks when executionDesignation is omitted', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom', 'boundary-coverage']));
    const result = await checkFreezeGate(baseArtifact());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('derivation-headroom');
    expect(result.error).toContain('boundary-coverage');
    expect(result.readiness?.ok).toBe(false);
  });

  it('refuses identically when executionDesignation is explicitly confirmatory', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom']));
    const result = await checkFreezeGate(baseArtifact({ executionDesignation: 'confirmatory' }));
    expect(result.ok).toBe(false);
  });

  it('passes straight through when every scientific-readiness check passes', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith([]));
    const result = await checkFreezeGate(baseArtifact());
    expect(result.ok).toBe(true);
    expect(result.readiness?.ok).toBe(true);
  });
});

describe('checkFreezeGate — internal-pilot deviation mechanism', () => {
  it('refuses when a failing check is NOT named in scientificDeviations', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom', 'boundary-coverage']));
    const result = await checkFreezeGate(
      baseArtifact({
        executionDesignation: 'internal-pilot',
        scientificDeviations: [{ checkName: 'derivation-headroom', rationale: 'pilot only', measuredDetail: '' }],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boundary-coverage');
  });

  it('proceeds when EVERY failing check is individually named — but readiness.ok stays false (never laundered to passed)', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom', 'boundary-coverage']));
    const result = await checkFreezeGate(
      baseArtifact({
        executionDesignation: 'internal-pilot',
        scientificDeviations: [
          { checkName: 'derivation-headroom', rationale: 'pilot only', measuredDetail: '' },
          { checkName: 'boundary-coverage', rationale: 'pilot only', measuredDetail: '' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    // The measurement itself is never rewritten — this is the "recorded
    // exactly as observed" guarantee.
    expect(result.readiness?.ok).toBe(false);
    expect(result.readiness?.checks.find((c) => c.name === 'derivation-headroom')?.passed).toBe(false);
  });

  it('an internal-pilot designation with NO failing checks needs no deviations and behaves like confirmatory', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith([]));
    const result = await checkFreezeGate(baseArtifact({ executionDesignation: 'internal-pilot', scientificDeviations: [] }));
    expect(result.ok).toBe(true);
  });
});

describe('freezeArtifact — persists the exact measured limitations, never a caller-supplied detail', () => {
  function mockArtifactRow(overrides: Record<string, unknown> = {}) {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        {
          objectKind: 'artifact',
          objectId: 'EXP-P1/crystal-vP2',
          payload: {
            kind: 'crystal-version',
            phase: 'protocol',
            experimentId: 'EXP-P1',
            contentHash: null,
            commitmentHash: null,
            frozenAt: null,
            signedBy: [],
            ...overrides,
          },
          lifecycleState: 'validated',
          receiptId: null,
        },
      ],
    });
  }

  it('rejects internal-pilot with zero scientificDeviations up front', async () => {
    mockArtifactRow();
    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'hash-abc',
      signedBy: ['operator-ref-1'],
      executionDesignation: 'internal-pilot',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('scientificDeviations');
    expect(mockRunCrystalReadinessReport).not.toHaveBeenCalled();
  });

  it('rejects scientificDeviations supplied under the default confirmatory designation', async () => {
    mockArtifactRow();
    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'hash-abc',
      signedBy: ['operator-ref-1'],
      scientificDeviations: [{ checkName: 'derivation-headroom', rationale: 'x' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('internal-pilot');
  });

  it('freezes under internal-pilot with server-computed measuredDetail, and persists readinessReportAtFreeze + freezeRationale + executionDesignation', async () => {
    mockArtifactRow();
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom', 'boundary-coverage']));

    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'hash-abc',
      signedBy: ['operator-ref-1'],
      freezeRationale:
        'Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run.',
      executionDesignation: 'internal-pilot',
      scientificDeviations: [
        { checkName: 'derivation-headroom', rationale: 'authorized for pilot only' },
        { checkName: 'boundary-coverage', rationale: 'authorized for pilot only' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(mockUpsertResearchObject).toHaveBeenCalledTimes(1);
    const persistedPayload = mockUpsertResearchObject.mock.calls[0][0].payload;
    expect(persistedPayload.executionDesignation).toBe('internal-pilot');
    expect(persistedPayload.freezeRationale).toContain('internal EXP-P1 experimental run');
    // measuredDetail is the REAL check detail, never blank / caller-supplied.
    const persistedDeviations = persistedPayload.scientificDeviations as Array<{ checkName: string; measuredDetail: string; rationale: string }>;
    expect(persistedDeviations).toHaveLength(2);
    for (const d of persistedDeviations) {
      expect(d.measuredDetail).toContain('MEASURED FAILURE');
      expect(d.rationale).toBe('authorized for pilot only');
    }
    // The full readiness report is persisted verbatim, still reporting ok:false.
    expect(persistedPayload.readinessReportAtFreeze.ok).toBe(false);
    expect(mockUpsertResearchObject.mock.calls[0][0].lifecycleState).toBe('frozen');
  });

  it('refuses when a failing check is not covered — never reaches the write path', async () => {
    mockArtifactRow();
    mockRunCrystalReadinessReport.mockResolvedValue(readinessWith(['derivation-headroom', 'boundary-coverage']));
    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'hash-abc',
      signedBy: ['operator-ref-1'],
      executionDesignation: 'internal-pilot',
      scientificDeviations: [{ checkName: 'derivation-headroom', rationale: 'authorized' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boundary-coverage');
    expect(mockUpsertResearchObject).not.toHaveBeenCalled();
  });
});

describe('nextGovernedActionForFrozenCrystal — exposes, never executes', () => {
  it('returns null for a non-frozen or non-crystal-version artifact', () => {
    expect(nextGovernedActionForFrozenCrystal(baseArtifact({ lifecycle: 'validated' }))).toBeNull();
    expect(nextGovernedActionForFrozenCrystal(baseArtifact({ lifecycle: 'frozen', kind: 'task-set' }))).toBeNull();
  });

  it('exposes an internal-pilot next act naming the acknowledged deviations, executed: false', () => {
    const action = nextGovernedActionForFrozenCrystal(
      baseArtifact({
        lifecycle: 'frozen',
        executionDesignation: 'internal-pilot',
        scientificDeviations: [
          { checkName: 'derivation-headroom', measuredDetail: 'x', rationale: 'y' },
          { checkName: 'boundary-coverage', measuredDetail: 'x', rationale: 'y' },
        ],
      }),
    );
    expect(action).not.toBeNull();
    expect(action?.executed).toBe(false);
    expect(action?.label).toContain('internal');
    expect(action?.detail).toContain('derivation-headroom');
    expect(action?.detail).toContain('boundary-coverage');
    expect(action?.detail).toContain('never mutated');
  });

  it('exposes a confirmatory next act for a fully-ready frozen crystal', () => {
    const action = nextGovernedActionForFrozenCrystal(
      baseArtifact({ lifecycle: 'frozen', executionDesignation: 'confirmatory' }),
    );
    expect(action).not.toBeNull();
    expect(action?.executed).toBe(false);
    expect(action?.label).toContain('confirmatory');
  });
});
