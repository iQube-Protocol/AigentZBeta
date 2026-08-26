/**
 * REHEARSAL — the whole freeze path, over a POPULATED crystal.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Every crystal canary in this repository runs over either synthetic report
 * objects (crystal-freeze-recommendation, crystal-freeze-ceremony) or an EMPTY
 * domain (prd-epi-001-crystal-readiness). Both are correct and neither exercises
 * the thing that actually happens the day Track 2 lands: readiness, statistics,
 * the content commitment, the ceremony package and the lifecycle ladder all
 * running end-to-end over a real, non-empty collection.
 *
 * So the first time a populated crystal existed would also have been the first
 * time this path ran. Discovering a freeze bug at the moment of a constitutional
 * act is the worst available time to discover it. This suite moves that
 * discovery forward.
 *
 * ── The sandbox rule — read before adding a fixture ────────────────────────
 *
 * The fixtures below live in `sandbox-freeze-rehearsal`, a NON-GOVERNED domain
 * that exists only in this file. They are NOT invariants: they are shaped rows
 * that exercise arithmetic. Nothing here is written to any substrate, and the
 * ratified EXP-P1 domain `financial-risk-value-systems` is never named as the
 * subject of a report — a canary at the bottom of this file fails the build if
 * it ever is.
 *
 * Populating the ratified domain with generated content would fabricate
 * scientific evidence into a governed corpus, and it would be invisible
 * afterwards because the counts would look right. There is no version of that
 * which is acceptable, including "just for the test".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { listInvariants, listEdgesForInvariants } from '@/services/invariants/store';
import {
  crystalLifecycleStage,
  crystalMilestone,
  crystalReviewStageStatus,
  evaluateCrystalAssignment,
  isReviewableScientificObject,
  mayOfferFreezeAffordance,
  EXP_P1_CRYSTAL_DOMAIN,
} from '@/services/research/crystalDomains';
import {
  buildFreezeCeremonyPackage,
  evaluateFreezeExecutionPreconditions,
} from '@/services/research/crystalFreezeCeremony';
import { composeCrystalFreezeRecommendation } from '@/services/research/crystalFreezeRecommendation';
import { buildTrack2Programme } from '@/services/research/track2Programme';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { runCrystalStatisticsReport } from '@/services/research/crystalStatistics';
import { INVARIANT_NAMESPACES } from '@/types/invariants';
import type { InvariantEdgeRecord, InvariantRecord, InvariantSemanticType } from '@/types/invariants';
import { deriveCrystalPopulationRequirement } from '@/services/research/crystalPopulationRequirement';
import { crystalReadinessCheckNames } from '@/services/research/crystalInstrumentSuite';

vi.mock('@/services/invariants/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/invariants/store')>();
  return {
    ...actual,
    listInvariants: vi.fn(actual.listInvariants),
    listEdgesForInvariants: vi.fn(actual.listEdgesForInvariants),
  };
});

/** The non-governed domain every report in this file is run against. */
const SANDBOX_DOMAIN = 'sandbox-freeze-rehearsal';

/**
 * ── FIXTURE SIZE AND SHAPE — REBUILT 2026-08-26 (IRL Review #001) ──────────
 *
 * This fixture used to be FOURTEEN rows, sized to clear the old
 * `selection-space` bar of "⌊0.4 × N⌋ ≥ 5". That bar was criterion drift against
 * the frozen §3.6 collection-size guard, and it is gone: the requirement is now
 * DERIVED (`required evaluation slice ÷ 0.40 = minimum collection size`).
 *
 * The fixture therefore had to grow, and the growth is MECHANICAL, not chosen:
 * `deriveCrystalPopulationRequirement()` is consulted for the floor, and the
 * fixture is built to it. Nothing here claims a target crystal size — if the
 * finalized task set demands a larger slice, this fixture must grow again, and
 * the assertion below reads the requirement rather than a literal so it will
 * say so.
 *
 * Three shape requirements the hardened gates impose, and how each is met:
 *
 *   - `derivation-headroom` now measures INFERENTIAL CAPACITY, so the fixture
 *     carries a causal chain whose conjunctions genuinely entail unstated
 *     conclusions (`CHAIN_STATEMENTS`). Bare "X is essential for Y" rows would
 *     not do, which is the point of the whole remediation.
 *   - `boundary-coverage` requires every declared namespace to be represented,
 *     so rows cycle through `INVARIANT_NAMESPACES`.
 *   - `duplicate-detection` now includes a SEMANTIC pass, so every statement
 *     below is distinct in predicate-argument form, not merely in wording.
 *
 * The base fourteen statements are unchanged, and the sandbox rule above still
 * governs: these are shaped rows that exercise arithmetic, never invariants.
 */
const BASE_STATEMENTS: Array<[string, InvariantSemanticType]> = [
  ['A capital buffer must exceed expected loss whenever the loss distribution is fat-tailed', 'constraint'],
  ['If collateral is rehypothecated then the effective leverage of the chain exceeds its nominal leverage', 'law'],
  ['Liquidity is the capacity to transact at a price without moving that price materially', 'definition'],
  ['A margin call propagates when the posting party funds it by selling the collateral asset itself', 'law'],
  ['Reserve adequacy is assessed against the tail of the claim distribution, not against its mean', 'constraint'],
  ['When a valuation input is unobservable the model risk dominates the market risk', 'law'],
  ['Settlement finality is the point after which a transfer cannot be reversed by the transferor', 'definition'],
  ['A pro-cyclical haircut amplifies the shock it was calibrated to absorb', 'law'],
  ['Concentration limits bind only if exposures are measured after netting is applied', 'constraint'],
  ['An insurer is solvent when assets cover liabilities under the prescribed stress, not under the mean path', 'principle'],
  ['If two obligors share a common funding source their defaults are not independent', 'law'],
  ['Mark-to-model valuation requires the model itself to be a disclosed input to the valuation', 'principle'],
  ['A clearing house mutualises loss only up to the size of its prefunded default waterfall', 'constraint'],
  ['Given a run dynamic the first mover advantage grows with the discount on forced sales', 'law'],
];

/**
 * A CAUSAL CHAIN. Each link's consequent is the next link's antecedent, and the
 * outer terms of any two adjacent links are disjoint — so every adjacent pair's
 * conjunction entails a conclusion neither states, which is §6(d)'s actual
 * requirement and what `derivation-headroom` now measures. Sixteen links yield
 * fifteen chains, against the twelve the registered derivation-task count
 * demands.
 */
const CHAIN_TOKENS = [
  ['aldrin', 'ridge'], ['bertol', 'shelf'], ['cavell', 'bluff'], ['durand', 'basin'],
  ['everly', 'crest'], ['forsyth', 'trough'], ['gaskell', 'spur'], ['halvard', 'delta'],
  ['ingram', 'moraine'], ['jarrow', 'cirque'], ['kelvin', 'esker'], ['lindorm', 'drumlin'],
  ['marlowe', 'kettle'], ['nordahl', 'arete'], ['osgood', 'couloir'], ['pemberly', 'massif'],
  ['quenton', 'plateau'],
] as const;

const CHAIN_STATEMENTS: Array<[string, InvariantSemanticType]> = CHAIN_TOKENS.slice(0, -1).map(
  ([tok, noun], i) => {
    const [nextTok, nextNoun] = CHAIN_TOKENS[i + 1];
    return [
      `${tok.charAt(0).toUpperCase()}${tok.slice(1)} ${noun} causes ${nextTok} ${nextNoun}.`,
      'law',
    ] as [string, InvariantSemanticType];
  },
);

/**
 * FILLER that deliberately asserts NO relation. It exists to carry the
 * population up to the derived floor without inflating the inferential-capacity
 * figure — a fixture that met the size requirement by adding more chain links
 * would prove nothing about the capacity gate, because capacity is a fraction.
 */
const FILLER_STATEMENTS: Array<[string, InvariantSemanticType]> = Array.from(
  { length: 30 },
  (_, i) =>
    [
      `The sandbox-${String(i).padStart(2, '0')} register enumerates entry vareen-${String(i).padStart(2, '0')} verbatim.`,
      (['definition', 'principle', 'constraint', 'law'] as InvariantSemanticType[])[i % 4],
    ] as [string, InvariantSemanticType],
);

const STATEMENTS: Array<[string, InvariantSemanticType]> = [
  ...BASE_STATEMENTS,
  ...CHAIN_STATEMENTS,
  ...FILLER_STATEMENTS,
];

function row(index: number, overrides: Partial<InvariantRecord> = {}): InvariantRecord {
  const [statement, semanticType] = STATEMENTS[index];
  return {
    id: `sbx-${String(index).padStart(2, '0')}`,
    seedId: null,
    statement,
    // Cycles the DECLARED boundary so `boundary-coverage` is satisfied by
    // representation rather than by narrowing the boundary.
    namespace: INVARIANT_NAMESPACES[index % INVARIANT_NAMESPACES.length],
    ontologyClassId: null,
    semanticType,
    status: 'validated',
    confidence: 0.8,
    confidenceBasis: 'document_verified',
    standing: 0.5 + (index % 5) * 0.1,
    reach: 0.4,
    timesValidated: 2 + (index % 3),
    timesContradicted: 0,
    timesReferenced: 1,
    timesUsed: 1,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    // Population A — external evidence provenance, which is what the ratified
    // eligibility rule requires. `source` is a fixture label, never a citation.
    provenance: {
      provenanceClass: 'external-established',
      discoveryProvenance: 'ide',
      source: `sandbox-source-${index % 4}`,
      evidence_ids: [`sandbox-evidence-${index}`],
    },
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function edge(from: string, to: string): InvariantEdgeRecord {
  return {
    id: `${from}->${to}`,
    fromInvariantId: from,
    toInvariantId: to,
    edgeType: 'supports',
    weight: 1,
    contextId: null,
    rationale: null,
    provenance: {},
    reasoningProvenance: {},
    dvnReceiptId: null,
    createdAt: new Date(0).toISOString(),
  };
}

const CRYSTAL = STATEMENTS.map((_, i) => row(i));
/**
 * A path over every member PLUS a skip edge — no orphans, one component, and
 * enough edges to clear the relationship-density floor at this population.
 * A bare path over N members has N-1 edges, which dilutes below the density
 * floor as N grows; the skip edge keeps the density arithmetic honest without
 * inventing a relationship type.
 */
const EDGES = [
  ...CRYSTAL.slice(1).map((r, i) => edge(CRYSTAL[i].id, r.id)),
  ...CRYSTAL.slice(2).map((r, i) => edge(CRYSTAL[i].id, r.id)),
];

function mountCrystal(invariants: InvariantRecord[] = CRYSTAL, edges: InvariantEdgeRecord[] = EDGES) {
  vi.mocked(listInvariants).mockResolvedValue(invariants);
  vi.mocked(listEdgesForInvariants).mockResolvedValue(edges);
}

beforeEach(() => {
  vi.mocked(listInvariants).mockReset();
  vi.mocked(listEdgesForInvariants).mockReset();
});

// ── 1. Readiness over a populated crystal ───────────────────────────────────

describe('rehearsal — readiness over a populated crystal', () => {
  it('every check passes, and the report says so mechanically', async () => {
    mountCrystal();
    const report = await runCrystalReadinessReport({
      experimentId: 'SANDBOX',
      crystalDomain: SANDBOX_DOMAIN,
    });
    const failing = report.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`);
    expect(failing, 'a populated, well-formed crystal must clear every check').toEqual([]);
    expect(report.ok).toBe(true);
    // Read from the executable contract rather than a literal count — the
    // hand-written `9` here went stale the moment `boundary-coverage` landed.
    expect(report.checks).toHaveLength(crystalReadinessCheckNames().length);
    expect(report.invariantCount).toBe(CRYSTAL.length);
    expect(report.eligibleCount).toBe(CRYSTAL.length);
    expect(report.populations).toEqual({
      A: CRYSTAL.length, B: 0, C: 0, unclassified: 0, ablationCount: CRYSTAL.length,
    });
  });

  it('the ⊆40% Arm C slice meets the §3.6-DERIVED demand and stays a proper subset', async () => {
    mountCrystal();
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const requirement = deriveCrystalPopulationRequirement();
    const slice = Math.floor(report.invariantCount * requirement.sliceFractionOfCrystal);
    // The assertion reads the DERIVED requirement, never a literal: if the task
    // design changes, this test tells the truth about the new floor instead of
    // silently certifying the old one.
    expect(slice).toBeGreaterThanOrEqual(requirement.requiredEvaluationSliceSize as number);
    expect(slice).toBeLessThan(report.invariantCount);
    expect(report.invariantCount).toBeGreaterThanOrEqual(requirement.minimumCollectionSize as number);
  });

  it('carries genuine inferential capacity, not merely relational-looking labels', async () => {
    mountCrystal();
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const requirement = deriveCrystalPopulationRequirement();
    expect(report.inferentialCapacity.entailmentChainCount).toBeGreaterThanOrEqual(
      requirement.requiredEntailmentChains as number,
    );
    expect(report.inferentialCapacity.inferentialCapacityFraction).toBeGreaterThanOrEqual(
      requirement.requiredInferentialCapacityFraction as number,
    );
    expect(report.checks.find((c) => c.name === 'derivation-headroom')?.passed).toBe(true);
  });

  it('represents every declared namespace — coverage satisfied by corpus, not by narrowing', async () => {
    mountCrystal();
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(report.coverage.missingNamespaces).toEqual([]);
    expect(report.coverage.representedNamespaceCount).toBe(INVARIANT_NAMESPACES.length);
    expect(report.checks.find((c) => c.name === 'boundary-coverage')?.passed).toBe(true);
  });

  it('one unclassified member fails provenance-eligibility — never silently admitted', async () => {
    // The fail-closed rule at the point that matters: a record with no recorded
    // evidence provenance is in NO population, and one of them blocks the whole
    // crystal rather than being averaged away.
    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { provenance: { source: 'sandbox' } })]);
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.name === 'provenance-eligibility')?.passed).toBe(false);
    expect(report.populations.unclassified).toBe(1);
    expect(report.eligibleCount).toBe(CRYSTAL.length - 1);
  });

  it('a zero-validation member fails lifecycle integrity — no bulk-authored filler', async () => {
    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { timesValidated: 0 })]);
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(report.checks.find((c) => c.name === 'lifecycle-validation-integrity')?.passed).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('a disconnected crystal fails connectivity and orphan detection', async () => {
    mountCrystal(CRYSTAL, EDGES.slice(0, 4));
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(report.checks.find((c) => c.name === 'graph-connectivity')?.passed).toBe(false);
    expect(report.checks.find((c) => c.name === 'orphan-detection')?.passed).toBe(false);
    expect(report.graph.orphanCount).toBeGreaterThan(1);
  });
});

// ── 2. Statistics and the content commitment ────────────────────────────────

describe('rehearsal — statistics and the content commitment', () => {
  it('reports source and document counts a birth certificate needs', async () => {
    mountCrystal();
    const stats = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(stats.ok).toBe(true);
    expect(stats.invariantCount).toBe(CRYSTAL.length);
    // 4 distinct `source` labels + one distinct evidence id per member.
    // Derived from the fixture rather than hardcoded, so growing the fixture to
    // meet a derived population floor does not require editing an unrelated
    // arithmetic assertion (which is how the old literal 18 became wrong).
    const expectedSources = 4 + CRYSTAL.length;
    expect(stats.sourceCount).toBe(expectedSources);
    expect(stats.externalSources.length).toBe(expectedSources);
    expect(stats.relationshipCount).toBe(EDGES.length);
    expect(stats.averageValidationDepth).toBeGreaterThan(0);
    expect(stats.semanticDiversity).toBeGreaterThan(0);
    expect(stats.substrateError).toBeNull();
  });

  it('the content hash is deterministic across recomputation, and the clock is not an input', async () => {
    // A commitment that moved with the clock could not be verified by anyone
    // who recomputed it later — which is the entire point of committing to one.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
      mountCrystal();
      const a = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });

      vi.setSystemTime(new Date('2027-01-01T12:34:56.000Z'));
      mountCrystal();
      const b = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });

      expect(b.computedAt, 'the reports were computed at different times').not.toBe(a.computedAt);
      expect(b.frozenHash, 'yet commit to the same content').toBe(a.frozenHash);
      expect(a.frozenHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('member ORDER does not change the hash; membership does', async () => {
    mountCrystal();
    const inOrder = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal([...CRYSTAL].reverse());
    const reversed = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(reversed.frozenHash, 'sorted by id — order is not content').toBe(inOrder.frozenHash);

    mountCrystal(CRYSTAL.slice(0, 13));
    const smaller = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(smaller.frozenHash).not.toBe(inOrder.frozenHash);
  });

  it('an edited statement changes the hash — the commitment is over content', async () => {
    mountCrystal();
    const before = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal([...CRYSTAL.slice(0, 13), row(13, { statement: `${STATEMENTS[13][0]} (amended)` })]);
    const after = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(after.frozenHash).not.toBe(before.frozenHash);
  });
});

// ── 3. The ceremony package and its two independent questions ───────────────

describe('rehearsal — the freeze ceremony package', () => {
  const ratification = {
    crystalId: 'SANDBOX/crystal-rehearsal',
    experimentId: 'SANDBOX',
    crystalDomain: SANDBOX_DOMAIN,
    operatorRef: 'operator-public-ref-0000',
    reviewerRef: 'reviewer-public-ref-1111',
    domainBoundary: 'Sandbox rehearsal boundary — not a governed domain.',
    knownLimitations: ['Fixture rows exercise arithmetic; they are not invariants.'],
    freezeRationale: 'Rehearsal of the freeze path over a populated crystal.',
    ratifiedAt: '2026-08-02T00:00:00.000Z',
  };

  it('is eligible, carries both signatories, and commits the statistics hash', async () => {
    mountCrystal();
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal();
    const statistics = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });

    const built = buildFreezeCeremonyPackage({ ...ratification, readiness, statistics });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('unreachable');
    expect(built.package.eligibleForRatification).toBe(true);
    expect(built.package.signatories).toEqual([ratification.operatorRef, ratification.reviewerRef]);
    expect(built.package.contentHash).toBe(statistics.frozenHash);
    expect(built.package.dvnAnchorRef).toBeNull();
    expect(built.package.receiptPreview.actionType).toBe('research_lifecycle_transition');
    expect(built.package.recommendation.verdict).toBe('READY_FOR_FREEZE');
    expect(built.package.recommendation.assessability).toBe('ASSESSED');
  });

  it('a single failing check flips eligibility while the package still builds', async () => {
    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { timesValidated: 0 })]);
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { timesValidated: 0 })]);
    const statistics = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const built = buildFreezeCeremonyPackage({ ...ratification, readiness, statistics });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('unreachable');
    expect(built.package.eligibleForRatification).toBe(false);
    expect(built.package.recommendation.verdict).toBe('NOT_READY');
  });

  it('the packageHash is deterministic over identical evidence', async () => {
    mountCrystal();
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal();
    const statistics = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const a = buildFreezeCeremonyPackage({ ...ratification, readiness, statistics });
    const b = buildFreezeCeremonyPackage({ ...ratification, readiness, statistics });
    expect(a.ok && b.ok && a.package.packageHash === b.package.packageHash).toBe(true);
  });

  it('EVIDENCE eligibility and SUBSTRATE executability are answered separately', async () => {
    // The defect this pins: a package can truthfully read
    // `eligibleForRatification: true` while `freezeArtifact` would refuse,
    // because no crystal-version artifact exists. Reading one as the other is
    // how a constitutional act fails at the moment it is performed.
    mountCrystal();
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    mountCrystal();
    const statistics = await runCrystalStatisticsReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const built = buildFreezeCeremonyPackage({ ...ratification, readiness, statistics });
    if (!built.ok) throw new Error('unreachable');

    const noArtifact = evaluateFreezeExecutionPreconditions({
      packageEligible: built.package.eligibleForRatification,
      packageContentHash: built.package.contentHash,
      signatoryCount: built.package.signatories.length,
      artifact: null,
      crystalId: built.package.crystalId,
    });
    expect(built.package.eligibleForRatification).toBe(true);
    expect(noArtifact.wouldFreezeSucceed, 'eligible evidence is not an executable freeze').toBe(false);
    expect(noArtifact.preconditions.find((p) => p.name === 'artifact-exists')?.satisfied).toBe(false);
    expect(noArtifact.nextAct).toMatch(/provision/i);

    const provisioned = evaluateFreezeExecutionPreconditions({
      packageEligible: true,
      packageContentHash: built.package.contentHash,
      signatoryCount: 2,
      artifact: { id: built.package.crystalId, lifecycle: 'validated' },
      crystalId: built.package.crystalId,
    });
    expect(provisioned.wouldFreezeSucceed).toBe(true);
    expect(provisioned.preconditions.every((p) => p.satisfied)).toBe(true);

    const alreadyFrozen = evaluateFreezeExecutionPreconditions({
      packageEligible: true,
      packageContentHash: built.package.contentHash,
      signatoryCount: 2,
      artifact: { id: built.package.crystalId, lifecycle: 'frozen' },
      crystalId: built.package.crystalId,
    });
    expect(alreadyFrozen.wouldFreezeSucceed, 'freeze is immutable — a re-freeze is refused').toBe(false);
    expect(alreadyFrozen.preconditions.find((p) => p.name === 'artifact-at-validated')?.detail).toMatch(
      /ALREADY frozen/,
    );
  });
});

// ── 4. The ladder, walked ───────────────────────────────────────────────────

describe('rehearsal — the lifecycle ladder over a real object', () => {
  it('a populated, passing crystal reaches READY_FOR_FREEZE and offers the affordance', async () => {
    mountCrystal();
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const stage = crystalLifecycleStage({
      domainRatified: true,
      invariantCount: readiness.invariantCount,
      readinessOk: readiness.ok,
    });
    expect(stage.stageId).toBe('READY_FOR_FREEZE');
    expect(stage.remainingWorkKind).toBe('governance');
    expect(mayOfferFreezeAffordance(stage)).toBe(true);

    expect(crystalMilestone({ invariantCount: readiness.invariantCount }).candidateConstituted).toBe(true);
    expect(isReviewableScientificObject({ invariantCount: readiness.invariantCount })).toBe(true);
    const review = crystalReviewStageStatus({ invariantCount: readiness.invariantCount, readinessOk: readiness.ok });
    expect(review.state).toBe('INDEPENDENT_REVIEW_OPEN');
    expect(review.independentReviewRequestOpen).toBe(true);
  });

  it('a populated, FAILING crystal is the team’s to diagnose, not a reviewer’s to assess', async () => {
    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { timesValidated: 0 })]);
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const stage = crystalLifecycleStage({
      domainRatified: true,
      invariantCount: readiness.invariantCount,
      readinessOk: readiness.ok,
    });
    expect(stage.stageId).toBe('CANDIDATE_READY_FOR_REVIEW');
    expect(stage.remainingWorkKind).toBe('scientific');
    expect(mayOfferFreezeAffordance(stage)).toBe(false);
    expect(
      crystalReviewStageStatus({ invariantCount: readiness.invariantCount, readinessOk: readiness.ok })
        .independentReviewRequestOpen,
    ).toBe(false);
  });

  it('a frozen artifact carries the ladder to FROZEN — the rung is reachable', () => {
    // Before 2026-08-02 nothing threaded `frozen`, so this rung could not be
    // rendered by any code path and a frozen crystal still displayed
    // READY_FOR_FREEZE.
    const stage = crystalLifecycleStage({
      domainRatified: true,
      invariantCount: 14,
      readinessOk: true,
      frozen: true,
    });
    expect(stage.stageId).toBe('FROZEN');
    expect(mayOfferFreezeAffordance(stage)).toBe(false);
    expect(stage.ladder.filter((s) => s.state === 'current')).toHaveLength(1);
  });
});

// ── 5. Assignment eligibility, at the point of entry ────────────────────────

describe('rehearsal — assignment is refused before the crystal has to fail for it', () => {
  const ratified = EXP_P1_CRYSTAL_DOMAIN;

  it('admits a validated, externally-sourced record', () => {
    const v = evaluateCrystalAssignment({
      declaration: ratified,
      status: 'validated',
      evidenceProvenance: 'external-established',
    });
    expect(v.admitted).toBe(true);
    expect(v.refusals).toEqual([]);
  });

  it('refuses a `proposed` record — eligibility is never widened to raise a count', () => {
    const v = evaluateCrystalAssignment({
      declaration: ratified,
      status: 'proposed',
      evidenceProvenance: 'external-established',
    });
    expect(v.admitted).toBe(false);
    expect(v.refusals).toContain('lifecycle-status-ineligible');
  });

  it('refuses platform-derived and platform-doctrine evidence', () => {
    for (const provenance of ['platform-derived', 'platform-hypothesized', 'platform-doctrine']) {
      const v = evaluateCrystalAssignment({ declaration: ratified, status: 'validated', evidenceProvenance: provenance });
      expect(v.admitted, provenance).toBe(false);
      expect(v.refusals).toContain('evidence-provenance-ineligible');
    }
  });

  it('refuses an UNRECORDED provenance — never defaulted into eligibility', () => {
    const v = evaluateCrystalAssignment({ declaration: ratified, status: 'validated', evidenceProvenance: null });
    expect(v.admitted).toBe(false);
    expect(v.refusals).toContain('evidence-provenance-unrecorded');
    expect(v.detail).toMatch(/fail closed/i);
  });

  it('refuses everything while the boundary is unratified', () => {
    const v = evaluateCrystalAssignment({
      declaration: { ...ratified, ratification: 'awaiting-operator-ratification' },
      status: 'validated',
      evidenceProvenance: 'external-established',
    });
    expect(v.admitted).toBe(false);
    expect(v.refusals).toContain('domain-not-ratified');
  });

  it('names EVERY rule that refused, not just the first', () => {
    const v = evaluateCrystalAssignment({
      declaration: { ...ratified, ratification: 'awaiting-operator-ratification' },
      status: 'proposed',
      evidenceProvenance: null,
    });
    expect(v.refusals).toEqual([
      'domain-not-ratified',
      'lifecycle-status-ineligible',
      'evidence-provenance-unrecorded',
    ]);
  });
});

// ── 6. The sandbox canary ───────────────────────────────────────────────────

describe('the rehearsal never touches the governed domain', () => {
  it('no fixture in this file is run against financial-risk-value-systems', () => {
    const src = readFileSync(join(__dirname, 'crystal-freeze-rehearsal.test.ts'), 'utf8');
    const asSubject = src.match(/crystalDomain:\s*['"]financial-risk-value-systems['"]/);
    expect(asSubject, 'the ratified EXP-P1 domain must never be the subject of a rehearsal report').toBeNull();
    expect(SANDBOX_DOMAIN).not.toBe(EXP_P1_CRYSTAL_DOMAIN.domain);
  });

  it('nothing here writes — no store mutator is imported or mocked into a write', () => {
    const src = readFileSync(join(__dirname, 'crystal-freeze-rehearsal.test.ts'), 'utf8');
    for (const writer of ['upsertContext', 'insertInvariant', 'updateInvariant', 'freezeArtifact', 'upsertArtifact']) {
      expect(src, `the rehearsal must not call ${writer}`).not.toContain(`${writer}(`);
    }
  });

  it('the fixture rows are declared as fixtures, not as invariants', () => {
    // A later reader must not mistake this file for a seed. The header says so;
    // this pins that it keeps saying so.
    const src = readFileSync(join(__dirname, 'crystal-freeze-rehearsal.test.ts'), 'utf8');
    expect(src).toMatch(/They are NOT invariants/);
    expect(src).toMatch(/fabricate scientific evidence/i);
  });
});

// ── 7. Readiness remedies — a failing check must say what fixes it ──────────

describe('rehearsal — every failing check says what fixes it', () => {
  /*
   * Operator ruling, 2026-08-02: "CLEAR READINESS REMEDIES — a failing check
   * should say what fixes it, in the same register as the lifecycle ladders."
   *
   * `detail` states a MEASUREMENT. A reader who does not already know the
   * substrate cannot get from "3/14 carry zero intra-crystal relationships" to
   * an action — and the actions differ per check BY KIND. A whole session went
   * into debugging an absence for exactly this reason.
   */
  it('a passing check carries no remedy; a failing one always does', async () => {
    mountCrystal();
    const green = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    for (const c of green.checks) {
      expect(c.passed, c.name).toBe(true);
      expect(c.remedy, `${c.name} passed — a remedy for a satisfied condition is noise`).toBeNull();
    }

    mountCrystal([...CRYSTAL.slice(0, 13), row(13, { timesValidated: 0, provenance: { source: 'sandbox' } })]);
    const red = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const failing = red.checks.filter((c) => !c.passed);
    expect(failing.length).toBeGreaterThan(0);
    for (const c of failing) {
      expect(c.remedy, `${c.name} failed with no remedy`).toBeTruthy();
      expect(c.remedy!.length, `${c.name}'s remedy must be an instruction, not a word`).toBeGreaterThan(40);
    }
  });

  it('the remedies name the real routes, so the operator is never left to guess one', async () => {
    mountCrystal(CRYSTAL, []);
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const orphan = report.checks.find((c) => c.name === 'orphan-detection')!;
    expect(orphan.passed).toBe(false);
    expect(orphan.remedy).toContain('/api/invariants/<id>/edges');
    // And it says why the orphans are there, so this does not read as a defect.
    expect(orphan.remedy).toMatch(/expected work, not a\s+defect/i);

    mountCrystal([...CRYSTAL.slice(0, -1), row(CRYSTAL.length - 1, { timesValidated: 0 })]);
    const zeroVal = (await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN }))
      .checks.find((c) => c.name === 'lifecycle-validation-integrity')!;
    expect(zeroVal.remedy).toContain('/api/invariants/<id>/advance');
  });

  it('no remedy ever tells the operator to widen eligibility or invent structure', async () => {
    mountCrystal([...CRYSTAL.slice(0, 12), row(12, { provenance: { source: 's' } }), row(13, { provenance: { provenanceClass: 'platform-derived' } })]);
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const provenance = report.checks.find((c) => c.name === 'provenance-eligibility')!;
    expect(provenance.passed).toBe(false);
    expect(provenance.remedy).toMatch(/NEVER widen\s+eligibility/i);

    mountCrystal(CRYSTAL, []);
    const sparse = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    expect(sparse.checks.find((c) => c.name === 'relationship-density')!.remedy).toMatch(
      /annotation, never invention/i,
    );
    expect(sparse.checks.find((c) => c.name === 'graph-connectivity')!.remedy).toMatch(
      /do not bridge it with an invented edge/i,
    );
  });

  it('an EMPTY domain is told nothing has failed — the ladder’s register, not a verdict', async () => {
    mountCrystal([], []);
    const report = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const remedies = report.checks.map((c) => c.remedy).filter((r): r is string => Boolean(r));
    expect(remedies.length).toBe(report.checks.length);
    for (const r of remedies) {
      expect(r).toMatch(/Nothing here has failed|Track 2/);
      // The words that made an absence read as a defect must not appear.
      expect(r.replace(/Nothing here has failed/g, '')).not.toMatch(/\bnot ready\b/i);
    }
  });
});

// ── 8. The guided Track 2 programme is a projection, never a state machine ──

describe('rehearsal — the Track 2 programme reads the substrate, it does not own it', () => {
  async function programmeOver(
    invariants = CRYSTAL,
    edges = EDGES,
    overrides: Partial<Parameters<typeof buildTrack2Programme>[0]['signals']> = {},
  ) {
    mountCrystal(invariants, edges);
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const lifecycle = crystalLifecycleStage({
      domainRatified: true,
      invariantCount: readiness.invariantCount,
      readinessOk: readiness.ok,
    });
    return buildTrack2Programme({
      experimentId: 'SANDBOX',
      crystalDomain: SANDBOX_DOMAIN,
      signals: {
        candidateSources: { total: 4, pendingReview: 0, admitted: 4 },
        discoveryCandidates: { total: 20, awaitingReview: 0, promoted: 14 },
        // STAGE 5–7's POPULATION IS STAGE 4's OUTPUT, so the fixture must hand
        // on exactly what Stage 4 declares (14). A cohort of any other size is
        // a population discontinuity and the programme now refuses it — which
        // is the point of the 2026-08-03 ruling, not an inconvenience of it.
        promotedCohort: {
          invariantIds: Array.from({ length: 14 }, (_, i) => `promoted-${i}`),
          unclassified: 0,
          unvalidated: 0,
          graph: { relationshipCount: 14, orphanCount: 0 },
          excluded: [],
        },
        readiness,
        lifecycle,
        artifact: null,
        independentReviewRequestOpen: readiness.ok,
        ...overrides,
      },
    });
  }

  it('has all eleven stages, in order, each naming an existing capability', async () => {
    const p = await programmeOver();
    expect(p.stages.map((s) => s.id)).toEqual([
      'discover-sources',
      'review-and-admit',
      'extract-candidates',
      'review-and-promote',
      'classify-provenance',
      'validate',
      'add-relationships',
      'assign-to-crystal',
      'run-readiness',
      'prepare-independent-review',
      'freeze',
    ]);
    expect(p.stages.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const s of p.stages) {
      expect(s.capability, `${s.id} must route to something that exists`).toMatch(
        /\/api\/|crystalReviewStageStatus|addEdge|freezeArtifact/,
      );
    }
  });

  it('carries the readiness engine’s own remedies verbatim — never a second wording', async () => {
    const p = await programmeOver(CRYSTAL, []);
    mountCrystal(CRYSTAL, []);
    const readiness = await runCrystalReadinessReport({ experimentId: 'SANDBOX', crystalDomain: SANDBOX_DOMAIN });
    const orphanRemedy = readiness.checks.find((c) => c.name === 'orphan-detection')!.remedy!;
    // ON `run-readiness`, NOT `add-relationships` (population ruling,
    // 2026-08-03). The readiness engine assesses the ASSIGNED crystal, so its
    // remedies belong to the stage that declares that population. Hanging them
    // on a current-crystal stage is how "Domain X holds no invariants" came to
    // be rendered beside a count of 68 on a stage holding 17. Carried verbatim
    // still — relocated, never reworded.
    const stage = p.stages.find((s) => s.id === 'run-readiness')!;
    expect(stage.population.consumes).toBe('assigned-crystal');
    expect(stage.status).toBe('in-progress');
    expect(stage.remedies.join(' ')).toContain(orphanRemedy);
  });

  it('an UNREADABLE upstream signal is `unknown` — never complete, never blocked', async () => {
    const p = await programmeOver(CRYSTAL, EDGES, {
      candidateSources: null,
      discoveryCandidates: null,
      promotedCohort: null,
    });
    for (const id of ['discover-sources', 'review-and-admit', 'extract-candidates', 'review-and-promote']) {
      const s = p.stages.find((x) => x.id === id)!;
      expect(s.status, `${id} must not be guessed`).toBe('unknown');
      expect(s.detail).toMatch(/unread|unknown/i);
    }
  });

  it('a freeze is never offered before the crystal is ready for one', async () => {
    const notReady = await programmeOver([...CRYSTAL.slice(0, 13), row(13, { timesValidated: 0 })]);
    const freeze = notReady.stages.find((s) => s.id === 'freeze')!;
    expect(freeze.status).toBe('not-started');
    expect(freeze.remedies.join(' ')).toMatch(/not the next act at this stage/i);
    // And the independent review is not opened over a failing crystal.
    expect(notReady.stages.find((s) => s.id === 'prepare-independent-review')!.status).toBe('blocked');
  });

  it('a ready crystal with no artifact blocks at freeze, and says to provision', async () => {
    const p = await programmeOver();
    const freeze = p.stages.find((s) => s.id === 'freeze')!;
    expect(freeze.status).toBe('blocked');
    expect(freeze.remedies.join(' ')).toMatch(/provision/i);
    // The independent review opens BEFORE the freeze — so a ready crystal sits
    // at stage 10, not 11. Getting this wrong in the test was the same class of
    // error as offering a freeze while review work is outstanding.
    expect(p.currentStageId).toBe('prepare-independent-review');
  });

  it('a frozen artifact completes the programme', async () => {
    const p = await programmeOver(CRYSTAL, EDGES, {
      artifact: { id: 'SANDBOX/crystal-rehearsal', lifecycle: 'frozen' },
    });
    expect(p.stages.find((s) => s.id === 'freeze')!.status).toBe('complete');
  });

  it('an empty crystal puts the programme at assignment, not at freeze', async () => {
    const p = await programmeOver([], []);
    expect(p.stages.find((s) => s.id === 'assign-to-crystal')!.status).toBe('not-started');
    expect(['classify-provenance', 'validate', 'add-relationships', 'assign-to-crystal']).toContain(
      p.currentStageId,
    );
  });

  it('stores nothing — the module holds no writer and says so', () => {
    const src = readFileSync(
      join(__dirname, '..', 'services', 'research', 'track2Programme.ts'),
      'utf8',
    );
    for (const writer of ['supabase', '.insert(', '.update(', '.upsert(', '.delete(']) {
      expect(src, `track2Programme.ts must be pure — found ${writer}`).not.toContain(writer);
    }
    // Pure means no I/O at all: no async, so no signal can be fetched here
    // instead of being passed in by the composing route.
    expect(src, 'the builder must not be async — signals are supplied, never fetched').not.toMatch(
      /export\s+async\s+function\s+buildTrack2Programme/,
    );
    expect(src).toMatch(/PROJECTION/);
  });
});
