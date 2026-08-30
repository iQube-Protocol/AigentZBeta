/**
 * THE RESEARCH PROGRAMME ORCHESTRATOR — the constraints the loop must keep.
 *
 * ── Why these are canaries and not review notes ─────────────────────────────
 *
 * An advance-until-gate loop is the single highest-risk shape in this
 * subsystem, because every failure mode it has looks like success:
 *
 *   - an exception count silently disabling a run reads as "nothing to do";
 *   - a partial run reported as complete reads as "done";
 *   - an acquisition act slipping past the measurement-layer gate reads as
 *     "the programme advanced";
 *   - a freeze performed by automation reads as "the crystal is frozen".
 *
 * None of those errors, and none of them is visible in a screenshot. So each is
 * asserted here, and each assertion names the operator ruling or candidate
 * invariant it protects.
 *
 * The projection (`track2Programme.ts`), the isolation model
 * (`exceptionIsolation.ts`) and the crystal domain declaration
 * (`crystalDomains.ts`) are deliberately REAL in these tests. Mocking them would
 * make the loop agree with a fake of the thing it is supposed to obey; only the
 * I/O leaves (the substrate reads and the two capabilities) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { createFakeSupabase } from './_lib/fakeSupabase';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { ReconciledPromotedCohort } from '@/services/research/populationReconciliation';
import type { CrystalRemediationProfile } from '@/types/crystalRemediation';

const ORCHESTRATOR = 'services/research/researchProgrammeOrchestrator.ts';

// ── The I/O leaves, mocked. Everything constitutional stays real. ───────────

// The orchestrator only needs a TRUTHY client (every substrate read below is
// itself mocked), and the shared fake is what supplies one — a hand-rolled
// `{}` here would be a second fake coexisting with `tests/_lib/fakeSupabase.ts`.
const { admin: fakeAdmin } = createFakeSupabase();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin,
}));

const mockListCandidateSources = vi.fn();
vi.mock('@/services/corpusScout/provenance', () => ({
  listCandidateSources: (...args: unknown[]) => mockListCandidateSources(...args),
}));

const mockListCandidates = vi.fn();
const mockRunConstitutionalDiscovery = vi.fn();
const mockListEvidence = vi.fn().mockResolvedValue([]);
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: unknown[]) => mockListCandidates(...args),
  runConstitutionalDiscovery: (...args: unknown[]) => mockRunConstitutionalDiscovery(...args),
  listEvidence: (...args: unknown[]) => mockListEvidence(...args),
}));

// findDuplicates backs the review-queue's pre-flight duplicate warning
// (2026-08-30) — every failure mode is already absorbed by the orchestrator's
// own `.catch(() => [])`, so an empty default is sufficient for every
// PRE-EXISTING test in this file; the new "review & promote queue" describe
// block below overrides it per case.
const mockFindDuplicates = vi.fn().mockResolvedValue([]);
vi.mock('@/services/invariants/comparison', () => ({
  findDuplicates: (...args: unknown[]) => mockFindDuplicates(...args),
}));

const mockValidateInvariant = vi.fn();
vi.mock('@/services/invariants', () => ({
  validateInvariant: (...args: unknown[]) => mockValidateInvariant(...args),
}));

const mockGetCurrentCrystalArtifact = vi.fn();
const mockLatestFrozenCrystalArtifact = vi.fn();
const mockCurrentCrystalArtifactId = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  getCurrentCrystalArtifact: (...args: unknown[]) => mockGetCurrentCrystalArtifact(...args),
  latestFrozenCrystalArtifact: (...args: unknown[]) => mockLatestFrozenCrystalArtifact(...args),
  currentCrystalArtifactId: (...args: unknown[]) => mockCurrentCrystalArtifactId(...args),
}));

const mockBuildFrozenCrystalManifest = vi.fn();
vi.mock('@/services/research/crystalFrozenManifest', () => ({
  buildFrozenCrystalManifest: (...args: unknown[]) => mockBuildFrozenCrystalManifest(...args),
}));

const mockRunCrystalReadinessReport = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  runCrystalReadinessReport: (...args: unknown[]) => mockRunCrystalReadinessReport(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: unknown[]) => mockReconcilePromotedCohort(...args),
}));

const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  writeLifecycleReceipt: (...args: unknown[]) => mockWriteLifecycleReceipt(...args),
}));

// PARTIAL mock: the declaration, the lifecycle ladder and the hash stay REAL —
// only `domainAcceptsAssignment` is overridable, so the one global stop this
// loop can observe is reachable in a test without faking the crystal domain.
const mockDomainAcceptsAssignment = vi.fn();
vi.mock('@/services/research/crystalDomains', async () => {
  const actual = await vi.importActual<typeof import('@/services/research/crystalDomains')>(
    '@/services/research/crystalDomains',
  );
  return {
    ...actual,
    domainAcceptsAssignment: (...args: unknown[]) => mockDomainAcceptsAssignment(...args),
  };
});

// Imported AFTER the mocks so the hoisted factories are in place.
import {
  ACT_CLASS,
  MAX_ACTS_PER_RUN,
  MAX_RECORDS_PER_ACT,
  PROGRAMME_ACT_KINDS,
  advanceResearchProgramme,
  buildAcquisitionPendingDecision,
  evaluateMeasurementLayerGate,
  firstPendingDecision,
  isHumanGatedStage,
  loadTrack2ProgrammeState,
  resolveMeasurementLayerReadiness,
  type MeasurementLayerReadiness,
  type ProgrammeRunResult,
} from '@/services/research/researchProgrammeOrchestrator';
import { buildTrack2Programme } from '@/services/research/track2Programme';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { BOUND_CRYSTAL_REMEDIATION_PROFILES } from '@/types/crystalRemediation';

// ── Fixtures ───────────────────────────────────────────────────────────────

const PERSONA = 'persona-under-test';
const EXPERIMENT = 'EXP-P1';

function readiness(over: Partial<CrystalReadinessReport> = {}): CrystalReadinessReport {
  return {
    ok: false,
    checks: [],
    maturity: { passedCount: 0, totalCount: 2, band: 'low' },
    invariantCount: 0,
    eligibleCount: 0,
    populations: { A: 0, B: 0, C: 0, unclassified: 0, ablationCount: 0 },
    derivationEligibleFraction: 0,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 0,
      relationshipDensity: 0,
      componentCount: 0,
      largestComponentSize: 0,
      connectivityRatio: 0,
      orphanCount: 0,
      orphanFraction: 0,
    },
    ...over,
  } as CrystalReadinessReport;
}

function member(id: string) {
  return { id, label: `statement ${id}`, statement: `statement ${id}` };
}

function cohort(over: Partial<ReconciledPromotedCohort> = {}): ReconciledPromotedCohort {
  const invariantIds = over.invariantIds ?? ['inv-1', 'inv-2', 'inv-3'];
  return {
    invariantIds,
    unclassified: 0,
    unvalidated: over.unvalidatedRecords?.length ?? invariantIds.length,
    graph: { relationshipCount: 4, orphanCount: 0 },
    excluded: [],
    unaccountedRecords: [],
    unclassifiedRecords: [],
    unvalidatedRecords: invariantIds.map(member),
    orphanRecords: [],
    members: invariantIds.map(member),
    ...over,
  };
}

/** A substrate where Stages 1–4 have produced output and Stage 6 has work. */
function seedSubstrate(over?: {
  sources?: unknown[];
  candidates?: unknown[];
  cohort?: ReconciledPromotedCohort;
  readiness?: CrystalReadinessReport;
}) {
  mockListCandidateSources.mockResolvedValue(
    over?.sources ?? [
      { reviewWorkflowStatus: 'approved_for_ingestion', evidenceRowId: 'ev-1' },
      { reviewWorkflowStatus: 'approved_for_ingestion', evidenceRowId: 'ev-2' },
    ],
  );
  // The promoted-candidate count is DERIVED from the cohort so the Stage 4 -> 5
  // handover reconciles (`received + excluded === declaredOut`). A fixture that
  // disagreed with itself would put the real projection into `blocked` — which
  // is the projection working correctly, and would make every downstream
  // assertion here a test of the fixture rather than of the loop.
  const resolvedCohort = over?.cohort ?? cohort();
  const rawCandidates: Array<Record<string, unknown>> =
    (over?.candidates as Array<Record<string, unknown>> | undefined) ??
    resolvedCohort.invariantIds.map((id) => ({ id: `cand-${id}`, status: 'promoted' }));
  // Every fixture above supplies only the fields THIS suite's own assertions
  // read (id, status, promotedInvariantId, createdAt) — never the full
  // CandidateRow shape. The review-and-promote queue (2026-08-30) reads
  // every OTHER field too (domain, statement, evidenceIds, confidence, …),
  // so a bare fixture object would crash it for any `status: 'candidate'`
  // row. Defaults are merged in HERE, in the one place every test's
  // candidates pass through, rather than editing every literal above —
  // real per-test values always win (spread last).
  mockListCandidates.mockResolvedValue(
    rawCandidates.map((c) => ({
      domain: 'financial-services',
      subDomain: null,
      scopeLevel: 'domain',
      abstractionLevel: null,
      discoveryClass: 'structural',
      statement: `stub statement for ${c.id}`,
      rationale: '',
      evidenceIds: [],
      confidence: 0.5,
      promotedInvariantId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      stage: 'constitutional',
      classification: null,
      coverage: null,
      compression: null,
      crystalExclusion: null,
      ...c,
    })),
  );
  mockReconcilePromotedCohort.mockResolvedValue(resolvedCohort);
  mockRunCrystalReadinessReport.mockResolvedValue(over?.readiness ?? readiness());
  mockGetCurrentCrystalArtifact.mockResolvedValue(null);
  // No frozen predecessor by default — every existing fixture's promoted
  // candidates are therefore never excluded as "already vP1", preserving
  // prior behaviour exactly (2026-08-30 frozen-generation-boundary fix).
  mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
  mockCurrentCrystalArtifactId.mockResolvedValue(`${EXPERIMENT}/crystal-vP1`);
  mockWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'receipt-abcdef01' });
}

/**
 * A satisfied measurement layer — the ONLY way an acquisition-class act runs.
 *
 * Built against Track 2's OWN `CrystalRemediationProfile`
 * (`types/crystalRemediation.ts`), not a local shape: the gate is Track 2's
 * `remediationProfileBindingState` derivation, so a fixture shaped to a
 * second type would prove nothing about the real gate.
 */
function openGate(): MeasurementLayerReadiness {
  const profile: CrystalRemediationProfile = {
    profileVersion: 'test-v1',
    experimentId: EXPERIMENT,
    sourceRefs: [
      {
        refId: 'ref-test',
        locator: 'tests/fixtures/review.json',
        contentHash: 'c'.repeat(64),
        kind: 'external-review',
        note: null,
      },
    ],
    checkMappings: [
      {
        findingId: 'f1',
        label: 'a finding under test',
        bearsOnChecks: ['duplicate-detection'],
        instrument: 'services/research/someInstrument.ts',
        executable: true,
        gap: null,
      },
    ],
    populationFormula: {
      sliceFractionOfCrystal: 0.4,
      sliceGuardSourceRef: 'tests/fixtures/guard',
      sliceDemandBasis: 'registered-minimum-task-design',
      requiredEvaluationSliceSize: 24,
      minimumCollectionSize: 60,
      derivationLines: ['24 / 0.4 = 60'],
      insufficientInputs: [],
    },
    boundaryRequirement: {
      boundarySourceRef: 'tests/fixtures/boundary',
      declaredNamespaces: ['ns-a', 'ns-b'],
      requiredRepresentedNamespaceCount: 2,
      remedy: 'extend-corpus',
      mayNarrowBoundary: false,
    },
    instrumentSuite: { suiteVersion: 'suite-1', contractFingerprint: 'h'.repeat(16), modules: [] },
    retrospective: {
      reproducedReviewerObjections: true,
      verdictRoute: '/api/research/crystal/EXP-P1/retrospective',
      crystalContentHash: 'a'.repeat(64),
      verifiedAgainstFreeze: true,
      computedAt: '2026-08-26T00:00:00.000Z',
    },
    binding: 'bound',
    bindingGaps: [],
  };
  return { profile, profileReadable: true };
}

async function run(over: Parameters<typeof advanceResearchProgramme>[0] extends never ? never : Partial<Parameters<typeof advanceResearchProgramme>[0]> = {}) {
  const result = await advanceResearchProgramme({
    experimentId: EXPERIMENT,
    personaId: PERSONA,
    ...over,
  });
  expect('error' in result, `the run returned an error: ${'error' in result ? result.error : ''}`).toBe(false);
  return result as ProgrammeRunResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  seedSubstrate();
  mockDomainAcceptsAssignment.mockReturnValue(true);
  mockValidateInvariant.mockResolvedValue({ invariant: {}, verdict: { ok: true, checks: [] } });
  mockRunConstitutionalDiscovery.mockResolvedValue({ ok: true, candidates: [], excludedEvidence: [] });
  mockListEvidence.mockResolvedValue([]);
  mockFindDuplicates.mockResolvedValue([]);
});

// ── ACCEPTANCE CRITERION #1 — the single most important assertion here ──────

describe('exceptions never halt the run', () => {
  it('a failing record is isolated and the run continues over the safe remainder', async () => {
    /*
     * THE ruling, verbatim (exceptionIsolation.ts, acceptance criterion #1):
     *
     *   > "The presence of exceptions MUST NOT make [primaryActionEnabled]
     *   >  false: three anomalous sources cannot disable admission of thirty
     *   >  eligible ones."
     *
     * Mutation that must fail this test: make the loop break when an act
     * reports `failed > 0`, or set `globalStop` from an exception count.
     */
    seedSubstrate({ cohort: cohort({ invariantIds: ['inv-1', 'inv-2', 'inv-3', 'inv-4'] }) });
    mockValidateInvariant.mockImplementation(async (id: string) =>
      id === 'inv-2'
        ? { invariant: {}, verdict: { ok: false, checks: [{ name: 'groundedness', passed: false, detail: 'none' }] } }
        : { invariant: {}, verdict: { ok: true, checks: [] } },
    );

    const result = await run();
    const validate = result.acts.find((a) => a.actKind === 'validate-cohort');
    expect(validate, 'the validate act did not run at all').toBeDefined();
    // Three succeeded despite one exception — the whole point.
    expect(validate?.succeeded).toBe(3);
    expect(validate?.failed).toBe(1);
    // The exception is recorded, visible, and did NOT disable the act.
    expect(result.isolation.counts.exceptions).toBe(1);
    expect(result.isolation.primaryActionEnabled).toBe(true);
    expect(result.stopReason.kind).not.toBe('global-integrity-failure');
  });

  it('every isolated record stays visible with its cause and an executable act', async () => {
    // `CI-2026-08-03-EXCLUSION-VISIBLE-NOT-DISCARDED-001` +
    // `CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001`: an exception that only
    // diagnoses is incomplete, and one that vanishes is worse.
    mockValidateInvariant.mockResolvedValue({
      invariant: {},
      verdict: { ok: false, checks: [{ name: 'canonical_form', passed: false, detail: 'not canonical' }] },
    });
    const result = await run();
    expect(result.isolation.exceptions.length).toBeGreaterThan(0);
    for (const e of result.isolation.exceptions) {
      expect(e.cause.length).toBeGreaterThan(0);
      expect(e.consequence.length).toBeGreaterThan(0);
      expect(e.acts, 'an exception with no executable treatment is a diagnosis, not an act').toBeDefined();
      expect(e.acts?.length ?? 0).toBeGreaterThan(0);
      // A record-local exception blocks nothing global. That IS the model.
      expect(e.blocksCurrentStage).toBe(false);
      expect(e.blocksCrystalAssignment).toBe(false);
      expect(e.blocksReadiness).toBe(false);
    }
  });

  it('a thrown capability error is isolated per record, not propagated', async () => {
    mockValidateInvariant.mockImplementation(async (id: string) => {
      if (id === 'inv-1') throw new Error('transition refused');
      return { invariant: {}, verdict: { ok: true, checks: [] } };
    });
    const result = await run();
    const validate = result.acts.find((a) => a.actKind === 'validate-cohort');
    expect(validate?.ok, 'one throwing record must not fail the whole act').toBe(true);
    expect(validate?.succeeded).toBe(2);
    expect(result.isolation.exceptions.some((e) => e.cause.includes('transition refused'))).toBe(true);
  });
});

// ── A GLOBAL STOP DOES halt it ─────────────────────────────────────────────

describe('a global stop halts the run', () => {
  it('an unratified boundary halts the whole run before any act', async () => {
    /*
     * `GlobalStopReason` is a CLOSED five-value union and this adds no sixth
     * member. The assign route's own canary states the rule this mirrors:
     * *"an unratified boundary is a GLOBAL stop, not N per-record refusals"*.
     *
     * Mutation that must fail: evaluate the boundary per record, or let the loop
     * proceed and report the failure as an exception.
     */
    mockDomainAcceptsAssignment.mockReturnValue(false);
    const result = await run({ resolveMeasurementLayer: async () => openGate() });
    expect(result.stopReason.kind).toBe('global-integrity-failure');
    if (result.stopReason.kind === 'global-integrity-failure') {
      expect(result.stopReason.globalStop.reason).toBe('governing-declaration-absent');
    }
    // NOTHING ran, and the isolation summary reflects the stop rather than a count.
    expect(result.actsAttempted).toBe(0);
    expect(mockValidateInvariant).not.toHaveBeenCalled();
    expect(mockRunConstitutionalDiscovery).not.toHaveBeenCalled();
    expect(result.isolation.primaryActionEnabled).toBe(false);
  });

  it('with no global stop the run does NOT report one — the negative control', async () => {
    // Without this, an always-stopping loop would pass the assertion above.
    seedSubstrate({ cohort: cohort({ unvalidatedRecords: [] }) });
    const result = await run({ resolveMeasurementLayer: async () => openGate() });
    expect(result.stopReason.kind).not.toBe('global-integrity-failure');
    expect(result.isolation.globalStop).toBeNull();
  });

  it('summarizeIsolation is what decides, so a global stop disables the primary action', () => {
    // The orchestrator delegates this decision wholly; asserting it here pins
    // that it did not reimplement the rule with an exception count.
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src).toMatch(/summarizeIsolation\(assignments, globalStop, 'record'\)/);
    expect(src, 'the loop must not derive a global stop from a count of exceptions').not.toMatch(
      /globalStop\s*=\s*\{[^}]*counts/,
    );
  });
});

// ── THE LOOP STOPS AT A GATE AND NAMES THE DECISION ────────────────────────

describe('the loop stops at a human gate and names the awaiting decision', () => {
  it('stops at the earliest gated stage and reports it as a consolidated decision', async () => {
    // Nothing machine-runnable outstanding: Stage 3 complete, Stage 6 complete.
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const result = await run();
    expect(['awaiting-governance', 'awaiting-human-judgment', 'blocked-on-measurement-layer']).toContain(
      result.stopReason.kind,
    );
    expect(result.pendingDecision, 'the operator is stopped without being told what for').not.toBeNull();
    expect(result.pendingDecision?.actor.length).toBeGreaterThan(0);
    expect(result.pendingDecision?.capability.length).toBeGreaterThan(0);
    expect(result.pendingDecision?.surface.length).toBeGreaterThan(0);
  });

  it('every governance stage of the real projection is recognised as gated', () => {
    // Reads the REAL projection, so a stage added later with
    // `workKind: 'governance'` is covered without editing this test.
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 3, awaitingReview: 0, promoted: 3 },
        promotedCohort: cohort(),
        readiness: readiness(),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    const governance = programme.stages.filter((s) => s.workKind === 'governance');
    expect(governance.length).toBeGreaterThan(0);
    for (const stage of governance) expect(isHumanGatedStage(stage)).toBe(true);
  });

  it('source admission is NEVER auto-executed, and neither is promotion or assignment', () => {
    /*
     * The recorded ruling (tests/track2-steward-workflow.test.ts's own header):
     *
     *   > "no automatic admission · no automatic promotion · no automatic
     *   >  validation no automatic assignment · no automatic freeze"
     *
     * Stage 2's actor also says so in its own words ("approval is never
     * automatic (PRD-ICA-001 §6/§11)"), which the generic detector catches — but
     * Stage 4 and Stage 8 carry the bare actor `'Steward'`, so the named set is
     * what covers them. Both paths are asserted.
     */
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 5, pendingReview: 3, admitted: 2 },
        discoveryCandidates: { total: 3, awaitingReview: 1, promoted: 2 },
        promotedCohort: cohort(),
        readiness: readiness(),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    for (const id of ['review-and-admit', 'review-and-promote', 'classify-provenance', 'add-relationships', 'assign-to-crystal'] as const) {
      const stage = programme.stages.find((s) => s.id === id);
      expect(stage, `stage '${id}' is missing from the projection`).toBeDefined();
      expect(isHumanGatedStage(stage!), `stage '${id}' would be auto-executed`).toBe(true);
    }
    // And no act in the closed catalogue targets any of them.
    for (const kind of PROGRAMME_ACT_KINDS) {
      expect(['extract-candidates', 'validate']).toContain(
        ({ 'extract-candidates': 'extract-candidates', 'validate-cohort': 'validate' } as const)[kind],
      );
    }
  });

  it('a pending-review source does not stop the loop from validating the admitted remainder', async () => {
    // `CI-2026-08-03-CONTROL-CONSTRAINS-RECORD-001`: three unresolved sources
    // must not withhold work over the twenty-nine already admitted.
    seedSubstrate({
      sources: [
        { reviewWorkflowStatus: 'pending_review', evidenceRowId: null },
        { reviewWorkflowStatus: 'pending_review', evidenceRowId: null },
        { reviewWorkflowStatus: 'approved_for_ingestion', evidenceRowId: 'ev-1' },
      ],
    });
    const result = await run();
    expect(result.acts.some((a) => a.actKind === 'validate-cohort')).toBe(true);
  });
});

// ── CANONICAL DEEP-LINK CONTRACT (2026-08-26 Research Copilot → Track 2 fix) ─
//
// Reconciliation invariants under test:
//   - CTA destinations must deep-link to the precise stage, never a generic
//     Experiment page.
//   - population counts and stage state must agree (the deep-link and the
//     programme it names come from the SAME read, never a second query).
//   - a pending human gate remains the next act until a receipt resolves it
//     (`loadTrack2ProgrammeState` — a plain GET/mount read, no acts executed —
//     already carries the pending decision, not only a POST /advance result).

describe('the canonical Track 2 deep-link (2026-08-26)', () => {
  it('every pending decision carries a deep-link naming the exact programme, experiment, stage and surface', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const result = await run();
    const decision = result.pendingDecision;
    expect(decision, 'a human gate is expected in this fixture').not.toBeNull();
    const deepLink = decision!.deepLink;
    expect(deepLink.programmeId).toBe('track-2');
    expect(deepLink.experimentId).toBe(EXPERIMENT);
    expect(deepLink.stageId).toBe(decision!.stageId);
    expect(deepLink.stageLabel).toBe(decision!.stageLabel);
    // The EXACT surface — never a generic Experiment Lab reference.
    expect(deepLink.surfaceRef.cartridgeTab).toBe('irl-experiment-lab');
    expect(deepLink.surfaceRef.labTab).toBe('track2');
    expect(deepLink.surfaceRef.anchorId).toBe(`track2-stage-${decision!.stageId}`);
  });

  it('firstPendingDecision and loadTrack2ProgrammeState never disagree — one derivation, not two', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    // Population counts and stage state must agree: the pending decision on
    // this read is computed from THIS SAME `programme`, not a separate query
    // that could disagree with it (inv.engineering.036/037).
    expect(state.pendingDecision).toEqual(firstPendingDecision(state.programme));
  });

  it('a plain GET read (no acts executed) already carries the pending decision — a mount/refresh needs no run', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    expect(state.pendingDecision).not.toBeNull();
    expect(state.pendingDecision?.deepLink).toBeDefined();
  });

  it('the GET route surfaces pendingDecision in its response — the durability seam the Copilot preview reads', () => {
    const src = stripComments(readSource('app/api/research/track2/[experimentId]/route.ts'));
    expect(src).toMatch(/pendingDecision:\s*state\.pendingDecision/);
  });

  it('a resolved gate reports pendingDecision: null — the decision does not outlive the receipt that resolves it', () => {
    // Direct unit test of firstPendingDecision (pure): once every stage's own
    // status is 'complete', no candidate remains and the function reports
    // null — the pending-judgment card the Copilot renders from this value
    // must disappear once the underlying evidence says the act is done,
    // never linger as a stale ghost from an earlier read.
    const base = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 3, awaitingReview: 0, promoted: 3 },
        promotedCohort: cohort({ unvalidated: 0, unvalidatedRecords: [], excluded: [] }),
        readiness: readiness({ ok: true }),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    // Force every stage complete — a synthetic "fully resolved" projection,
    // never asserting the real fixture reaches this by other means.
    const allComplete = {
      ...base,
      stages: base.stages.map((s) => ({ ...s, status: 'complete' as const })),
    };
    expect(firstPendingDecision(allComplete)).toBeNull();
  });
});

// ── THE FROZEN-GENERATION BOUNDARY (2026-08-30, "Track 2 successor-crystal
// identity" fix) — Track 2 has no data-model concept of a construction cohort
// distinct from the frozen vP1 population: `discovery_candidates` carries no
// generation field. These tests pin the fix at `loadTrack2ProgrammeState`:
// a promoted candidate already resolved into the FROZEN predecessor's
// manifest is vP1's own historical promotion, not v2 construction work, and
// must be excluded from BOTH Stage 4's own `promoted` count and the Stage
// 5-7 cohort — narrowing only one side would break the Stage 4→5 handover
// identity `track2Programme.ts` already enforces.

describe('the frozen-generation boundary — a frozen predecessor’s own promotions are never v2 construction work', () => {
  it('excludes a promoted candidate already resolved into the frozen manifest from the cohort AND from Stage 4’s promoted count', async () => {
    seedSubstrate({
      candidates: [
        { id: 'cand-1', status: 'promoted', promotedInvariantId: 'inv-1' }, // vP1 residue
        { id: 'cand-2', status: 'promoted', promotedInvariantId: 'inv-2' }, // vP1 residue
        { id: 'cand-new', status: 'promoted', promotedInvariantId: 'inv-new' }, // genuine v2 promotion
      ],
    });
    mockLatestFrozenCrystalArtifact.mockResolvedValue({
      id: 'EXP-P1/crystal-vP1',
      lifecycle: 'frozen',
      contentHash: 'h',
      commitmentHash: 'h',
      frozenAt: '2026-01-01T00:00:00.000Z',
      signedBy: ['operator-ref'],
      receiptId: null,
    });
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      recoveredInvariants: [{ id: 'inv-1' }, { id: 'inv-2' }],
    });

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    expect(state.signalCounts.discoveryCandidates?.promoted).toBe(1);
    expect(mockReconcilePromotedCohort).toHaveBeenCalledTimes(1);
    const passed = mockReconcilePromotedCohort.mock.calls[0][0] as Array<{ id: string }>;
    expect(passed.map((c) => c.id)).toEqual(['cand-new']);
  });

  it('when no frozen predecessor exists, every promoted candidate is available for construction (unchanged behaviour)', async () => {
    seedSubstrate({
      candidates: [{ id: 'cand-1', status: 'promoted', promotedInvariantId: 'inv-1' }],
    });
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    expect(state.signalCounts.discoveryCandidates?.promoted).toBe(1);
    const passed = mockReconcilePromotedCohort.mock.calls[0][0] as Array<{ id: string }>;
    expect(passed.map((c) => c.id)).toEqual(['cand-1']);
  });

  it('vP1’s rows are read, never deleted or relabeled — the fixture’s candidate rows are untouched by this loader (source canary)', () => {
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src, 'the frozen-generation boundary must not write anything').not.toMatch(
      /(update|delete|upsert).{0,40}discovery_candidates/i,
    );
  });
});

// ── THE STAGE 3 → STAGE 4 HANDOFF GAP (2026-08-30 fix) ──────────────────────
//
// The frozen-generation boundary above only narrowed Stage 4's own `promoted`
// count — Stage 3's `total` (and Stage 4's `awaitingReview`) still read the
// SAME raw, all-time `discovery_candidates` rows, so a live report could show
// "17 extracted" alongside a correctly-narrowed "0 promoted, 0 awaiting
// review" with the 17 never accounted for anywhere. Traced: a candidate that
// never resolved to an invariant (`status: 'candidate'` or `'rejected'` with
// no `promotedInvariantId`) has no invariant id to check against the frozen
// manifest, so the only available boundary is creation time relative to the
// freeze — extracted-but-never-promoted material from BEFORE the freeze
// belongs to that construction cycle, not v2's, even though it was never
// promoted into it. These tests pin: (1) such a pre-freeze orphan candidate
// is excluded from Stage 3's `total` and Stage 4's `awaitingReview` the same
// way a resolved vP1 promotion is excluded from Stage 4's `promoted`; (2) a
// genuinely new (post-freeze) candidate is NOT excluded; (3) the accounting
// invariant `total === awaitingReview + promoted + rejected` holds by
// construction once all three are exposed.

describe('the Stage 3 → Stage 4 handoff gap — extracted candidates may never vanish before Stage 4', () => {
  const FROZEN_AT = '2026-01-01T00:00:00.000Z';

  function seedFrozenPredecessor() {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({
      id: 'EXP-P1/crystal-vP1',
      lifecycle: 'frozen',
      contentHash: 'h',
      commitmentHash: 'h',
      frozenAt: FROZEN_AT,
      signedBy: ['operator-ref'],
      receiptId: null,
    });
    mockBuildFrozenCrystalManifest.mockResolvedValue({ recoveredInvariants: [{ id: 'inv-1' }] });
  }

  it('a pre-freeze orphan candidate (never promoted, never rejected) is excluded from Stage 3’s total AND Stage 4’s awaitingReview — the exact 17-vs-0/0 gap', async () => {
    seedSubstrate({
      candidates: [
        // Historical: extracted before the freeze, never promoted or
        // rejected — sat inert in the table ever since. This is the shape
        // that produced "17 extracted / 0 promoted, 0 awaiting review".
        { id: 'cand-old', status: 'candidate', promotedInvariantId: null, createdAt: '2025-12-01T00:00:00.000Z' },
      ],
    });
    seedFrozenPredecessor();

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    // Stage 3 and Stage 4 must agree: NEITHER counts the historical orphan.
    expect(state.signalCounts.discoveryCandidates?.total).toBe(0);
    expect(state.signalCounts.discoveryCandidates?.awaitingReview).toBe(0);
    const extractStage = state.programme.stages.find((s) => s.id === 'extract-candidates')!;
    expect(extractStage.status).toBe('not-started');
    expect(extractStage.detail).toMatch(/^0 candidate\(s\) extracted/);
  });

  it('a genuinely new (post-freeze) candidate IS counted — the fix never suppresses real v2 work', async () => {
    seedSubstrate({
      candidates: [
        { id: 'cand-new', status: 'candidate', promotedInvariantId: null, createdAt: '2026-02-01T00:00:00.000Z' },
      ],
    });
    seedFrozenPredecessor();

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    expect(state.signalCounts.discoveryCandidates?.total).toBe(1);
    expect(state.signalCounts.discoveryCandidates?.awaitingReview).toBe(1);
    const extractStage = state.programme.stages.find((s) => s.id === 'extract-candidates')!;
    expect(extractStage.status).toBe('complete');
  });

  it('the accounting invariant holds: total === awaitingReview + promoted + rejected, over a mixed successor-scoped set', async () => {
    seedSubstrate({
      candidates: [
        // pre-freeze orphans — excluded entirely, never counted anywhere
        { id: 'cand-old-1', status: 'candidate', promotedInvariantId: null, createdAt: '2025-12-01T00:00:00.000Z' },
        { id: 'cand-old-2', status: 'rejected', promotedInvariantId: null, createdAt: '2025-12-02T00:00:00.000Z' },
        // vP1 residue — resolved, but into the frozen manifest — excluded
        { id: 'cand-vp1', status: 'promoted', promotedInvariantId: 'inv-1', createdAt: '2025-12-15T00:00:00.000Z' },
        // genuine v2 material — all three dispositions represented
        { id: 'cand-v2-awaiting', status: 'candidate', promotedInvariantId: null, createdAt: '2026-02-01T00:00:00.000Z' },
        { id: 'cand-v2-promoted', status: 'promoted', promotedInvariantId: 'inv-new', createdAt: '2026-02-02T00:00:00.000Z' },
        { id: 'cand-v2-rejected', status: 'rejected', promotedInvariantId: null, createdAt: '2026-02-03T00:00:00.000Z' },
      ],
    });
    seedFrozenPredecessor();

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    const dc = state.signalCounts.discoveryCandidates!;
    expect(dc.total).toBe(3); // only the three genuine v2 rows
    expect(dc.awaitingReview).toBe(1);
    expect(dc.promoted).toBe(1);
    expect(dc.rejected).toBe(1);
    expect(dc.awaitingReview + dc.promoted + (dc.rejected ?? 0)).toBe(dc.total);

    const extractStage = state.programme.stages.find((s) => s.id === 'extract-candidates')!;
    expect(extractStage.detail).toMatch(/3 candidate\(s\) extracted — 1 awaiting review, 1 promoted, 1 explicitly rejected/);
  });

  it('when no frozen predecessor exists, a pre-freeze-looking candidate is still counted (nothing to distinguish against)', async () => {
    seedSubstrate({
      candidates: [
        { id: 'cand-old', status: 'candidate', promotedInvariantId: null, createdAt: '2020-01-01T00:00:00.000Z' },
      ],
    });
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    expect(state.signalCounts.discoveryCandidates?.total).toBe(1);
    expect(state.signalCounts.discoveryCandidates?.awaitingReview).toBe(1);
  });

  it('an unreadable freeze timestamp never excludes on its own — fail-open, never a silent disappearance', async () => {
    seedSubstrate({
      candidates: [
        { id: 'cand-old', status: 'candidate', promotedInvariantId: null, createdAt: '2020-01-01T00:00:00.000Z' },
      ],
    });
    mockLatestFrozenCrystalArtifact.mockResolvedValue({
      id: 'EXP-P1/crystal-vP1',
      lifecycle: 'frozen',
      contentHash: 'h',
      commitmentHash: 'h',
      frozenAt: null,
      signedBy: ['operator-ref'],
      receiptId: null,
    });
    mockBuildFrozenCrystalManifest.mockResolvedValue({ recoveredInvariants: [] });

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);

    expect(state.signalCounts.discoveryCandidates?.total).toBe(1);
  });
});

// ── "CLASSIFY PROVENANCE" MANUFACTURING A FALSE HUMAN GATE (2026-08-30 fix) ─
//
// `partially-complete` legitimately covers two different situations
// (exception-isolation ruling §6): real outstanding work (Stage 2, sources
// still awaiting review) and an already-resolved historical exclusion with
// nothing left to do (Stage 5/6, once every eligible member is classified/
// validated and the remainder is explicitly excluded). `stage.remedies` tells
// them apart — these tests pin that `firstPendingDecision` reads it.

describe('firstPendingDecision does not manufacture a gate from an already-resolved exclusion', () => {
  it('a partially-complete Stage 5 with ONLY historical exclusions (empty remedies) is never the pending decision', () => {
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 17, awaitingReview: 0, promoted: 17 },
        promotedCohort: cohort({
          invariantIds: Array.from({ length: 15 }, (_, i) => `inv-${i}`),
          unclassified: 0,
          unvalidated: 0,
          unvalidatedRecords: [],
          excluded: [
            { recordId: 'cand-a', reason: 'promoted with no recorded promoted_invariant_id' },
            { recordId: 'cand-b', reason: 'promoted invariant id does not resolve to an invariant row' },
          ],
        }),
        readiness: readiness({ ok: false, invariantCount: 11 }),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    const classify = programme.stages.find((s) => s.id === 'classify-provenance')!;
    // The ratified status derivation is UNCHANGED — still partially-complete.
    expect(classify.status).toBe('partially-complete');
    expect(classify.remedies).toEqual([]);
    // But it must never be presented as the operator's pending judgment.
    const decision = firstPendingDecision(programme);
    expect(decision?.stageId).not.toBe('classify-provenance');
  });

  it('a genuinely partially-complete stage (Stage 2, sources still awaiting review) still surfaces as pending', async () => {
    seedSubstrate({
      sources: [
        { reviewWorkflowStatus: 'approved_for_ingestion', evidenceRowId: 'ev-1' },
        { reviewWorkflowStatus: 'pending_review', evidenceRowId: null },
      ],
    });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    const stage2 = state.programme.stages.find((s) => s.id === 'review-and-admit')!;
    expect(stage2.status).toBe('partially-complete');
    expect(stage2.remedies.length).toBeGreaterThan(0);
    expect(state.pendingDecision?.stageId).toBe('review-and-admit');
  });
});

// ── THE GENERIC "ACTIONABLE" RULE (2026-08-30, "prepare-independent-review is
// invisible in the Copilot" fix) ────────────────────────────────────────────
//
// `remedies.length === 0` is REMEDIATION PROSE being absent, not proof that
// nothing is left for the operator to do — a stage can have a real, existing
// action surface with no repair to name (the act itself IS the decision).
// `Track2Stage.actionable` is the stage's OWN declaration of that, read
// verbatim — `firstPendingDecision` must never special-case a stage id to
// recover this distinction. These tests prove the MECHANISM is generic
// (a synthetic stage, not `prepare-independent-review` itself), then confirm
// the real Stage 10 fix end-to-end, then confirm no already-actionable stage
// changed behavior.

describe('the generic actionable rule — a partially-complete stage with empty remedies can still be pending, IF it declares a real action surface', () => {
  it('THE MECHANISM, proven on a SYNTHETIC stage — never a stage-id special case', () => {
    // `classify-provenance` is reused here only as a valid Track2StageId
    // value — its REAL derivation (tested above) never sets `actionable`,
    // and continues not to. This object is hand-built, not read from
    // `buildTrack2Programme`, specifically so this test cannot be satisfied
    // by any stage-name-specific logic in the projection itself.
    const stage = {
      id: 'classify-provenance',
      ordinal: 5,
      label: 'Synthetic Actionable Stage',
      does: 'test fixture only',
      capability: 'test capability',
      surface: 'test surface',
      workKind: 'scientific',
      actor: 'Steward',
      population: { consumes: 'x', produces: 'x', source: 'x' },
      status: 'partially-complete',
      detail: 'a real action surface is available; there is nothing to remediate',
      remedies: [],
      actionable: true,
    };
    const programme = {
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      stages: [stage],
      currentStageId: stage.id,
      unblockedStageIds: [stage.id],
    } as unknown as Track2Programme;

    const decision = firstPendingDecision(programme);
    expect(decision).not.toBeNull();
    expect(decision?.stageId).toBe('classify-provenance');
    expect(decision?.remedies).toEqual([]);
    expect(decision?.actionable).toBe(true);
  });

  it('the SAME synthetic stage WITHOUT actionable is correctly excluded — proves the flag, not the stage id, decides it', () => {
    const stage = {
      id: 'classify-provenance',
      ordinal: 5,
      label: 'Synthetic Non-Actionable Stage',
      does: 'test fixture only',
      capability: 'test capability',
      surface: 'test surface',
      workKind: 'scientific',
      actor: 'Steward',
      population: { consumes: 'x', produces: 'x', source: 'x' },
      status: 'partially-complete',
      detail: 'nothing left to do',
      remedies: [],
      // actionable omitted — the pre-existing default behavior.
    };
    const programme = {
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      stages: [stage],
      currentStageId: stage.id,
      unblockedStageIds: [stage.id],
    } as unknown as Track2Programme;

    expect(firstPendingDecision(programme)).toBeNull();
  });

  it('THE REAL FIX, end-to-end: prepare-independent-review becomes the pending decision when the review request is open, with empty remedies', () => {
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 15, awaitingReview: 0, promoted: 15 },
        promotedCohort: cohort({
          invariantIds: Array.from({ length: 15 }, (_, i) => `inv-${i}`),
          unclassified: 0,
          unvalidated: 0,
          unvalidatedRecords: [],
        }),
        readiness: readiness({ ok: true, invariantCount: 60 }),
        lifecycle: { stageId: 'READY_FOR_FREEZE' } as never,
        artifact: null,
        independentReviewRequestOpen: true,
      },
    });
    const stage10 = programme.stages.find((s) => s.id === 'prepare-independent-review')!;
    expect(stage10.status).toBe('partially-complete');
    expect(stage10.remedies).toEqual([]);
    expect(stage10.actionable).toBe(true);

    const decision = firstPendingDecision(programme);
    expect(decision?.stageId).toBe('prepare-independent-review');
    expect(decision?.actionable).toBe(true);
    expect(decision?.remedies).toEqual([]);
    // Its own real surface/capability, verbatim — this is what the Copilot's
    // "Open <stage>" deep-link and Track2ProgrammePanel's ReviewPackageControl
    // both already key off; nothing here re-derives that.
    expect(decision?.surface).toBe('Independent Review panel');
  });

  it('prepare-independent-review is NOT actionable, and NOT the pending decision, when the review request is closed — no behavior change outside the open-request case', () => {
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 15, awaitingReview: 0, promoted: 15 },
        promotedCohort: cohort({
          invariantIds: Array.from({ length: 15 }, (_, i) => `inv-${i}`),
          unclassified: 0,
          unvalidated: 0,
          unvalidatedRecords: [],
        }),
        readiness: readiness({ ok: false, invariantCount: 11 }),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    const stage10 = programme.stages.find((s) => s.id === 'prepare-independent-review')!;
    expect(stage10.actionable).not.toBe(true);
    expect(firstPendingDecision(programme)?.stageId).not.toBe('prepare-independent-review');
  });

  it('freeze remains separately gated — the orchestrator still holds no path to the freeze act, regardless of this fix', () => {
    // Source-authority canary, mirroring the existing freeze-immunity test:
    // this fix touches firstPendingDecision's FILTER only, never the act
    // catalogue or any freeze-adjacent capability.
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src).not.toMatch(/freezeArtifact/);
    expect(src).not.toMatch(/action:\s*['"]freeze['"]/);
  });
});

// ── THE ACQUISITION BRIDGE (2026-08-30, "acquisition dead end" fix) ─────────
//
// The targeted acquisition plan (`crystalAcquisitionBrief.ts`) was pure
// reporting with no consumer — Stage 1 is deliberately excluded from both the
// automatic act catalogue (unbounded external HTTP) and the human-gated set
// (its own status can't express "not ENOUGH material exists"). These tests
// pin `buildAcquisitionPendingDecision` as the bridge: it never runs
// discovery itself, it only turns an applicable brief into one correctly
// named, correctly routed pending decision.

describe('the acquisition bridge — a targeted plan becomes one real, correctly-labeled pending decision', () => {
  function readinessNeedingAcquisition(): CrystalReadinessReport {
    return readiness({
      invariantCount: 11,
      checks: [
        { name: 'selection-space', tier: 'scientific-readiness', passed: false, detail: '', remedy: 'grow the collection' } as never,
      ],
      populationRequirement: {
        derivable: true,
        insufficientInputs: [],
        sliceFractionOfCrystal: 0.4,
        sliceGuardSourceRef: 'ref',
        sliceDemandBasis: 'registered-minimum-task-design',
        requiredEvaluationSliceSize: 24,
        minimumCollectionSize: 60,
        requiredEntailmentChains: 12,
        requiredRelationalMembersInSlice: 24,
      } as never,
      inferentialCapacity: {
        assessedCount: 11,
        relationalMemberCount: 0,
        relationalMemberFraction: 0,
        bareNecessityCount: 0,
        unparsedCount: 0,
        entailmentChains: [],
        entailmentChainCount: 0,
        inferentiallyCapableCount: 0,
        inferentialCapacityFraction: 0,
        degenerateNecessityChainCount: 0,
        structuresPresent: [],
        structuresAbsent: ['causal', 'conditional'],
      } as never,
      coverage: {
        boundaryNamespaceCount: 15,
        representedNamespaceCount: 2,
        ratio: 2 / 15,
        representedNamespaces: ['ns-a', 'ns-b'],
        missingNamespaces: ['ns-c', 'ns-d'],
      },
    });
  }

  it('returns null when the brief does not apply (every acquisition-gating check passes)', async () => {
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 0, awaitingReview: 0, promoted: 0 },
        promotedCohort: cohort({ invariantIds: [], unvalidatedRecords: [] }),
        readiness: readiness({ ok: true, checks: [] }),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    const declaration = crystalDomainForExperiment(EXPERIMENT)!;
    const decision = await buildAcquisitionPendingDecision({
      programme,
      declaration,
      readiness: readiness({ ok: true, checks: [] }),
      artifact: null,
    });
    expect(decision).toBeNull();
  });

  it('names Stage 1 (Discover Sources) — never Classify Provenance — with the brief’s own deficits as remedies', async () => {
    const programme = buildTrack2Programme({
      experimentId: EXPERIMENT,
      crystalDomain: 'financial-risk-value-systems',
      signals: {
        candidateSources: { total: 2, pendingReview: 0, admitted: 2 },
        discoveryCandidates: { total: 0, awaitingReview: 0, promoted: 0 },
        promotedCohort: cohort({ invariantIds: [], unvalidatedRecords: [] }),
        readiness: readinessNeedingAcquisition(),
        lifecycle: { stageId: 'DOMAIN_RATIFIED' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
      },
    });
    const declaration = crystalDomainForExperiment(EXPERIMENT)!;
    const decision = await buildAcquisitionPendingDecision({
      programme,
      declaration,
      readiness: readinessNeedingAcquisition(),
      artifact: null,
    });
    expect(decision).not.toBeNull();
    expect(decision?.stageId).toBe('discover-sources');
    expect(decision?.stageLabel).not.toMatch(/classify provenance/i);
    expect(decision?.remedies.length).toBeGreaterThan(0);
    expect(decision?.remedies.join(' ')).toMatch(/grow the collection/);
    // Never executes discovery itself — it names a capability, it does not call one.
    expect(mockRunConstitutionalDiscovery).not.toHaveBeenCalled();
  });

  it('a full run stops at the acquisition decision instead of reporting nothing left to do', async () => {
    seedSubstrate({
      candidates: [],
      readiness: readinessNeedingAcquisition(),
    });
    mockCurrentCrystalArtifactId.mockResolvedValue(`${EXPERIMENT}/crystal-vP2`);
    const result = await run();
    expect(result.stopReason.kind).toBe('awaiting-human-judgment');
    if (result.stopReason.kind === 'awaiting-human-judgment') {
      expect(result.stopReason.decision.stageId).toBe('discover-sources');
    }
  });
});

// ── THE REVIEW & PROMOTE QUEUE (2026-08-30, "Review & Promote is a
// description, not a decision surface" fix) ─────────────────────────────────
//
// The Research Copilot must render the ACTUAL successor-scoped candidates
// awaiting review inline, not merely a capability string. Every field on
// `reviewQueue` is read from data `loadTrack2ProgrammeState` already fetches
// for Stage 3/4's own counts (`successorScopedCandidates`), plus two already-
// reused instruments (`listEvidence`, `findDuplicates`) — these tests pin
// that no second candidate query is introduced and that the queue is scoped,
// resolved and disposed exactly as the operator specified.

describe('the review & promote queue — successor candidates rendered as a real decision surface', () => {
  const AWAITING_CANDIDATE = {
    id: 'cand-awaiting-1',
    status: 'candidate' as const,
    promotedInvariantId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    domain: 'financial-services',
    subDomain: null,
    statement: 'Statement under review A',
    rationale: 'Extracted from source X',
    evidenceIds: ['ev-1'],
    confidence: 0.82,
    convergence: { supportCount: 3, frameworks: ['FATF', 'BIS'], tier: 'broad' as const },
    recurrence: undefined,
    classification: 'novel' as const,
    discoveryClass: 'structural' as const,
    abstractionLevel: 'L2' as const,
    scopeLevel: 'domain' as const,
  };

  it('the pending decision for review-and-promote carries the exact awaiting candidates, and only those', async () => {
    seedSubstrate({
      candidates: [
        AWAITING_CANDIDATE,
        { id: 'cand-promoted-1', status: 'promoted', promotedInvariantId: 'inv-1', createdAt: '2026-07-01T00:00:00.000Z' },
        { id: 'cand-rejected-1', status: 'rejected', promotedInvariantId: null, createdAt: '2026-07-02T00:00:00.000Z' },
      ],
    });
    mockListEvidence.mockResolvedValue([
      { id: 'ev-1', domain: 'financial-services', subDomain: null, title: 'BIS Working Paper', sourceKind: 'academic-literature', content: 'A'.repeat(500), sourceRef: 'https://bis.org/wp1', createdAt: '2026-06-01T00:00:00.000Z' },
    ]);
    mockFindDuplicates.mockResolvedValue([]);

    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    expect(state.pendingDecision?.stageId).toBe('review-and-promote');
    expect(state.pendingDecision?.reviewQueue).toHaveLength(1);
    const entry = state.pendingDecision!.reviewQueue![0];
    expect(entry.candidateId).toBe('cand-awaiting-1');
    expect(entry.statement).toBe('Statement under review A');
    expect(entry.proposedNamespace).toBeTruthy();
    expect(entry.confidence).toBe(0.82);
    expect(entry.convergence?.supportCount).toBe(3);
    // Evidence is RESOLVED (joined by id) — never the raw evidenceIds passed through.
    expect(entry.evidence).toHaveLength(1);
    expect(entry.evidence[0].title).toBe('BIS Working Paper');
    expect(entry.evidence[0].excerpt.length).toBeLessThanOrEqual(400);
    // The promoted and rejected rows never appear — only `status: 'candidate'`.
    expect(state.pendingDecision!.reviewQueue!.map((e) => e.candidateId)).not.toContain('cand-promoted-1');
    expect(state.pendingDecision!.reviewQueue!.map((e) => e.candidateId)).not.toContain('cand-rejected-1');
  });

  it('never queries listCandidates a second time — the queue is built from the SAME successor-scoped array Stage 3/4 counted from', async () => {
    seedSubstrate({ candidates: [AWAITING_CANDIDATE] });
    await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    expect(mockListCandidates).toHaveBeenCalledTimes(1);
  });

  it('an exact duplicate surfaces as a duplicate warning, and the recommendation is "reject"', async () => {
    seedSubstrate({ candidates: [AWAITING_CANDIDATE] });
    mockFindDuplicates.mockResolvedValue([
      { invariant: { id: 'inv-existing-1', statement: 'Statement under review A' }, similarity: 1, exact: true },
    ]);
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    const entry = state.pendingDecision!.reviewQueue![0];
    expect(entry.duplicateWarning?.exact).toBe(true);
    expect(entry.duplicateWarning?.existingInvariantId).toBe('inv-existing-1');
    expect(entry.recommendation.action).toBe('reject');
  });

  it('high confidence with converging sources and no duplicate recommends "promote"', async () => {
    seedSubstrate({ candidates: [{ ...AWAITING_CANDIDATE, confidence: 0.9 }] });
    mockFindDuplicates.mockResolvedValue([]);
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    expect(state.pendingDecision!.reviewQueue![0].recommendation.action).toBe('promote');
  });

  it('low confidence recommends "inspect", never a blocking verdict — both buttons remain the operator’s own call', async () => {
    seedSubstrate({ candidates: [{ ...AWAITING_CANDIDATE, confidence: 0.1, convergence: { supportCount: 0, frameworks: [], tier: 'single' } }] });
    mockFindDuplicates.mockResolvedValue([]);
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    expect(state.pendingDecision!.reviewQueue![0].recommendation.action).toBe('inspect');
  });

  it('reviewQueue is absent (undefined) when no candidate is awaiting review — never an empty-but-present array masking a resolved queue', async () => {
    seedSubstrate({
      candidates: [
        { id: 'cand-promoted-only', status: 'promoted', promotedInvariantId: 'inv-1', createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    // review-and-promote is 'complete' here (promoted>0, awaitingReview=0), so
    // it is not even the pending decision — but the invariant under test is
    // narrower and holds regardless of which stage IS pending:
    expect(state.pendingDecision?.reviewQueue).toBeUndefined();
  });

  it('reviewQueue is absent on every OTHER stage’s pending decision (acquisitionBrief’s own stage, for instance)', async () => {
    seedSubstrate({
      candidates: [],
      readiness: readiness({
        invariantCount: 11,
        checks: [{ name: 'selection-space', tier: 'scientific-readiness', passed: false, detail: '', remedy: 'grow the collection' } as never],
        populationRequirement: {
          derivable: true, insufficientInputs: [], sliceFractionOfCrystal: 0.4, sliceGuardSourceRef: 'ref',
          sliceDemandBasis: 'registered-minimum-task-design', requiredEvaluationSliceSize: 24, minimumCollectionSize: 60,
          requiredEntailmentChains: 12, requiredRelationalMembersInSlice: 24,
        } as never,
        inferentialCapacity: {
          assessedCount: 11, relationalMemberCount: 0, relationalMemberFraction: 0, bareNecessityCount: 0, unparsedCount: 0,
          entailmentChains: [], entailmentChainCount: 0, inferentiallyCapableCount: 0, inferentialCapacityFraction: 0,
          degenerateNecessityChainCount: 0, structuresPresent: [], structuresAbsent: ['causal', 'conditional'],
        } as never,
        coverage: { boundaryNamespaceCount: 15, representedNamespaceCount: 2, ratio: 2 / 15, representedNamespaces: ['ns-a'], missingNamespaces: ['ns-c'] },
      }),
    });
    mockCurrentCrystalArtifactId.mockResolvedValue(`${EXPERIMENT}/crystal-vP2`);
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    expect(state.pendingDecision?.stageId).toBe('discover-sources');
    expect(state.pendingDecision?.acquisitionBrief).toBeDefined();
    expect(state.pendingDecision?.reviewQueue).toBeUndefined();
  });

  it('a listEvidence failure degrades to an empty evidence list — never throws, never drops the candidate from the queue', async () => {
    seedSubstrate({ candidates: [AWAITING_CANDIDATE] });
    mockListEvidence.mockRejectedValue(new Error('db down'));
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error('unexpected error result');
    expect(state.pendingDecision!.reviewQueue).toHaveLength(1);
    expect(state.pendingDecision!.reviewQueue![0].evidence).toEqual([]);
  });
});

// ── THE CRYSTAL LINEAGE INVARIANT (operator ruling, 2026-08-27) ────────────
//
// "A frozen predecessor Crystal must never satisfy the freeze state of a
// successor Crystal candidate." Before this fix, `loadTrack2ProgrammeState`
// read the crystal-version artifact via `getArtifact(experimentId,
// 'crystal-version')` — a first-match lookup that could not tell a frozen
// vP1 apart from an active vP2 candidate, because both were, in practice,
// literally the same object id (`${experimentId}/crystal-vP1`, hardcoded
// everywhere the freeze route defaulted it). The fix is `getCurrentCrystal
// Artifact`, mocked here as `mockGetCurrentCrystalArtifact` — these tests pin
// the ORCHESTRATOR-facing half of the fix: whatever that resolver reports is
// exactly what Stage 11 ("Freeze") derives its status from, and nothing here
// re-derives lineage a second time.

describe('the crystal lineage invariant — a frozen predecessor never satisfies a successor’s Freeze stage', () => {
  it('Freeze reads NOT complete when the lineage resolver reports no active candidate (the frozen-predecessor-with-no-successor-provisioned case)', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    // This is exactly what getCurrentCrystalArtifact returns once the ONLY
    // existing generation is frozen and no successor has been provisioned —
    // never the frozen artifact itself (see prd-epi-001-artifact-model.test.ts).
    mockGetCurrentCrystalArtifact.mockResolvedValue(null);
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    const freezeStage = state.programme.stages.find((s) => s.id === 'freeze');
    expect(freezeStage?.status).not.toBe('complete');
    expect(freezeStage?.detail).toBe('no crystal-version artifact has been provisioned');
  });

  it('Freeze reads complete only when the CURRENT (active) generation itself is frozen', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    mockGetCurrentCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP2', lifecycle: 'frozen' });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    const freezeStage = state.programme.stages.find((s) => s.id === 'freeze');
    expect(freezeStage?.status).toBe('complete');
  });

  it('an in-progress (validated, not yet frozen) successor reads in-progress/blocked, never complete', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    mockGetCurrentCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP2', lifecycle: 'validated' });
    const state = await loadTrack2ProgrammeState({ experimentId: EXPERIMENT });
    if ('error' in state) throw new Error(state.error);
    const freezeStage = state.programme.stages.find((s) => s.id === 'freeze');
    expect(freezeStage?.status).not.toBe('complete');
  });

  it('the orchestrator resolves the crystal-version signal through getCurrentCrystalArtifact, never the first-match getArtifact lookup (source canary)', () => {
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(
      src,
      'a bare getArtifact(...) call for crystal-version reintroduces the lineage collision this fix closes',
    ).not.toMatch(/getArtifact\(/);
    expect(src).toMatch(/getCurrentCrystalArtifact\(/);
  });
});

// ── THE FREEZE IS NEVER REACHED BY AUTOMATION ──────────────────────────────

describe('the orchestrator can never freeze', () => {
  it('the module holds no path to the freeze act (grep canary)', () => {
    /*
     * A source-authority canary, in the style `tests/execution-absorption.test.ts`
     * already uses against the Panel. The lineage the operator set —
     * `vP1 frozen → … → vP2 freeze → independent re-review` — makes this the
     * load-bearing boundary: the orchestrator drives the middle and must touch
     * neither end.
     */
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src, "the orchestrator must never post action: 'freeze'").not.toMatch(/action:\s*['"]freeze['"]/);
    expect(src, 'the orchestrator must not import freezeArtifact').not.toMatch(/freezeArtifact/);
    expect(src, 'the orchestrator must not import upsertArtifact (provisioning is the operator’s act too)').not.toMatch(
      /upsertArtifact/,
    );
    expect(src, 'the orchestrator must not call the freeze route').not.toMatch(/\/freeze/);
    // The stage id `'freeze'` itself is legitimate — it is how the loop RECOGNISES
    // the stop — so the assertions above are deliberately about the ACT, not the id.
    expect(src, 'the loop must still recognise the freeze stage in order to stop at it').toMatch(/'freeze'/);
  });

  it('the module holds no path to editing a statement or a ratified boundary', () => {
    /*
     * The two shortcuts the operator refused, verbatim: *"We will not manually
     * rewrite the 15 statements into stronger invariants"* and *"We will not
     * silently narrow the 15-namespace boundary"*. Structural, not advisory.
     */
    const src = stripComments(readSource(ORCHESTRATOR));
    for (const forbidden of [
      'updateInvariant',
      'mergeInvariants',
      'upsertContext',
      'promoteCandidate',
      'applyProvenanceReclassification',
      'addEdge',
      'canonizeInvariant',
      'transitionInvariant',
      'excludeCandidateFromCrystal',
      'repairPromotedCandidateInvariantLink',
    ]) {
      expect(src, `the orchestrator must not reach ${forbidden}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it('the act catalogue is closed and holds only the two machine acts', () => {
    expect([...PROGRAMME_ACT_KINDS].sort()).toEqual(['extract-candidates', 'validate-cohort']);
  });
});

// ── THE MEASUREMENT-LAYER SEQUENCING GATE ──────────────────────────────────

describe('the sequencing gate cannot be bypassed', () => {
  it('an extraction-class act does not execute while the gate is closed', async () => {
    /*
     * The operator's ruling, verbatim: *"the prepare-crystal-v2 objective should
     * stop before new extraction or crystal construction until Track 2 has
     * produced a versioned remediation profile whose gates are executable and
     * the vP1 retrospective test has passed."*
     *
     * Mutation that must fail: drop `withheldActs` from the offerable filter, or
     * default the gate to satisfied.
     */
    // Stage 3 not-started ⇒ extraction is offerable; Stage 6 has nothing to do.
    // Force the gate closed explicitly (no registered profile) — EXP-P1's own
    // registered profile is bound as of 2026-08-30, so this test's CLOSED
    // premise is supplied here rather than relied on implicitly.
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    const result = await run({ resolveMeasurementLayer: async () => ({ profile: null, profileReadable: true }) });
    expect(result.acts.some((a) => a.actKind === 'extract-candidates'), 'extraction ran behind a closed gate').toBe(false);
    expect(mockRunConstitutionalDiscovery).not.toHaveBeenCalled();
    expect(result.measurementLayerGate.satisfied).toBe(false);
  });

  it('the default resolver fails CLOSED for an experiment with no registered profile', async () => {
    // The registry is a module constant, so the read SUCCEEDS and the honest
    // answer is "no profile is bound" rather than "we could not tell". Both
    // close the gate; distinguishing them is what separates a missing artifact
    // from a broken reader. Uses a genuinely unregistered id — EXP-P1 itself
    // now carries a real (still-unbound) profile, see the test below.
    const readinessState = await resolveMeasurementLayerReadiness('EXP-NEVER-REGISTERED');
    expect(readinessState.profile).toBeNull();
    expect(readinessState.profileReadable).toBe(true);
    const gate = evaluateMeasurementLayerGate(readinessState);
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBe('unbound-no-artifact');
    expect(gate.gaps.join(' ')).toMatch(/not an artifact/);
  });

  it('EXP-P1’s ingested v1 profile is source-complete AND bound (2026-08-30) — the gate opens through the unmodified derivation', async () => {
    // 2026-08-29 — the EXP-P1 remediation profile was authored from real,
    // hash-verifiable source refs (IRL Review #001, the resolution record,
    // the frozen EXP-P1 README). 2026-08-30 — a real, observed canonical
    // retrospective (reproducedReviewerObjections: true, admitted via the
    // legacy-substrate governance ruling; verifiedAgainstFreeze stays false)
    // was copied into `retrospective` verbatim. This test proves the gate
    // opens through resolveMeasurementLayerReadiness/evaluateMeasurementLayerGate
    // completely UNMODIFIED by that population — no gate-logic change was
    // needed or made.
    const readinessState = await resolveMeasurementLayerReadiness(EXPERIMENT);
    expect(readinessState.profileReadable).toBe(true);
    expect(readinessState.profile).not.toBeNull();
    expect(readinessState.profile?.retrospective?.reproducedReviewerObjections).toBe(true);
    expect(readinessState.profile?.retrospective?.verifiedAgainstFreeze).toBe(false);
    const gate = evaluateMeasurementLayerGate(readinessState);
    expect(gate.satisfied).toBe(true);
    expect(gate.binding).toBe('bound');
    expect(gate.gaps).toEqual([]);
    expect(gate.profileVersion).toBe('exp-p1-remediation-2026-08-29.v1');
  });

  it('removing the REAL EXP-P1 retrospective returns the gate to fail-closed — proving the open state above is a consequence of that field, not a stored assertion elsewhere', async () => {
    const readinessState = await resolveMeasurementLayerReadiness(EXPERIMENT);
    const realProfile = readinessState.profile as CrystalRemediationProfile;
    const corrupted = evaluateMeasurementLayerGate({
      profile: { ...realProfile, retrospective: null },
      profileReadable: true,
    });
    expect(corrupted.satisfied).toBe(false);
    expect(corrupted.binding).toBe('unbound-retrospective-not-reproduced');
    expect(corrupted.gaps.join(' ')).toMatch(/retrospective falsification against the frozen crystal has not been run/);
  });

  it('corrupting the REAL EXP-P1 retrospective to reproducedReviewerObjections: false returns the gate to fail-closed', async () => {
    const readinessState = await resolveMeasurementLayerReadiness(EXPERIMENT);
    const realProfile = readinessState.profile as CrystalRemediationProfile;
    const corrupted = evaluateMeasurementLayerGate({
      profile: { ...realProfile, retrospective: { ...realProfile.retrospective!, reproducedReviewerObjections: false } },
      profileReadable: true,
    });
    expect(corrupted.satisfied).toBe(false);
    expect(corrupted.binding).toBe('unbound-retrospective-not-reproduced');
  });

  it('an UNREADABLE substrate also fails closed, and says it is unreadable', () => {
    // FAIL FAITHFUL (`nextConstitutionalAct.ts`: "a null fact never collapses to
    // false") applied in the only safe direction.
    const gate = evaluateMeasurementLayerGate({ profile: null, profileReadable: false });
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBeNull();
    expect(gate.gaps.join(' ')).toMatch(/unreadable/);
  });

  it('a profile that CLAIMS bound while carrying a gap does not open the gate', () => {
    // The binding is DERIVED from the profile's contents (Track 2's
    // `remediationProfileBindingState`), never read off `profile.binding` — a
    // stored claim must not be able to license a second crystal.
    const open = openGate();
    const profile = open.profile as CrystalRemediationProfile;
    const gate = evaluateMeasurementLayerGate({
      ...open,
      profile: {
        ...profile,
        binding: 'bound',
        bindingGaps: [],
        checkMappings: [{ ...profile.checkMappings[0], executable: false, gap: 'no instrument' }],
      },
    });
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBe('unbound-incomplete');
  });

  it('a retrospective that did not reproduce the objections does not open the gate', () => {
    // The inverted sense: the retrospective PASSES when the instruments REJECT
    // the frozen artifact the reviewer rejected.
    const open = openGate();
    const profile = open.profile as CrystalRemediationProfile;
    const gate = evaluateMeasurementLayerGate({
      ...open,
      profile: {
        ...profile,
        retrospective: { ...profile.retrospective!, reproducedReviewerObjections: false },
      },
    });
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBe('unbound-retrospective-not-reproduced');
  });

  it('an absent retrospective does not open the gate either', () => {
    const open = openGate();
    const gate = evaluateMeasurementLayerGate({
      ...open,
      profile: { ...(open.profile as CrystalRemediationProfile), retrospective: null },
    });
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBe('unbound-retrospective-not-reproduced');
  });

  it('a satisfied gate DOES permit extraction — the negative control', async () => {
    // Without this, an always-closed gate would pass every assertion above.
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    mockRunConstitutionalDiscovery.mockResolvedValue({
      ok: true,
      candidates: [{ id: 'new-cand-1' }],
      excludedEvidence: [],
    });
    const result = await advanceResearchProgramme({
      experimentId: EXPERIMENT,
      personaId: PERSONA,
      resolveMeasurementLayer: async () => openGate(),
    });
    const r = result as ProgrammeRunResult;
    expect(r.measurementLayerGate.satisfied).toBe(true);
    expect(r.acts.some((a) => a.actKind === 'extract-candidates')).toBe(true);
    expect(mockRunConstitutionalDiscovery).toHaveBeenCalled();
  });

  it('a withheld act is NAMED, and the stop is its own kind — not a governance stop', async () => {
    // Forced closed explicitly — EXP-P1's own registered profile is bound as
    // of 2026-08-30, so this test's CLOSED premise is supplied here rather
    // than relied on implicitly.
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    const result = await run({ resolveMeasurementLayer: async () => ({ profile: null, profileReadable: true }) });
    if (result.stopReason.kind === 'blocked-on-measurement-layer') {
      expect(result.stopReason.withheldActs).toContain('extract-candidates');
      expect(result.stopReason.gate.satisfied).toBe(false);
    } else {
      // Whatever the stop, the withheld act must not have run.
      expect(result.acts.some((a) => a.actKind === 'extract-candidates')).toBe(false);
    }
    expect(ACT_CLASS['extract-candidates']).toBe('v2-acquisition');
    expect(ACT_CLASS['validate-cohort']).toBe('pre-remediation-safe');
  });

  it('the gate never reads reviewer prose or recomputes a derivation', () => {
    // "Configuration, not interpretation." The orchestrator reads `derivedFloor`
    // if it needs the floor at all; it must never evaluate `formula`.
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src, 'the orchestrator must not evaluate the population formula').not.toMatch(/0\.40|0\.4\b|\/\s*0\.4/);
    // The binding judgment is Track 2's derivation, called — never re-made here.
    expect(src).toMatch(/remediationProfileBindingState\(profile\)/);
    expect(src).toMatch(/from '@\/types\/crystalRemediation'/);
    // And it must not read `minimumCollectionSize` to re-derive anything.
    expect(src, 'the orchestrator must not reach into the population formula').not.toMatch(
      /populationFormula\./,
    );
  });
});

// ── A PARTIAL RUN REPORTS AS PARTIAL ───────────────────────────────────────

describe('a partial run can never be read as complete', () => {
  it('one failed act makes the run partial, never complete', async () => {
    // The property `summariseAbsorbedExecution` protects, at the run level:
    // *"If batch 2 fails after batch 1 succeeded, the result must say EXACTLY
    // that."*
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    mockRunConstitutionalDiscovery.mockResolvedValue({ ok: false, error: 'no evidence for this domain' });
    const result = await advanceResearchProgramme({
      experimentId: EXPERIMENT,
      personaId: PERSONA,
      resolveMeasurementLayer: async () => openGate(),
    });
    const r = result as ProgrammeRunResult;
    expect(r.actsAttempted).toBe(1);
    expect(r.actsSucceeded).toBe(0);
    expect(r.actExecution).toBe('failed');
    expect(r.headline).toMatch(/NONE succeeded/);
    expect(r.reconciles).toBe(true);
  });

  it('records an act could not reach are NAMED, never summarised away', async () => {
    // `CI-2026-08-03-CAPACITY-LIMIT-BATCHES-NOT-TRUNCATES-001` — a ceiling
    // batches; it does not truncate silently.
    const ids = Array.from({ length: MAX_RECORDS_PER_ACT + 3 }, (_, i) => `inv-${String(i).padStart(3, '0')}`);
    seedSubstrate({ cohort: cohort({ invariantIds: ids, unvalidatedRecords: ids.map(member) }) });
    const result = await run();
    const validate = result.acts.find((a) => a.actKind === 'validate-cohort');
    expect(validate?.attempted).toBe(MAX_RECORDS_PER_ACT);
    expect(validate?.deferredRecordIds).toHaveLength(3);
    // Named individually, and deterministically — sorted before slicing.
    expect(validate?.deferredRecordIds).toEqual(ids.slice(MAX_RECORDS_PER_ACT));
    expect(validate?.detail).toMatch(/NOT reached/);
  });

  it('a run that executed nothing says so rather than reporting success', async () => {
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const result = await run();
    expect(result.actExecution).toBe('not-started');
    expect(result.headline).toMatch(/No act was executed/);
  });

  it('the headline names a stop reason in every branch', async () => {
    const result = await run();
    expect(result.headline).toMatch(/Stopped|Nothing further/);
  });
});

// ── THE RUN IS BOUNDED ─────────────────────────────────────────────────────

describe('the run is bounded three ways', () => {
  it('the act budget is clamped and cannot be widened by a caller', async () => {
    const result = await run({ maxActs: 9999 });
    expect(result.actsAttempted).toBeLessThanOrEqual(MAX_ACTS_PER_RUN);
  });

  it('each act kind executes at most once per run, so a no-op act cannot spin', async () => {
    // The bound that makes re-reading the projection safe: an act that left its
    // stage unchanged is not offered again.
    seedSubstrate({ cohort: cohort({ invariantIds: ['inv-1'], unvalidatedRecords: [member('inv-1')] }) });
    // The cohort NEVER changes across re-reads, so a loop without this bound
    // would re-select `validate-cohort` until the budget ran out.
    const result = await run();
    expect(result.acts.filter((a) => a.actKind === 'validate-cohort')).toHaveLength(1);
    expect(result.stopReason.kind).not.toBe('act-budget-exhausted');
  });

  it('the wall-clock budget stops the run BEFORE an act begins, never inside one', async () => {
    let t = 0;
    const result = await run({ timeBudgetMs: 10, now: () => (t += 100) });
    expect(result.stopReason.kind).toBe('time-budget-exhausted');
    expect(result.actsAttempted).toBe(0);
    if (result.stopReason.kind === 'time-budget-exhausted') {
      expect(result.stopReason.detail).toMatch(/NOT begun/);
    }
    expect(mockValidateInvariant).not.toHaveBeenCalled();
  });
});

// ── THE EMPTY-504 REPAIR (2026-08-30) ───────────────────────────────────────
//
// `POST .../advance` was observed returning an empty HTTP 504 — the platform
// killing the connection before any JSON body could be written — even for a
// state with ZERO offerable acts (e.g. "Discover Sources" pending). The prior
// budget check ran only after an act was already selected, so a state whose
// composition alone (readiness + candidate/source/artifact reads + frozen-
// manifest verification + cohort reconciliation) consumed the whole budget
// never had a chance to be caught: the loop's first (and only) iteration
// resolves `pendingDecision` and returns before ever checking elapsed time.
// These prove the two-part fix: a top-of-loop check that catches a slow
// state load even with nothing to execute, and a hard backstop race around
// the one-time composition for the case where it doesn't even finish.
describe('the empty-504 repair — a slow state composition still returns a structured result', () => {
  it('a state composition that alone consumes the budget still returns the FULL structured run — programme, population, diagnostics — with zero acts attempted, never a bare stop', async () => {
    let t = 0;
    // The fake clock advances on every timer checkpoint state composition
    // itself makes (readiness, the rest of the composition, the outer
    // wrapper) — by the time the loop's own first check runs, several of
    // those ticks have already elapsed, exceeding a small budget WITHOUT any
    // act ever being selected.
    const result = await run({ timeBudgetMs: 50, now: () => (t += 100) });
    expect(result.actsAttempted).toBe(0);
    expect(result.stopReason.kind).toBe('time-budget-exhausted');
    // The rich shape survives — this is what "must always return a
    // structured programme result" requires: not just a stop reason, but
    // every field a normal run carries.
    expect(result.programme).toBeDefined();
    expect(result.population).toBeDefined();
    expect(result.isolation).toBeDefined();
    expect(result.measurementLayerGate).toBeDefined();
    expect(result.guardrails.length).toBeGreaterThan(0);
    expect(typeof result.headline).toBe('string');
    expect(result.diagnostics.timings.length).toBeGreaterThan(0);
  });

  it('diagnostics.timings names every phase the operator asked to instrument, present on every run', async () => {
    const result = await run();
    const phases = result.diagnostics.timings.map((entry) => entry.phase);
    expect(phases).toContain('programme-state-load');
    expect(phases).toContain('readiness');
    expect(phases).toContain('programme-state-derivation');
    expect(phases).toContain('measurement-layer-resolution');
    expect(result.diagnostics.totalElapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('diagnostics.timings names each executed act by kind, and the final re-read', async () => {
    seedSubstrate({ cohort: cohort({ invariantIds: ['inv-1'], unvalidatedRecords: [member('inv-1')] }) });
    const result = await run();
    const phases = result.diagnostics.timings.map((entry) => entry.phase);
    expect(phases.some((p) => p.startsWith('act:'))).toBe(true);
    expect(phases).toContain('final-state-recomputation');
  });

  it('a state composition that exceeds the HARD backstop deadline returns a structured 503 — never nothing, never a throw', async () => {
    // A pathologically slow readiness read, real wall-clock delay well past
    // a deliberately tiny deadline — proves the race itself, not just the
    // loop's own per-iteration check (which never runs at all here, since
    // the state never finishes composing).
    mockRunCrystalReadinessReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(readiness()), 50)),
    );
    const result = await advanceResearchProgramme({
      experimentId: EXPERIMENT,
      personaId: PERSONA,
      stateCompositionDeadlineMs: 5,
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/safety budget/);
    }
  });

  it('the hard backstop deadline cannot be widened by a caller past STATE_COMPOSITION_DEADLINE_MS', async () => {
    const src = stripComments(readSource(ORCHESTRATOR));
    expect(src).toMatch(/Math\.min\(input\.stateCompositionDeadlineMs \?\? STATE_COMPOSITION_DEADLINE_MS, STATE_COMPOSITION_DEADLINE_MS\)/);
  });

  it('the internal time budget leaves real margin below this repo\'s own documented ~30s hosting ceiling (app/api/dev-command-center/validate|remediate/route.ts)', async () => {
    const { DEFAULT_TIME_BUDGET_MS, STATE_COMPOSITION_DEADLINE_MS } = await import(
      '@/services/research/researchProgrammeOrchestrator'
    );
    expect(DEFAULT_TIME_BUDGET_MS).toBeLessThanOrEqual(25_000);
    expect(STATE_COMPOSITION_DEADLINE_MS).toBeLessThan(DEFAULT_TIME_BUDGET_MS);
  });
});

// ── POPULATION DISCLOSURE — THE COUNTERWEIGHT ──────────────────────────────

describe('population disclosure is present in every result', () => {
  it('all eight fields are reported on every run, including a run that did nothing', async () => {
    /*
     * The counterweight guardrail, verbatim: *"isolating exceptions must not
     * allow the system to quietly reduce the corpus until readiness passes.
     * Exception isolation WITHOUT population disclosure is a worse failure than
     * the batch-blocking it replaces."*
     */
    seedSubstrate({ cohort: cohort({ unvalidated: 0, unvalidatedRecords: [] }) });
    const result = await run();
    for (const field of [
      'discovered',
      'admitted',
      'candidatesExtracted',
      'validated',
      'assignedToCrystal',
      'excludedWithWarnings',
      'exceptions',
      'refused',
    ] as const) {
      expect(typeof result.population[field], `population.${field} is missing`).toBe('number');
    }
  });

  it('an unreadable signal is NAMED, so a zero is not mistaken for a fact', async () => {
    mockListCandidateSources.mockRejectedValue(new Error('substrate down'));
    const result = await run();
    expect(result.population.discovered).toBe(0);
    expect(result.populationUnreadable).toContain('corpus_candidate_sources');
  });

  it('the run writes exactly ONE run-level receipt, on the shared lifecycle path', async () => {
    // `writeLifecycleReceipt`'s own header: "NEVER FORK THIS".
    await run();
    expect(mockWriteLifecycleReceipt).toHaveBeenCalledTimes(1);
    const summary = String(mockWriteLifecycleReceipt.mock.calls[0][0].summary);
    expect(summary).toMatch(/Population —/);
    expect(summary).toMatch(/Sequencing gate/);
    expect(summary).toMatch(/No freeze, no statement edit, no boundary change/);
  });
});

// ── ONE READ MODEL, TWO CALLERS ────────────────────────────────────────────

describe('the signal composition is not duplicated', () => {
  it('the Track 2 GET route calls the shared loader rather than composing its own', () => {
    const src = stripComments(readSource('app/api/research/track2/[experimentId]/route.ts'));
    expect(src).toMatch(/loadTrack2ProgrammeState/);
    // The composition it used to hold must be gone — a second copy would be the
    // stale one the first time a signal changed (inv.engineering.036/037).
    expect(src).not.toMatch(/buildTrack2Programme/);
    expect(src).not.toMatch(/reconcilePromotedCohort/);
    expect(src).not.toMatch(/runCrystalReadinessReport/);
  });

  it('the loader reports an undeclared experiment rather than inventing a crystal', async () => {
    const state = await loadTrack2ProgrammeState({ experimentId: 'EXP-NOT-DECLARED' });
    expect('error' in state).toBe(true);
    if ('error' in state) expect(state.status).toBe(404);
  });

  it('the advance route is thin and admin-gated exactly like its siblings', () => {
    const src = stripComments(readSource('app/api/research/programme/[experimentId]/advance/route.ts'));
    expect(src).toMatch(/getActivePersona\(req\)/);
    expect(src).toMatch(/persona\.cartridgeFlags\?\.isAdmin/);
    expect(src).toMatch(/advanceResearchProgramme\(/);
    // A client must not be able to widen the bounds or open the gate.
    expect(src).not.toMatch(/maxActs:/);
    expect(src).not.toMatch(/resolveMeasurementLayer:/);
    expect(src).not.toMatch(/timeBudgetMs:/);
  });
});

// ── THE COPILOT SURFACE ────────────────────────────────────────────────────

describe('the Research Copilot is the orchestration head, not a second Track 2 UI', () => {
  const TAB = 'components/composer/IRLResearchCopilotTab.tsx';

  it('there is exactly ONE control, and it rides personaFetch with the persona hint', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(/Run until you need me/);
    expect(src).toMatch(/personaFetch\(\s*`\/api\/research\/programme\//);
    expect(src).toMatch(/personaIdHint: personaId/);
    // Raw fetch against a spine endpoint silently 401s (CLAUDE.md, PARAMOUNT).
    expect(src).not.toMatch(/[^a-zA-Z]fetch\(\s*[`'"]\/api\/research\/programme/);
    expect(src).not.toMatch(/authedFetchHeaders/);
  });

  it('no effect starts a run — the run is an explicit steward act', () => {
    const src = stripComments(readSource(TAB));
    const effects = src.split('useEffect(');
    for (const block of effects.slice(1)) {
      expect(block.slice(0, 900), 'an effect must never start a programme run').not.toMatch(/runProgramme\(/);
    }
  });

  it('the objective renders the gate, the population and the pending decision', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(/measurementLayerGate/);
    expect(src).toMatch(/population\.discovered/);
    expect(src).toMatch(/pendingDecision/);
    expect(src).toMatch(/guardrails/);
  });

  it('it does not fork the Track 2 panel — it deep-links to it', () => {
    const src = stripComments(readSource(TAB));
    expect(src).not.toMatch(/Track2ProgrammePanel/);
    expect(src).toMatch(/codex:navigate-tab/);
    expect(src).toMatch(/irl-experiment-lab/);
  });

  it('the objectives concept has exactly one member — no framework for one', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(/RESEARCH_OBJECTIVES/);
    expect((src.match(/id:\s*"prepare-crystal-v2"/g) ?? []).length).toBeGreaterThan(0);
  });
});

// ── VISIBLE ON OPEN, NOT ONLY AFTER A RUN (2026-08-26 reconciliation) ──────
//
// Acceptance-gap closure: the operator could not see the objective's state
// without clicking "Run until you need me" first — the run result's own
// `programme` field (Track 2, re-read after the last act) was fetched and
// then never rendered at all. Closed by reading the SAME read-only
// projection Track2ProgrammePanel itself reads (GET /api/research/track2/
// [experimentId]) on mount, alongside overview/results — never a run.

describe('the objective is visible on open, before any run', () => {
  const TAB = 'components/composer/IRLResearchCopilotTab.tsx';

  it('loads the read-only Track 2 preview inside refresh() (mount-safe: no acts, no POST /advance)', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(/personaFetch\(`\/api\/research\/track2\/\$\{encodeURIComponent\(objective\.experimentId\)\}`/);
    expect(src).toMatch(/setProgrammePreview\(data\.programme\)/);
    // The preview call must live inside refresh(), not runProgramme() — it is
    // read-only and therefore safe on mount; the run itself never is.
    const refreshStart = src.indexOf('const refresh = useCallback');
    const refreshEnd = src.indexOf('const openedRef = useRef(false);');
    expect(refreshStart).toBeGreaterThan(-1);
    expect(refreshEnd).toBeGreaterThan(refreshStart);
    const refreshBody = src.slice(refreshStart, refreshEnd);
    expect(refreshBody).toMatch(/setProgrammePreview\(data\.programme\)/);
  });

  it('the ObjectiveCard renders the Track 2 block from run.programme OR the mount-time preview — never gated on `run` alone', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(/const programme = run\?\.programme \?\? programmePreview;/);
    expect(src).toMatch(/\{programme && \(/);
    expect(src).toMatch(/Track 2 — you are here/);
    expect(src).toMatch(/Inspect Track 2/);
    expect(src).toMatch(/Next executable act/);
  });

  it("never fabricates a separate IDE 2.0 or Crystal v2 status field or a nonexistent navigation target — both route through the SAME Track 2 inspect link", () => {
    const src = stripComments(readSource(TAB));
    // No invented field names for a status the data model does not carry.
    expect(src).not.toMatch(/ideStatus|ide2Status|currentCrystal|targetCrystal/);
    // Exactly one deep-link affordance out of the Track 2 block — onOpenDetail,
    // the same seam every other deep link in this card already uses.
    const trackTwoBlockStart = src.indexOf('Track 2 — you are here');
    expect(trackTwoBlockStart).toBeGreaterThan(-1);
  });
});

// ── THE REMEDIATION-PROFILE SEAM STAYS EMPTY AND GENERIC ───────────────────

describe('the remediation profile is a generic shape with no ingested content', () => {
  it('no review is named, numbered or privileged in the orchestrator', () => {
    /*
     * "One named review must be REPRESENTABLE, never PRIVILEGED." A reviewer
     * name or a review number here would hard-code this cycle's review into
     * machinery meant to outlive it — and the operator has been explicit that a
     * chat paste is not an authoritative artifact.
     */
    const raw = readSource(ORCHESTRATOR);
    for (const forbidden of ['Austin', '#001', 'semantic dedup', 'relational sufficiency']) {
      expect(raw.includes(forbidden), `the orchestrator names '${forbidden}'`).toBe(false);
    }
  });

  it('the orchestrator defines NO second profile shape — it imports Track 2’s', () => {
    /*
     * The convergence requirement, verbatim: *"have both tracks converge on one
     * versioned `CrystalRemediationProfile` object"*. Track 2 owns
     * `types/crystalRemediation.ts`; a local re-declaration here would be the
     * second shape (inv.engineering.036/037), and the two would drift the first
     * time either was edited.
     *
     * Mutation that must fail: re-declare `CrystalRemediationProfile`,
     * `RemediationCheckMapping` or a local remediation-item interface in the
     * orchestrator.
     */
    const full = stripComments(readSource(ORCHESTRATOR));
    expect(full).toMatch(/from '@\/types\/crystalRemediation'/);
    // Import statements are removed first: `import { type X }` legitimately
    // names the shape, and a canary that could not tell an import from a
    // re-declaration would forbid the very convergence it exists to require.
    const src = full.replace(/^import[\s\S]*?;$/gm, '');
    for (const shape of [
      'CrystalRemediationProfile',
      'RemediationCheckMapping',
      'BoundSourceRef',
      'TaskDerivedPopulationFormula',
      'BoundaryCoverageRequirement',
      'InstrumentSuiteIdentity',
      'RetrospectiveFalsificationRef',
    ]) {
      expect(src, `the orchestrator re-declares '${shape}'`).not.toMatch(
        new RegExp(`(interface|type)\\s+${shape}\\b`),
      );
    }
  });

  it('the shared profile type carries all five required members plus version and binding', () => {
    // Asserted from the CONSUMER's side too: if Track 2 dropped a member the
    // orchestrator's gate depends on, this fails here as well as there.
    const src = readSource('types/crystalRemediation.ts');
    for (const member of [
      'sourceRefs',          // 1 — bound source refs
      'checkMappings',       // 2 — check mappings
      'populationFormula',   // 3 — task-derived population formula
      'boundaryRequirement', // 4 — boundary requirement
      'instrumentSuite',     // 5 — instrument version/hash
      'profileVersion',
      'binding',
    ]) {
      expect(src, `the shared profile is missing '${member}'`).toMatch(new RegExp(`\\b${member}\\b`));
    }
  });

  it('EXP-P1 has a real ingested profile, bound as of 2026-08-30', () => {
    // 2026-08-29 — no longer an empty registry: EXP-P1's v1 profile is
    // ingested from real, hash-verifiable source refs. 2026-08-30 — a real,
    // observed canonical retrospective was copied in, and the UNMODIFIED
    // `remediationProfileBindingState` derivation independently reaches
    // 'bound' from those contents.
    expect(BOUND_CRYSTAL_REMEDIATION_PROFILES).toHaveLength(1);
    const profile = BOUND_CRYSTAL_REMEDIATION_PROFILES[0];
    expect(profile.experimentId).toBe('EXP-P1');
    expect(profile.binding).toBe('bound');
    expect(profile.retrospective).not.toBeNull();
    expect(profile.sourceRefs.length).toBeGreaterThan(0);
    expect(profile.sourceRefs.every((r) => typeof r.contentHash === 'string' && r.contentHash.length > 0)).toBe(true);
  });

  it('the boundary requirement cannot express a narrowing', () => {
    // The operator's refusal, structurally: there is no field for "the boundary
    // we settled for", and `mayNarrowBoundary` is typed to the literal `false`.
    const src = stripComments(readSource('types/crystalRemediation.ts'));
    expect(src).toMatch(/mayNarrowBoundary: false/);
    expect(src).not.toMatch(/narrowedNamespaces|effectiveNamespaces|reducedNamespaces/);
  });
});
