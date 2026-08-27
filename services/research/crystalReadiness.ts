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
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
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
import {
  computeFreezeBlocking,
  freezeBlockingExceptions,
  renderPopulationDisclosure,
  type IsolationException,
  type PopulationDisclosure,
} from '@/services/research/exceptionIsolation';
/**
 * ── IRL REVIEW #001 — REMEDIATION CYCLE 1 (2026-08-26) ────────────────────
 *
 * An external reviewer returned `changes_requested` on the FROZEN Crystal vP1.
 * The freeze machinery worked: the hash verified. What failed is this file. The
 * readiness gates certified a substrate that did not possess the properties the
 * gates purported to establish — they scored LABELS and LEXICAL DISTANCE rather
 * than content, and one of them had drifted below a frozen constraint.
 *
 * Four defects, and where each is now measured:
 *
 *   1. DUPLICATES. `findNearDuplicatePairs` compared word sets, so paraphrase
 *      pairs a human catches on first read passed. Now the union of that
 *      lexical pass and `findSemanticDuplicatePairs`, which compares
 *      direction-canonicalised predicate-argument FORMS
 *      (crystalSemanticStructure.ts). Same check name — `duplicate-detection`.
 *   2. STATEMENT QUALITY / DERIVATION HEADROOM. `looksDerivationEligible`
 *      tested `semanticType ∈ {constraint, law}` or a connective word, while
 *      the check's own label claimed to assess whether the collection is "not
 *      only atomic assertions". Now `assessInferentialCapacity` measures
 *      whether CONJUNCTIONS entail unstated conclusions (§6(d)'s actual
 *      requirement) and classifies each member against the operator's seven
 *      relational structures. The old label-diversity figure is retained,
 *      reported, and explicitly re-labelled as a proxy that no longer gates.
 *      Same check name — `derivation-headroom`.
 *   3. SIZE. `minMeaningfulSliceSize ?? 5` was criterion drift against the
 *      frozen §3.6 guard, which had already ruled an 18-invariant collection
 *      insufficient with worked arithmetic. Now derived:
 *      `required evaluation slice ÷ 0.40 = minimum collection size`
 *      (crystalPopulationRequirement.ts). Same check name — `selection-space`.
 *   4. COVERAGE. Namespace coverage was computed in crystalStatistics.ts and
 *      disclosed by crystalFreezeRecommendation.ts as "not itself a gate".
 *      At 2/15 the reviewer could not author tasks at all. Now a first-class
 *      gate — the ONE genuinely new check name, `boundary-coverage`, which
 *      requires a CFS-054 §2.5 amendment (drafted for the operator, never
 *      self-ratified).
 *
 * Three of the four are IMPLEMENTATION CORRECTIONS behind already-pinned check
 * names, not new gates: they are what those gates always claimed to be doing.
 *
 * WHAT IS DELIBERATELY UNCHANGED: frozen vP1, byte for byte, including its hash
 * AND the readiness results that let it through. Those results remain the record
 * of what the old instruments said. Nothing here re-scores history, and no
 * invariant statement text was authored, rewritten or re-tagged — that would
 * contaminate the experiment. The ratified namespace boundary is not narrowed;
 * `boundary-coverage` REPORTS against it and never adjusts it.
 */
import {
  assessInferentialCapacity,
  findSemanticDuplicatePairs,
  type InferentialCapacityAssessment,
  type SemanticDuplicatePair,
} from '@/services/research/crystalSemanticStructure';
import {
  deriveCrystalPopulationRequirement,
  type CrystalPopulationRequirement,
} from '@/services/research/crystalPopulationRequirement';
import {
  remediationClassForCheck,
  remediationStageAnchorForCheck,
  tierForCheck,
  type CheckRemediationClass,
  type CrystalReadinessTier,
  type Track2StageIdForRemediation,
} from '@/services/research/crystalInstrumentSuite';
import { INVARIANT_NAMESPACES } from '@/types/invariants';

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
  /**
   * RETIRED AS A GATE (IRL Review #001, 2026-08-26). This was
   * `?? 5` — "a slice of ≥5 is meaningful" — a number that appears in no
   * registered constraint and that passed collections the frozen §3.6 guard
   * had already rejected with worked arithmetic. `selection-space` now gates on
   * the DERIVED requirement (`crystalPopulationRequirement.ts`).
   *
   * The parameter is retained because it is part of this module's published
   * input shape, and it is still REPORTED in the check's detail for continuity
   * with historical reports — but supplying it can no longer weaken or
   * strengthen the gate. There is deliberately no fallback path to it: when the
   * derived requirement is unavailable the check reports insufficient-input and
   * fails closed, because a silent fallback is how the original drift survived.
   */
  minMeaningfulSliceSize?: number;
  /**
   * RETIRED AS A GATE (IRL Review #001, 2026-08-26). The fraction it bounded is
   * a LABEL-DIVERSITY proxy (`semanticType` class or a connective word), which
   * the reviewer correctly identified as scoring labels rather than content.
   * `derivation-headroom` now gates on inferential capacity — see
   * `CrystalReadinessReport.inferentialCapacity`. Still reported, explicitly as
   * a proxy, so the distinction the reviewer drew stays visible in the payload.
   */
  minDerivationEligibleFraction?: number;
  /**
   * The FINALIZED task set, when one exists. The §3.6 population requirement
   * derives from it in preference to the registered minimum design — so the
   * floor rises mechanically with the real design rather than needing a code
   * change. Absent, every derived figure is labelled a floor.
   */
  taskSet?: readonly import('@/services/research/taskCoverage').TaskDefinition[];
  /**
   * The DECLARED namespace boundary `boundary-coverage` measures against.
   * Defaults to the ratified `INVARIANT_NAMESPACES` ontology — the same list
   * `crystalStatistics.coverageEstimate` already used, so the two surfaces
   * cannot describe different boundaries.
   *
   * A caller may pass a NARROWER list only to inspect a hypothetical; doing so
   * never constitutes narrowing the ratified boundary, which is a governance
   * act performed elsewhere or not at all.
   */
  declaredNamespaceBoundary?: readonly string[];
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
  /**
   * Records excluded from this crystal, for SEPARATE disclosure (see
   * `excludedFromCrystal`). Reporting only — no check consults these, and
   * supplying them can never change `ok`. Their `blocksFreeze` is RECOMPUTED
   * here against this report's own checks, so a per-record assertion made
   * upstream can never survive as a freeze blocker the crystal does not
   * actually have (exception-isolation ruling §3).
   */
  exclusions?: readonly IsolationException[];
  /** The full population behind this crystal, for the same disclosure. */
  population?: PopulationDisclosure;
}

/**
 * Two tiers (operator ruling, 2026-08-05 — "Can this crystal be frozen? Is
 * this crystal considered scientifically ideal? Those are not the same
 * question."):
 *
 * - `scientific-readiness` — a hard gate. A crystal cannot legally freeze
 *   while one of these fails (data integrity, provenance eligibility,
 *   receipted validation, minimum graph structure). ALL of these must pass
 *   for `CrystalReadinessReport.ok`.
 * - `scientific-maturity` — informational, non-blocking. These describe how
 *   SCIENTIFICALLY COMPLETE the corpus is, not whether it is constitutionally
 *   sound. A first crystal of N repetitions of one semantic shape, or one
 *   still fragmented into disjoint clusters, is a true and useful finding —
 *   it is not evidence corruption, and treating it as a freeze blocker would
 *   mean no first crystal in a new domain could ever be ratified (a crystal
 *   improves after freezing the same way Standing accrues after a Passport is
 *   issued — neither invalidates what already exists). `ok` NEVER depends on
 *   a `scientific-maturity` check; see `CrystalReadinessReport.maturity` for
 *   the corresponding informational summary.
 *
 * If a specific experiment genuinely needs a maturity check enforced as a
 * hard gate, that is an EXPLICIT experiment policy to add on top of this
 * report — never an intrinsic property of the crystal itself.
 */
export type { CrystalReadinessTier };

export interface CrystalReadinessCheck {
  name: string;
  passed: boolean;
  detail: string;
  tier: CrystalReadinessTier;
  /**
   * WHAT FIXES THIS, in the lifecycle ladder's register (operator ruling,
   * 2026-08-02).
   *
   * ── The defect this closes ────────────────────────────────────────────────
   *
   * `detail` states a measurement — "3/14 invariants carry zero intra-crystal
   * relationships (21.4%), need ≤ 10%". A reader who does not already know the
   * substrate cannot get from that to an action, and the actions differ per
   * check by KIND: some need more corpus, some need relationships recorded, one
   * needs a provenance classification, one cannot be fixed at all because the
   * domain is empty. A failing check that does not say what fixes it sends the
   * operator to debug the engine, which is exactly what happened on 2026-08-02.
   *
   * `null` when the check passed — a remedy for a satisfied condition is noise.
   * Computed HERE, beside the measurement that produced it, so the two can
   * never describe different situations (inv.engineering.036).
   */
  remedy: string | null;
  /**
   * WHAT KIND of remediation, and WHERE — the summary-level routing the
   * operator asked to replace a generic "scroll to Stage 9" with (operator
   * ruling, 2026-08-27, "Crystal v1/v2 lineage collision", item 4). Sourced
   * from `crystalInstrumentSuite.ts`'s single check contract
   * (inv.engineering.036) — never a second, independently-maintained mapping.
   * Populated for every check, pass or fail, by a single enrichment pass at
   * the end of `runCrystalReadinessReport` — never at each individual
   * `checks.push` site, so there is exactly one place that can disagree with
   * `crystalInstrumentSuite.ts`'s contract. Declared optional only because
   * TypeScript cannot see that enrichment from each push-site's literal; both
   * fields are unconditionally present on every check this module returns.
   */
  remediationClass?: CheckRemediationClass;
  remediationStageAnchor?: Track2StageIdForRemediation | null;
  /**
   * Only populated on the `duplicate-detection` check — the exact
   * near-duplicate invariant id pairs the count in `detail` refers to, so a
   * real adjudication queue can act on them instead of only reporting a
   * number. `undefined` on every other check.
   */
  duplicatePairs?: Array<{ aId: string; bId: string }>;
}

/** Bronze/Silver/Gold — how many `scientific-maturity` checks currently pass.
 *  Never gates anything; a crystal can be frozen at any band. */
export type ScientificMaturityBand = 'bronze' | 'silver' | 'gold';

export interface CrystalMaturitySummary {
  checks: CrystalReadinessCheck[];
  passedCount: number;
  totalCount: number;
  band: ScientificMaturityBand;
}

export interface CrystalReadinessReport {
  /**
   * READY FOR FREEZE — true iff every `scientific-readiness`-tier check
   * passes. NEVER depends on a `scientific-maturity` check (operator ruling,
   * 2026-08-05) — see `CrystalReadinessCheck`'s own doc comment for why.
   */
  ok: boolean;
  checks: CrystalReadinessCheck[];
  /** Informational only — see `CrystalMaturitySummary`. Never consulted by `ok`. */
  maturity: CrystalMaturitySummary;
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
  /**
   * LABEL-DIVERSITY PROXY, not capacity (renamed in meaning, kept in name for
   * consumer continuity — IRL Review #001). The fraction of members whose
   * `semanticType` sits in a relational-leaning class OR whose text carries a
   * logical connective. This is the figure the pre-remediation
   * `derivation-headroom` check gated on, and the reviewer's point is precisely
   * that it is not evidence of inferential capacity. It is retained and
   * reported so the two can be COMPARED — a high proxy beside a near-zero
   * capacity is the exact signature of the vP1 defect.
   */
  derivationEligibleFraction: number;
  /**
   * The gating duplicate count: the UNION of lexical and semantic pairs. The
   * name is unchanged (crystalStatistics.ts's duplicate-ratio reads it), the
   * measurement is strictly stronger. Per-mechanism counts: `duplicates`.
   */
  duplicatePairCount: number;
  /**
   * Duplicate detection, per mechanism, so a reader can see WHICH pass found a
   * pair — and in particular how many pairs only the semantic pass could see.
   * `distinctStatementEstimate` is the number of equivalence classes under the
   * union relation (union-find over the pair graph, reusing the same
   * `connectedComponents` primitive the graph checks use): the answer to "how
   * many distinct statements does this collection really contain?".
   */
  duplicates: {
    lexicalPairCount: number;
    semanticPairCount: number;
    unionPairCount: number;
    /** Pairs the semantic pass found that the lexical pass did not. */
    semanticOnlyPairCount: number;
    distinctStatementEstimate: number;
    semanticPairs: SemanticDuplicatePair[];
  };
  /**
   * Whether the collection's CONJUNCTIONS can entail unstated conclusions —
   * §6(d)'s actual requirement, and what `derivation-headroom` now gates on.
   */
  inferentialCapacity: InferentialCapacityAssessment;
  /**
   * Namespace coverage against the DECLARED boundary — computed here, once, and
   * read by `crystalStatistics.coverageEstimate` rather than re-derived there
   * (inv.engineering.036). REPORTING plus gating (`boundary-coverage`); it never
   * adjusts the boundary.
   */
  coverage: {
    boundaryNamespaceCount: number;
    representedNamespaceCount: number;
    ratio: number;
    representedNamespaces: string[];
    missingNamespaces: string[];
  };
  /**
   * The §3.6-derived population requirement `selection-space` gated on —
   * carried on the report so a consumer reads the SAME derivation the check
   * used, including its auditable arithmetic lines.
   */
  populationRequirement: CrystalPopulationRequirement;
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
  /**
   * ── EXCLUSIONS, REPORTED SEPARATELY (exception-isolation ruling §3/§7) ────
   *
   *   > "Readiness assesses the ACTUAL assigned crystal, reporting excluded
   *   >  exceptions SEPARATELY — it must not treat every unassigned Track 2
   *   >  record as a crystal failure."
   *
   * This report already assessed only the ASSIGNED crystal: `listInvariants`
   * is filtered to `{ domain: crystalDomain, status: ['validated',
   * 'canonical'] }`, so an unassigned or unvalidated Track 2 record was never
   * one of the rows any check ran over. That property was already correct and
   * is unchanged.
   *
   * What was missing is the DISCLOSURE. A reader could not tell a crystal of
   * 26 invariants drawn from 26 candidates from a crystal of 26 drawn from
   * 300 — and the second is a materially narrow crystal that would otherwise
   * appear complete. `excludedFromCrystal` is that disclosure, and it is
   * REPORTING, never gating: no check consults it, and `ok` does not move
   * because of it.
   *
   * `null` when the caller supplied no exclusion context — honestly absent
   * rather than reported as zero, because "nothing was excluded" and "nobody
   * told us what was excluded" are different facts.
   */
  excludedFromCrystal: {
    /** Exceptions the caller carried in, recomputed for freeze-blocking
     *  against THIS report's own checks. */
    exceptions: IsolationException[];
    /** Those that genuinely block a freeze — computed, never asserted. */
    freezeBlockers: IsolationException[];
    /** The full population, so a narrow crystal cannot look complete. */
    population: PopulationDisclosure | null;
    /** Stated in one line for any surface that renders it. */
    disclosure: string;
  } | null;
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
 * The analysis fields for a report that could not read the substrate. Reported
 * absent-as-zero with an explicitly empty assessment rather than omitted, so a
 * consumer's field access never throws — but nothing here may read as a
 * finding: an infrastructure fault tells us nothing about the collection.
 */
function degradedAnalysisFields() {
  return {
    duplicates: {
      lexicalPairCount: 0,
      semanticPairCount: 0,
      unionPairCount: 0,
      semanticOnlyPairCount: 0,
      distinctStatementEstimate: 0,
      semanticPairs: [] as SemanticDuplicatePair[],
    },
    inferentialCapacity: assessInferentialCapacity([]),
    coverage: {
      boundaryNamespaceCount: 0,
      representedNamespaceCount: 0,
      ratio: 0,
      representedNamespaces: [] as string[],
      missingNamespaces: [] as string[],
    },
    populationRequirement: deriveCrystalPopulationRequirement(),
  };
}

/**
 * Intra-crystal edges only: both endpoints must be members of the domain's
 * own invariant set. An edge reaching OUTSIDE the crystal says nothing about
 * whether the crystal is internally related — counting it would let a single
 * invariant with many cross-domain edges masquerade as a well-connected
 * collection while every other member sits unconnected to it.
 */
export async function fetchIntraCrystalEdges(
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

/**
 * Union-find over the intra-crystal undirected pairs — full component
 * MEMBERSHIP, not just sizes. Exported (2026-08-05, Stage 9 bridge-candidate
 * remediation) so the graph-connectivity remedy can propose which SPECIFIC
 * invariants to relate across which SPECIFIC components, not just report a
 * count. `connectedComponentSizes` below derives sizes from this so the two
 * never disagree about the same partition.
 */
export function connectedComponents(ids: readonly string[], pairs: ReadonlyArray<[string, string]>): string[][] {
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
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const group = groups.get(root);
    if (group) group.push(id);
    else groups.set(root, [id]);
  }
  return [...groups.values()];
}

function connectedComponentSizes(ids: readonly string[], pairs: ReadonlyArray<[string, string]>): number[] {
  return connectedComponents(ids, pairs).map((group) => group.length);
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
  // The experiment's DECLARED domain, not a hardcoded default (operator
  // ruling, 2026-08-02). EXP-P1 draws from `financial-risk-value-systems`; the
  // historical `constitutional-reasoning` collection keeps its own identity and
  // is not relabelled to populate this surface. An explicit caller-supplied
  // domain still wins, so ad-hoc inspection of any domain is unaffected.
  const crystalDomain =
    input.crystalDomain ?? crystalDomainForExperiment(input.experimentId)?.domain ?? 'constitutional-reasoning';
  // Both retired as gates (IRL Review #001) — see their doc comments. Read
  // only to be REPORTED, never to decide a check. `?? null` rather than a
  // numeric default on purpose: there is no longer any number for the gate to
  // fall back to.
  const reportedLegacySliceFloor = input.minMeaningfulSliceSize ?? null;
  const reportedLegacyDerivationFloor = input.minDerivationEligibleFraction ?? null;
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
      // An infrastructure fault tells us nothing about exclusions either —
      // reported absent rather than as an empty (and therefore reassuring) list.
      excludedFromCrystal: null,
      invariantCount: 0,
      eligibleCount: 0,
      populations: { A: 0, B: 0, C: 0, unclassified: 0, ablationCount: 0 },
      derivationEligibleFraction: 0,
      duplicatePairCount: 0,
      ...degradedAnalysisFields(),
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
          tier: 'scientific-readiness',
          passed: false,
          detail:
            `could not read domain '${crystalDomain}' for experiment '${input.experimentId}' from the invariant ` +
            `substrate: ${error instanceof Error ? error.message : String(error)} — reported as not-ready, ` +
            `never crashed and never silently passed`,
          remedy:
            'This is an infrastructure fault, not a finding about the collection. Nothing about the crystal can ' +
            'be concluded from it. Restore the invariant substrate and re-run.',
        },
      ],
      maturity: { checks: [], passedCount: 0, totalCount: 0, band: 'bronze' },
    };
  }

  const invariantCount = invariants.length;
  const checks: CrystalReadinessCheck[] = [];

  /**
   * The one remedy that is NOT a remedy — stated once, shared by every check
   * that can only fail because the domain is empty.
   *
   * An empty domain is not a defective crystal, and telling the operator to
   * "fix" one of these checks would send them to correct something that is not
   * broken. The work is corpus construction, which is scientific.
   */
  const EMPTY_DOMAIN_REMEDY =
    `Nothing here has failed. Domain '${crystalDomain}' holds no invariants, so this check has nothing to ` +
    `assess. The missing thing is the crystal itself: Track 2 corpus acquisition — admit external sources, ` +
    `extract candidates, validate them through the receipted lifecycle, and assign the eligible ones to the ` +
    `ratified domain. Scientific work; no governance act and no code change moves it.`;

  // ── 1. SELECTION SPACE — now §3.6-DERIVED (IRL Review #001, finding 3) ────
  //
  // The gate was `sliceCap >= 5`. The frozen §3.6 guard had already ruled, with
  // worked arithmetic, that an 18-invariant collection (slice cap 7) was
  // "plainly insufficient to ground 24 tasks incl. 12 derivation items". A bar
  // of 5 therefore passed collections the protocol had already rejected. The
  // arithmetic is now derived and PRINTED, both operands and their sources
  // named, so a reader can audit the division without reading code.
  const populationRequirement = deriveCrystalPopulationRequirement(
    input.taskSet && input.taskSet.length > 0 ? { tasks: input.taskSet } : {},
  );
  const sliceFraction = populationRequirement.sliceFractionOfCrystal;
  const sliceCap = Math.floor(invariantCount * sliceFraction);
  const requiredSlice = populationRequirement.requiredEvaluationSliceSize;
  const minimumCollection = populationRequirement.minimumCollectionSize;
  const requirementDerivable = populationRequirement.derivable && requiredSlice !== null;
  const selectionSpaceOk =
    requirementDerivable &&
    invariantCount > 0 &&
    sliceCap >= (requiredSlice as number) &&
    sliceCap < invariantCount;
  const legacyFloorNote =
    reportedLegacySliceFloor === null
      ? ''
      : ` (caller supplied the RETIRED minMeaningfulSliceSize=${reportedLegacySliceFloor}; it is reported ` +
        `here and does not affect this gate)`;
  checks.push({
    name: 'selection-space',
    tier: tierForCheck('selection-space'),
    passed: selectionSpaceOk,
    detail: !requirementDerivable
      ? `INSUFFICIENT INPUT — the §3.6 population requirement is not derivable: ` +
        `${populationRequirement.insufficientInputs.join('; ') || 'no derivation was produced'}. ` +
        `Reported as unknown and failed closed; this check does NOT fall back to a default slice floor.` +
        legacyFloorNote
      : invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — no ⊆${(sliceFraction * 100).toFixed(0)}% subset ` +
          `choice is possible. Derived requirement: ${requiredSlice} ÷ ${sliceFraction.toFixed(2)} = ` +
          `${minimumCollection} minimum collection size.`
        : `⌊${sliceFraction.toFixed(2)} × ${invariantCount}⌋ = ${sliceCap} usable statement(s) available for the ` +
          `fixed Arm C slice. DERIVED REQUIREMENT (${populationRequirement.sliceDemandBasis}): required ` +
          `evaluation slice = ${requiredSlice} ⇒ minimum collection size = ${requiredSlice} ÷ ` +
          `${sliceFraction.toFixed(2)} = ${minimumCollection}. This collection holds ${invariantCount}` +
          (invariantCount < (minimumCollection as number)
            ? `, short of ${minimumCollection} by ${(minimumCollection as number) - invariantCount}`
            : `, at or above ${minimumCollection}`) +
          `; the slice must also remain a proper subset (${sliceCap} < ${invariantCount}). ` +
          `${populationRequirement.crossCheckAgainstSection6} Derivation: ` +
          populationRequirement.derivation.join(' | ') +
          legacyFloorNote,
    remedy: selectionSpaceOk
      ? null
      : !requirementDerivable
        ? `Register the missing task-design input, then re-run. The population requirement derives from the ` +
          `frozen ⊆${(sliceFraction * 100).toFixed(0)}% guard and the task set; with neither a finalized task ` +
          `set nor the registered minimum design readable, no honest requirement exists and this check must ` +
          `report unknown rather than invent one. Do NOT reintroduce a default slice floor.`
        : invariantCount === 0
          ? EMPTY_DOMAIN_REMEDY
          : `Grow the collection to at least ${minimumCollection}. At ${invariantCount} invariants the ` +
            `⊆${(sliceFraction * 100).toFixed(0)}% guard caps the Arm C slice at ${sliceCap}, below the ` +
            `${requiredSlice} usable statements the task design demands. The floor is DERIVED — it rises ` +
            `mechanically if the finalized task set demands a larger slice, and no invariant is authored to ` +
            `reach it. Continue Track 2 accrual. Scientific work.`,
  });

  // ── 2. DERIVATION HEADROOM — now INFERENTIAL CAPACITY (finding 2) ─────────
  //
  // The gate was `≥20% of members have semanticType ∈ {constraint, law} or a
  // connective word`. The check's own label claimed "the collection is not only
  // atomic assertions"; the measurement could not distinguish label diversity
  // from inferential capacity, which is exactly the reviewer's closing flag.
  //
  // It now gates on §6(d)'s actual requirement — invariants "whose CONJUNCTIONS
  // entail unstated conclusions" — via `assessInferentialCapacity`. The old
  // proxy is still computed and REPORTED beside the real figure, because a high
  // proxy next to a near-zero capacity is the signature of the vP1 defect and a
  // reader should be able to see it.
  const derivationEligible = invariants.filter(looksDerivationEligible);
  const derivationFraction = invariantCount > 0 ? derivationEligible.length / invariantCount : 0;
  const capacity = assessInferentialCapacity(
    invariants.map((inv) => ({ id: inv.id, statement: inv.statement })),
  );
  const requiredChains = populationRequirement.requiredEntailmentChains;
  const requiredCapacityFraction = populationRequirement.requiredInferentialCapacityFraction;
  const capacityRequirementDerivable =
    populationRequirement.derivable && requiredChains !== null && requiredCapacityFraction !== null;
  const derivationOk =
    capacityRequirementDerivable &&
    invariantCount > 0 &&
    capacity.entailmentChainCount >= (requiredChains as number) &&
    capacity.inferentialCapacityFraction >= (requiredCapacityFraction as number);
  const structuresLine =
    `structures present: ${capacity.structuresPresent.length > 0 ? capacity.structuresPresent.join(', ') : 'NONE'}` +
    `; absent: ${capacity.structuresAbsent.length > 0 ? capacity.structuresAbsent.join(', ') : 'none'}`;
  const legacyProxyNote =
    reportedLegacyDerivationFloor === null
      ? ''
      : ` (caller supplied the RETIRED minDerivationEligibleFraction=${reportedLegacyDerivationFloor}; reported, ` +
        `not applied)`;
  checks.push({
    name: 'derivation-headroom',
    tier: tierForCheck('derivation-headroom'),
    passed: derivationOk,
    remedy: derivationOk
      ? null
      : invariantCount === 0
        ? EMPTY_DOMAIN_REMEDY
        : !capacityRequirementDerivable
          ? `Register the missing task-design input, then re-run — the chain demand derives from the derivation-task ` +
            `count and cannot be assumed. This check reports unknown rather than substituting a fraction.`
          : `Acquire relational structure, not more facts. This collection carries ` +
            `${capacity.relationalMemberCount}/${invariantCount} member(s) asserting ANY of the seven relational ` +
            `structures (causal, conditional, propagation, constraint, threshold, trade-off, quantitative) and ` +
            `${capacity.entailmentChainCount} conjunction(s) that entail an unstated conclusion, against the ` +
            `${requiredChains} the derivation tasks demand. ` +
            (capacity.bareNecessityCount > 0
              ? `${capacity.bareNecessityCount} member(s) are bare necessity/dependency generalities ("X is ` +
                `essential for Y") — they assert that something matters without saying by what mechanism, in ` +
                `which direction it propagates, under what condition it triggers, or across what magnitude. ` +
                `Their conjunctions entail only type-preserving transitivity ` +
                `(${capacity.degenerateNecessityChainCount} such chain(s), counted and EXCLUDED). `
              : '') +
            `Target sources that state propagation mechanics, conditional dependencies and quantitative ` +
            `constraints. This is NOT fixed by re-tagging existing rows, and it is NOT fixed by rewriting ` +
            `statement text — authoring stronger invariants to pass this gate would contaminate the experiment. ` +
            `Scientific work.`,
    detail: !capacityRequirementDerivable
      ? `INSUFFICIENT INPUT — the derived entailment-chain demand is unavailable: ` +
        `${populationRequirement.insufficientInputs.join('; ') || 'no derivation was produced'}. Failed closed.` +
        legacyProxyNote
      : `INFERENTIAL CAPACITY (what this check now measures): ` +
        `${capacity.entailmentChainCount} conjunction(s) entail an unstated conclusion, need ≥ ${requiredChains}; ` +
        `${capacity.inferentiallyCapableCount}/${invariantCount} member(s) participate in one ` +
        `(${(capacity.inferentialCapacityFraction * 100).toFixed(1)}%, need ≥ ` +
        `${((requiredCapacityFraction as number) * 100).toFixed(1)}%). ` +
        `${capacity.relationalMemberCount}/${invariantCount} assert ≥1 of the seven relational structures; ` +
        `${structuresLine}. ${capacity.bareNecessityCount} bare necessity/dependency generality(ies); ` +
        `${capacity.unparsedCount} statement(s) matched no relation lexeme; ` +
        `${capacity.degenerateNecessityChainCount} degenerate necessity-transitivity chain(s) excluded. ` +
        `LABEL-DIVERSITY PROXY, for comparison only and no longer gating: ${derivationEligible.length}/` +
        `${invariantCount} (${(derivationFraction * 100).toFixed(1)}%) by semanticType ∈ {constraint, law} or a ` +
        `connective word — the measure the reviewer identified as scoring labels rather than content. ` +
        `MECHANISM: ${capacity.mechanism}` +
        legacyProxyNote,
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
    tier: tierForCheck('structural-diversity'),
    passed: diversityOk,
    remedy: diversityOk
      ? null
      : invariantCount === 0
        ? EMPTY_DOMAIN_REMEDY
        : distinctShapes < 2
          ? `Every member carries one semantic_type shape. Acquire material of other shapes (constraint, law, ` +
            `definition, principle, heuristic, epistemic) — a crystal of N repetitions of one shape tests one ` +
            `thing N times. Scientific work.`
          : `One shape covers ${(dominantShapeFraction * 100).toFixed(1)}% of the collection. Broaden acquisition ` +
            `toward the under-represented shapes rather than re-labelling existing rows — semantic_type is a ` +
            `claim about the statement, not a quota to balance. Scientific work.`,
    detail:
      `${distinctShapes} distinct semantic_type shape(s) present; the largest shape covers ` +
      `${(dominantShapeFraction * 100).toFixed(1)}% of the collection (need ≥ 2 shapes and no single shape ` +
      `> ${(maxDominantShapeFraction * 100).toFixed(0)}%)`,
  });

  // ── 4. DUPLICATE DETECTION — lexical ∪ SEMANTIC (finding 1) ───────────────
  //
  // The gate was word-set Jaccard alone, which structurally cannot see
  // "Liquidity is essential for market stability" ≡ "Market stability depends
  // on adequate liquidity" — the two share almost no words. The semantic pass
  // compares direction-canonicalised predicate-argument forms and does. The
  // gate is the UNION, so nothing the lexical pass caught is lost, and
  // `distinctStatementEstimate` answers the reviewer's actual question: how
  // many distinct statements does this collection really contain?
  const lexicalPairs = findNearDuplicatePairs(invariants, duplicateSimilarityThreshold);
  const semanticPairs = findSemanticDuplicatePairs(
    invariants.map((inv) => ({ id: inv.id, statement: inv.statement })),
  );
  const pairKey = (a: string, b: string) => [a, b].sort().join('~');
  const lexicalKeys = new Set(lexicalPairs.map(([a, b]) => pairKey(a, b)));
  const unionMap = new Map<string, [string, string]>();
  for (const [a, b] of lexicalPairs) unionMap.set(pairKey(a, b), [a, b]);
  for (const p of semanticPairs) unionMap.set(pairKey(p.aId, p.bId), [p.aId, p.bId]);
  const duplicatePairs = [...unionMap.values()];
  const semanticOnlyPairCount = semanticPairs.filter(
    (p) => !lexicalKeys.has(pairKey(p.aId, p.bId)),
  ).length;
  const distinctStatementEstimate =
    invariantCount > 0
      ? connectedComponents(invariants.map((inv) => inv.id), duplicatePairs).length
      : 0;
  checks.push({
    name: 'duplicate-detection',
    tier: tierForCheck('duplicate-detection'),
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
          ? `no near-duplicate statements found by EITHER mechanism: lexical word-set similarity at ` +
            `${duplicateSimilarityThreshold}, or semantic predicate-argument form comparison ` +
            `(direction-canonicalised). ${distinctStatementEstimate}/${invariantCount} statements are distinct.`
          : `${duplicatePairs.length} near-duplicate pair(s) — ${lexicalPairs.length} lexical, ` +
            `${semanticPairs.length} semantic, of which ${semanticOnlyPairCount} were invisible to the lexical ` +
            `pass. DISTINCT-STATEMENT ESTIMATE: ${distinctStatementEstimate} of ${invariantCount} nominal ` +
            `members (equivalence classes under the union relation). ` +
            (semanticPairs.length > 0
              ? `e.g. ${semanticPairs[0].aId} ~ ${semanticPairs[0].bId}: ${semanticPairs[0].detail}. `
              : `e.g. ${duplicatePairs[0][0]} ~ ${duplicatePairs[0][1]}. `) +
            `Unresolved duplicates fail this check.`,
    remedy:
      invariantCount > 0 && duplicatePairs.length === 0
        ? null
        : invariantCount === 0
          ? EMPTY_DOMAIN_REMEDY
          : `Resolve each of the ${duplicatePairs.length} pair(s): merge the duplicate into a survivor ` +
            `(mergeInvariants unions their contexts and marks the merged row 'superseded'), or record a ` +
            `'supersedes' relationship if one genuinely replaces the other. Do NOT raise either threshold — ` +
            `both passes are heuristics, so a flagged pair a steward judges distinct is a finding to record, ` +
            `not a setting to change. Note the count that matters is the DISTINCT-STATEMENT estimate ` +
            `(${distinctStatementEstimate}), not the nominal ${invariantCount}: every downstream size ` +
            `requirement is against distinct statements. Steward work.`,
    duplicatePairs: duplicatePairs.map(([aId, bId]) => ({ aId, bId })),
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
  const ineligibleForCrystal = invariantCount - eligibleCount;
  checks.push({
    name: 'provenance-eligibility',
    tier: tierForCheck('provenance-eligibility'),
    passed: invariantCount > 0 && eligibleCount === invariantCount,
    remedy:
      invariantCount > 0 && eligibleCount === invariantCount
        ? null
        : invariantCount === 0
          ? EMPTY_DOMAIN_REMEDY
          : `${ineligibleForCrystal} member(s) are not Population A — ` +
            `${partition.unclassified.length} carry no recorded evidence provenance, ` +
            `${partition.B.length} are platform-derived and ${partition.C.length} are platform doctrine. ` +
            `For the unclassified, record the real evidence basis: POST /api/invariants/discovery ` +
            `{ action: 'classify', invariantId, to, evidenceRefs, rationale } — which refuses a move into ` +
            `Population A citing only repo-internal sources. For the platform-derived and doctrine members, ` +
            `remove them from this crystal domain; they remain available to the application. NEVER widen ` +
            `eligibility to clear this check — that admits rows the pre-registered policy excludes and makes the ` +
            `substitution invisible. Steward work.`,
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
    tier: tierForCheck('lifecycle-validation-integrity'),
    passed: invariantCount > 0 && zeroValidated.length === 0,
    detail:
      invariantCount > 0 && zeroValidated.length === 0
        ? `all ${invariantCount} invariants carry real (> 0) validation counts`
        : `${zeroValidated.length}/${invariantCount} invariant(s) carry zero validations — real receipted ` +
          `validation is required, never bulk-authored filler (CRYSTAL-ENLARGEMENT_plan.md §2 condition a)`,
    remedy:
      invariantCount > 0 && zeroValidated.length === 0
        ? null
        : invariantCount === 0
          ? EMPTY_DOMAIN_REMEDY
          : `Run the validation gate on each of the ${zeroValidated.length} member(s): ` +
            `POST /api/invariants/<id>/advance { "action": "validate" }` +
            (zeroValidated.length > 0 ? ` (e.g. ${zeroValidated[0].id})` : '') +
            `. The gate runs the consistency, groundedness and canonical-form checks and writes a receipt — ` +
            `it is not a counter to increment. A member that cannot pass it does not belong in the crystal. ` +
            `Steward work.`,
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

  const densityOk = invariantCount > 1 && relationshipDensity >= minRelationshipDensity;
  const edgesShortOf = Math.max(0, Math.ceil(minRelationshipDensity * maxPossiblePairs) - relationshipCount);
  const EDGE_ROUTE = 'POST /api/invariants/<id>/edges { toInvariantId, relation, rationale, evidenceRefs }';
  checks.push({
    name: 'relationship-density',
    tier: tierForCheck('relationship-density'),
    passed: densityOk,
    remedy: densityOk
      ? null
      : invariantCount <= 1
        ? EMPTY_DOMAIN_REMEDY
        : `Record the relationships that already hold between these statements: ${EDGE_ROUTE}. About ` +
          `${edgesShortOf} more intra-crystal edge(s) would reach the threshold — but record only relationships ` +
          `that are genuinely there. This check under-reports a corpus with real-but-unannotated structure; it ` +
          `does not over-report, so the fix is annotation, never invention. Steward work.`,
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
  const connectivityOk = invariantCount > 1 && connectivityRatio >= minConnectivityRatio;
  checks.push({
    name: 'graph-connectivity',
    tier: tierForCheck('graph-connectivity'),
    passed: connectivityOk,
    remedy: connectivityOk
      ? null
      : invariantCount <= 1
        ? EMPTY_DOMAIN_REMEDY
        : `The collection is in ${componentSizes.length} disjoint cluster(s); the largest holds ` +
          `${largestComponent}/${invariantCount}. Relate the smaller clusters to the main one where a real ` +
          `relationship exists: ${EDGE_ROUTE}. If no genuine relationship links a cluster, that is a finding ` +
          `about the domain's coherence — report it; do not bridge it with an invented edge. Steward work.`,
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
  const orphansOk = invariantCount > 0 && orphanFraction <= maxOrphanFraction;
  checks.push({
    name: 'orphan-detection',
    tier: tierForCheck('orphan-detection'),
    passed: orphansOk,
    remedy: orphansOk
      ? null
      : invariantCount === 0
        ? EMPTY_DOMAIN_REMEDY
        : `${orphans.length} member(s) carry no intra-crystal relationship at all` +
          (orphans.length > 0 ? ` (e.g. ${orphans[0].id})` : '') +
          `. Record at least one real relationship for each: ${EDGE_ROUTE}. Independently discovered invariants ` +
          `arrive as orphans by default — nothing in acquisition creates edges — so this is expected work, not a ` +
          `defect. Steward work.`,
    detail:
      invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — orphan detection has nothing to compare`
        : `${orphans.length}/${invariantCount} invariant(s) carry ZERO intra-crystal relationships ` +
          `(${(orphanFraction * 100).toFixed(1)}%), need ≤ ${(maxOrphanFraction * 100).toFixed(0)}%` +
          (orphans.length > 0 ? ` — e.g. ${orphans[0].id}` : '') +
          edgeFetchSuffix,
  });

  // ── 10. BOUNDARY COVERAGE — the one new check name (finding 4) ────────────
  //
  // WHY IT IS A GATE, AND WHY IT IS `scientific-readiness`.
  //
  // Coverage was already computed (crystalStatistics.coverageEstimate) and
  // already disclosed (crystalFreezeRecommendation: "not itself a gate, but a
  // scope fact the operator should see"). Disclosure was not enough: at 2 of 15
  // declared namespaces the independent reviewer could not author the task set
  // at all — "without either broad failure or contamination". A crystal that
  // cannot support task authorship against ITS OWN DECLARED BOUNDARY fails a
  // pre-registered protocol condition (§5.1: IRL provides the domain corpus
  // boundary, the reviewer authors tasks against it; §5.4: every task must be
  // answerable from the material). That is not a maturity aspiration, which is
  // why it sits in the gating tier and not beside structural-diversity.
  //
  // WHY THE REQUIREMENT IS FULL REPRESENTATION AND NOT SOME RATIO. No ratio
  // threshold is derivable from any registered constraint, and inventing one
  // would repeat the `?? 5` defect. What IS derivable: any boundary namespace
  // with zero members is a region the reviewer may author into and that nothing
  // grounds. So the requirement is a CONSISTENCY requirement between two
  // declared things, with no chosen number in it.
  //
  // THE REMEDY IS CORPUS EXTENSION, NEVER BOUNDARY NARROWING. Coverage can be
  // made to pass arithmetically either way, and the second way is a governance
  // act — the operator has ruled it "will be surfaced as a separate governance
  // decision rather than an implementation shortcut". This check therefore
  // REPORTS against the declared boundary and never adjusts it; the remedy text
  // says so explicitly so a reader under delivery pressure cannot mistake the
  // shortcut for a fix.
  const declaredBoundary = input.declaredNamespaceBoundary ?? INVARIANT_NAMESPACES;
  const representedNamespaces = new Set(invariants.map((inv) => inv.namespace));
  const missingNamespaces = declaredBoundary.filter((ns) => !representedNamespaces.has(ns as never));
  const representedInBoundary = declaredBoundary.filter((ns) => representedNamespaces.has(ns as never));
  const coverageRatio =
    declaredBoundary.length > 0 ? representedInBoundary.length / declaredBoundary.length : 0;
  const coverageOk = invariantCount > 0 && declaredBoundary.length > 0 && missingNamespaces.length === 0;
  checks.push({
    name: 'boundary-coverage',
    tier: tierForCheck('boundary-coverage'),
    passed: coverageOk,
    detail:
      invariantCount === 0
        ? `no invariants found in domain '${crystalDomain}' — 0/${declaredBoundary.length} declared namespaces ` +
          `represented; coverage has nothing to measure, which is not evidence of readiness`
        : `${representedInBoundary.length}/${declaredBoundary.length} declared namespaces represented ` +
          `(${(coverageRatio * 100).toFixed(1)}%)` +
          (missingNamespaces.length > 0
            ? ` — unrepresented: ${missingNamespaces.join(', ')}. A reviewer authoring tasks against the ` +
              `declared boundary (§5.1) may author into any of these, and nothing in the crystal grounds ` +
              `them (§5.4).`
            : ` — every declared namespace is represented.`) +
          (input.declaredNamespaceBoundary
            ? ` Measured against a CALLER-SUPPLIED boundary, not the ratified ontology — an inspection, not a ` +
              `narrowing of the ratified boundary.`
            : ` Measured against the ratified INVARIANT_NAMESPACES ontology (types/invariants.ts).`),
    remedy: coverageOk
      ? null
      : invariantCount === 0
        ? EMPTY_DOMAIN_REMEDY
        : `Extend the corpus into the ${missingNamespaces.length} unrepresented namespace(s): ` +
          `${missingNamespaces.join(', ')}. Continue Track 2 acquisition targeted at those regions. ` +
          `DO NOT narrow the declared boundary to fit the material that happens to have been acquired — ` +
          `that would make this check pass without changing anything about what the crystal can ground, and ` +
          `narrowing a ratified boundary is a SEPARATE GOVERNANCE DECISION that must be surfaced as one, ` +
          `never taken as an implementation shortcut. Scientific work.`,
  });

  // Single enrichment pass — see CrystalReadinessCheck.remediationClass's doc
  // comment. Sourced from crystalInstrumentSuite.ts's one check contract
  // (inv.engineering.036), never a second mapping maintained here.
  for (const c of checks) {
    c.remediationClass = remediationClassForCheck(c.name);
    c.remediationStageAnchor = remediationStageAnchorForCheck(c.name);
  }

  // READY FOR FREEZE never depends on a `scientific-maturity` check (operator
  // ruling, 2026-08-05) — see CrystalReadinessCheck's doc comment.
  const ok = checks.filter((c) => c.tier === 'scientific-readiness').every((c) => c.passed);

  const maturityChecks = checks.filter((c) => c.tier === 'scientific-maturity');
  const maturityPassedCount = maturityChecks.filter((c) => c.passed).length;
  const maturity: CrystalMaturitySummary = {
    checks: maturityChecks,
    passedCount: maturityPassedCount,
    totalCount: maturityChecks.length,
    // totalCount:0 (nothing was measured) is deliberately 'bronze', not
    // 'gold' — a vacuous "nothing to prove wrong" must never read as an
    // achievement.
    band:
      maturityChecks.length > 0 && maturityPassedCount === maturityChecks.length
        ? 'gold'
        : maturityPassedCount > 0
          ? 'silver'
          : 'bronze',
  };

  // ── Exclusion disclosure — reporting, never gating ────────────────────────
  //
  // `blocksFreeze` is RECOMPUTED from the checks just produced. An upstream
  // stage may have asserted anything; what survives is only what this
  // crystal's own readiness actually implies (ruling §3: *"If the assigned
  // crystal passes, unrelated exclusions remain disclosed limitations rather
  // than blockers."*). Note `ok` is computed ABOVE and is not touched by any
  // of this.
  const excludedFromCrystal = input.exclusions
    ? (() => {
        const recomputed = computeFreezeBlocking(input.exclusions!, { checks, invariantCount });
        const blockers = freezeBlockingExceptions(recomputed);
        return {
          exceptions: recomputed,
          freezeBlockers: blockers,
          population: input.population ?? null,
          disclosure:
            (input.population ? `${renderPopulationDisclosure(input.population)}. ` : '') +
            `${recomputed.length} record(s) excluded from this crystal; ` +
            (blockers.length === 0
              ? 'none of them blocks a freeze — the crystal is assessed on what it actually contains, and these ' +
                'remain disclosed limitations.'
              : `${blockers.length} of them block a freeze, because the remaining crystal cannot pass a ` +
                'pre-registered readiness criterion without them.'),
        };
      })()
    : null;

  return {
    ok,
    checks,
    maturity,
    excludedFromCrystal,
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
    duplicates: {
      lexicalPairCount: lexicalPairs.length,
      semanticPairCount: semanticPairs.length,
      unionPairCount: duplicatePairs.length,
      semanticOnlyPairCount,
      distinctStatementEstimate,
      semanticPairs,
    },
    inferentialCapacity: capacity,
    coverage: {
      boundaryNamespaceCount: declaredBoundary.length,
      representedNamespaceCount: representedInBoundary.length,
      ratio: coverageRatio,
      representedNamespaces: [...representedNamespaces].sort(),
      missingNamespaces: [...missingNamespaces],
    },
    populationRequirement,
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
