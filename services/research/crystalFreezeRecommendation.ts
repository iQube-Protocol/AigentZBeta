/**
 * Crystal Freeze Recommendation — CFS-054 / PRD-EPI-001 §3.1 Workstream 4.
 *
 * Composes an already-run `CrystalReadinessReport` and `CrystalStatisticsReport`
 * into an ADVISORY verdict for the operator: `READY_FOR_FREEZE` or `NOT_READY`,
 * with checkmarked rationale and a remaining-risks section. This module NEVER
 * ratifies, freezes, writes to `research_objects`, or calls `freezeArtifact` —
 * it is read-only composition over already-computed figures, exactly like
 * `readinessDashboard.ts`'s relationship to `crystalReadiness.ts`.
 *
 * The verdict is a MECHANICAL derivation (`readiness.ok`), never a separate
 * judgement call layered on top of the checks — a recommendation that could
 * say READY while a check fails would be exactly the self-attested "looks
 * good" this programme exists to replace with computed evidence.
 *
 * "Preparing a crystal for freeze" is engineering; "freezing a crystal" is
 * the operator's constitutional act (CFS-054 §1). This module produces the
 * former's output only. See services/research/crystalFreezeCeremony.ts for
 * the (also non-executing) package the operator's ratification act consumes.
 */

import { runCrystalReadinessReport, type CrystalReadinessReport } from '@/services/research/crystalReadiness';
import { runCrystalStatisticsReport, type CrystalStatisticsReport } from '@/services/research/crystalStatistics';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';

export type FreezeVerdict = 'READY_FOR_FREEZE' | 'NOT_READY';

/**
 * Was there anything to assess at all?
 *
 * ── The defect this closes (operator report, 2026-08-02) ───────────────────
 *
 * `NOT_READY` is two-valued, so an empty domain and a genuinely failing
 * collection produce the SAME verdict and nine near-identical failures. The
 * operator's own bundle read as nine defects in Crystal vP1; what it actually
 * showed was a domain with no rows in it, where every check correctly declines
 * to certify an empty set.
 *
 * That distinction matters most to the reader we can least afford to mislead.
 * An external reviewer opening a package of nine failures concludes the crystal
 * is broken. The truth is that the workstream which populates it has not run —
 * a different fact, calling for a different response, from a different party.
 *
 * The VERDICT stays mechanically derived from `readiness.ok` (an unpopulated
 * domain is emphatically not ready). This says whether the verdict was earned
 * by assessment or reached by default.
 */
export type CrystalAssessability =
  /** Rows existed and the checks ran against them. The verdict is a finding. */
  | 'ASSESSED'
  /** The domain holds no invariants. The verdict is a default, not a finding. */
  | 'DOMAIN_UNPOPULATED';

/**
 * Why an unpopulated domain is expected right now — stated in the payload, not
 * left for a reader to infer from nine zeroes.
 *
 * `crystalReadiness.ts`'s own header records this: no live `invariant_contexts`
 * row carries the crystal domain tag, because Track 2 — the crystal
 * source-material workstream — is separately chartered and PAUSED. Its plan
 * (CRYSTAL-ENLARGEMENT_plan.md, status PLANNED) is explicit that this is
 * "genuine lab work, not a quick fix", that the collection must grow through
 * receipted `proposed → validated` accrual, and that "no invariant is authored
 * to hit a number".
 *
 * So this is not a defect to be fixed in code, and must never be presented as
 * one — nor worked around by relaxing the readiness filter, which would admit
 * unvalidated rows to make a count rise.
 */
export const DOMAIN_UNPOPULATED_PROVENANCE =
  'This crystal domain holds no invariants yet. The readiness checks below therefore report zero and fail ' +
  'closed — that is the checks behaving correctly on an empty set, not a finding about the collection. ' +
  'Populating the domain is Track 2 (crystal enlargement), a separately chartered workstream: see ' +
  'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/CRYSTAL-ENLARGEMENT_plan.md. ' +
  'It proceeds by receipted proposed→validated accrual and never by authoring invariants to reach a number, ' +
  'so no change to this software can make the domain ready.';

export interface FreezeRationaleItem {
  id: string;
  label: string;
  satisfied: boolean;
  detail: string;
}

export interface CrystalFreezeRecommendation {
  ok: boolean;
  experimentId: string;
  crystalDomain: string;
  verdict: FreezeVerdict;
  /** Whether the verdict was earned by assessment or reached by default. */
  assessability: CrystalAssessability;
  /** Present only when `assessability` is 'DOMAIN_UNPOPULATED'. */
  unpopulatedProvenance?: string;
  rationale: FreezeRationaleItem[];
  remainingRisks: string[];
  readiness: CrystalReadinessReport;
  statistics: CrystalStatisticsReport;
  /** Stated on every recommendation, not just documented in a comment — a
   * reader of the JSON payload (not just the source) must see the disclaimer. */
  advisoryNote: string;
}

const ADVISORY_NOTE =
  'This recommendation is ADVISORY ONLY. It is computed from the Crystal Readiness Report and ' +
  'Crystal Statistics Report above and goes TO the operator — it never marks Crystal vP1 (or any ' +
  'crystal) as constitutionally frozen. Only an explicit operator ratification act, recorded through ' +
  'the Freeze Ceremony package and executed via freezeArtifact(), constitutes a freeze (CFS-054 §1).';

function findCheck(readiness: CrystalReadinessReport, name: string) {
  return readiness.checks.find((c) => c.name === name) ?? null;
}

/**
 * Pure composition — no I/O. Callers that already have both reports (e.g. a
 * UI that fetched them separately) should use this directly rather than
 * re-running the underlying reports a second time.
 */
export function composeCrystalFreezeRecommendation(
  experimentId: string,
  crystalDomain: string,
  readiness: CrystalReadinessReport,
  statistics: CrystalStatisticsReport,
): CrystalFreezeRecommendation {
  const named = [
    ['selection-space', 'sufficient-coverage', 'Sufficient coverage — a genuine, meaningful Arm C slice exists'],
    ['derivation-headroom', 'derivational-headroom-satisfied', 'Derivational headroom satisfied — the collection is not only atomic assertions'],
    ['structural-diversity', 'structural-diversity-satisfied', 'Structural diversity satisfied — multiple semantic-type shapes present'],
    ['duplicate-detection', 'no-duplicate-inflation', 'No duplicate inflation — no unresolved near-duplicate statements'],
    ['provenance-eligibility', 'provenance-verified', 'Provenance verified — every invariant carries an external evidence basis (Population A)'],
    ['lifecycle-validation-integrity', 'lifecycle-validated', 'Lifecycle/validation integrity — no zero-validation filler entries'],
    ['relationship-density', 'relationship-density-satisfied', 'Relationship density satisfied — the collection is graph-related, not a bag of statements'],
    ['graph-connectivity', 'graph-connectivity-satisfied', 'Graph connectivity satisfied — not fragmented into many disjoint clusters'],
    ['orphan-detection', 'no-excess-orphans', 'No excess orphans — few or no invariants carry zero relationships'],
  ] as const;

  const rationale: FreezeRationaleItem[] = named.map(([checkName, id, label]) => {
    const check = findCheck(readiness, checkName);
    return {
      id,
      label,
      satisfied: check?.passed ?? false,
      detail: check?.detail ?? `check '${checkName}' did not run`,
    };
  });

  // A summary item, mechanically derived from the SAME checks list above —
  // never a separate judgement. `readiness.ok` depends ONLY on
  // `scientific-readiness`-tier checks (operator ruling, 2026-08-05); this
  // item's own text must say so explicitly rather than claiming "all N
  // passed" when N includes the non-blocking `scientific-maturity` checks
  // (structural-diversity, graph-connectivity), which may still be failing
  // even when `ok` is true.
  const readinessTierChecks = readiness.checks.filter((c) => c.tier === 'scientific-readiness');
  rationale.unshift({
    id: 'readiness-checks-passed',
    label: 'Readiness checks passed',
    satisfied: readiness.ok,
    detail: readiness.ok
      ? `all ${readinessTierChecks.length} scientific-readiness checks passed (freeze-gating); ` +
        `scientific maturity ${readiness.maturity.passedCount}/${readiness.maturity.totalCount} (${readiness.maturity.band}, informational only)`
      : `${readinessTierChecks.filter((c) => !c.passed).length}/${readinessTierChecks.length} scientific-readiness checks failing: ` +
        readinessTierChecks.filter((c) => !c.passed).map((c) => c.name).join(', '),
  });

  // Nothing to assess is a different situation from assessed-and-failing, and
  // it belongs FIRST — a reader who does not learn it up front reads the nine
  // zeroes below as nine defects.
  const assessability: CrystalAssessability =
    readiness.invariantCount === 0 ? 'DOMAIN_UNPOPULATED' : 'ASSESSED';

  const remainingRisks: string[] = [];
  if (assessability === 'DOMAIN_UNPOPULATED') remainingRisks.push(DOMAIN_UNPOPULATED_PROVENANCE);
  for (const item of rationale) {
    if (!item.satisfied) remainingRisks.push(`${item.label}: ${item.detail}`);
  }
  if (statistics.substrateError) {
    remainingRisks.push(`Statistics substrate error: ${statistics.substrateError}`);
  }
  if (statistics.duplicateRatio > 0) {
    remainingRisks.push(
      `Non-zero duplicate ratio (${(statistics.duplicateRatio * 100).toFixed(2)}%) even though the gating ` +
        `duplicate-detection check passed at the configured threshold — a heuristic lexical measure, not a ` +
        'semantic dedup guarantee.',
    );
  }
  if (statistics.coverageEstimate.ratio < 1) {
    remainingRisks.push(
      `Domain coverage is ${(statistics.coverageEstimate.ratio * 100).toFixed(1)}% of the ratified namespace ` +
        `boundary (${statistics.coverageEstimate.representedNamespaceCount}/${statistics.coverageEstimate.boundaryNamespaceCount}) ` +
        '— not itself a gate, but a scope fact the operator should see before ratifying a domain boundary.',
    );
  }
  remainingRisks.push(
    'Duplicate and derivation-eligibility detection are lexical/statement-shape heuristics (documented limits in ' +
      'crystalReadiness.ts) — neither is a formal semantic-entailment check.',
  );
  remainingRisks.push(
    'Relationship/connectivity checks read only recorded invariant_edges rows — a corpus with real but ' +
      'un-annotated relationships will under-report density and connectivity, not over-report them.',
  );

  return {
    ok: readiness.ok,
    experimentId,
    crystalDomain,
    verdict: readiness.ok ? 'READY_FOR_FREEZE' : 'NOT_READY',
    assessability,
    ...(assessability === 'DOMAIN_UNPOPULATED' ? { unpopulatedProvenance: DOMAIN_UNPOPULATED_PROVENANCE } : {}),
    rationale,
    remainingRisks,
    readiness,
    statistics,
    advisoryNote: ADVISORY_NOTE,
  };
}

export interface RunCrystalFreezeRecommendationInput {
  experimentId: string;
  crystalDomain?: string;
  fetchLimit?: number;
}

/** I/O wrapper — runs both underlying reports fresh, then composes. */
export async function runCrystalFreezeRecommendation(
  input: RunCrystalFreezeRecommendationInput,
): Promise<CrystalFreezeRecommendation> {
  // The experiment's DECLARED domain (operator ruling, 2026-08-02) — the same
  // resolution readiness uses, so the two reports can never describe different
  // collections while claiming to describe one crystal.
  const crystalDomain =
    input.crystalDomain ?? crystalDomainForExperiment(input.experimentId)?.domain ?? 'constitutional-reasoning';
  const [readiness, statistics] = await Promise.all([
    runCrystalReadinessReport({ experimentId: input.experimentId, crystalDomain, fetchLimit: input.fetchLimit }),
    runCrystalStatisticsReport({ experimentId: input.experimentId, crystalDomain, fetchLimit: input.fetchLimit }),
  ]);
  return composeCrystalFreezeRecommendation(input.experimentId, crystalDomain, readiness, statistics);
}
