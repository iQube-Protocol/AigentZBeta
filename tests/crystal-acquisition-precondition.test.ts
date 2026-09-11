/**
 * services/research/crystalAcquisitionPrecondition.ts — the bounded,
 * authoritative precondition composition for Track 2's targeted-acquisition
 * approval (2026-08-31, "Research Copilot targeted-acquisition approval
 * timeout" repair). Mirrors researchProgrammeOrchestrator.ts's own hard-
 * backstop test pattern: a real short wall-clock delay racing a tiny
 * injected deadline, no fake timers needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockRunCrystalReadinessReport = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  runCrystalReadinessReport: (...args: any[]) => mockRunCrystalReadinessReport(...args),
}));

const mockCurrentCrystalArtifactId = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  currentCrystalArtifactId: (...args: any[]) => mockCurrentCrystalArtifactId(...args),
}));

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
}));

import { composeAcquisitionPreconditions } from '@/services/research/crystalAcquisitionPrecondition';

const readiness = () => ({ scope: 'acquisition-gate', invariantCount: 11, checks: [] }) as any;

beforeEach(() => {
  mockRunCrystalReadinessReport.mockReset();
  mockRunCrystalReadinessReport.mockResolvedValue(readiness());
  mockCurrentCrystalArtifactId.mockReset();
  mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-v2');
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([]);
});

describe('composeAcquisitionPreconditions — the bounded projection', () => {
  it('calls runCrystalReadinessReport with scope: acquisition-gate, never full', async () => {
    await composeAcquisitionPreconditions({ experimentId: 'EXP-P1', crystalDomain: 'financial-risk-value-systems' });
    expect(mockRunCrystalReadinessReport).toHaveBeenCalledWith(
      expect.objectContaining({ experimentId: 'EXP-P1', crystalDomain: 'financial-risk-value-systems', scope: 'acquisition-gate' }),
    );
  });

  it('successful bounded confirmation — resolves ok:true with report/crystalGeneration/admitted well within the deadline', async () => {
    const result = await composeAcquisitionPreconditions({ experimentId: 'EXP-P1', crystalDomain: 'financial-risk-value-systems' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.report.invariantCount).toBe(11);
    expect(result.crystalGeneration).toBe('EXP-P1/crystal-v2');
    expect(result.admitted).toEqual([]);
  });
});

describe('composeAcquisitionPreconditions — timeout / fail-closed', () => {
  it('a composition that exceeds its deadline resolves ok:false, reason:timeout — never nothing, never a throw', async () => {
    // A pathologically slow readiness read, real wall-clock delay well past
    // a deliberately tiny deadline — proves the race itself.
    mockRunCrystalReadinessReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(readiness()), 50)),
    );
    const result = await composeAcquisitionPreconditions({
      experimentId: 'EXP-P1',
      crystalDomain: 'financial-risk-value-systems',
      stateCompositionDeadlineMs: 5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('timeout');
    expect(result.deadlineMs).toBe(5);
  });

  it('the deadline cannot be widened by a caller past STATE_COMPOSITION_DEADLINE_MS', async () => {
    const src = readFileSync(
      join(process.cwd(), 'services/research/crystalAcquisitionPrecondition.ts'),
      'utf-8',
    );
    expect(src).toMatch(/Math\.min\(input\.stateCompositionDeadlineMs \?\? STATE_COMPOSITION_DEADLINE_MS, STATE_COMPOSITION_DEADLINE_MS\)/);
  });

  it('reuses the SAME canonical STATE_COMPOSITION_DEADLINE_MS the orchestrator races against — never a second, independently-set timeout constant', async () => {
    const { STATE_COMPOSITION_DEADLINE_MS } = await import('@/services/research/researchProgrammeOrchestrator');
    expect(STATE_COMPOSITION_DEADLINE_MS).toBe(15_000);
    const src = readFileSync(
      join(process.cwd(), 'services/research/crystalAcquisitionPrecondition.ts'),
      'utf-8',
    );
    expect(src).toMatch(/from '@\/services\/research\/researchProgrammeOrchestrator'/);
  });
});
