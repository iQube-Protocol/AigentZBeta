/**
 * Track 2 Stage 1 ("Discover Sources") derivation-fidelity fix (2026-08-31,
 * "targeted-acquisition domain/source-universe handoff" repair).
 *
 * Live incident: a targeted-acquisition approval succeeded, but Stage 1
 * regressed to a generic "not started" with the remedy "ratify the domain
 * constitution pillars first" — even though the acquisition domain
 * ('financial-services') already had ratified institutions. The ACTUAL
 * blocker was SPEC-CIR-001 §9's verification gate (documented, ratified
 * 2026-07-27): none of those institutions had completed verification yet,
 * so `runOneAcquisitionStep` legitimately found zero eligible institutions.
 * Root cause traced to code/substrate — NOT a domain mismatch, NOT a missing
 * domain constitution, NOT a failed provisioning step. `financial-risk-value-
 * systems` (the CRYSTAL domain) and `financial-services` (the ACQUISITION
 * domain) are deliberately different namespaces (researchProgrammeOrchestrator.ts's
 * own header); every acquisition surface already resolves the SAME
 * acquisition-domain value.
 *
 * These tests pin the corrected Stage 1 derivation: it must distinguish
 * "nothing ratified yet" (`not-started`) from "ratified but unverified"
 * (`blocked` — a targeted-acquisition approval can be genuinely active
 * while this holds) from "ready to run" (`not-started`, honestly worded)
 * from "unreadable" (`unknown`) — never collapsing all four into one
 * generic status/remedy.
 */
import { describe, it, expect } from 'vitest';
import { buildTrack2Programme, type Track2ProgrammeSignals } from '@/services/research/track2Programme';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalLifecycle } from '@/services/research/crystalDomains';

function minimalReadiness(): CrystalReadinessReport {
  return {
    ok: false,
    invariantCount: 11,
    eligibleCount: 11,
    populations: { A: 11, B: 0, C: 0, unclassified: 0, ablationCount: 11 },
    derivationEligibleFraction: 0,
    duplicatePairCount: 0,
    graph: { relationshipCount: 0, relationshipDensity: 0, componentCount: 0, largestComponentSize: 0, connectivityRatio: 0, orphanCount: 0, orphanFraction: 0 },
    checks: [],
  } as unknown as CrystalReadinessReport;
}

function minimalLifecycle(): CrystalLifecycle {
  return { stageId: 'CANDIDATE_NOT_CONSTITUTED', label: '', marker: '', meaning: '', whatIsMissing: '', remainingWorkKind: 'scientific', whoActs: 'Steward', ladder: [] } as unknown as CrystalLifecycle;
}

function discoverSourcesStage(
  signalOverrides: Partial<Track2ProgrammeSignals> = {},
  acquisitionDomain = 'financial-services',
) {
  const programme = buildTrack2Programme({
    experimentId: 'EXP-P1',
    crystalDomain: 'financial-risk-value-systems',
    acquisitionDomain,
    signals: {
      candidateSources: { total: 0, pendingReview: 0, admitted: 0 },
      discoveryCandidates: null,
      promotedCohort: null,
      readiness: minimalReadiness(),
      lifecycle: minimalLifecycle(),
      artifact: null,
      independentReviewRequestOpen: false,
      acquisitionSourceUniverse: null,
      ...signalOverrides,
    },
  });
  return programme.stages.find((s) => s.id === 'discover-sources')!;
}

describe('Stage 1 discover-sources — the four distinguished states', () => {
  it('candidateSources unreadable → unknown, never guessed', () => {
    const stage = discoverSourcesStage({ candidateSources: null });
    expect(stage.status).toBe('unknown');
  });

  it('sources already discovered → complete, regardless of the source-universe signal', () => {
    const stage = discoverSourcesStage({
      candidateSources: { total: 5, pendingReview: 5, admitted: 0 },
      acquisitionSourceUniverse: null,
    });
    expect(stage.status).toBe('complete');
  });

  it('zero sources AND the constitution substrate itself is unreadable → unknown, not "not started"', () => {
    const stage = discoverSourcesStage({ acquisitionSourceUniverse: null });
    expect(stage.status).toBe('unknown');
    expect(stage.detail).toMatch(/could not be read/);
  });

  it('genuinely nothing ratified yet → not-started, with the ORIGINAL "ratify the pillars" remedy', () => {
    const stage = discoverSourcesStage({
      acquisitionSourceUniverse: { ratifiedInstitutionCount: 0, eligibleInstitutionCount: 0 },
    });
    expect(stage.status).toBe('not-started');
    expect(stage.remedies).toEqual(['Ratify the domain constitution pillars first, then run discovery for the domain.']);
  });

  it('THE LIVE INCIDENT — ratified but zero verified → blocked, distinct from not-started, and never recommends re-ratification', () => {
    const stage = discoverSourcesStage({
      acquisitionSourceUniverse: { ratifiedInstitutionCount: 9, eligibleInstitutionCount: 0 },
    });
    expect(stage.status).toBe('blocked');
    expect(stage.status).not.toBe('not-started');
    expect(stage.detail).toMatch(/9 institution\(s\) are ratified/);
    expect(stage.detail).toMatch(/NONE have completed verification/);
    // Distinguishes "acquisition approved, source universe unavailable" from
    // "acquisition never started" in its own words.
    expect(stage.detail).toMatch(/not acquisition never having started/);
    expect(stage.remedies[0]).toMatch(/institution verification/i);
    expect(stage.remedies[0]).not.toMatch(/ratify.*pillars/i);
    expect(stage.remedies[0]).toMatch(/already ratified/);
  });

  it('ratified AND verified, discovery simply not run yet → not-started, honestly worded as ready', () => {
    const stage = discoverSourcesStage({
      acquisitionSourceUniverse: { ratifiedInstitutionCount: 9, eligibleInstitutionCount: 9 },
    });
    expect(stage.status).toBe('not-started');
    expect(stage.detail).toMatch(/9 ratified and verified institution\(s\) are ready/);
    expect(stage.remedies).toEqual([]);
  });
});

describe('Stage 1 reads the SAME canonical acquisitionDomain every other acquisition surface resolves', () => {
  it('names the EXACT acquisitionDomain parameter in its detail/remedy text — never the crystal domain, never a hardcoded literal', () => {
    const stage = discoverSourcesStage(
      { acquisitionSourceUniverse: { ratifiedInstitutionCount: 3, eligibleInstitutionCount: 0 } },
      'a-distinctive-test-acquisition-domain',
    );
    expect(stage.detail).toContain('a-distinctive-test-acquisition-domain');
    expect(stage.remedies[0]).toContain('a-distinctive-test-acquisition-domain');
    expect(stage.detail).not.toContain('financial-risk-value-systems'); // the crystal domain never leaks in here
  });

  it('a domain constitution genuinely ratified for the crystal domain does not accidentally satisfy Stage 1 for a DIFFERENT acquisition domain', () => {
    // Simulates option (3) from the operator's diagnostic checklist: if
    // discovery were querying the WRONG domain key, this fixture would still
    // show 'not-started'/'blocked' for the acquisition domain even though
    // the (irrelevant) crystal domain has its own unrelated signal — proving
    // Stage 1 never silently substitutes one domain's institutions for
    // another's.
    const stage = discoverSourcesStage(
      { acquisitionSourceUniverse: { ratifiedInstitutionCount: 0, eligibleInstitutionCount: 0 } },
      'financial-services',
    );
    expect(stage.status).toBe('not-started');
    expect(stage.detail).toContain('financial-services');
  });
});
