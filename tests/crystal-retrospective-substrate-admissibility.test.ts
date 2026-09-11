/**
 * Retrospective Substrate Admissibility
 * (services/research/crystalRetrospectiveSubstrateAdmissibility.ts)
 * — 2026-08-30 governance ruling implementation.
 *
 * Pins the operator's exact required semantics:
 *   - strict byte-exact verification → admissible;
 *   - EXP-P1 vP1 + the versioned legacy ruling +
 *     legacyContentVerification.state === 'scientific-content-verified' +
 *     zero blockingGaps → admissible as 'legacy-scientific-content';
 *   - otherwise → inadmissible.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveRetrospectiveSubstrateAdmissibility,
  RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS,
} from '@/services/research/crystalRetrospectiveSubstrateAdmissibility';
import type { LegacyFreezeVerificationEvidence } from '@/services/research/crystalLegacyContentVerification';

function legacyEvidence(overrides: Partial<LegacyFreezeVerificationEvidence> = {}): LegacyFreezeVerificationEvidence {
  return {
    state: 'scientific-content-verified',
    byteExact: false,
    frozenAt: '2026-08-05T21:39:57.033Z',
    memberCount: 15,
    materialFieldsChecked: ['id', 'statement', 'namespace', 'semanticType', 'evidenceProvenance', 'provenance'],
    immaterialDriftFields: ['status'],
    blockingGaps: [],
    reason: 'clean legacy evidence',
    unresolvedRisk: 'residual risk note',
    ...overrides,
  };
}

describe('deriveRetrospectiveSubstrateAdmissibility', () => {
  it('1. byte-exact substrates are admissible without any legacy rule — even for an experiment/artifact no ruling names', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-UNRELATED',
      artifactId: null,
      verifiedAgainstFreeze: true,
      legacyContentVerification: null,
    });
    expect(admissibility.admissible).toBe(true);
    expect(admissibility.basis).toBe('byte-exact');
    expect(admissibility.governingRuling).toBeNull();
  });

  it('2. EXP-P1 / crystal-vP1 is admissible specifically under the versioned legacy ruling', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P1',
      artifactId: 'EXP-P1/crystal-vP1',
      verifiedAgainstFreeze: false,
      legacyContentVerification: legacyEvidence(),
    });
    expect(admissibility.admissible).toBe(true);
    expect(admissibility.basis).toBe('legacy-scientific-content');
    expect(admissibility.governingRuling).not.toBeNull();
    expect(admissibility.governingRuling?.experimentId).toBe('EXP-P1');
    expect(admissibility.governingRuling?.artifactId).toBe('EXP-P1/crystal-vP1');
    // The governing rule/version is VISIBLE in the evidence.
    expect(admissibility.governingRuling?.rulingId).toEqual(expect.stringContaining('EXP-P1'));
    expect(admissibility.governingRuling?.version).toBeTruthy();
    expect(RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS).toContainEqual(admissibility.governingRuling);
  });

  it('3. an identical scientific-content-verified state for an UNRELATED experiment is NOT automatically admissible', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P2',
      artifactId: 'EXP-P2/crystal-vP1',
      verifiedAgainstFreeze: false,
      legacyContentVerification: legacyEvidence(),
    });
    expect(admissibility.admissible).toBe(false);
    expect(admissibility.basis).toBe('inadmissible');
    expect(admissibility.governingRuling).toBeNull();
    expect(admissibility.reason).toContain('no ratified legacy substrate ruling covers');
  });

  it('3b. an identical scientific-content-verified state for the SAME experiment but a DIFFERENT artifact (e.g. crystal-vP2) is NOT automatically admissible', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P1',
      artifactId: 'EXP-P1/crystal-vP2',
      verifiedAgainstFreeze: false,
      legacyContentVerification: legacyEvidence(),
    });
    expect(admissibility.admissible).toBe(false);
    expect(admissibility.governingRuling).toBeNull();
  });

  it('4. any legacy blocking gap makes the substrate inadmissible, even for EXP-P1/crystal-vP1 under the ruling', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P1',
      artifactId: 'EXP-P1/crystal-vP1',
      verifiedAgainstFreeze: false,
      legacyContentVerification: legacyEvidence({ blockingGaps: ['a mutation was found'] }),
    });
    expect(admissibility.admissible).toBe(false);
    expect(admissibility.basis).toBe('inadmissible');
    // The ruling is named even though it doesn't admit — so a reader can see
    // WHICH ruling almost applied and why it did not.
    expect(admissibility.governingRuling?.artifactId).toBe('EXP-P1/crystal-vP1');
    expect(admissibility.reason).toContain('blocking gap');
  });

  it('a legacy state other than scientific-content-verified (e.g. unverified) is never admitted by the ruling', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P1',
      artifactId: 'EXP-P1/crystal-vP1',
      verifiedAgainstFreeze: false,
      legacyContentVerification: legacyEvidence({ state: 'unverified' }),
    });
    expect(admissibility.admissible).toBe(false);
  });

  it('no legacyContentVerification supplied at all → inadmissible, never assumed byte-exact-adjacent', () => {
    const admissibility = deriveRetrospectiveSubstrateAdmissibility({
      experimentId: 'EXP-P1',
      artifactId: 'EXP-P1/crystal-vP1',
      verifiedAgainstFreeze: false,
      legacyContentVerification: null,
    });
    expect(admissibility.admissible).toBe(false);
    expect(admissibility.governingRuling).toBeNull();
  });

  it('the ratified ruling registry names EXP-P1/crystal-vP1 exactly once, never a blanket entry', () => {
    expect(RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS).toHaveLength(1);
    expect(RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS[0].experimentId).toBe('EXP-P1');
    expect(RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS[0].artifactId).toBe('EXP-P1/crystal-vP1');
    expect(RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS[0].admissibleLegacyState).toBe('scientific-content-verified');
  });
});
