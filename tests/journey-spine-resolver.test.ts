/**
 * Journey Spine resolver — optional-prerequisite canary (JS-LAW-002).
 *
 * "A step may block another step only where the underlying constitutional,
 * operational, or evidentiary dependency genuinely requires it. Optional
 * agent delegation must not block direct human artifact upload merely
 * because the UI previously presented delegation first." Before the fix in
 * services/journey/resolveJourneyState.ts, `create-deposit`'s prerequisite
 * on `delegation-establish` required delegation-establish to reach COMPLETE
 * — impossible to skip, since skipping never produces the `delegation_active`
 * evidence the stage's own satisfactionCondition checks. This canary pins
 * the corrected behavior directly against Ian's real, shipped journey
 * definition — not a synthetic fixture — so a regression here is caught
 * against the actual production journey, not a stand-in.
 */

import { describe, it, expect } from 'vitest';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';

function baseAuthState(overrides: Partial<AuthoritativePlatformState['stages']> = {}): AuthoritativePlatformState {
  return {
    stages: {
      orient: { orientation_ritual_completed: true },
      passport: { passport_issued: true },
      'delegation-establish': {}, // never touched — Ian chose "continue myself"
      ...overrides,
    },
    receiptRefs: {},
  };
}

describe('resolveJourneyState — optional prerequisite never blocks (JS-LAW-002)', () => {
  it('create-deposit is READY even though its optional prerequisite delegation-establish has no evidence', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, baseAuthState());

    const delegation = state.stages.find((s) => s.stageId === 'delegation-establish');
    const createDeposit = state.stages.find((s) => s.stageId === 'create-deposit');

    expect(delegation?.state).not.toBe('COMPLETE');
    // The stage this pins: create-deposit must not read BLOCKED merely
    // because its optional prerequisite is unresolved.
    expect(createDeposit?.state).toBe('READY');
  });

  it('orient and passport are COMPLETE once their real evidence is present, and delegation-establish stays incomplete without fabricating it', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, baseAuthState());
    const orient = state.stages.find((s) => s.stageId === 'orient');
    const passport = state.stages.find((s) => s.stageId === 'passport');
    const delegation = state.stages.find((s) => s.stageId === 'delegation-establish');

    expect(orient?.state).toBe('COMPLETE');
    expect(passport?.state).toBe('COMPLETE');
    expect(delegation?.evidencePresent).toEqual([]);
  });

  it('a REQUIRED prerequisite still genuinely blocks — the fix is scoped to optional only', () => {
    // orient has no evidence -> passport (required prerequisite: orient) must be BLOCKED.
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, {
      stages: { orient: {}, passport: {}, 'delegation-establish': {} },
      receiptRefs: {},
    });
    const passport = state.stages.find((s) => s.stageId === 'passport');
    expect(passport?.state).toBe('BLOCKED');
  });

  it('delegating for real still lets create-deposit proceed (optional does not mean disabled)', () => {
    const state = resolveJourneyState(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      baseAuthState({ 'delegation-establish': { delegation_active: true } }),
    );
    const delegation = state.stages.find((s) => s.stageId === 'delegation-establish');
    const createDeposit = state.stages.find((s) => s.stageId === 'create-deposit');
    expect(delegation?.state).toBe('COMPLETE');
    expect(createDeposit?.state).toBe('READY');
  });
});
