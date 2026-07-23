/**
 * Corpus Scout (PRD-ICA-001) — Phase 3 LIGHTWEIGHT corpus intelligence
 * (§8 structural-value classification, §12 coverage metrics, §14.3).
 *
 * Everything in this module is HEURISTIC ONLY — keyword/pattern matching over
 * already-extracted text and exact-hash comparison over already-computed
 * digests. No ML, no LLM calls, no network access, no DB access: every
 * function here is pure and unit-testable (mirroring the pure-function/
 * orchestrator separation PRD-ICA-001 §0.4 mandates). The outputs ASSIST the
 * human reviewer (§8: "assist review, never replace human judgment") — they
 * are advisory metadata, never an approval/rejection decision.
 */

import type { CandidateSourceRow, ReviewWorkflowStatus, StructuralValueTag } from './types';

// ── Structural-value classification (§8) ────────────────────────────────────

/**
 * HEURISTIC keyword/pattern signals per structural-value tag. A single
 * case-insensitive match assigns the tag — deliberately coarse: the tag's job
 * is to surface likely reasoning structure to a human reviewer scanning a
 * candidate list, not to be right about every document. False positives are
 * acceptable; silent crashes and false authority are not.
 */
const TAG_PATTERNS: ReadonlyArray<[StructuralValueTag, RegExp]> = [
  ['causal', /\b(because|therefore|leads? to|results? in|causes?\b|caused by|consequently|as a result|gives? rise to)\b/i],
  ['conditional', /\bif\b[^.\n]{0,120}\bthen\b|\b(provided that|unless|conditional (?:up)?on|in the event (?:that|of)|contingent on)\b/i],
  ['relational', /\b(proportional to|correlat\w*|inversely|varies with|relative to|as a function of|depends? on)\b/i],
  ['mathematical', /[∑∫√±≤≥]|\b(equation|formula|coefficient|derivative|logarithm|exponent\w*|variance|standard deviation)\b/i],
  ['probabilistic', /\b(probabilit\w*|likelihood|stochastic|distribution|confidence interval|expected value|random variable)\b/i],
  ['temporal', /\b(over time|time horizon|duration|maturity|lagged?|annualis?ed|annualized|decay|intertemporal)\b/i],
  ['threshold-based', /\b(threshold|exceed(?:s|ed|ing)?|floor|ceiling|trigger(?:s|ed)? (?:at|when)|minimum requirement|upper limit|lower limit)\b/i],
  ['feedback', /\b(feedback loop|self-reinforc\w*|procyclical|amplif\w*|spiral\w*|vicious (?:cycle|circle)|reflexiv\w*)\b/i],
  ['trade-off', /\b(trade-?offs?|at the expense of|balanced against|opportunity cost|comes? at the cost)\b/i],
  ['constraint', /\b(must not|shall not|prohibited|not permitted|constraints?|restricted to|bounded by|may not exceed)\b/i],
  ['failure-derived', /\b(failures?|collapse[ds]?|defaults? (?:on|of)|insolven\w*|post-?mortem|lessons? learned|breach\w*|crisis|crises)\b/i],
  ['governance', /\b(governance|oversight|fiduciary|supervis\w*|regulator\w*|board approval|must comply|mandate[ds]?)\b/i],
  ['definitional', /\b(is defined as|refers to|definition of|for the purposes of this|hereinafter|means\b)\b/i],
  ['empirical-association', /\b(empirical\w*|observed|evidence suggests|stud(?:y|ies) (?:found|show)|data (?:show|indicate)|statistically significant|sample of)\b/i],
];

export interface StructuralClassification {
  /** Always true — this classification is a keyword heuristic, not a model
   *  judgment. Consumers must present it as such. */
  heuristic: true;
  tags: StructuralValueTag[];
}

/**
 * Classify a candidate's normalized text into PRD-ICA-001 §8 structural-value
 * tags via keyword/pattern HEURISTICS. Empty/blank text yields no tags and
 * never throws.
 */
export function classifyStructuralValue(normalizedText: string): StructuralClassification {
  const text = typeof normalizedText === 'string' ? normalizedText : '';
  if (!text.trim()) return { heuristic: true, tags: [] };
  const tags = TAG_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  return { heuristic: true, tags };
}

// ── Lane-coverage assessment (§12 source-lane coverage metric) ──────────────

const APPROVED_STATUSES: ReadonlySet<ReviewWorkflowStatus> = new Set([
  'approved_exp_p1', 'approved_general_finance', 'approved_reference_only',
]);
const PENDING_STATUSES: ReadonlySet<ReviewWorkflowStatus> = new Set([
  'pending_review', 'needs_retrieval_fix',
]);

export interface LaneCoverageRow {
  /** `campaign_sub_domain`, or '(unassigned)' where none was recorded. */
  lane: string;
  total: number;
  pending: number;
  approved: number;
  /** Everything else — rejected_*, duplicate, superseded. */
  closed: number;
  byStatus: Partial<Record<ReviewWorkflowStatus, number>>;
  /** Gap Detection (Constitutional Discovery amendment §6): true when this
   *  lane matches a ratified Constitutional Coverage Model pillar key. Absent
   *  entirely for callers that don't pass `requiredLanes` — existing
   *  behavior is unchanged. */
  required?: boolean;
}

/**
 * Per-lane counts by review status — the §12 coverage-control view, so one
 * lane (e.g. regulatory sources) cannot silently dominate the corpus while
 * others sit empty. Pure aggregation over rows the caller already holds.
 *
 * `requiredLanes` (optional, additive — Constitutional Discovery amendment
 * §6 "Gap Detection"): when supplied, every required lane gets a row even if
 * zero candidates have been submitted for it yet (total: 0), so the function
 * can answer "what's still missing" against a ratified Coverage Model, not
 * just "what exists." Existing callers that omit this parameter see
 * byte-for-byte the same output as before this parameter existed.
 */
export function assessLaneCoverage(
  candidates: ReadonlyArray<Pick<CandidateSourceRow, 'campaignSubDomain' | 'reviewWorkflowStatus'>>,
  requiredLanes?: readonly string[],
): LaneCoverageRow[] {
  const lanes = new Map<string, LaneCoverageRow>();
  for (const c of candidates) {
    const lane = c.campaignSubDomain?.trim() || '(unassigned)';
    let row = lanes.get(lane);
    if (!row) {
      row = { lane, total: 0, pending: 0, approved: 0, closed: 0, byStatus: {} };
      lanes.set(lane, row);
    }
    row.total += 1;
    row.byStatus[c.reviewWorkflowStatus] = (row.byStatus[c.reviewWorkflowStatus] ?? 0) + 1;
    if (APPROVED_STATUSES.has(c.reviewWorkflowStatus)) row.approved += 1;
    else if (PENDING_STATUSES.has(c.reviewWorkflowStatus)) row.pending += 1;
    else row.closed += 1;
  }

  if (requiredLanes && requiredLanes.length > 0) {
    for (const requiredLane of requiredLanes) {
      const lane = requiredLane.trim();
      if (!lane) continue;
      let row = lanes.get(lane);
      if (!row) {
        row = { lane, total: 0, pending: 0, approved: 0, closed: 0, byStatus: {} };
        lanes.set(lane, row);
      }
      row.required = true;
    }
  }

  return [...lanes.values()].sort((a, b) => b.total - a.total || a.lane.localeCompare(b.lane));
}

// ── Duplicate detection (§8 — exact matches only) ───────────────────────────

export interface DuplicateGroup {
  matchType: 'artifact-hash' | 'normalized-text-hash' | 'canonical-url';
  /** The shared hash/URL value the group matched on. */
  key: string;
  sourceIds: string[];
}

/**
 * Find EXACT duplicate candidates: identical `artifact_hash` (byte-identical
 * files — mirrors), identical `normalized_text_hash` (same extracted text
 * behind different bytes, e.g. re-encoded copies), or identical canonical
 * URL (re-submissions). This is byte/string equality only — it catches
 * mirrors and re-submissions, NOT paraphrases, revised editions, or
 * translations (that judgment stays with the human reviewer; full version
 * resolution is out of scope for this heuristic pass). Null hashes are never
 * grouped. Groups already fully covered by a stronger match are not repeated.
 */
export function findDuplicateCandidates(
  candidates: ReadonlyArray<Pick<CandidateSourceRow, 'sourceId' | 'artifactHash' | 'normalizedTextHash' | 'canonicalUrl'>>,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const emittedMemberSets: string[] = [];

  const collect = (
    matchType: DuplicateGroup['matchType'],
    keyOf: (c: (typeof candidates)[number]) => string | null,
  ) => {
    const byKey = new Map<string, string[]>();
    for (const c of candidates) {
      const key = keyOf(c);
      if (!key) continue; // never group missing hashes/URLs together
      const list = byKey.get(key) ?? [];
      list.push(c.sourceId);
      byKey.set(key, list);
    }
    for (const [key, sourceIds] of byKey) {
      if (sourceIds.length < 2) continue;
      const signature = [...sourceIds].sort().join('|');
      if (emittedMemberSets.includes(signature)) continue; // same set, stronger axis already reported
      emittedMemberSets.push(signature);
      groups.push({ matchType, key, sourceIds });
    }
  };

  collect('artifact-hash', (c) => c.artifactHash);
  collect('normalized-text-hash', (c) => c.normalizedTextHash);
  collect('canonical-url', (c) => c.canonicalUrl?.trim() || null);
  return groups;
}
