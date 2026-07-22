/**
 * Crystal Intrinsic Readiness Report — PRD-EPI-001 §3.1.
 *
 * Assesses a crystal domain's invariant collection WITHOUT reference to any
 * task set — the crystal must stand on its own (IRL-016 §5 /
 * CRYSTAL-ENLARGEMENT_plan.md §4's "sacred" sequence: enlarge → FREEZE
 * crystal → construct tasks independently). This report is what gates
 * `crystal-version`'s `validated → frozen` transition
 * (services/research/artifacts.ts::checkFreezeGate) — but this module is a
 * pure query+report function. It does NOT touch the freeze gate itself; the
 * calling session wires that integration once this and a parallel task-
 * coverage build both land, to avoid two agents editing checkFreezeGate
 * concurrently.
 *
 * `crystalDomain` defaults to 'constitutional-reasoning' — the name
 * CRYSTAL-ENLARGEMENT_plan.md uses in prose — but as of this build there is
 * NO live `invariant_contexts` row anywhere in the corpus actually tagged
 * with that domain (Track 2, the crystal source-material work that would
 * populate one, is a separately-chartered and currently-PAUSED workstream).
 * Every check below therefore degrades HONESTLY when the domain has no
 * invariants yet: it reports zero / insufficient and fails closed — it never
 * crashes, and it never silently reports readiness for a domain with no data.
 *
 * Server-only.
 */

import { listInvariants } from '@/services/invariants/store';
import type { InvariantRecord } from '@/types/invariants';

/**
 * PRD-EPI-001 §9 / CRYSTAL-ENLARGEMENT_plan.md §2a — only these two
 * provenance classes are eligible for the EXP-P1 crystal. Read from
 * `InvariantRecord.provenance.provenanceClass` (the vocabulary
 * PRD-ICA-001 §0.3 ratifies) — a JSON blob field on `invariants.provenance`,
 * not yet a first-class column. A missing/unset tag is treated as NOT
 * eligible (fail closed — eligibility is never assumed).
 */
const ELIGIBLE_PROVENANCE_CLASSES = new Set(['external-established', 'external-empirical']);

/** Heuristic-only statement-shape signal for "this looks relational or
 * conditional, not a bare atomic assertion" — see looksDerivationEligible. */
const RELATIONAL_SHAPE_PATTERN =
  /\b(if|when|unless|whenever|therefore|implies|because|provided that|only if|given that|such that|entails|requires that)\b/i;

export interface CrystalReadinessInput {
  /** FK to ResearchExperiment.id (e.g. 'EXP-P1'). Not itself used to filter
   * the invariant query below (crystal readiness is domain-scoped, not
   * experiment-scoped) — carried through into failure details for
   * traceability, and kept in the signature because callers key every
   * PRD-EPI-001 report by experiment. */
  experimentId: string;
  /** CRYSTAL-ENLARGEMENT_plan.md's prose name for the domain. No live
   * invariant_contexts row carries this tag yet (Track 2 paused) — an empty
   * result is EXPECTED right now and must be reported honestly, never
   * treated as a bug in this function. */
  crystalDomain?: string;
  /** Arm C's fixed slice must remain a genuine, non-trivial proper subset —
   * this is the floor on `floor(0.4 * N)` below which a subset can't be
   * called "meaningful" (EXP-P1 README §3). Illustrative default only
   * (PRD-EPI-001 §0.5) — never a hard requirement. */
  minMeaningfulSliceSize?: number;
  /** Minimum fraction of the collection that must show derivation-eligible
   * (relational/conditional/compositional) shape — CRYSTAL-ENLARGEMENT_plan.md
   * §3 condition d. Illustrative default only. */
  minDerivationEligibleFraction?: number;
  /** Above this fraction, one semantic_type "shape" is considered to be
   * monopolizing the collection — README §3.1's "duplicate-shape ratio
   * exceeds a documented threshold". Illustrative default only. */
  maxDominantShapeFraction?: number;
  /** Near-duplicate statement similarity threshold (Jaccard over normalized
   * word sets) at/above which two statements are flagged as duplicates. */
  duplicateSimilarityThreshold?: number;
  /** Max invariants to fetch for the domain (services/invariants/store.ts
   * hard-caps at 500 server-side regardless of what's requested here). */
  fetchLimit?: number;
}

export interface CrystalReadinessCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface CrystalReadinessReport {
  ok: boolean;
  checks: CrystalReadinessCheck[];
  invariantCount: number;
  eligibleCount: number;
}

function normalizeStatement(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * HEURISTIC, not a formal entailment analysis: near-duplicate detection via
 * normalized-text Jaccard similarity over word sets. This catches lexical
 * near-duplicates only — it will miss paraphrases with low word overlap and
 * can false-positive on short, generic statements that happen to share most
 * of their words. Documented limit, not a semantic dedup engine.
 */
function findNearDuplicatePairs(
  invariants: InvariantRecord[],
  threshold: number,
): Array<[string, string]> {
  const normalized = invariants.map((inv) => ({
    id: inv.id,
    words: new Set(normalizeStatement(inv.statement).split(' ').filter(Boolean)),
  }));
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (jaccardSimilarity(normalized[i].words, normalized[j].words) >= threshold) {
        pairs.push([normalized[i].id, normalized[j].id]);
      }
    }
  }
  return pairs;
}

/**
 * HEURISTIC, not a certainty: whether an invariant's statement plausibly
 * carries relational/conditional/compositional structure (as opposed to a
 * bare atomic assertion) — CRYSTAL-ENLARGEMENT_plan.md §3 condition d. Uses
 * two cheap proxies (semantic_type in a relational-leaning class, or a
 * logical-connective word pattern in the statement text). Neither proxy is a
 * substitute for actually checking that a conjunction of invariants entails
 * an unstated conclusion — that requires the real derivation-task probe
 * (P-IRL-3), not this function.
 */
function looksDerivationEligible(inv: InvariantRecord): boolean {
  if (inv.semanticType === 'constraint' || inv.semanticType === 'law') return true;
  return RELATIONAL_SHAPE_PATTERN.test(inv.statement);
}

function groupBySemanticType(invariants: InvariantRecord[]): Map<string, number> {
  const groups = new Map<string, number>();
  for (const inv of invariants) {
    const key = inv.semanticType ?? 'unspecified';
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return groups;
}

/**
 * Run all six PRD-EPI-001 §3.1 checks for one crystal domain. Never throws:
 * a substrate read failure is reported as a single failing check, not a
 * crash, and an empty domain reports `ok: false` with zero/insufficient
 * counts rather than silently passing.
 */
export async function runCrystalReadinessReport(
  input: CrystalReadinessInput,
): Promise<CrystalReadinessReport> {
  const crystalDomain = input.crystalDomain ?? 'constitutional-reasoning';
  const minMeaningfulSliceSize = input.minMeaningfulSliceSize ?? 5;
  const minDerivationEligibleFraction = input.minDerivationEligibleFraction ?? 0.2;
  const maxDominantShapeFraction = input.maxDominantShapeFraction ?? 0.8;
  const duplicateSimilarityThreshold = input.duplicateSimilarityThreshold ?? 0.85;
  const fetchLimit = input.fetchLimit ?? 500;

  let invariants: InvariantRecord[];
  try {
    invariants = await listInvariants({
      domain: crystalDomain,
      status: ['validated', 'canonical'],
      limit: fetchLimit,
    });
  } catch (error) {
    return {
      ok: false,
      invariantCount: 0,
      eligibleCount: 0,
      checks: [
        {
          name: 'invariant-fetch',
          passed: false,
          detail:
            `could not read domain '${crystalDomain}' for experiment '${input.experimentId}' from the invariant ` +
            `substrate: ${error instanceof Error ? error.message : String(error)} — reported as not-ready, ` +
            `never crashed and never silently passed`,
        },
      ],
    };
  }

  const invariantCount = invariants.length;
  const checks: CrystalReadinessCheck[] = [];

  // 1. Selection space — Arm C's fixed slice must remain a genuine ⊆40%
  // proper subset at meaningful size (EXP-P1 README §3).
  const sliceCap = Math.floor(invariantCount * 0.4);
  const selectionSpaceOk =
    invariantCount > 0 && sliceCap >= minMeaningfulSliceSize && sliceCap < invariantCount;
  checks.push({
    name: 'selection-space',
    passed: selectionSpaceOk,
    detail:
      invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — no ⊆40% subset choice is possible`
        : `⌊0.4 × ${invariantCount}⌋ = ${sliceCap} available for a fixed Arm C slice ` +
          `(need ≥ ${minMeaningfulSliceSize} to be meaningful, and < ${invariantCount} to remain a proper subset)`,
  });

  // 2. Derivation headroom (heuristic — see looksDerivationEligible's docs).
  const derivationEligible = invariants.filter(looksDerivationEligible);
  const derivationFraction = invariantCount > 0 ? derivationEligible.length / invariantCount : 0;
  checks.push({
    name: 'derivation-headroom',
    passed: invariantCount > 0 && derivationFraction >= minDerivationEligibleFraction,
    detail:
      `${derivationEligible.length}/${invariantCount} invariants show relational/conditional/compositional ` +
      `shape by a HEURISTIC proxy (semanticType ∈ {constraint, law}, or a logical-connective statement pattern) ` +
      `— ${(derivationFraction * 100).toFixed(1)}%, need ≥ ${(minDerivationEligibleFraction * 100).toFixed(0)}%. ` +
      `This is not a formal entailment check.`,
  });

  // 3. Structural diversity — spans multiple semantic_types, not N
  // repetitions of one shape.
  const shapeGroups = groupBySemanticType(invariants);
  const distinctShapes = shapeGroups.size;
  const dominantShapeCount = shapeGroups.size > 0 ? Math.max(...shapeGroups.values()) : 0;
  const dominantShapeFraction = invariantCount > 0 ? dominantShapeCount / invariantCount : 1;
  const diversityOk =
    invariantCount > 0 && distinctShapes >= 2 && dominantShapeFraction <= maxDominantShapeFraction;
  checks.push({
    name: 'structural-diversity',
    passed: diversityOk,
    detail:
      `${distinctShapes} distinct semantic_type shape(s) present; the largest shape covers ` +
      `${(dominantShapeFraction * 100).toFixed(1)}% of the collection (need ≥ 2 shapes and no single shape ` +
      `> ${(maxDominantShapeFraction * 100).toFixed(0)}%)`,
  });

  // 4. Duplicate detection (heuristic — see findNearDuplicatePairs's docs).
  const duplicatePairs = findNearDuplicatePairs(invariants, duplicateSimilarityThreshold);
  checks.push({
    name: 'duplicate-detection',
    passed: duplicatePairs.length === 0,
    detail:
      duplicatePairs.length === 0
        ? 'no near-duplicate statements found at the configured similarity threshold (lexical heuristic only)'
        : `${duplicatePairs.length} near-duplicate statement pair(s) found (e.g. ${duplicatePairs[0][0]} ~ ` +
          `${duplicatePairs[0][1]}) — unresolved duplicates fail this check`,
  });

  // 5. Provenance eligibility — only external-established | external-empirical.
  const eligibleInvariants = invariants.filter((inv) => {
    const tag = inv.provenance?.provenanceClass;
    return typeof tag === 'string' && ELIGIBLE_PROVENANCE_CLASSES.has(tag);
  });
  const eligibleCount = eligibleInvariants.length;
  checks.push({
    name: 'provenance-eligibility',
    passed: invariantCount > 0 && eligibleCount === invariantCount,
    detail:
      `${eligibleCount}/${invariantCount} invariants carry an eligible provenance.provenanceClass ` +
      `(external-established | external-empirical); any invariant with a missing, platform-derived, or ` +
      `platform-hypothesized tag blocks this check (PRD-EPI-001 §9)`,
  });

  // 6. Lifecycle/validation integrity — no zero-validation filler.
  const zeroValidated = invariants.filter((inv) => inv.timesValidated <= 0);
  checks.push({
    name: 'lifecycle-validation-integrity',
    passed: invariantCount > 0 && zeroValidated.length === 0,
    detail:
      invariantCount > 0 && zeroValidated.length === 0
        ? `all ${invariantCount} invariants carry real (> 0) validation counts`
        : `${zeroValidated.length}/${invariantCount} invariant(s) carry zero validations — real receipted ` +
          `validation is required, never bulk-authored filler (CRYSTAL-ENLARGEMENT_plan.md §2 condition a)`,
  });

  const ok = checks.every((c) => c.passed);
  return { ok, checks, invariantCount, eligibleCount };
}
