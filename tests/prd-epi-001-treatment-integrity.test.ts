/**
 * Canary — PRD-EPI-001 §7 Treatment Integrity Check.
 *
 * A Treatment Integrity failure classifies as `implementation-failure`, never
 * `scientific-null` (§6) — this suite pins the six-check gate's pass/fail
 * boundary, especially that a silently-substituted fallback path fails
 * regardless of what every other field claims.
 */

import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { checkTreatmentIntegrity, type ExecutionTrace } from '../services/research/treatmentIntegrity';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function passingTrace(): ExecutionTrace {
  const renderedPrompt = 'grounded prompt text for task T-1';
  const armConfigHash = 'armconfig-hash-abc123';
  return {
    armId: 'B',
    taskId: 'T-1',
    candidateInvariantsConsidered: ['inv.reasoning.310', 'inv.reasoning.313'],
    selectedInvariantIds: ['inv.reasoning.310'],
    projectionNonEmpty: true,
    armConfigId: 'EXP-P1:arm-config:B:v1',
    armConfigHash,
    expectedArmConfigHash: armConfigHash,
    usedFallback: false,
    renderedPrompt,
    renderedPromptHash: sha256Hex(renderedPrompt),
  };
}

describe('PRD-EPI-001 §7 — Treatment Integrity Check', () => {
  it('a fully-passing trace returns ok: true, failures: []', () => {
    const result = checkTreatmentIntegrity(passingTrace());
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('usedFallback: true always fails, regardless of every other field passing', () => {
    const trace = { ...passingTrace(), usedFallback: true };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /fallback/i.test(f))).toBe(true);
  });

  it('an armConfigHash mismatch fails (check 4)', () => {
    const trace = { ...passingTrace(), armConfigHash: 'wrong-hash' };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /arm-config/i.test(f))).toBe(true);
  });

  it('a renderedPromptHash mismatch fails (check 6)', () => {
    const trace = { ...passingTrace(), renderedPromptHash: 'wrong-hash' };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /rendered prompt/i.test(f))).toBe(true);
  });

  it('empty candidateInvariantsConsidered without skippedSelection fails (check 1)', () => {
    const trace = { ...passingTrace(), candidateInvariantsConsidered: [] };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /resolution\/selection engine did not run/i.test(f))).toBe(true);
  });

  it('empty selectedInvariantIds fails (check 2)', () => {
    const trace = { ...passingTrace(), selectedInvariantIds: [] };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /candidate selection did not occur/i.test(f))).toBe(true);
  });

  it('projectionNonEmpty: false fails (check 3)', () => {
    const trace = { ...passingTrace(), projectionNonEmpty: false };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /projection was empty/i.test(f))).toBe(true);
  });

  it('skippedSelection: true fails even with non-empty candidate/selection arrays', () => {
    const trace = { ...passingTrace(), skippedSelection: true };
    const result = checkTreatmentIntegrity(trace);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /selection stage explicitly skipped/i.test(f))).toBe(true);
  });
});
