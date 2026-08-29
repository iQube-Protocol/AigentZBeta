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

describe('resolveJourneyState — currentStageId fallback skips a skipped OPTIONAL stage (JS-LAW-002, OCSGA Bridge projection fix 2026-08-29)', () => {
  /*
   * OCSGA Bridge live defect: Ian deposited his artifact (create-deposit
   * COMPLETE) but never delegated (delegation-establish stays READY/never
   * COMPLETE, by design — it is optional). The naive "first stage that isn't
   * COMPLETE" fallback picked delegation-establish purely because it sits
   * earlier in stage array order than the real current stage
   * (freeze-attestation-ready) — even though the resolver's own
   * prerequisites/priorStagesAllComplete logic already treats that same
   * optional stage as non-blocking. /bridge/ocsga rendered the generic
   * BoundedDelegationTab shell instead of Ian's Reciprocal Artifact Exchange
   * workspace as a direct consequence.
   */
  it('currentStageId is the first REQUIRED incomplete stage, never a skipped optional one that merely sits earlier in array order', () => {
    const state = resolveJourneyState(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      baseAuthState({
        'create-deposit': { iqube_created: true, content_deposited: true },
        'freeze-attestation-ready': {}, // not yet acknowledged — the real current stage
      }),
    );
    const delegation = state.stages.find((s) => s.stageId === 'delegation-establish');
    const createDeposit = state.stages.find((s) => s.stageId === 'create-deposit');
    expect(delegation?.state).not.toBe('COMPLETE');
    expect(createDeposit?.state).toBe('COMPLETE');
    expect(state.currentStageId).toBe('freeze-attestation-ready');
    expect(state.currentStageId).not.toBe('delegation-establish');
  });

  it('once freeze-attestation-ready is genuinely satisfied, currentStageId advances to freeze-attestation — still never delegation-establish', () => {
    const state = resolveJourneyState(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      baseAuthState({
        'create-deposit': { iqube_created: true, content_deposited: true },
        'freeze-attestation-ready': { attestation_ready_acknowledged: true },
      }),
    );
    expect(state.currentStageId).toBe('freeze-attestation');
  });

  it('with no deposit evidence at all, currentStageId is create-deposit itself — never delegation-establish, its skipped optional prerequisite', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, baseAuthState());
    expect(state.currentStageId).toBe('create-deposit');
  });
});
