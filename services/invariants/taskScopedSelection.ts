/**
 * Task-scoped invariant selection — the treatment-faithful Arm B selector
 * (EXP-P1 Arm B selection-fidelity audit, 2026-09-07).
 *
 * ── WHY THIS MODULE EXISTS, NOT A `buildInvariantSlice` PARAMETER ───────────
 *
 * Mechanical audit of `grounding.ts::buildInvariantSlice` (the function
 * `services/research/expP1Rehearsal.ts` was calling for Arm B) found:
 *   - task intent was never represented at all (one run-level domain constant
 *     shared by every task);
 *   - the only "eligibility" gate was domain/namespace/status membership —
 *     coarse, task-blind, and identical for all 63 members of a single-domain
 *     corpus;
 *   - `semanticType` (functional role) was never read anywhere in the path;
 *   - no relational/graph structure was ever consulted;
 *   - standing (`rankByStanding`) was therefore the ONLY discriminating
 *     signal over an undifferentiated pool — i.e. a GLOBAL ranking criterion,
 *     not a calibrator among already-relevant, functionally comparable
 *     candidates;
 *   - the call was made ONCE per run, outside the per-task loop, so Arm B's
 *     "selection" never varied across the 16 rehearsal tasks at all.
 *
 * This violates the required runtime principle: "Intent and functional
 * relevance determine candidate eligibility. Standing calibrates evidentiary
 * strength among sufficiently relevant, functionally comparable candidates.
 * Standing must never substitute one invariant type or relational role for
 * another that the intent requires." Per that audit, the two persisted
 * rehearsal runs that used the old selector
 * (`EXP-P1/execution-run/internal-rehearsal/2026-09-07T15:58:43.405Z` — 6
 * tasks, and `.../2026-09-07T21:11:38.247Z` — 16 tasks; plus the original
 * pre-repair `.../2026-09-06T17:47:45.131Z`) are permanently reclassified as
 * `treatment-fidelity-diagnostic` — instrument-validation evidence about the
 * OLD selector's plumbing, never evidence for or against the runtime
 * hypothesis. See `expP1Rehearsal.ts`'s own third header section.
 *
 * `buildInvariantSlice` itself is UNCHANGED — this module composes the same
 * underlying substrate/graph services (`listInvariants`, `dependencyClosure`)
 * as a DISTINCT, task-scoped pipeline, rather than mutating
 * `buildInvariantSlice`'s contract for its other (non-EXP-P1) callers, all of
 * which pass a context, never free intent text, and are unaffected by
 * anything in this file.
 *
 * ── THE CORRECTED ORDER (mature runtime target; THIS version implements
 *    stages 1-4 + 6 only — see "Stage 5" below) ─────────────────────────────
 *
 *   1 Intent                        — the task's own prompt text, verbatim.
 *   2 Functional necessity/relevance — lexical-overlap eligibility gate +
 *                                      functional-role (semanticType)
 *                                      carried through, NEVER hard-gated.
 *   3 Relational completion         — graph expansion (depends_on/composes)
 *                                      from the relevant set, BEFORE
 *                                      truncation, so a structurally-required
 *                                      but not-directly-keyword-matched
 *                                      invariant is not discarded.
 *   4 Evidentiary standing          — `rankByStanding`, applied ONLY within
 *                                      the relevant+expanded set from stages
 *                                      2-3, never across the whole domain.
 *   5 Consequence/value calibration — RESERVED, NAMED NO-OP in this version.
 *   6 Bounded representation        — truncate to `limit` last.
 *
 * ── STAGE 5 — WHY IT IS A NO-OP HERE, ON PURPOSE ─────────────────────────
 *
 * The mature runtime distinction this selector is architected for is:
 *   intent -> functional necessity/relevance -> relational completion ->
 *   evidentiary standing -> consequence/value calibration -> bounded
 *   representation
 * where value/risk-of-repair eventually calibrate WHICH constitutionally
 * adequate candidate is expected to produce the greatest time-to-value
 * without disproportionate remediation risk. That is a DIFFERENT dimension
 * from relevance/role/standing and must never be collapsed into one global
 * score with them (operator instruction, 2026-09-07).
 *
 * The codebase's existing risk/value research
 * (`services/invariants/riskField.ts` — `IntentRiskVector`, `RepairPath`,
 * `researchRiskAdjustedValue`; `services/invariants/riskCalibration.ts` —
 * `ConsequenceCalibrationEvidence`, `DimensionCalibration`; CFS-056 /
 * CFS-056A / CFS-056B, the Lehigh ERM calibration lineage) calibrates
 * DISCOVERY-time materiality of CANDIDATE invariants during corpus
 * curation — a different lifecycle stage, on different objects, computed by
 * a different (still-maturing, not yet cross-validated against this
 * selection context) model. It is NOT a runtime grounding-selection ranking
 * signal today, and this module does not import or call any of it. Inventing
 * a coefficient here to "use" those signals would be exactly the fabricated-
 * calibration failure `resolution.ts`'s own `constitutional: null` /
 * `InvariantCoordinates` comment already refuses to commit ("NEVER estimated
 * without one — no fabricated calibration").
 *
 * `TaskScopedSelectionItem.valueEstimate` / `.riskOfRepairEstimate` are
 * therefore ALWAYS `null` in this version — present on the type so a future
 * ratified, sufficiently-evidenced calibration model has a seam to populate
 * without changing this pipeline's shape, but never computed, guessed, or
 * defaulted to a synthetic number now. Wiring stage 5 for real means adding a
 * scoring function that runs AFTER stage 4's rank and BEFORE stage 6's
 * truncation, changing nothing about stages 1-4.
 *
 * Server-only.
 */

import { listInvariants } from './store';
import { dependencyClosure } from './graph';
import { GROUNDING_STATUSES, dedupeById, rankByStanding } from './grounding';
import type {
  InvariantNamespace,
  InvariantRecord,
  InvariantSemanticType,
  InvariantStatus,
} from '@/types/invariants';

/** Bumped whenever the selection ALGORITHM changes (stopword list, relevance
 *  formula, stage order) — never for a data change. Persisted per-run so a
 *  later reader can tell "same task + frozen Crystal + selector version
 *  ⇒ same result" from "the selector itself changed since this run". */
export const TASK_SCOPED_SELECTOR_VERSION = 'task-scoped-v1';

/**
 * A small, generic, standard English stopword list (the common IR/NLP
 * function-word set) — NOT derived from, or tuned to, any EXP-P1 task theme.
 * Using a generic linguistic resource here (rather than a curated per-domain
 * vocabulary like `perception.ts::DOMAIN_VOCABULARY`, which the audit found
 * has zero overlap with this experiment's finance/compliance domain) is what
 * lets this selector work for an ARBITRARY task prompt over an ARBITRARY
 * corpus, never just the 16 rehearsal tasks it was audited against.
 */
const STOPWORDS = new Set<string>([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'into', 'isnt', 'it',
  'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'off',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'shant', 'she', 'should', 'shouldnt', 'some', 'such', 'than', 'that', 'thats', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'this', 'those', 'through',
  'too', 'under', 'until', 'very', 'was', 'wasnt', 'we', 'were', 'werent', 'what', 'whats', 'when',
  'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont',
  'would', 'wouldnt', 'you', 'your', 'yours', 'yourself', 'yourselves', 'relate', 'relates', 'related',
  'say', 'says',
]);

/** Lowercase, strip punctuation, drop stopwords + short tokens. Pure,
 *  deterministic — same text always yields the same token list. */
function tokenize(text: string): string[] {
  const raw = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((t) => t.replace(/'/g, ''));
  return raw.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function sortedIds(records: InvariantRecord[]): string[] {
  return records.map((r) => r.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Stage 0 — the domain/namespace/status-filtered candidate POOL, a
 *  diagnostic upper bound only (never ranked or truncated here). Mirrors
 *  `buildInvariantSlice`'s own fan-out over (namespace × domain ×
 *  ontologyClass) signal combinations, composed from the SAME `listInvariants`
 *  substrate reader, so this module never re-implements the query layer. */
async function gatherCandidatePool(context: {
  domains?: string[];
  namespaces?: InvariantNamespace[];
  ontologyClassIds?: string[];
  statuses?: InvariantStatus[];
}): Promise<InvariantRecord[]> {
  const statuses = context.statuses ?? GROUNDING_STATUSES;
  const namespaces = context.namespaces?.length ? context.namespaces : [undefined as unknown as InvariantNamespace];
  const domains = context.domains?.length ? context.domains : [undefined];
  const classes = context.ontologyClassIds?.length ? context.ontologyClassIds : [undefined];

  // A generous, fixed cap — a diagnostic upper bound, not tuned to any
  // observed corpus or task-set size (mirrors the discipline
  // `expP1Rehearsal.ts`'s own `armBAvailableSlice` already applies).
  const PER_QUERY_CAP = 1000;

  const queries: Promise<InvariantRecord[]>[] = [];
  for (const namespace of namespaces) {
    for (const domain of domains) {
      for (const ontologyClassId of classes) {
        queries.push(
          listInvariants({
            namespace: namespace ?? undefined,
            status: statuses,
            domain: domain ?? undefined,
            ontologyClassId: ontologyClassId ?? undefined,
            limit: PER_QUERY_CAP,
          }),
        );
      }
    }
  }
  return dedupeById((await Promise.all(queries)).flat());
}

export interface TaskScopedSelectionInput {
  /** The task's own prompt text — and ONLY this. Never pass an answer-key
   *  field (task.keywords, expected invariant ids, ground-truth text) here;
   *  this selector has no parameter for one, by design (audit constraint:
   *  "no answer-key field affects selection"). */
  intentText: string;
  domains?: string[];
  namespaces?: InvariantNamespace[];
  ontologyClassIds?: string[];
  statuses?: InvariantStatus[];
  /** Bounded final representation size (stage 6). Default 12 — the same
   *  default `buildInvariantSlice` already used, carried forward for
   *  continuity, NOT re-derived from the 16-task rehearsal's observed
   *  outcomes. */
  limit?: number;
  /** Constrain the ENTIRE pipeline (pool, relevance, graph expansion) to
   *  this id set — e.g. a frozen crystal generation's own member ids, so a
   *  live-table id that postdates the freeze (or a successor generation
   *  under construction) can never leak into a rehearsal against an older
   *  frozen substrate. */
  restrictToIds?: string[];
}

/** One selected item, carrying the FULL per-stage provenance so a later
 *  reader can audit exactly why it is here — never a bare id. */
export interface TaskScopedSelectionItem {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: InvariantNamespace;
  status: InvariantStatus;
  confidence: number;
  standing: number;
  reach: number;
  /** Stage 2 — human-readable relevance provenance. `null` only when this
   *  item entered SOLELY via stage-3 graph expansion (never directly
   *  relevant on its own) or via the empty-relevance fallback (see
   *  `usedRelevanceFallback`). */
  relevanceBasis: string | null;
  /** Stage 2 — raw shared-token count against the intent. An ELIGIBILITY
   *  signal only; NEVER used to rank (ranking is stage 4, standing). */
  relevanceScore: number;
  /** Stage 2 — functional role. Same underlying value as
   *  `InvariantRecord.semanticType`, named for this selector's own stage
   *  vocabulary. Carried through for transparency and future diversity use;
   *  NEVER a hard eligibility gate in this version (see module header). */
  functionalRole: InvariantSemanticType | null;
  /** True iff this item entered ONLY via stage-3 graph expansion (a
   *  depends_on/composes target of a directly-relevant root), not by its own
   *  direct lexical relevance. */
  viaGraphExpansion: boolean;
  /** Stage 4 — the standing/confidence/reach values that calibrated this
   *  item's rank within the relevant+expanded set. Provenance, not a new
   *  score. */
  standingBasis: string;
  /** Stage 5 — RESERVED for a future ratified consequence/value model.
   *  ALWAYS `null` in this version. See module header "Stage 5". */
  valueEstimate: number | null;
  /** Stage 5 — RESERVED for a future ratified risk-of-repair model. ALWAYS
   *  `null` in this version. */
  riskOfRepairEstimate: number | null;
  /** One-line compact narrative for THIS item, combining the above — the
   *  cheapest possible audit surface for "why is this invariant here". */
  selectionRationale: string;
}

export interface TaskScopedSelection {
  selectorVersion: string;
  /** Stage 1 — the tokenized intent signal (post-stopword-filter), so a
   *  reader can see exactly what drove stage 2 without re-tokenizing. */
  intentTokens: string[];
  /** Stage 0 — the domain-filtered candidate pool. Diagnostic upper bound
   *  ONLY — never used to ground a score (mirrors the audited three-set
   *  distinction `RehearsalArmTaskResult` already established). */
  availableIds: string[];
  /** Stage 2 — ids that cleared the relevance/eligibility gate on their own
   *  direct lexical overlap with the intent (before graph expansion). */
  relevantIds: string[];
  /** Stage 2 ∪ Stage 3 — `relevantIds` plus any graph-expansion additions,
   *  BEFORE truncation. This is the set stage 4's standing calibration ranks
   *  over. */
  expandedIds: string[];
  /** Stage 6 — the final bounded, standing-ranked-within-relevance
   *  representation. THIS is what Arm B is actually grounded on. */
  selectedIds: string[];
  items: TaskScopedSelectionItem[];
  /** True when stage 2 found NO candidate sharing any intent token at all —
   *  an honest degraded case (mirrors `resolveConstitutionalField`'s own
   *  documented empty-perception discipline): falls back to standing-ranking
   *  the full scoped pool rather than returning nothing, but flagged so a
   *  reader never mistakes the fallback for a real relevance match. */
  usedRelevanceFallback: boolean;
  /** Whole-run narrative — stage-by-stage counts, never fed back into
   *  ranking; pure transparency. */
  selectionRationale: string;
}

/**
 * The task-scoped, treatment-faithful Arm B selector. Deterministic given
 * identical (intentText, frozen substrate content, selector version): no
 * randomness, no wall-clock dependency, and a final `id`-ascending tiebreak
 * after the standing/confidence/reach comparison so exact ties never make
 * the output order depend on incidental DB row order.
 */
export async function selectTaskScopedInvariants(
  input: TaskScopedSelectionInput,
): Promise<TaskScopedSelection> {
  const limit = input.limit ?? 12;
  const restrict = input.restrictToIds ? new Set(input.restrictToIds) : null;

  // Stage 0 — candidate pool.
  let pool = await gatherCandidatePool({
    domains: input.domains,
    namespaces: input.namespaces,
    ontologyClassIds: input.ontologyClassIds,
    statuses: input.statuses,
  });
  if (restrict) pool = pool.filter((r) => restrict.has(r.id));
  const byId = new Map(pool.map((r) => [r.id, r]));
  const availableIds = sortedIds(pool);

  // Stage 1 — intent.
  const intentTokens = tokenize(input.intentText);

  // Stage 2 — functional necessity/relevance (eligibility, never ranking).
  // semanticType is read here for transparency (`functionalRole` below) but
  // is NEVER a filter condition — per the audit's own constraint, it is not
  // yet justified as a hard gate by any existing runtime semantics.
  const relevance = new Map<string, { score: number; sharedTokens: string[] }>();
  for (const record of pool) {
    const statementTokens = new Set(tokenize(record.statement));
    const shared = [...new Set(intentTokens.filter((t) => statementTokens.has(t)))];
    if (shared.length > 0) relevance.set(record.id, { score: shared.length, sharedTokens: shared });
  }
  let usedRelevanceFallback = false;
  let relevantIds = [...relevance.keys()];
  if (relevantIds.length === 0 && pool.length > 0) {
    // Empty-perception discipline (mirrors `resolveConstitutionalField`'s own
    // documented fallback): never silently return nothing, but never let
    // standing masquerade as relevance either — flag it instead.
    usedRelevanceFallback = true;
    relevantIds = pool.map((r) => r.id);
  }

  // Stage 3 — relational completion. Graph-expand from the relevant set
  // BEFORE truncation, so a structurally-required supporting invariant is
  // never discarded merely because it wasn't a direct lexical match. Skipped
  // in the fallback case (no genuine relevance root to expand from) and
  // best-effort (a graph read failure must never break selection — mirrors
  // `getCachedFieldSnapshot`'s own guard).
  const domain = input.domains?.length === 1 ? input.domains[0] : undefined;
  const expandedRecords: InvariantRecord[] = relevantIds
    .map((id) => byId.get(id))
    .filter((r): r is InvariantRecord => Boolean(r));
  const expandedIdSet = new Set(expandedRecords.map((r) => r.id));
  if (!usedRelevanceFallback && relevantIds.length > 0) {
    try {
      const closure = await dependencyClosure(relevantIds, domain);
      for (const node of closure.nodes) {
        if (expandedIdSet.has(node.invariant.id)) continue;
        if (restrict && !restrict.has(node.invariant.id)) continue;
        expandedIdSet.add(node.invariant.id);
        expandedRecords.push(node.invariant);
      }
    } catch {
      // best-effort — proceed with the relevant set alone.
    }
  }

  // Stage 4 — evidentiary standing, calibrated ONLY within the relevant+
  // expanded set (never across the unfiltered domain pool — the exact
  // defect this selector exists to correct).
  const ranked = [...expandedRecords].sort(
    (a, b) => rankByStanding(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  // Stage 5 — consequence/value calibration: named no-op (see module
  // header). `ranked` passes through unchanged.

  // Stage 6 — bounded representation.
  const bounded = ranked.slice(0, limit);
  const selectedIds = bounded.map((r) => r.id);

  const items: TaskScopedSelectionItem[] = bounded.map((r) => {
    const rel = relevance.get(r.id);
    const viaGraphExpansion = !rel && !usedRelevanceFallback;
    const relevanceBasis = rel
      ? `lexical overlap: ${rel.sharedTokens.join(', ')}`
      : usedRelevanceFallback
        ? 'relevance fallback — no candidate in the scoped pool shared an intent token; standing-ranked pool used honestly, flagged'
        : null;
    const standingBasis = `standing ${r.standing.toFixed(1)}, confidence ${r.confidence.toFixed(3)}, reach ${r.reach.toFixed(1)}`;
    const selectionRationale = viaGraphExpansion
      ? `entered via graph expansion (depends_on/composes from a relevant root), not directly relevant; ${standingBasis}`
      : usedRelevanceFallback
        ? `relevance fallback (no lexical match found for this intent); ${standingBasis}`
        : `${relevanceBasis}; ${standingBasis}`;
    return {
      id: r.id,
      seedId: r.seedId,
      statement: r.statement,
      namespace: r.namespace,
      status: r.status,
      confidence: r.confidence,
      standing: r.standing,
      reach: r.reach,
      relevanceBasis,
      relevanceScore: rel?.score ?? 0,
      functionalRole: r.semanticType,
      viaGraphExpansion,
      standingBasis,
      valueEstimate: null,
      riskOfRepairEstimate: null,
      selectionRationale,
    };
  });

  const graphAdded = expandedRecords.length - relevantIds.length;
  const selectionRationaleTotal =
    `${availableIds.length} candidate(s) in domain scope; ` +
    (usedRelevanceFallback
      ? 'no candidate shared an intent token — relevance fallback used, flagged'
      : `${relevantIds.length} relevant by lexical overlap`) +
    `; ${graphAdded > 0 ? `${graphAdded} added by graph expansion (depends_on/composes)` : 'no graph expansion additions'}` +
    `; ranked by standing within ${expandedRecords.length} candidate(s); bounded to ${selectedIds.length} of limit ${limit}.`;

  return {
    selectorVersion: TASK_SCOPED_SELECTOR_VERSION,
    intentTokens,
    availableIds,
    relevantIds: [...relevantIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    expandedIds: sortedIds(expandedRecords),
    selectedIds,
    items,
    usedRelevanceFallback,
    selectionRationale: selectionRationaleTotal,
  };
}
