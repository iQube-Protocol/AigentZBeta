/**
 * Corpus → frozen review package, for one review instance.
 *
 * The single construction shared by the CLI runner and the Lab surface. Both
 * need the identical package — the CLI so a run is reproducible from a shell,
 * the Lab so the redacted preview a human approves is the same bytes the
 * reviewers receive. Two constructions would drift, and the drift would be
 * invisible exactly where it matters: in the preview a human looks at *in order
 * to trust the thing they are not looking at*.
 *
 * Lives outside `services/research/review/` because it reads the corpus, and
 * that directory is canaried to contain no database access whatsoever.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBlockDecision,
  buildReviewPackage,
  commit,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  type BlockDecision,
  type ReviewPackage,
  type ReviewSubjectRecord,
} from '@/services/research/review';
import {
  CLASS_C_BLOCK_RULING,
  CLASS_C_POPULATION_QUERY,
  EXP_P1_CHRONOLOGY,
  EXP_P1_COVERAGE,
  EXP_P1_NAMESPACE_BOUNDARY,
  EXP_P1_NON_TARGETS,
  EXP_P1_TARGET_STATEMENT,
  expP1ClassCExceptionRules,
  expP1MechanicalFlags,
  expP1MechanicalFlagsByRule,
} from '@/services/research/review/templates/expP1Admissibility';
import { GENERAL_CONSTITUTIONAL_NAMESPACES } from '@/services/research/experimentRelation';

const CORPUS_COLUMNS = 'id,seed_id,statement,namespace,status,provenance,created_at,updated_at';

interface CorpusRow {
  id: string;
  seed_id: string | null;
  statement: string;
  namespace: string;
  status: string;
  provenance: unknown;
  created_at: string;
  updated_at: string | null;
}

function readProvenanceClass(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== 'object') return null;
  const p = provenance as Record<string, unknown>;
  for (const k of ['provenanceClass', 'evidenceProvenance', 'provenance_class']) {
    if (typeof p[k] === 'string') return p[k] as string;
  }
  return null;
}

function readRefs(provenance: unknown, keys: readonly string[]): string[] {
  if (!provenance || typeof provenance !== 'object') return [];
  const p = provenance as Record<string, unknown>;
  const out: string[] = [];
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
    if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === 'string'));
  }
  return out;
}

/**
 * One corpus row as a reviewer sees it.
 *
 * Note what is NOT copied across: status is carried as `lifecycleStatus`
 * (evidence about the row), while Standing, times_validated, times_contradicted
 * and reach are never read at all. The package builder would refuse them, but
 * not selecting them in the first place means they cannot be leaked by an
 * intermediate object that forgets to strip them.
 */
export function corpusRowToSubject(row: CorpusRow): ReviewSubjectRecord {
  return {
    subjectRef: row.seed_id || row.id,
    statement: row.statement,
    namespace: String(row.namespace),
    sourceProvenance: readProvenanceClass(row.provenance),
    sourceRefs: readRefs(row.provenance, ['sourceRefs', 'sources', 'source', 'sourceUrl', 'ratified_source']),
    derivationRefs: readRefs(row.provenance, ['derivationRefs', 'derivedFrom', 'derivation', 'method']),
    createdAt: String(row.created_at ?? ''),
    revisedAt: row.updated_at ? String(row.updated_at) : null,
    lifecycleStatus: String(row.status),
  };
}

export interface ReviewPlan {
  reviewId: string;
  pkg: ReviewPackage;
  assetRef: string;
  assetCommitment: string;
  block: BlockDecision;
  corpusRowCount: number;
  inBoundaryCount: number;
  outOfBoundaryCount: number;
  /** Out-of-boundary rows by the namespace that excluded them (e.g. style, narrative). */
  outOfBoundaryByNamespace: Record<string, number>;
  classCCount: number;
  individuallyEnumerated: number;
  mechanicallyFlagged: string[];
  /** Same flags, broken down by which rule fired — see expP1MechanicalFlagsByRule. */
  mechanicallyFlaggedByRule: Record<string, string[]>;
  mechanicallyFlaggedRuleReasons: Record<string, string>;
  coverage: { sampleRate: number; sampleSeed: string };
}

/**
 * Read the corpus and build the frozen package.
 *
 * `createdAt` is a PARAMETER, so the same corpus at the same stated time
 * produces the same package hash whether the caller is a shell or a route.
 */
export async function buildReviewPlan(
  admin: SupabaseClient,
  input: { version: string; createdAt: string },
): Promise<ReviewPlan> {
  const rows: CorpusRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('invariants')
      .select(CORPUS_COLUMNS)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`corpus read failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as CorpusRow[]));
    if (!data || data.length < PAGE) break;
  }

  const boundary = new Set(EXP_P1_NAMESPACE_BOUNDARY);
  const inBoundary = rows.filter((r) => boundary.has(String(r.namespace)));
  const outOfBoundary = rows.filter((r) => !boundary.has(String(r.namespace)));
  const subjects = inBoundary.map(corpusRowToSubject);

  const outOfBoundaryByNamespace: Record<string, number> = {};
  for (const r of outOfBoundary) {
    const ns = String(r.namespace);
    outOfBoundaryByNamespace[ns] = (outOfBoundaryByNamespace[ns] ?? 0) + 1;
  }

  const classC = subjects.filter((s) => GENERAL_CONSTITUTIONAL_NAMESPACES.has(s.namespace));
  const individual = subjects.filter((s) => !GENERAL_CONSTITUTIONAL_NAMESPACES.has(s.namespace));

  const block = buildBlockDecision({
    blockId: `block.class-c.${input.version}`,
    ruling: CLASS_C_BLOCK_RULING,
    populationQuery: CLASS_C_POPULATION_QUERY,
    population: classC,
    exceptionRules: expP1ClassCExceptionRules(),
    taskConstructionBegun: false,
    taskConstructionEvidence:
      'No task specification exists in the repository at package-construction time; task construction ' +
      'follows the freeze, never precedes it.',
    sampleSeed: EXP_P1_COVERAGE.blockSampleSeed,
    samplePerNamespace: EXP_P1_COVERAGE.blockSamplePerNamespace,
  });

  const extractedRefs = new Set(block.extracted.map((e) => e.subjectRef));
  const sampleRefs = new Set(block.representativeSample);
  const packageSubjects = [
    ...individual,
    ...classC.filter((s) => extractedRefs.has(s.subjectRef) || sampleRefs.has(s.subjectRef)),
  ];

  // Content-derived, NOT wall-clock-derived (2026-07-30 fix) — the same
  // corpus/boundary/rubric/ruling must reproduce the same reviewId, so this
  // hashes the actual package CONTENT (the exact subject set and the block
  // decision's own outcome) rather than `input.createdAt`. Two builds from
  // identical inputs now get identical reviewId/packageId, and therefore
  // identical packageHash — see reviewPackage.ts's determinism fix.
  const reviewId = `review.${input.version}.${commit({
    v: input.version,
    subjectRefs: packageSubjects.map((s) => s.subjectRef).sort(),
    blockAssessed: block.assessed,
    blockAdmitted: block.admitted,
    blockExtractedRefs: block.extracted.map((e) => e.subjectRef).sort(),
  }).slice(0, 12)}`;
  const assetCommitment = commit({ subjects: packageSubjects.map((s) => s.subjectRef).sort() });

  const pkg = buildReviewPackage({
    packageId: `pkg.${reviewId}`,
    reviewId,
    assetRef: `crystal-${input.version}`,
    assetCommitment,
    targetDefinition: EXP_P1_TARGET_STATEMENT,
    nonTargets: EXP_P1_NON_TARGETS,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    sourceRefs: [
      'codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md',
      'codexes/packs/agentiq/updates/2026-07-29_external-review-rulings.md',
    ],
    chronology: EXP_P1_CHRONOLOGY,
    evidenceSummaries: [],
    subjects: packageSubjects,
    blockDecisions: [block],
    exclusionsFromPackage: outOfBoundary.map((r) => r.seed_id || r.id),
    createdAt: input.createdAt,
  });

  const { byRule: mechanicallyFlaggedByRule, ruleReasons: mechanicallyFlaggedRuleReasons } =
    expP1MechanicalFlagsByRule(packageSubjects);

  return {
    reviewId,
    pkg,
    assetRef: `crystal-${input.version}`,
    assetCommitment,
    block,
    corpusRowCount: rows.length,
    inBoundaryCount: inBoundary.length,
    outOfBoundaryCount: outOfBoundary.length,
    outOfBoundaryByNamespace,
    classCCount: classC.length,
    individuallyEnumerated: packageSubjects.length,
    mechanicallyFlagged: expP1MechanicalFlags(packageSubjects),
    mechanicallyFlaggedByRule,
    mechanicallyFlaggedRuleReasons,
    coverage: { sampleRate: EXP_P1_COVERAGE.sampleRate, sampleSeed: EXP_P1_COVERAGE.sampleSeed },
  };
}
