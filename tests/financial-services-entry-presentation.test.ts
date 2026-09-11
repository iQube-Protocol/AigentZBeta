/**
 * financialServicesEntryPresentation.ts — the Bridge CHOOSE CTA refinement
 * (2026-09-01). "The destination remains stable; the invitation adapts":
 * one shared, evidence-derived rule for the Financial Services entry card's
 * label/intent on both KNYTS and CI, replacing the old "Apply to join the
 * Constitutional Financial Services Pilot" / "Join Financial Services"
 * application-framing.
 */
import { describe, it, expect } from 'vitest';
import { resolveFinancialServicesEntryPresentation } from '@/services/journey/financialServicesEntryPresentation';
import type { JourneyRuntimeState, JourneyStageRuntimeState } from '@/types/journey';

function stageState(stageId: string, state: JourneyStageRuntimeState['state']): JourneyStageRuntimeState {
  return { stageId, state, evidencePresent: [], evidenceMissing: [], receiptRefs: [] };
}

function runtimeStateWith(stages: JourneyStageRuntimeState[]): JourneyRuntimeState {
  return {
    journeyId: 'test-journey',
    journeyVersion: '1.0.0',
    subjectRef: 'visitor',
    currentStageId: 'choose',
    stages,
    complete: false,
  };
}

describe('resolveFinancialServicesEntryPresentation', () => {
  it('no runtime state at all (not yet loaded / signed-out visitor) resolves to the first-time presentation', () => {
    expect(resolveFinancialServicesEntryPresentation(undefined)).toEqual({
      label: 'Learn about Constitutional Financial Services',
      intent: 'LEARN_FINANCIAL_SERVICES',
    });
    expect(resolveFinancialServicesEntryPresentation(null)).toEqual({
      label: 'Learn about Constitutional Financial Services',
      intent: 'LEARN_FINANCIAL_SERVICES',
    });
  });

  it('runtime state with no FS stage evidence at all resolves to the first-time presentation', () => {
    const state = runtimeStateWith([stageState('choose', 'READY')]);
    expect(resolveFinancialServicesEntryPresentation(state).label).toBe('Learn about Constitutional Financial Services');
    expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('LEARN_FINANCIAL_SERVICES');
  });

  it('fs-discover NOT_STARTED/READY (not COMPLETE) still resolves to the first-time presentation — merely reachable is not "meaningfully engaged"', () => {
    for (const s of ['NOT_STARTED', 'READY', 'BLOCKED'] as const) {
      const state = runtimeStateWith([stageState('fs-discover', s)]);
      expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('LEARN_FINANCIAL_SERVICES');
    }
  });

  it('fs-discover COMPLETE resolves to the returning presentation', () => {
    const state = runtimeStateWith([stageState('fs-discover', 'COMPLETE')]);
    expect(resolveFinancialServicesEntryPresentation(state)).toEqual({
      label: 'Constitutional Financial Services',
      intent: 'JOIN_FINANCIAL_SERVICES',
    });
  });

  it('fs-learn COMPLETE alone (without fs-discover present in state) still resolves to the returning presentation — any of the three qualifying stages is sufficient', () => {
    const state = runtimeStateWith([stageState('fs-learn', 'COMPLETE')]);
    expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('JOIN_FINANCIAL_SERVICES');
  });

  it('fs-explore COMPLETE alone resolves to the returning presentation', () => {
    const state = runtimeStateWith([stageState('fs-explore', 'COMPLETE')]);
    expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('JOIN_FINANCIAL_SERVICES');
  });

  it('fs-prepare/fs-cross COMPLETE alone (gate-less stages, no real evidence yet) does NOT qualify — never a false "returning" read from stages with no completionEvidence', () => {
    const state = runtimeStateWith([stageState('fs-prepare', 'COMPLETE'), stageState('fs-cross', 'COMPLETE')]);
    expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('LEARN_FINANCIAL_SERVICES');
  });

  it('an unrelated stage (e.g. passport) being COMPLETE never qualifies as FS engagement — Passport/Standing/persona existence must never gate this', () => {
    const state = runtimeStateWith([stageState('passport', 'COMPLETE'), stageState('stand', 'COMPLETE')]);
    expect(resolveFinancialServicesEntryPresentation(state).intent).toBe('LEARN_FINANCIAL_SERVICES');
  });
});
