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

import { listInvariants, listEdgesForInvariants } from '@/services/invariants/store';
import type { InvariantRecord } from '@/types/invariants';

/**
 * PRD-EPI-001 §9 / CRYSTAL-ENLARGEMENT_plan.md §2a as REFINED by the operator
 * ruling of 2026-07-27 — the primary EXP-P1 population is Population A, whose
 * membership is decided by EVIDENCE provenance alone (never by where the
 * invariant was discovered). This module no longer keeps its own copy of the
 * eligible set: `inPrimaryPopulation` / `partitionByPopulation` in
 * `experimentalPopulations` are the single authority (inv.engineering.036), and
 * they read both the structured `provenance.provenanceClass` field and the
 * `evidenceProvenance=` key=value idiom the seed file uses. A missing/unset
 * tag is still NOT eligible (fail closed — eligibility is never assumed).
 *
 * The ABLATION arm (Populations A ∪ B) is reported alongside the primary count
 * below, permanently: a conclusion that survives both analyses is stronger
 * than one obtained by relaxing the rule.
 */
import {
  inPrimaryPopulation,
  partitionByPopulation,
} from '@/services/research/experimentalPopulations';

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
  /**
   * Minimum standard graph density (unique undirected intra-crystal pairs ÷
   * N(N-1)/2) required to call the collection "related" rather than a bag of
   * unconnected statements — PRD-EPI-001 §3.1's "relationship density" check.
   * Illustrative default only, same discipline as the other thresholds here.
   */
  minRelationshipDensity?: number;
  /** Minimum fraction of the collection that must sit in the single largest
   * connected component (over intra-crystal edges) — a crystal fragmented
   * into many small unconnected clusters cannot support cross-invariant
   * derivation chains regardless of its raw edge count. */
  minConnectivityRatio?: number;
  /** Above this fraction, too many invariants carry NO intra-crystal
   * relationship at all (in either direction) — orphan statements do not
   * benefit from the graph-structured retrieval the crystal exists to test. */
  maxOrphanFraction?: number;
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
  /** Population A — the PRIMARY EXP-P1 evaluation population. */
  eligibleCount: number;
  /**
   * The mechanical A/B/C/unclassified split (operator ruling 2026-07-27),
   * reported on EVERY readiness report so the ablation arm is a permanent
   * feature rather than something a reader has to reconstruct from prose.
   * `ablationCount` = A + B.
   */
  populations: {
    A: number;
    B: number;
    C: number;
    unclassified: number;
    ablationCount: number;
  };
  /** Fraction of the collection classified derivation-eligible by the
   * heuristic proxy (check #2) — exposed numerically so a consumer (e.g.
   * crystalStatistics.ts's "derivation headroom" figure) reads the SAME
   * computed value the check itself gated on, rather than re-deriving it. */
  derivationEligibleFraction: number;
  /** Near-duplicate pair count from check #4 (findNearDuplicatePairs),
   * exposed numerically for the same reason — one authoritative computation,
   * reused by crystalStatistics.ts's duplicate-ratio figure. */
  duplicatePairCount: number;
  /** Structural graph facts computed once and reused across the three
   * graph-shaped checks (relationship-density, graph-connectivity,
   * orphan-detection) — reported here too so a caller doesn't have to
   * re-derive them from the checks' prose details. */
  graph: {
    relationshipCount: number;
    relationshipDensity: number;
    componentCount: number;
    largestComponentSize: number;
    connectivityRatio: number;
    orphanCount: number;
    orphanFraction: number;
  };
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

/**
 * Intra-crystal edges only: both endpoints must be members of the domain's
 * own invariant set. An edge reaching OUTSIDE the crystal says nothing about
 * whether the crystal is internally related — counting it would let a single
 * invariant with many cross-domain edges masquerade as a well-connected
 * collection while every other member sits unconnected to it.
 */
async function fetchIntraCrystalEdges(
  invariants: InvariantRecord[],
): Promise<{ pairs: Array<[string, string]>; degree: Map<string, number> }> {
  const ids = invariants.map((inv) => inv.id);
  const idSet = new Set(ids);
  const degree = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return { pairs: [], degree };

  const edges = await listEdgesForInvariants(ids, 'both');
  const seenPairs = new Set<string>();
  const pairs: Array<[string, string]> = [];
  for (const edge of edges) {
    if (!idSet.has(edge.fromInvariantId) || !idSet.has(edge.toInvariantId)) continue;
    if (edge.fromInvariantId === edge.toInvariantId) continue; // no self-loops in the density/connectivity math
    const key = [edge.fromInvariantId, edge.toInvariantId].sort().join('~');
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    pairs.push([edge.fromInvariantId, edge.toInvariantId]);
    degree.set(edge.fromInvariantId, (degree.get(edge.fromInvariantId) ?? 0) + 1);
    degree.set(edge.toInvariantId, (degree.get(edge.toInvariantId) ?? 0) + 1);
  }
  return { pairs, degree };
}

/** Union-find over the intra-crystal undirected pairs — connected-component
 * sizes are the mechanical basis for the graph-connectivity check. */
function connectedComponentSizes(ids: readonly string[], pairs: ReadonlyArray<[string, string]>): number[] {
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const [a, b] of pairs) union(a, b);
  const sizes = new Map<string, number>();
  for (const id of ids) {
    const root = find(id);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  return [...sizes.values()];
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
 * Run all nine PRD-EPI-001 §3.1 checks for one crystal domain — the original
 * six (selection-space, derivation-headroom, structural-diversity,
 * duplicate-detection, provenance-eligibility, lifecycle-validation-integrity)
 * plus three graph-structural checks added for Crystal Expansion Readiness
 * (relationship-density, graph-connectivity, orphan-detection — CFS-054).
 * Never throws: a substrate read failure is reported as a single failing
 * check, not a crash, and an empty domain reports `ok: false` with
 * zero/insufficient counts rather than silently passing.
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
    // FAIL-CLOSED FIX 2026-07-26: this was `duplicatePairs.length === 0`, which
    // reports passed:true on an EMPTY collection — "no duplicates found" is
    // vacuously true when there is nothing to compare. Every sibling check
    // here already guards with `invariantCount > 0`; this one did not, so a
    // readiness report on a domain with zero invariants carried one green
    // check. That is precisely the silent-readiness failure the report exists
    // to prevent.
    passed: invariantCount > 0 && duplicatePairs.length === 0,
    detail:
      invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — duplicate detection has nothing to compare, ` +
          `which is not evidence of readiness`
        : duplicatePairs.length === 0
          ? 'no near-duplicate statements found at the configured similarity threshold (lexical heuristic only)'
          : `${duplicatePairs.length} near-duplicate statement pair(s) found (e.g. ${duplicatePairs[0][0]} ~ ` +
            `${duplicatePairs[0][1]}) — unresolved duplicates fail this check`,
  });

  // 5. Provenance eligibility — Population A only (§2a as refined 2026-07-27).
  //    Membership is decided by EVIDENCE provenance alone. An invariant the IDE
  //    discovered from an independently authored external corpus is Population
  //    A; where the discovery happened is recorded separately and is not
  //    consulted here.
  const partition = partitionByPopulation(invariants, (inv) => inv.provenance);
  const eligibleInvariants = invariants.filter((inv) => inPrimaryPopulation(inv.provenance));
  const eligibleCount = eligibleInvariants.length;
  const ablationCount = partition.A.length + partition.B.length;
  checks.push({
    name: 'provenance-eligibility',
    passed: invariantCount > 0 && eligibleCount === invariantCount,
    // The A/B/C/unclassified split rides in THIS check's detail rather than in
    // a row of its own. The ablation is a reporting obligation, not a gate, and
    // a non-gating row in a list where every entry must fail closed on an empty
    // collection is exactly the decorative-mechanism defect the sibling canary
    // catches (it did, on the first run). Structured counts: `populations`.
    detail:
      `${eligibleCount}/${invariantCount} invariants are Population A (evidence provenance ` +
      `external-established | external-empirical); any invariant with a missing, platform-derived, ` +
      `platform-hypothesized or platform-doctrine evidence provenance blocks this check ` +
      `(PRD-EPI-001 §9; CRYSTAL-ENLARGEMENT_plan.md §2a as refined 2026-07-27). ` +
      `Populations — A (external-derived) ${partition.A.length} · B (platform-derived) ${partition.B.length} · ` +
      `C (platform doctrine) ${partition.C.length} · unclassified ${partition.unclassified.length}; ` +
      `P1 Core = A (${eligibleCount}), P1 Ablation = A ∪ B (${ablationCount}). Both results are reported ` +
      `for every crystal — a conclusion that survives both analyses is stronger than one obtained by ` +
      `relaxing the rule (operator ruling 2026-07-27).`,
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

  // 7–9. Relationship density / graph connectivity / orphan detection —
  // Workstream 2's graph-structural checks (PRD-EPI-001 §3.1). All three
  // read the SAME intra-crystal edge fetch so they can never disagree about
  // which edges exist; each fails closed on invariantCount <= 1 (a graph of
  // zero or one node has no density/connectivity/orphan question to answer,
  // and reporting "passed" for "nothing to check" is the exact vacuous-pass
  // defect the duplicate-detection fix above already corrected once).
  const minRelationshipDensity = input.minRelationshipDensity ?? 0.05;
  const minConnectivityRatio = input.minConnectivityRatio ?? 0.6;
  const maxOrphanFraction = input.maxOrphanFraction ?? 0.1;

  let intraPairs: Array<[string, string]> = [];
  let degree = new Map<string, number>(invariants.map((inv) => [inv.id, 0]));
  let edgeFetchError: string | null = null;
  try {
    const fetched = await fetchIntraCrystalEdges(invariants);
    intraPairs = fetched.pairs;
    degree = fetched.degree;
  } catch (error) {
    // Fail closed, same discipline as the top-level invariant-fetch guard:
    // an unreachable edge substrate reports as zero relationships (every
    // graph check below then honestly fails) rather than throwing out of
    // the whole report or silently skipping the three graph checks.
    edgeFetchError = error instanceof Error ? error.message : String(error);
  }
  const edgeFetchSuffix = edgeFetchError
    ? ` (edge substrate unreachable: ${edgeFetchError} — reported as zero relationships, not skipped)`
    : '';
  const relationshipCount = intraPairs.length;
  const maxPossiblePairs = invariantCount > 1 ? (invariantCount * (invariantCount - 1)) / 2 : 0;
  const relationshipDensity = maxPossiblePairs > 0 ? relationshipCount / maxPossiblePairs : 0;

  checks.push({
    name: 'relationship-density',
    passed: invariantCount > 1 && relationshipDensity >= minRelationshipDensity,
    detail:
      invariantCount <= 1
        ? `${invariantCount} invariant(s) in domain '${crystalDomain}' — density over a graph of ≤1 node is undefined, ` +
          `which is not evidence of relatedness`
        : `${relationshipCount} intra-crystal relationship(s) over ${invariantCount} invariants — density ` +
          `${relationshipDensity.toFixed(3)} (${(relationshipDensity * 100).toFixed(1)}% of ${maxPossiblePairs} possible ` +
          `undirected pairs), need ≥ ${minRelationshipDensity.toFixed(3)}. Counts only edges where BOTH endpoints are ` +
          `in this crystal — an edge reaching outside it says nothing about whether the crystal is internally related.` +
          edgeFetchSuffix,
  });

  const componentSizes = connectedComponentSizes(
    invariants.map((inv) => inv.id),
    intraPairs,
  );
  const largestComponent = componentSizes.length > 0 ? Math.max(...componentSizes) : 0;
  const connectivityRatio = invariantCount > 0 ? largestComponent / invariantCount : 0;
  checks.push({
    name: 'graph-connectivity',
    passed: invariantCount > 1 && connectivityRatio >= minConnectivityRatio,
    detail:
      invariantCount <= 1
        ? `${invariantCount} invariant(s) — connectivity is undefined below 2 nodes`
        : `${componentSizes.length} connected component(s) over ${invariantCount} invariants; the largest holds ` +
          `${largestComponent} (${(connectivityRatio * 100).toFixed(1)}%), need ≥ ${(minConnectivityRatio * 100).toFixed(0)}% ` +
          `in one component — a crystal fragmented into many small disjoint clusters cannot support the ` +
          `cross-invariant derivation chains the graph-structured retrieval is meant to test` +
          edgeFetchSuffix,
  });

  const orphans = invariants.filter((inv) => (degree.get(inv.id) ?? 0) === 0);
  const orphanFraction = invariantCount > 0 ? orphans.length / invariantCount : 1;
  checks.push({
    name: 'orphan-detection',
    passed: invariantCount > 0 && orphanFraction <= maxOrphanFraction,
    detail:
      invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — orphan detection has nothing to compare`
        : `${orphans.length}/${invariantCount} invariant(s) carry ZERO intra-crystal relationships ` +
          `(${(orphanFraction * 100).toFixed(1)}%), need ≤ ${(maxOrphanFraction * 100).toFixed(0)}%` +
          (orphans.length > 0 ? ` — e.g. ${orphans[0].id}` : '') +
          edgeFetchSuffix,
  });

  const ok = checks.every((c) => c.passed);
  return {
    ok,
    checks,
    invariantCount,
    eligibleCount,
    populations: {
      A: partition.A.length,
      B: partition.B.length,
      C: partition.C.length,
      unclassified: partition.unclassified.length,
      ablationCount,
    },
    derivationEligibleFraction: derivationFraction,
    duplicatePairCount: duplicatePairs.length,
    graph: {
      relationshipCount,
      relationshipDensity,
      componentCount: componentSizes.length,
      largestComponentSize: largestComponent,
      connectivityRatio,
      orphanCount: orphans.length,
      orphanFraction,
    },
  };
}
