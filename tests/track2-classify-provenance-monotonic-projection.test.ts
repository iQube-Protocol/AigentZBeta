/**
 * Track 2 — "candidate-source substrate unreadable" must never regress the
 * canonical frontier away from real outstanding work (2026-09-04 repair).
 *
 * ── The live defect ──────────────────────────────────────────────────────
 *
 * Observed on EXP-P1: the Research Copilot correctly showed "Classify
 * Provenance — 53/58" (a real, well-defined 58-member successor cohort with
 * 53 unclassified / 55 unvalidated / 3 unresolved-relationship members), then
 * on a later refresh reverted to "Discover Sources" with "candidate-source
 * substrate could not be read" — even though the 58-member cohort and its
 * Stage 5/6/7 outstanding work were untouched throughout. Root cause, in
 * `buildTrack2Programme` (services/research/track2Programme.ts):
 *
 *   const current = stages.find((st) => st.status !== 'complete') ?? ...;
 *   const PASSES_THROUGH = new Set(['complete', 'partially-complete']);
 *
 * Stage 1 (`discover-sources`) reports `status: 'unknown'` whenever its own
 * `candidateSources` read fails — a signal about ACQUISITION observability,
 * not about the already-promoted cohort Stages 5-7 operate on (that cohort
 * is independently resolved from `promotedCohort`/`discoveryCandidates`,
 * never from `candidateSources`). Because 'unknown' was treated identically
 * to 'not-started'/'blocked'/'in-progress': (1) it won the "first non-
 * complete stage" scan, hijacking `currentStageId` from Stage 5's real work,
 * and (2) it was excluded from `unblockedStageIds`'s PASSES_THROUGH set, so
 * EVERY later stage — not just the display label — was excluded from
 * `unblockedStageIds`, which is what `unblockedStage`/`firstPendingDecision`
 * (services/research/researchProgrammeOrchestrator.ts) gate real act
 * offering on.
 *
 * ── Why the fix is NOT "unknown always wins the tie" ────────────────────────
 *
 * The first attempt at this fix was correctly challenged: treating every
 * stage's 'unknown' as universally harmless to its dependents would be an
 * overcorrection if a later stage actually trusted an earlier stage's
 * reported completion to decide whether ITS OWN work is real. That is not
 * how this pipeline is built: Stage 2 derives its status from
 * `candidateSources` directly, Stages 3-4 from `discoveryCandidates`
 * directly, and Stages 5-7 from `promotedCohort` directly (via the shared
 * `cohortGate()`) — every stage verifies its OWN substrate independently
 * rather than inheriting a completion judgement from the stage before it.
 * So an earlier stage's `unknown` (a health-check on ITS OWN read) has no
 * bearing on whether a LATER stage's OWN, separately-confirmed status is
 * real — passing 'unknown' through changes what an earlier read failure
 * WITHHOLDS from later stages; it never changes what may be done to the
 * unreadable stage itself, and a later stage whose OWN substrate is ALSO
 * unreadable still reports `unknown` for itself, unaffected by this.
 *
 * Candidate invariant: CI-2026-09-04-UNKNOWN-STAGE-NEVER-BLOCKS-VERIFIED-DOWNSTREAM-001.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTrack2Programme,
  type PromotedCohort,
  type Track2ProgrammeSignals,
} from '@/services/research/track2Programme';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalLifecycle } from '@/services/research/crystalDomains';

function readiness(): CrystalReadinessReport {
  return {
    ok: false,
    invariantCount: 58,
    eligibleCount: 5,
    populations: { A: 40, B: 10, C: 8, unclassified: 53, ablationCount: 0 },
    derivationEligibleFraction: 0.1,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 100,
      relationshipDensity: 0.1,
      componentCount: 2,
      largestComponentSize: 55,
      connectivityRatio: 0.9,
      orphanCount: 3,
      orphanFraction: 0.05,
    },
    checks: [],
  } as CrystalReadinessReport;
}

function lifecycle(): CrystalLifecycle {
  return {
    stageId: 'CANDIDATE_CONSTITUTED',
    label: 'Candidate Crystal Constituted',
    marker: '🟡',
    meaning: 'the successor cohort has outstanding scientific work',
    whatIsMissing: 'provenance/validation/relationships',
    remainingWorkKind: 'scientific',
    whoActs: 'Steward',
    ladder: [],
  } as unknown as CrystalLifecycle;
}

/** The real observed shape: 58 members, 53 unclassified, 55 unvalidated, 3 orphaned. */
function liveCohort(over: Partial<PromotedCohort> = {}): PromotedCohort {
  return {
    invariantIds: Array.from({ length: 58 }, (_, i) => `inv-${i}`),
    unclassified: 53,
    unvalidated: 55,
    graph: { relationshipCount: 100, orphanCount: 3 },
    excluded: [],
    unaccountedRecords: [],
    unclassifiedRecords: Array.from({ length: 53 }, (_, i) => ({ id: `inv-${i}` })) as never,
    unvalidatedRecords: Array.from({ length: 55 }, (_, i) => ({ id: `inv-${i}` })) as never,
    orphanRecords: Array.from({ length: 3 }, (_, i) => ({ id: `inv-${i}` })) as never,
    members: Array.from({ length: 58 }, (_, i) => ({ id: `inv-${i}`, statement: `s-${i}` })) as never,
    ...over,
  };
}

function programme(over: Partial<Track2ProgrammeSignals> = {}) {
  return buildTrack2Programme({
    experimentId: 'EXP-P1',
    crystalDomain: 'financial-risk-value-systems',
    acquisitionDomain: 'financial-services',
    signals: {
      // Stage 1's own signal is unreadable — the reported live defect.
      candidateSources: null,
      discoveryCandidates: { total: 58, awaitingReview: 0, promoted: 58, rejected: 0 },
      promotedCohort: liveCohort(),
      readiness: readiness(),
      lifecycle: lifecycle(),
      artifact: null,
      independentReviewRequestOpen: false,
      acquisitionSourceUniverse: null,
      ...over,
    },
  });
}

const stage = (p: ReturnType<typeof programme>, id: string) => p.stages.find((s) => s.id === id)!;

describe('an unreadable Stage 1 never hijacks the frontier away from a real, established successor cohort', () => {
  it('Stage 1 itself still honestly reports unknown — nothing here hides the read failure', () => {
    const p = programme();
    expect(stage(p, 'discover-sources').status).toBe('unknown');
    expect(stage(p, 'discover-sources').detail).toMatch(/candidate-source substrate could not be read/);
  });

  it('Stage 5 (Classify Provenance) keeps its real in-progress status — 53 of 58 unclassified', () => {
    const p = programme();
    const classify = stage(p, 'classify-provenance');
    expect(classify.status).toBe('in-progress');
    expect(classify.detail).toContain('53');
    expect(classify.detail).toContain('58');
  });

  it('currentStageId is classify-provenance, never discover-sources, while real work is outstanding downstream', () => {
    const p = programme();
    expect(p.currentStageId).toBe('classify-provenance');
  });

  it('unblockedStageIds includes classify-provenance — the actual defect (not just the display label)', () => {
    // This is the real-world severity of the bug: before the fix, Stage 1's
    // 'unknown' excluded EVERY later stage from unblockedStageIds, which is
    // what services/research/researchProgrammeOrchestrator.ts's
    // unblockedStage()/firstPendingDecision() gate real act-offering on — so
    // the Copilot didn't just mislabel the frontier, it lost the ability to
    // OFFER Classify Provenance at all.
    const p = programme();
    expect(p.unblockedStageIds).toContain('classify-provenance');
  });

  it('unknown is deprioritized behind EVERY other open status, not just behind real in-progress work — it never wins a tie against a merely optional, still-open later stage either', () => {
    // Push the whole pipeline to its far end: Stages 3-9 all complete,
    // Stage 10 (Prepare Independent Review) legitimately 'partially-complete'
    // (optional, may still open — it structurally never reaches 'complete').
    // Stage 1 stays 'unknown'. If the fix had gone too far the other way —
    // making 'unknown' win ties by ordinal position again — Stage 1 would
    // wrongly resurface as current here. It must not: currentStageId still
    // correctly names the real, still-open Stage 10, never the unreadable
    // Stage 1, because 'unknown' is the LAST resort for `current`, not a
    // tiebreaker.
    const p = programme({
      promotedCohort: liveCohort({
        unclassified: 0,
        unvalidated: 0,
        graph: { relationshipCount: 200, orphanCount: 0 },
        unclassifiedRecords: [],
        unvalidatedRecords: [],
        orphanRecords: [],
      }),
      readiness: {
        ...readiness(),
        ok: true,
        checks: [],
        maturity: { passedCount: 9, totalCount: 9, band: 'mature' },
      } as unknown as CrystalReadinessReport,
      independentReviewRequestOpen: true,
    });
    expect(stage(p, 'classify-provenance').status).toBe('complete');
    expect(stage(p, 'validate').status).toBe('complete');
    expect(stage(p, 'add-relationships').status).toBe('complete');
    expect(stage(p, 'run-readiness').status).toBe('complete');
    expect(stage(p, 'prepare-independent-review').status).toBe('partially-complete');
    expect(stage(p, 'discover-sources').status).toBe('unknown');
    expect(p.currentStageId).toBe('prepare-independent-review');
  });
});

describe('the boundary this fix must not cross: an unrelated stage\'s OWN unreadable substrate still reports unknown for ITSELF, unaffected by Stage 1 passing through', () => {
  it('Stage 2 (Review & Admit) unknown when its own candidateSources read fails, independent of Stage 1', () => {
    // Same input as the live defect (candidateSources: null drives BOTH
    // Stage 1 and Stage 2's status, since both read that one signal) —
    // pinning that Stage 2 is not silently promoted to a false 'complete'
    // just because it now passes through to unblock later stages.
    const p = programme();
    expect(stage(p, 'review-and-admit').status).toBe('unknown');
  });

  it('Stage 3/4 (Extract/Promote Candidates) report unknown when discoveryCandidates is unreadable, and Stage 5-7 still resolve from their OWN promotedCohort read, not from Stage 3/4\'s', () => {
    const p = programme({ discoveryCandidates: null });
    expect(stage(p, 'extract-candidates').status).toBe('unknown');
    expect(stage(p, 'review-and-promote').status).toBe('unknown');
    // The cohort itself is a SEPARATE signal (promotedCohort) — Stage 5's
    // own read did not fail, so its real outstanding work still surfaces.
    expect(stage(p, 'classify-provenance').status).toBe('in-progress');
    expect(p.currentStageId).toBe('classify-provenance');
  });

  it('when the cohort itself is unreadable (promotedCohort: null), Stages 5-7 correctly report unknown themselves — passing through Stage 1/2\'s unknown never fabricates a cohort that was not actually read', () => {
    const p = programme({ promotedCohort: null });
    expect(stage(p, 'classify-provenance').status).toBe('unknown');
    expect(stage(p, 'validate').status).toBe('unknown');
    expect(stage(p, 'add-relationships').status).toBe('unknown');
  });
});
