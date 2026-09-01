/**
 * services/journey/constitutionalInternetBridgeJourney.ts — resolveJourneyState
 * over the CI Bridge's 7-node Posit Spine (home/view/orient/passport/act/
 * stand/choose), reconstituted onto the same architecture as KNYTS Bridge
 * (services/journey/knytsBridgeCrossingJourney.ts): four open narrative
 * nodes with no completion evidence, three tracked/evidenced stages.
 *
 * Mirrors the shape of tests/validation-programme-journey.test.ts: pure,
 * no I/O, exercises resolveJourneyState directly against hand-built
 * AuthoritativePlatformState fixtures.
 */

import { describe, it, expect } from 'vitest';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';

const OPEN_NARRATIVE_STAGES = ['home', 'view', 'orient', 'choose', 'fs-discover', 'fs-learn', 'fs-explore', 'fs-prepare', 'fs-cross'];
const TRACKED_STAGES = ['passport', 'personify', 'stand'];

function stateFor(overrides: Partial<{
  citizenPassportUsable: boolean;
  agentRelationshipStarted: boolean;
  constitutionalEventRecorded: boolean;
}>): AuthoritativePlatformState {
  return {
    stages: {
      passport: { citizenPassportUsable: overrides.citizenPassportUsable ?? false },
      personify: { agentRelationshipStarted: overrides.agentRelationshipStarted ?? false },
      stand: { constitutionalEventRecorded: overrides.constitutionalEventRecorded ?? false },
    },
  };
}

describe('CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY — twelve real spine nodes (seven original + AEE-XP-001 Financial Sovereignty segment)', () => {
  it('has exactly twelve stages, in the public order: home, view, orient, passport, personify, stand, choose, fs-discover..fs-cross (AEE-XP-001 §4, Main Spine 2026-09-01 correction: the FS segment is a branch AFTER Choose, not before it)', () => {
    expect(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.map((s) => s.id)).toEqual([
      'home',
      'view',
      'orient',
      'passport',
      'personify',
      'stand',
      'choose',
      'fs-discover',
      'fs-learn',
      'fs-explore',
      'fs-prepare',
      'fs-cross',
    ]);
  });

  it('open narrative stages (home/view/orient/choose) carry no prerequisites and no completion evidence', () => {
    // AEE-XP-001 §10/XP-6 (2026-09-01) EXCEPTION: fs-discover is the first
    // live proof of the generic experience-evidence loop and carries real
    // completionEvidence — see tests/experience-observation-promotion-loop.test.ts
    // and tests/financial-sovereignty-main-spine.test.ts.
    for (const id of OPEN_NARRATIVE_STAGES) {
      const stage = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === id);
      expect(stage, `stage '${id}' missing`).toBeTruthy();
      expect(stage!.prerequisites).toEqual([]);
      if (id === 'fs-discover') {
        expect(stage!.completionEvidence).toEqual(['discoverExperienceObserved']);
      } else {
        expect(stage!.completionEvidence).toEqual([]);
      }
    }
  });

  it('open narrative stages resolve READY even with zero platform state — never BLOCKED, never a permanent gate', () => {
    const result = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, stateFor({}));
    for (const id of OPEN_NARRATIVE_STAGES) {
      const stage = result.stages.find((s) => s.stageId === id);
      expect(stage?.state).not.toBe('BLOCKED');
      expect(stage?.state).not.toBe('COMPLETE');
    }
  });

  it('tracked stages (passport/personify/stand) carry real completion evidence', () => {
    const evidenceByStage: Record<string, string[]> = {
      passport: ['citizenPassportUsable'],
      personify: ['agentRelationshipStarted'],
      stand: ['constitutionalEventRecorded'],
    };
    for (const id of TRACKED_STAGES) {
      const stage = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === id);
      expect(stage!.completionEvidence).toEqual(evidenceByStage[id]);
    }
  });

  it('brand-new signed-out visitor: passport is not yet complete', () => {
    const result = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, stateFor({}));
    const passport = result.stages.find((s) => s.stageId === 'passport');
    expect(passport?.state).not.toBe('COMPLETE');
  });

  it('passport crossed but no agent relationship started yet: personify is not yet complete, not gated by fabricated evidence', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ citizenPassportUsable: true }),
    );
    const passport = result.stages.find((s) => s.stageId === 'passport');
    const personify = result.stages.find((s) => s.stageId === 'personify');
    expect(passport?.state).toBe('COMPLETE');
    expect(personify?.state).not.toBe('COMPLETE');
  });

  it('agent relationship started (either supporting path) but no constitutional event yet: stand is not yet complete', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ citizenPassportUsable: true, agentRelationshipStarted: true }),
    );
    const personify = result.stages.find((s) => s.stageId === 'personify');
    const stand = result.stages.find((s) => s.stageId === 'stand');
    expect(personify?.state).toBe('COMPLETE');
    expect(stand?.state).not.toBe('COMPLETE');
  });

  it('all tracked facts true: passport/personify/stand all COMPLETE', () => {
    const result = resolveJourneyState(
      CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      stateFor({ citizenPassportUsable: true, agentRelationshipStarted: true, constitutionalEventRecorded: true }),
    );
    for (const id of TRACKED_STAGES) {
      const stage = result.stages.find((s) => s.stageId === id);
      expect(stage?.state).toBe('COMPLETE');
    }
  });
});
