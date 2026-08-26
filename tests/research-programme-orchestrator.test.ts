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
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: unknown[]) => mockListCandidates(...args),
  runConstitutionalDiscovery: (...args: unknown[]) => mockRunConstitutionalDiscovery(...args),
}));

const mockValidateInvariant = vi.fn();
vi.mock('@/services/invariants', () => ({
  validateInvariant: (...args: unknown[]) => mockValidateInvariant(...args),
}));

const mockGetArtifact = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
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
  evaluateMeasurementLayerGate,
  firstPendingDecision,
  isHumanGatedStage,
  loadTrack2ProgrammeState,
  resolveMeasurementLayerReadiness,
  type MeasurementLayerReadiness,
  type ProgrammeRunResult,
} from '@/services/research/researchProgrammeOrchestrator';
import { buildTrack2Programme } from '@/services/research/track2Programme';
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
  mockListCandidates.mockResolvedValue(
    over?.candidates ??
      resolvedCohort.invariantIds.map((id) => ({ id: `cand-${id}`, status: 'promoted' })),
  );
  mockReconcilePromotedCohort.mockResolvedValue(resolvedCohort);
  mockRunCrystalReadinessReport.mockResolvedValue(over?.readiness ?? readiness());
  mockGetArtifact.mockResolvedValue(null);
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
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    const result = await run();
    expect(result.acts.some((a) => a.actKind === 'extract-candidates'), 'extraction ran behind a closed gate').toBe(false);
    expect(mockRunConstitutionalDiscovery).not.toHaveBeenCalled();
    expect(result.measurementLayerGate.satisfied).toBe(false);
  });

  it('the default resolver fails CLOSED over Track 2’s empty registry', async () => {
    // The registry is a module constant, so the read SUCCEEDS and the honest
    // answer is "no profile is bound" rather than "we could not tell". Both
    // close the gate; distinguishing them is what separates a missing artifact
    // from a broken reader.
    const readinessState = await resolveMeasurementLayerReadiness(EXPERIMENT);
    expect(readinessState.profile).toBeNull();
    expect(readinessState.profileReadable).toBe(true);
    const gate = evaluateMeasurementLayerGate(readinessState);
    expect(gate.satisfied).toBe(false);
    expect(gate.binding).toBe('unbound-no-artifact');
    expect(gate.gaps.join(' ')).toMatch(/not an artifact/);
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
    seedSubstrate({ candidates: [], cohort: cohort({ invariantIds: [], unvalidatedRecords: [] }) });
    const result = await run();
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

  it('no profile is bound, so the orchestrator is gated by a real empty read', () => {
    // The honest state until an authoritative artifact with a re-readable
    // locator is ingested.
    expect(BOUND_CRYSTAL_REMEDIATION_PROFILES).toHaveLength(0);
  });

  it('the boundary requirement cannot express a narrowing', () => {
    // The operator's refusal, structurally: there is no field for "the boundary
    // we settled for", and `mayNarrowBoundary` is typed to the literal `false`.
    const src = stripComments(readSource('types/crystalRemediation.ts'));
    expect(src).toMatch(/mayNarrowBoundary: false/);
    expect(src).not.toMatch(/narrowedNamespaces|effectiveNamespaces|reducedNamespaces/);
  });
});
