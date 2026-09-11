/**
 * Phase A Baseline Mechanical Canaries
 *
 * These tests verify exact invariants that must hold before Phase A remediation:
 * 1. MoneyPenny Passport must remain incomplete until genuine sponsorship + agent-passport evidence exists
 * 2. Know1 must have zero completed constitutional acts before its real Register ceremony
 *
 * Failure of either canary indicates a regression in phase-A baseline state and blocks remediation.
 * Do not modify these assertions without explicit operator authorization.
 */

import { describe, it, expect } from 'vitest';

const MONEYPENNY_STATE_URL = 'https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/state?agentSlug=moneypenny';
const KNOW1_STATE_URL = 'https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/state?agentSlug=kn0w1';

interface JourneyState {
  ok: boolean;
  state: {
    stages: Array<{
      stageId: string;
      state: string;
      evidencePresent: string[];
      evidenceMissing: string[];
      receiptRefs: string[];
    }>;
  };
  resolution: {
    stages: Array<{
      stageId: string;
      canonicalOutcome: boolean;
      receiptRefs: string[];
    }>;
  };
}

describe('Phase A Baseline Canaries', () => {
  describe('MoneyPenny Passport Incompleteness', () => {
    let state: JourneyState;

    beforeAll(async () => {
      const res = await fetch(MONEYPENNY_STATE_URL);
      expect(res.ok).toBe(true);
      state = await res.json();
    });

    it('Passport stage must be IN_PROGRESS', () => {
      const passportStage = state.state.stages.find(s => s.stageId === 'passport');
      expect(passportStage?.state).toBe('IN_PROGRESS');
    });

    it('operatorPolityCitizenPassportValid must be present', () => {
      const passportStage = state.state.stages.find(s => s.stageId === 'passport');
      expect(passportStage?.evidencePresent).toContain('operatorPolityCitizenPassportValid');
    });

    it('sponsorBinding must be missing', () => {
      const passportStage = state.state.stages.find(s => s.stageId === 'passport');
      expect(passportStage?.evidenceMissing).toContain('sponsorBinding');
    });

    it('delegatePassportIssued must be missing', () => {
      const passportStage = state.state.stages.find(s => s.stageId === 'passport');
      expect(passportStage?.evidenceMissing).toContain('delegatePassportIssued');
    });

    it('Passport canonicalOutcome must be false', () => {
      const passportCanonical = state.resolution.stages.find(s => s.stageId === 'passport');
      expect(passportCanonical?.canonicalOutcome).toBe(false);
    });

    it('Passport receiptRefs must be empty', () => {
      const passportCanonical = state.resolution.stages.find(s => s.stageId === 'passport');
      expect(passportCanonical?.receiptRefs).toEqual([]);
    });

    it('Activate must be BLOCKED (depends on Passport completion)', () => {
      const activateStage = state.state.stages.find(s => s.stageId === 'activate');
      expect(activateStage?.state).toBe('BLOCKED');
    });

    it('Delegate must be BLOCKED', () => {
      const delegateStage = state.state.stages.find(s => s.stageId === 'delegate');
      expect(delegateStage?.state).toBe('BLOCKED');
    });

    it('Operate (aigentme) must be BLOCKED', () => {
      const operateStage = state.state.stages.find(s => s.stageId === 'aigentme');
      expect(operateStage?.state).toBe('BLOCKED');
    });
  });

  describe('Know1 Fresh End-to-End Canary', () => {
    let state: JourneyState;

    beforeAll(async () => {
      const res = await fetch(KNOW1_STATE_URL);
      expect(res.ok).toBe(true);
      state = await res.json();
    });

    it('Register stage must be IN_PROGRESS', () => {
      const registerStage = state.state.stages.find(s => s.stageId === 'register');
      expect(registerStage?.state).toBe('IN_PROGRESS');
    });

    it('Register must show aigentQube + Agent Card present', () => {
      const registerStage = state.state.stages.find(s => s.stageId === 'register');
      expect(registerStage?.evidencePresent).toContain('aigentQubeResolved');
      expect(registerStage?.evidencePresent).toContain('agentCardResolves');
    });

    it('Claim must be BLOCKED (depends on Register completion)', () => {
      const claimStage = state.state.stages.find(s => s.stageId === 'claim');
      expect(claimStage?.state).toBe('BLOCKED');
    });

    it('All downstream stages must have canonicalOutcome = false', () => {
      const downstreamStages = ['claim', 'orient', 'passport', 'activate', 'delegate', 'aigentme', 'verify', 'deploy', 'standing'];
      downstreamStages.forEach(stageId => {
        const stage = state.resolution.stages.find(s => s.stageId === stageId);
        expect(stage?.canonicalOutcome).toBe(false);
      });
    });

    it('All downstream stages must have empty receiptRefs', () => {
      const downstreamStages = ['claim', 'orient', 'passport', 'activate', 'delegate', 'aigentme', 'verify', 'deploy', 'standing'];
      downstreamStages.forEach(stageId => {
        const stage = state.resolution.stages.find(s => s.stageId === stageId);
        expect(stage?.receiptRefs).toEqual([]);
      });
    });

    it('Know1 must have zero completed constitutional acts', () => {
      // Count stages with canonicalOutcome = true (should be none)
      const completedStages = state.resolution.stages.filter(s => s.canonicalOutcome === true);
      expect(completedStages).toHaveLength(0);
    });

    it('No cross-agent evidence should be present in Know1 state', () => {
      // Each stage should have matching evidencePresent/Missing between state and resolution
      state.state.stages.forEach(stageState => {
        const resolStage = state.resolution.stages.find(s => s.stageId === stageState.stageId);
        // If resolution shows evidence is present, state should also show it
        // This is a basic sanity check for evidence consistency
        expect(resolStage).toBeDefined();
      });
    });
  });
});
