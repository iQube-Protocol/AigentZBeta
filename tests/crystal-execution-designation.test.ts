/**
 * Iterative Crystal versioning (2026-09-05, operator ruling): "Frozen
 * generations are immutable; Crystal lineages are evolutionary." A Crystal
 * freeze fixes ONE generation forever; it does not terminate the lineage.
 *
 * Before this change, `checkFreezeGate` treated every `scientific-readiness`
 * check as unconditionally freeze-gating, with no way to represent an
 * operator-authorized internal/pilot run against a generation with named,
 * measured deficiencies. These tests pin the new, narrow mechanism:
 *
 *   - a CONFIRMATORY freeze (the default, and everything that existed before
 *     this change) is byte-identical: the unconditional gate, no deviation
 *     ever accepted, regardless of whether one is supplied;
 *   - an INTERNAL-PILOT freeze may proceed despite failing scientific-
 *     readiness checks, but ONLY with an attributed, stated authorization
 *     that acknowledges EXACTLY the checks currently failing — no fewer
 *     (nothing failing may go unacknowledged), no more (nothing may be
 *     pre-authorized against a future, unmeasured failure);
 *   - nothing here ever marks a failing check `passed`, adjusts a threshold,
 *     or changes what a check measures — `readiness.ok` and every check's
 *     `passed` value are untouched by either designation;
 *   - the full readiness report, the exact hash pre-image, the authorization
 *     record and the designation are all persisted on the frozen artifact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListResearchObjects = vi.fn();
const mockUpsertResearchObject = vi.fn();
const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: (...args: unknown[]) => mockUpsertResearchObject(...args),
  writeLifecycleReceipt: (...args: unknown[]) => mockWriteLifecycleReceipt(...args),
}));

const mockRunCrystalReadinessReport = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  runCrystalReadinessReport: (...args: unknown[]) => mockRunCrystalReadinessReport(...args),
}));

const mockRunTaskCoverageReport = vi.fn();
vi.mock('@/services/research/taskCoverage', () => ({
  runTaskCoverageReport: (...args: unknown[]) => mockRunTaskCoverageReport(...args),
}));

import { checkFreezeGate, freezeArtifact } from '@/services/research/artifacts';

function crystalRow(overrides: Record<string, unknown> = {}) {
  return {
    objectKind: 'artifact' as const,
    objectId: 'EXP-P1/crystal-vP2',
    payload: {
      kind: 'crystal-version',
      experimentId: 'EXP-P1',
      contentHash: null,
      commitmentHash: null,
      frozenAt: null,
      signedBy: [],
      executionDesignation: null,
      freezeAuthorization: null,
      readinessSnapshot: null,
      memberSnapshot: null,
      ...overrides,
    },
    lifecycleState: 'validated',
    receiptId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function readinessReport(overrides: { failingNames?: string[] } = {}) {
  const failing = new Set(overrides.failingNames ?? ['derivation-headroom', 'boundary-coverage']);
  const allChecks = ['selection-space', 'derivation-headroom', 'duplicate-detection', 'boundary-coverage', 'provenance-eligibility'];
  return {
    scope: 'full',
    ok: failing.size === 0,
    checks: allChecks.map((name) => ({
      name,
      tier: 'scientific-readiness' as const,
      passed: !failing.has(name),
      detail: failing.has(name) ? `${name} measured failing` : `${name} measured passing`,
      remedy: failing.has(name) ? `fix ${name}` : null,
    })),
    invariantCount: 63,
  } as any;
}

const memberSnapshot = [{ id: 'inv-1', statement: 's', namespace: 'finance', semanticType: null, status: 'validated', evidenceProvenance: 'external-established', provenance: null }];

beforeEach(() => {
  mockListResearchObjects.mockReset();
  mockUpsertResearchObject.mockReset();
  mockUpsertResearchObject.mockResolvedValue({ ok: true });
  mockWriteLifecycleReceipt.mockReset();
  mockWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'receipt-1' });
  mockRunCrystalReadinessReport.mockReset();
  mockRunTaskCoverageReport.mockReset();
});

describe('checkFreezeGate — confirmatory (default) is byte-identical to pre-2026-09-05 behaviour', () => {
  it('refuses with the same message when a scientific-readiness check fails, deviationAuthorization or not', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());
    const artifact = { id: 'EXP-P1/crystal-vP2', kind: 'crystal-version', phase: 'protocol', experimentId: 'EXP-P1', lifecycle: 'validated', contentHash: 'h', commitmentHash: null, frozenAt: null, signedBy: ['op'], receiptId: null, executionDesignation: null, freezeAuthorization: null, readinessSnapshot: null, memberSnapshot: null } as any;
    const gate = await checkFreezeGate(artifact);
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/Crystal Intrinsic Readiness Report failed \(PRD-EPI-001 §3\.1\)/);
    expect(gate.error).toMatch(/derivation-headroom/);
    expect(gate.error).toMatch(/boundary-coverage/);
  });

  it('a confirmatory freeze that supplies a deviationAuthorization is refused outright, before readiness is even evaluated', async () => {
    const artifact = { id: 'EXP-P1/crystal-vP2', kind: 'crystal-version', phase: 'protocol', experimentId: 'EXP-P1', lifecycle: 'validated', contentHash: 'h', commitmentHash: null, frozenAt: null, signedBy: ['op'], receiptId: null, executionDesignation: null, freezeAuthorization: null, readinessSnapshot: null, memberSnapshot: null } as any;
    const gate = await checkFreezeGate(artifact, {
      executionDesignation: 'confirmatory',
      deviationAuthorization: { authorizedBy: 'op', statement: 'x', acknowledgedCheckNames: [] },
    });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/confirmatory freeze must never carry a deviationAuthorization/);
    expect(mockRunCrystalReadinessReport).not.toHaveBeenCalled();
  });

  it('passes when every scientific-readiness check passes — unchanged', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport({ failingNames: [] }));
    const artifact = { id: 'EXP-P1/crystal-vP2', kind: 'crystal-version', phase: 'protocol', experimentId: 'EXP-P1', lifecycle: 'validated', contentHash: 'h', commitmentHash: null, frozenAt: null, signedBy: ['op'], receiptId: null, executionDesignation: null, freezeAuthorization: null, readinessSnapshot: null, memberSnapshot: null } as any;
    const gate = await checkFreezeGate(artifact);
    expect(gate.ok).toBe(true);
    expect(gate.readiness?.ok).toBe(true);
  });
});

describe('checkFreezeGate — internal-pilot requires an exact, attributed acknowledgement', () => {
  const artifact = { id: 'EXP-P1/crystal-vP2', kind: 'crystal-version', phase: 'protocol', experimentId: 'EXP-P1', lifecycle: 'validated', contentHash: 'h', commitmentHash: null, frozenAt: null, signedBy: ['op'], receiptId: null, executionDesignation: null, freezeAuthorization: null, readinessSnapshot: null, memberSnapshot: null } as any;

  it('refuses without any deviationAuthorization at all', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());
    const gate = await checkFreezeGate(artifact, { executionDesignation: 'internal-pilot' });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/requires deviationAuthorization\.authorizedBy and \.statement/);
  });

  it('refuses an unattributed authorization (blank authorizedBy/statement)', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());
    const gate = await checkFreezeGate(artifact, {
      executionDesignation: 'internal-pilot',
      deviationAuthorization: { authorizedBy: '  ', statement: '', acknowledgedCheckNames: ['derivation-headroom', 'boundary-coverage'] },
    });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/requires deviationAuthorization\.authorizedBy and \.statement/);
  });

  it('refuses when a real failing check is left unacknowledged (under-naming)', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());
    const gate = await checkFreezeGate(artifact, {
      executionDesignation: 'internal-pilot',
      deviationAuthorization: { authorizedBy: 'op', statement: 'pilot run', acknowledgedCheckNames: ['derivation-headroom'] },
    });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/missing: boundary-coverage/);
  });

  it('refuses when a check that is NOT currently failing is named (over-claiming)', async () => {
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());
    const gate = await checkFreezeGate(artifact, {
      executionDesignation: 'internal-pilot',
      deviationAuthorization: {
        authorizedBy: 'op',
        statement: 'pilot run',
        acknowledgedCheckNames: ['derivation-headroom', 'boundary-coverage', 'selection-space'],
      },
    });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/not currently failing: selection-space/);
  });

  it('THE ACCEPTED CASE: exact-match acknowledgement proceeds despite readiness.ok === false, and readiness is unmodified', async () => {
    const report = readinessReport();
    mockRunCrystalReadinessReport.mockResolvedValue(report);
    const gate = await checkFreezeGate(artifact, {
      executionDesignation: 'internal-pilot',
      deviationAuthorization: {
        authorizedBy: 'op',
        statement: 'Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run.',
        acknowledgedCheckNames: ['derivation-headroom', 'boundary-coverage'],
      },
    });
    expect(gate.ok).toBe(true);
    // Never marked passed, never weakened — the SAME report object, unmutated.
    expect(gate.readiness?.ok).toBe(false);
    expect(gate.readiness?.checks.find((c: any) => c.name === 'derivation-headroom')?.passed).toBe(false);
    expect(gate.readiness?.checks.find((c: any) => c.name === 'boundary-coverage')?.passed).toBe(false);
  });

  it('an internal-pilot designation on a non-crystal-version artifact is refused', async () => {
    const nonCrystal = { ...artifact, kind: 'task-set' } as any;
    const gate = await checkFreezeGate(nonCrystal, { executionDesignation: 'internal-pilot' });
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/apply only to crystal-version artifacts/);
    expect(mockRunCrystalReadinessReport).not.toHaveBeenCalled();
  });
});

describe('freezeArtifact — persists the full snapshot on an accepted internal-pilot freeze', () => {
  it('requires memberSnapshot for a crystal-version freeze', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [crystalRow()] });
    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'h',
      signedBy: ['op'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/memberSnapshot is required/);
    expect(mockRunCrystalReadinessReport).not.toHaveBeenCalled();
  });

  it('persists executionDesignation, freezeAuthorization (with the exact deviations), readinessSnapshot and memberSnapshot', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [crystalRow()] });
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());

    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'h',
      signedBy: ['op-ref'],
      executionDesignation: 'internal-pilot',
      deviationAuthorization: {
        authorizedBy: 'op-ref',
        statement:
          'Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run. It ' +
          'contains 63 externally grounded, validated and distinct invariants and satisfies the registered ' +
          'selection-space requirement. Its measured limitations in derivational structure and declared-' +
          'boundary coverage are preserved as properties of this generation. Findings from the internal run ' +
          'may motivate corpus expansion in a successor Crystal generation; vP2 itself will remain immutable.',
        acknowledgedCheckNames: ['derivation-headroom', 'boundary-coverage'],
      },
      memberSnapshot,
    });

    expect(result.ok).toBe(true);
    expect(mockUpsertResearchObject).toHaveBeenCalledTimes(1);
    const persistedPayload = mockUpsertResearchObject.mock.calls[0][0].payload;
    expect(persistedPayload.executionDesignation).toBe('internal-pilot');
    expect(persistedPayload.freezeAuthorization.authorizedBy).toBe('op-ref');
    expect(persistedPayload.freezeAuthorization.executionDesignation).toBe('internal-pilot');
    expect(persistedPayload.freezeAuthorization.deviations.map((d: any) => d.checkName).sort()).toEqual([
      'boundary-coverage',
      'derivation-headroom',
    ]);
    // Every deviation carries the REAL measured detail, not a summary.
    expect(persistedPayload.freezeAuthorization.deviations.find((d: any) => d.checkName === 'derivation-headroom').measuredDetail).toMatch(/measured failing/);
    expect(persistedPayload.readinessSnapshot.ok).toBe(false);
    expect(persistedPayload.readinessSnapshot.checks.length).toBe(5);
    expect(persistedPayload.memberSnapshot).toEqual(memberSnapshot);
  });

  it('a confirmatory freeze persists executionDesignation and freezeAuthorization as null — unaffected by this scheme when unused', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [crystalRow()] });
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport({ failingNames: [] }));

    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'h',
      signedBy: ['op-ref'],
      memberSnapshot,
    });

    expect(result.ok).toBe(true);
    const persistedPayload = mockUpsertResearchObject.mock.calls[0][0].payload;
    expect(persistedPayload.executionDesignation).toBe('confirmatory');
    expect(persistedPayload.freezeAuthorization).toBeNull();
    expect(persistedPayload.readinessSnapshot.ok).toBe(true);
  });

  it('an internal-pilot freeze that fails checkFreezeGate (under-acknowledged) never writes anything', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [crystalRow()] });
    mockRunCrystalReadinessReport.mockResolvedValue(readinessReport());

    const result = await freezeArtifact({
      personaId: 'persona-1',
      id: 'EXP-P1/crystal-vP2',
      contentHash: 'h',
      signedBy: ['op-ref'],
      executionDesignation: 'internal-pilot',
      deviationAuthorization: { authorizedBy: 'op-ref', statement: 'x', acknowledgedCheckNames: ['derivation-headroom'] },
      memberSnapshot,
    });

    expect(result.ok).toBe(false);
    expect(mockUpsertResearchObject).not.toHaveBeenCalled();
    expect(mockWriteLifecycleReceipt).not.toHaveBeenCalled();
  });
});
