/**
 * services/research/crystalAcquisitionBrief.ts — behavioral tests (Defect 2,
 * 2026-08-27 "Crystal freeze-gating continuation" review pass).
 *
 * `buildCrystalAcquisitionBrief` is pure and dependency-injected (no I/O), so
 * it is exercised BEHAVIORALLY here rather than via source-authority grepping
 * — every number under test is either read off the REAL registered constants
 * (`deriveCrystalPopulationRequirement`, `INVARIANT_NAMESPACES`,
 * `RELATIONAL_STRUCTURES`) or asserted as a RELATIONSHIP between fixture
 * inputs and the brief's outputs, never a bare literal the module could
 * satisfy by coincidence.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCrystalAcquisitionBrief,
  acquisitionBriefApplies,
  FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES,
} from '@/services/research/crystalAcquisitionBrief';
import { deriveCrystalPopulationRequirement } from '@/services/research/crystalPopulationRequirement';
import { INVARIANT_NAMESPACES } from '@/types/invariants';
import { RELATIONAL_STRUCTURES, type RelationalStructure } from '@/services/research/crystalSemanticStructure';
import { EXP_P1_CRYSTAL_DOMAIN } from '@/services/research/crystalDomains';
import type { CrystalReadinessCheck, CrystalReadinessReport } from '@/services/research/crystalReadiness';

/** A minimal, fully-typed CrystalReadinessReport fixture — every field this
 *  module reads is realistic; every field it does not read is a harmless
 *  placeholder, so the type checker (not this file) is the guarantee that
 *  buildCrystalAcquisitionBrief only reads the fields it is documented to
 *  read. */
function check(overrides: Partial<CrystalReadinessCheck> & Pick<CrystalReadinessCheck, 'name'>): CrystalReadinessCheck {
  return {
    passed: false,
    detail: '',
    tier: 'scientific-readiness',
    remedy: null,
    ...overrides,
  };
}

function fixtureReport(overrides: {
  invariantCount: number;
  requiredEntailmentChains: number;
  currentEntailmentChainCount: number;
  requiredRelationalMembersInSlice: number;
  currentRelationalMemberCount: number;
  representedNamespaces: string[];
  missingNamespaces: string[];
  structuresAbsent: RelationalStructure[];
  minimumCollectionSize: number | null;
  structuralDiversityPassed?: boolean;
}): CrystalReadinessReport {
  const structuresPresent = RELATIONAL_STRUCTURES.filter((s) => !overrides.structuresAbsent.includes(s));
  const structureCounts = Object.fromEntries(
    RELATIONAL_STRUCTURES.map((s) => [s, overrides.structuresAbsent.includes(s) ? 0 : 1]),
  ) as Record<RelationalStructure, number>;

  const selectionSpacePassed = overrides.minimumCollectionSize !== null && overrides.invariantCount >= overrides.minimumCollectionSize;
  const derivationOk =
    overrides.currentEntailmentChainCount >= overrides.requiredEntailmentChains &&
    overrides.currentRelationalMemberCount >= overrides.requiredRelationalMembersInSlice;
  const boundaryOk = overrides.missingNamespaces.length === 0;

  return {
    ok: selectionSpacePassed && derivationOk && boundaryOk,
    checks: [
      check({
        name: 'selection-space',
        passed: selectionSpacePassed,
        remedy: selectionSpacePassed ? null : `Acquire ${Math.max(0, (overrides.minimumCollectionSize ?? 0) - overrides.invariantCount)} more distinct member(s).`,
      }),
      check({
        name: 'derivation-headroom',
        passed: derivationOk,
        remedy: derivationOk ? null : 'Acquire statements expressing explicit mechanisms.',
      }),
      check({
        name: 'boundary-coverage',
        passed: boundaryOk,
        remedy: boundaryOk ? null : `Extend the corpus into: ${overrides.missingNamespaces.join(', ')}.`,
      }),
      check({
        name: 'structural-diversity',
        tier: 'scientific-maturity',
        passed: overrides.structuralDiversityPassed ?? false,
        detail: 'the collection spans too few semantic_type shapes',
      }),
    ],
    maturity: { checks: [], passedCount: 0, totalCount: 1, band: 'bronze' },
    excludedFromCrystal: null,
    invariantCount: overrides.invariantCount,
    eligibleCount: overrides.invariantCount,
    populations: { A: overrides.invariantCount, B: 0, C: 0, unclassified: 0, ablationCount: overrides.invariantCount },
    derivationEligibleFraction: 0,
    duplicatePairCount: 0,
    duplicates: {
      lexicalPairCount: 0,
      semanticPairCount: 0,
      unionPairCount: 0,
      semanticOnlyPairCount: 0,
      distinctStatementEstimate: overrides.invariantCount,
      semanticPairs: [],
    },
    inferentialCapacity: {
      assessedCount: overrides.invariantCount,
      relationalMemberCount: overrides.currentRelationalMemberCount,
      relationalMemberFraction: 0,
      bareNecessityCount: 0,
      unparsedCount: 0,
      entailmentChains: [],
      entailmentChainCount: overrides.currentEntailmentChainCount,
      inferentiallyCapableCount: 0,
      inferentialCapacityFraction: 0,
      degenerateNecessityChainCount: 0,
      structuresPresent,
      structuresAbsent: overrides.structuresAbsent,
      structureCounts,
      mechanism: 'fixture',
    },
    coverage: {
      boundaryNamespaceCount: overrides.representedNamespaces.length + overrides.missingNamespaces.length,
      representedNamespaceCount: overrides.representedNamespaces.length,
      ratio: 0,
      representedNamespaces: overrides.representedNamespaces,
      missingNamespaces: overrides.missingNamespaces,
    },
    populationRequirement: {
      ...deriveCrystalPopulationRequirement(),
      requiredEntailmentChains: overrides.requiredEntailmentChains,
      requiredRelationalMembersInSlice: overrides.requiredRelationalMembersInSlice,
      minimumCollectionSize: overrides.minimumCollectionSize,
    },
    graph: {
      relationshipCount: 0,
      relationshipDensity: 0,
      componentCount: 0,
      largestComponentSize: 0,
      connectivityRatio: 0,
      orphanCount: 0,
      orphanFraction: 0,
    },
  };
}

describe('buildCrystalAcquisitionBrief — the current authoritative Crystal state', () => {
  // The task's own stated state: 11 distinct invariants, short by 49 against
  // the registered minimum, 2/15 namespaces represented.
  const registeredRequirement = deriveCrystalPopulationRequirement();
  const missingNamespaces = INVARIANT_NAMESPACES.filter((_, i) => i >= 2).slice() as string[];
  const representedNamespaces = INVARIANT_NAMESPACES.slice(0, 2) as string[];

  const report = fixtureReport({
    invariantCount: 11,
    requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
    currentEntailmentChainCount: 0,
    requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
    currentRelationalMemberCount: 0,
    representedNamespaces,
    missingNamespaces,
    structuresAbsent: [...RELATIONAL_STRUCTURES],
    minimumCollectionSize: registeredRequirement.minimumCollectionSize,
  });

  it('COMPUTES the net-new-member deficit from the real population requirement — never a hardcoded 49 (required test 4)', () => {
    // Sanity pin on the REGISTERED constant this derivation is built from —
    // if EXP-P1 README §5.2/§6 ever changes, this pin (and the 49 below) move
    // together, which is the point: nothing here is independently hardcoded.
    expect(registeredRequirement.minimumCollectionSize).toBe(60);

    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds: [],
    });

    expect(brief.requiredNetNewDistinctMembers).toBe(49);
    // The relationship, not just the literal: this must equal
    // minimumCollectionSize - invariantCount computed from THIS report's own
    // fields, so a change to either operand moves the deficit mechanically.
    expect(brief.requiredNetNewDistinctMembers).toBe(report.populationRequirement.minimumCollectionSize! - report.invariantCount);
  });

  it('a deficit of zero when the collection already meets the floor — proves the arithmetic runs both directions', () => {
    const fullReport = fixtureReport({
      invariantCount: 60,
      requiredEntailmentChains: 0,
      currentEntailmentChainCount: 12,
      requiredRelationalMembersInSlice: 0,
      currentRelationalMemberCount: 6,
      representedNamespaces: [...INVARIANT_NAMESPACES],
      missingNamespaces: [],
      structuresAbsent: [],
      minimumCollectionSize: 60,
    });
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report: fullReport,
      admittedInvariantIds: [],
    });
    expect(brief.requiredNetNewDistinctMembers).toBe(0);
  });

  it('carries EVERY missing namespace from the real 15-namespace registry — never a hardcoded 13 (required test 6)', () => {
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds: [],
    });
    // Computed from the REAL INVARIANT_NAMESPACES registry, not restated here.
    const expectedMissing = INVARIANT_NAMESPACES.filter((ns) => !representedNamespaces.includes(ns));
    expect(brief.missingNamespaces).toEqual(expectedMissing);
    expect(brief.missingNamespaces.length).toBe(INVARIANT_NAMESPACES.length - representedNamespaces.length);
    expect(brief.boundaryNamespaceCount).toBe(INVARIANT_NAMESPACES.length);
  });

  it('preserves derivational-structure targets from the population requirement — entailment chains AND relational members (required test 7)', () => {
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds: [],
    });
    expect(brief.requiredEntailmentChains).toBe(registeredRequirement.requiredEntailmentChains);
    expect(brief.requiredRelationalMembersInSlice).toBe(registeredRequirement.requiredRelationalMembersInSlice);
    expect(brief.entailmentChainDeficit).toBe(registeredRequirement.requiredEntailmentChains);
    // All seven relational structures are deficient in this fixture (none
    // asserted) — the brief must name every one, from the real registry.
    expect(brief.deficientRelationalStructures).toEqual(RELATIONAL_STRUCTURES);
  });

  it('excludes already-admitted invariant ids from the brief verbatim — dedup on reacquisition (required test 8)', () => {
    const admittedInvariantIds = ['inv-001', 'inv-002', 'inv-003'];
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds,
    });
    expect(brief.alreadyAdmittedInvariantIds).toEqual(admittedInvariantIds);
  });

  it('carries source-admissibility constraints straight off the RATIFIED domain declaration — never invented', () => {
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds: [],
    });
    for (const status of EXP_P1_CRYSTAL_DOMAIN.eligibleStatuses) {
      expect(brief.sourceAdmissibilityConstraints.some((c) => c.includes(status))).toBe(true);
    }
    for (const provenance of EXP_P1_CRYSTAL_DOMAIN.eligibleProvenance) {
      expect(brief.sourceAdmissibilityConstraints.some((c) => c.includes(provenance))).toBe(true);
    }
  });

  it('ties completion criteria 1:1 to the three named freeze-blocking checks — the SAME three every time', () => {
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report,
      admittedInvariantIds: [],
    });
    expect(brief.completionCriteria.map((c) => c.checkName)).toEqual([...FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES]);
    for (const c of brief.completionCriteria) expect(c.satisfied).toBe(false);
  });
});

describe('structural-diversity — optional, never a Freeze blocker (required test 9)', () => {
  const registeredRequirement = deriveCrystalPopulationRequirement();
  const passingScientificReport = fixtureReport({
    invariantCount: 60,
    requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
    currentEntailmentChainCount: registeredRequirement.requiredEntailmentChains ?? 0,
    requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
    currentRelationalMemberCount: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
    representedNamespaces: [...INVARIANT_NAMESPACES],
    missingNamespaces: [],
    structuresAbsent: [],
    minimumCollectionSize: 60,
    structuralDiversityPassed: false,
  });

  it('acquisitionBriefApplies is FALSE once all three freeze-blocking checks pass — structural-diversity failing does not count', () => {
    // Every scientific-readiness check passes; ONLY the scientific-maturity
    // structural-diversity check fails. This must never make the combined
    // acquisition brief "apply" — it is not one of the three targeted checks.
    expect(acquisitionBriefApplies(passingScientificReport)).toBe(false);
  });

  it('is EXCLUDED from the brief by default — an operator must explicitly opt in', () => {
    const failingReport = fixtureReport({
      invariantCount: 11,
      requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
      currentEntailmentChainCount: 0,
      requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
      currentRelationalMemberCount: 0,
      representedNamespaces: [],
      missingNamespaces: [...INVARIANT_NAMESPACES],
      structuresAbsent: [...RELATIONAL_STRUCTURES],
      minimumCollectionSize: registeredRequirement.minimumCollectionSize,
      structuralDiversityPassed: false,
    });
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report: failingReport,
      admittedInvariantIds: [],
      // includeStructuralDiversity intentionally omitted
    });
    expect(brief.structuralDiversityOpportunity).toBeNull();
    // And never appears among the freeze-blocking completion criteria.
    expect(brief.completionCriteria.map((c) => c.checkName)).not.toContain('structural-diversity');
  });

  it('is INCLUDED only when explicitly requested, and still carried as informational, never as a completion criterion', () => {
    const failingReport = fixtureReport({
      invariantCount: 11,
      requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
      currentEntailmentChainCount: 0,
      requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
      currentRelationalMemberCount: 0,
      representedNamespaces: [],
      missingNamespaces: [...INVARIANT_NAMESPACES],
      structuresAbsent: [...RELATIONAL_STRUCTURES],
      minimumCollectionSize: registeredRequirement.minimumCollectionSize,
      structuralDiversityPassed: false,
    });
    const brief = buildCrystalAcquisitionBrief({
      experimentId: 'EXP-P1',
      crystalGeneration: 'EXP-P1/crystal-vP1',
      domain: EXP_P1_CRYSTAL_DOMAIN,
      report: failingReport,
      admittedInvariantIds: [],
      includeStructuralDiversity: true,
    });
    expect(brief.structuralDiversityOpportunity).not.toBeNull();
    expect(brief.structuralDiversityOpportunity?.included).toBe(true);
    expect(brief.completionCriteria.map((c) => c.checkName)).not.toContain('structural-diversity');
  });
});

describe('acquisitionBriefApplies', () => {
  const registeredRequirement = deriveCrystalPopulationRequirement();

  it('is TRUE when any of the three named checks fails', () => {
    const report = fixtureReport({
      invariantCount: 11,
      requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
      currentEntailmentChainCount: 0,
      requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
      currentRelationalMemberCount: 0,
      representedNamespaces: [],
      missingNamespaces: [...INVARIANT_NAMESPACES],
      structuresAbsent: [...RELATIONAL_STRUCTURES],
      minimumCollectionSize: registeredRequirement.minimumCollectionSize,
    });
    expect(acquisitionBriefApplies(report)).toBe(true);
  });

  it('is FALSE when selection-space, derivation-headroom AND boundary-coverage all pass', () => {
    const report = fixtureReport({
      invariantCount: 60,
      requiredEntailmentChains: registeredRequirement.requiredEntailmentChains ?? 0,
      currentEntailmentChainCount: registeredRequirement.requiredEntailmentChains ?? 0,
      requiredRelationalMembersInSlice: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
      currentRelationalMemberCount: registeredRequirement.requiredRelationalMembersInSlice ?? 0,
      representedNamespaces: [...INVARIANT_NAMESPACES],
      missingNamespaces: [],
      structuresAbsent: [],
      minimumCollectionSize: 60,
    });
    expect(acquisitionBriefApplies(report)).toBe(false);
  });
});
