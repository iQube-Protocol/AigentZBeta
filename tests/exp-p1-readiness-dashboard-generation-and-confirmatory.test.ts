/**
 * Canary — two defects in `services/research/readinessDashboard.ts`'s
 * Crystal + Execution sections, both surfaced by the 2026-09-07 two-mode
 * execution model work:
 *
 *   1. The Crystal section's green-branch detail hardcoded the literal string
 *      'Crystal vP1 snapshot is frozen + hash-committed.' regardless of which
 *      generation was actually frozen — stale the moment vP2 froze (operator
 *      report: "the deployed UI... references frozen Crystal vP1").
 *   2. The Execution section flipped green the moment ANY `execution-run`
 *      artifact existed (`listArtifacts` + `kind === 'execution-run'`),
 *      including an `internal-rehearsal` run — which must NEVER read as "the
 *      confirmatory execution has occurred" (operator ruling: "Confirmatory
 *      result queries must exclude rehearsal runs by construction").
 */
import { describe, it, expect, vi } from 'vitest';

const mockListResearchObjects = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: vi.fn(),
  writeLifecycleReceipt: vi.fn(),
  deriveOverview: async () => [],
}));

import { buildReadinessDashboard } from '@/services/research/readinessDashboard';

function frozenCrystalRow(generation: number, executionDesignation: string) {
  return {
    objectKind: 'artifact',
    objectId: `EXP-P1/crystal-vP${generation}`,
    payload: {
      kind: 'crystal-version',
      phase: 'protocol',
      experimentId: 'EXP-P1',
      contentHash: 'hash-abc',
      commitmentHash: 'hash-abc',
      frozenAt: '2026-09-06T00:00:00.000Z',
      signedBy: ['operator-ref-1'],
      executionDesignation,
    },
    lifecycleState: 'frozen',
    receiptId: 'receipt-1',
  };
}

function executionRunRow(designation: 'internal-rehearsal' | 'confirmatory', confirmatoryEligible: boolean) {
  return {
    objectKind: 'artifact',
    objectId: `EXP-P1/execution-run/${designation}/2026-09-07T00:00:00.000Z`,
    payload: {
      kind: 'execution-run',
      phase: 'execution',
      experimentId: 'EXP-P1',
      contentHash: null,
      commitmentHash: null,
      frozenAt: '2026-09-07T00:00:00.000Z',
      signedBy: [],
      runExecutionDesignation: designation,
      frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
      frozenCrystalContentHash: 'hash-abc',
      taskSetId: 'EXP-P1/rehearsal-task-set-provisional-v1',
      taskSetProvenance: 'provisional',
      armIds: ['A', 'B', 'C', 'D'],
      providerModel: 'deterministic-retrieval-v1',
      confirmatoryEligible,
      taskResults: [],
    },
    lifecycleState: 'executed',
    receiptId: 'receipt-2',
  };
}

describe('readinessDashboard — Crystal section names the ACTUAL frozen generation, never a hardcoded vP1', () => {
  it('names vP2 when vP2 is the frozen generation', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [frozenCrystalRow(2, 'internal-pilot')] });
    const d = await buildReadinessDashboard('EXP-P1');
    const crystal = d.sections.find((s) => s.section === 'Crystal');
    expect(crystal?.status).toBe('green');
    expect(crystal?.detail).toContain('vP2');
    expect(crystal?.detail).not.toContain('vP1');
    expect(crystal?.detail).toContain('internal-pilot');
  });
});

describe('readinessDashboard — Execution section excludes internal-rehearsal runs by construction', () => {
  it('stays RED when only an internal-rehearsal execution-run exists', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [frozenCrystalRow(2, 'internal-pilot'), executionRunRow('internal-rehearsal', false)],
    });
    const d = await buildReadinessDashboard('EXP-P1');
    const execution = d.sections.find((s) => s.section === 'Execution');
    expect(execution?.status).toBe('red');
    expect(execution?.detail).toContain('internal-rehearsal');
    expect(execution?.detail).toContain('NON-CONFIRMATORY');
  });

  it('goes GREEN only once a confirmatoryEligible execution-run exists', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        frozenCrystalRow(2, 'internal-pilot'),
        executionRunRow('internal-rehearsal', false),
        executionRunRow('confirmatory', true),
      ],
    });
    const d = await buildReadinessDashboard('EXP-P1');
    const execution = d.sections.find((s) => s.section === 'Execution');
    expect(execution?.status).toBe('green');
    expect(execution?.detail).toContain('1 confirmatory execution run');
  });
});
