/**
 * services/journey/constitutionalInternetBridgeJourney.ts — resolveJourneyState
 * over the CI Bridge's 3-stage ladder (passport → act → stand).
 *
 * Mirrors the shape of tests/validation-programme-journey.test.ts: pure,
 * no I/O, exercises resolveJourneyState directly against hand-built
 * AuthoritativePlatformState fixtures.
 */

import { describe, it, expect } from 'vitest';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';

function stateFor(overrides: Partial<{
  personaAuthenticated: boolean;
  dispositionRecorded: boolean;
  constitutionalEventRecorded: boolean;
}>): AuthoritativePlatformState {
  return {
    stages: {
      passport: { personaAuthenticated: overrides.personaAuthenticated ?? false },
      act: { dispositionRecorded: overrides.dispositionRecorded ?? false },
      stand: { constitutionalEventRecorded: overrides.constitutionalEventRecorded ?? false },
    },
  };
}

describe('CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY', () => {
  it('has exactly three stages, in order: passport, act, stand', () => {
    expect(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.map((s) => s.id)).toEqual(['passport', 'act', 'stand']);
  });

  it('brand-new signed-out visitor: passport is the current, not-yet-complete stage', () => {
    const result = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, stateFor({}));
    const passport = result.stages.find((s) => s.stageId === 'passport');
    expect(passport?.state).not.toBe('COMPLETE');
    expect(result.currentStageId).toBe('passport');
  });

  it('passport crossed but no disposition yet: act is current, not gated by fabricated evidence', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ personaAuthenticated: true }),
    );
    const passport = result.stages.find((s) => s.stageId === 'passport');
    const act = result.stages.find((s) => s.stageId === 'act');
    expect(passport?.state).toBe('COMPLETE');
    expect(act?.state).not.toBe('COMPLETE');
    expect(result.currentStageId).toBe('act');
  });

  it('disposition recorded but no constitutional event yet: stand is current', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ personaAuthenticated: true, dispositionRecorded: true }),
    );
    const act = result.stages.find((s) => s.stageId === 'act');
    const stand = result.stages.find((s) => s.stageId === 'stand');
    expect(act?.state).toBe('COMPLETE');
    expect(stand?.state).not.toBe('COMPLETE');
    expect(result.currentStageId).toBe('stand');
  });

  it('all three real facts true: every stage COMPLETE', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ personaAuthenticated: true, dispositionRecorded: true, constitutionalEventRecorded: true }),
    );
    for (const stage of result.stages) {
      expect(stage.state).toBe('COMPLETE');
    }
  });
});
