/**
 * EXP-P1 internal rehearsal runner — PRD-EPI-001 §7 execution layer.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT (operator ruling, 2026-09-07: "EXP-P1
 *    now has a frozen internal-pilot substrate. Update the experiment
 *    execution model so we can rehearse internally without weakening the
 *    registered confirmatory protocol.") ────────────────────────────────────
 *
 * The registered four-arm design (README.md,
 * `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/`):
 *   Arm A — Cold: task prompt only, no grounding material.
 *   Arm B — Full Runtime: IRL's live, per-task selection + orchestration.
 *   Arm C — Flattened Invariants: a FIXED, pre-registered slice, no live
 *           selection.
 *   Arm D — Expert Prose: externally authored (Austin's side), token-budget-
 *           matched to Arm C, fixed once, identical across all tasks.
 *
 * This runner exercises the REAL shape of that design — real retrieval (Arm B
 * via `selectTaskScopedInvariants`, a task-scoped selection path composed from
 * the same production substrate/graph services — see this module's third
 * header section for why it replaced a direct `buildInvariantSlice` call;
 * Arm C via the frozen crystal's own committed `memberSnapshot`), real task loading,
 * real receipts, real persistence — against ONLY materials that genuinely
 * exist today:
 *   - the FROZEN `crystal-vP2` substrate (never mutated by this runner);
 *   - an IRL-authored PROVISIONAL task set (`PROVISIONAL_REHEARSAL_TASK_SET`
 *     below) — never the sealed, externally-authored held-out set Austin has
 *     not produced yet;
 *   - a fixed, IRL-authored PROVISIONAL Arm D prose placeholder — never
 *     Austin's externally-authored expert prose.
 *
 * It does NOT call a live model/judge — no judge-config, rubric, or model-
 * calling seam exists anywhere in this codebase for EXP-P1 (judge config +
 * rubric are explicitly Austin's deliverable per the registered protocol's
 * division of responsibility). Scoring here is MECHANICAL — keyword/id
 * coverage against a provisional, synthetic ground truth derived from the
 * frozen crystal's own content — mirroring the established precision/recall
 * convention `services/experiments/expP3.ts` (EXP-012) already uses for a
 * different experiment's mechanical harness, though THIS harness computes
 * recall only (never precision/F1) — see `RehearsalScoreMetric`. This is a
 * REHEARSAL of the pipeline's plumbing (task loading, arm construction,
 * retrieval, scoring, receipts, persistence), never a scientific result.
 *
 * ── INSTRUMENT-VALIDATION FINDINGS, 2026-09-07 (first rehearsal,
 *    `EXP-P1/execution-run/internal-rehearsal/2026-09-06T17:47:45.131Z`) ────
 *
 * The first rehearsal run surfaced a genuine instrument defect, not a
 * scientific result: Arm B's ONE up-front `buildInvariantSlice` call was
 * given `limit: members.length` — the frozen population's own size — which
 * defeats `buildInvariantSlice`'s standing-ranked TRUNCATION entirely (its
 * `.slice(0, limit)` becomes a no-op once `limit` ≥ the candidate pool). The
 * result: Arm B's `groundingInvariantIds` was the ENTIRE 63-member frozen
 * population, on every one of the 6 tasks, vs Arm C's genuine 25-member
 * (⌊63×0.4⌋) fixed slice. Since every task's ground-truth ids are themselves
 * drawn FROM the frozen population, an arm holding the whole population
 * recalls 100% BY CONSTRUCTION — Arm B's "B > C" scores were a mechanical
 * artifact of context QUANTITY, not evidence of runtime/selection value
 * (README §4's Arm B is "IRL's complete pipeline... per-task intent-scoped
 * SELECTION"; giving it everything is not selection, it is the absence of
 * selection). Fixed by splitting the single call into two — `available`
 * (the domain-filtered candidate pool, kept only as a diagnostic upper bound,
 * never used to ground a score) and `selected` (`buildInvariantSlice`'s own
 * UNMODIFIED default limit — the real, bounded, standing-ranked selection —
 * which now grounds Arm B's score). See `RehearsalArmTaskResult`'s three
 * invariant-id fields.
 *
 * The same run also surfaced two tasks (`rehearsal-003`, `rehearsal-005`)
 * whose keywords ('settlement'/'value', 'reserve') matched ZERO of the 63
 * frozen invariant statements — an empty `groundTruthInvariantIds` set that
 * `idRecallScore`'s defensive `groundTruthIds.length === 0 ? 0` branch was
 * silently reporting as a real "0% recall" score for every arm, indistinguishable
 * from an arm that had material to recall and failed to. Fixed by marking such
 * a task `scorable: false` with an explicit `unscorableReason`, retaining its
 * raw per-arm scores as diagnostics but excluding it from every aggregate —
 * see `RehearsalTaskResult.scorable` and `summarizeRehearsalRun`. The task
 * set's keywords are deliberately NOT edited to "fix" this — that would erase
 * the diagnostic rather than report it.
 *
 * ── SECOND INSTRUMENT-VALIDATION AUDIT, 2026-09-07 (post-repair rehearsal,
 *    `EXP-P1/execution-run/internal-rehearsal/2026-09-07T15:58:43.405Z`) ────
 *
 * Operator audit question: does `actuallyGroundedInvariantIds` represent
 * evidence DEMONSTRABLY USED by an arm's generated response, or is it merely
 * copied from `selectedInvariantIds`? Mechanical answer, verified by reading
 * this module: it was the LATTER — every arm's `actuallyGroundedInvariantIds`
 * was set to the exact same array as its `selectedInvariantIds` (or `[]`
 * for A/D), because no arm in this harness ever generates a response for
 * evidence-of-use to be extracted from (see the header above: no model/judge
 * call exists anywhere in this codebase for EXP-P1). The exact formula this
 * harness has ALWAYS actually run, for every scored task and every arm:
 *
 *   groundTruthInvariantIds (keyword-substring match against the frozen
 *     crystal's memberSnapshot)
 *     -> arm selection (A: none: B: buildInvariantSlice's bounded, standing-
 *        ranked selection; C: the fixed ~40% slice; D: n/a, fixed prose)
 *     -> [NO model/runtime execution step — no answer is ever generated]
 *     -> [NO evidence-of-use extraction step — nothing to extract from]
 *     -> score = idRecallScore(selectedInvariantIds, groundTruthInvariantIds)
 *        for A/B/C, or keywordCoverageScore(fixedProse, task.keywords) for D.
 *
 * `actuallyGroundedInvariantIds` therefore never added information beyond
 * `selectedInvariantIds` and risked being misread as a real usage
 * measurement — retrieval AVAILABILITY was one step from being confused with
 * demonstrated REASONING USE. Repaired: `actuallyGroundedInvariantIds` is now
 * `null` for every arm in every run this harness constructs — `null` means
 * "no evidence-of-use extraction step exists", structurally distinct from an
 * array (which would mean "measured, and this is what was actually cited").
 * `score` was already, and remains, computed from `selectedInvariantIds`
 * directly — this repair changes what is PERSISTED, not what is SCORED. A
 * real confirmatory run, once a live model/judge exists, is the only thing
 * that may ever populate this field with a non-null value.
 *
 * Every run this module writes is `runExecutionDesignation: 'internal-
 * rehearsal'`, `confirmatoryEligible: false`, unconditionally — see
 * `recordExecutionRun`'s own refusal if a caller ever tried to claim
 * otherwise. It NEVER calls `recordExperimentRunLifecycle` (the EXPERIMENT-
 * level `designed -> protocol-ratified -> running -> ...` macro-transition) —
 * that transition is reserved for the real confirmatory execution, and
 * `protocol-ratified` cannot legally be reached yet (task-set, arm-config,
 * answer-key, judge-config, analysis-config, interpretation-table are all
 * still unfrozen — `deriveProtocolRatified`). A rehearsal run must never be
 * able to advance, or be read as advancing, that macro-lifecycle.
 *
 * ── THIRD AUDIT — ARM B SELECTION FIDELITY, 2026-09-07 (Arm B rewired to
 *    `selectTaskScopedInvariants`) ───────────────────────────────────────────
 *
 * Mechanical trace of Arm B's selection pipeline found it violated the
 * required runtime principle ("Intent and functional relevance determine
 * candidate eligibility. Standing calibrates evidentiary strength among
 * sufficiently relevant, functionally comparable candidates. Standing must
 * never substitute one invariant type or relational role for another that
 * the intent requires."):
 *   - `buildInvariantSlice` was called ONCE per RUN (not per task), with a
 *     single run-level domain constant — task intent was never represented
 *     at all, so Arm B's "selection" never varied across the 16 tasks;
 *   - the only eligibility gate was domain/namespace/status membership —
 *     coarse and identical for every task in a single-domain corpus;
 *   - `semanticType` (functional role) was read nowhere in the path;
 *   - no relational/graph structure was ever consulted;
 *   - standing was therefore the ONLY discriminating signal over an
 *     undifferentiated 63-member pool — a GLOBAL ranking criterion, not a
 *     calibrator among already-relevant candidates.
 *
 * Per that audit, the THREE persisted internal-rehearsal runs that used the
 * old (task-blind, globally-standing-ranked) selector —
 * `EXP-P1/execution-run/internal-rehearsal/2026-09-06T17:47:45.131Z` (6
 * tasks, pre-repair), `.../2026-09-07T15:58:43.405Z` (6 tasks, post
 * actuallyGroundedInvariantIds repair) and `.../2026-09-07T21:11:38.247Z` (16
 * tasks) — are PERMANENTLY reclassified `treatment-fidelity-diagnostic`:
 * instrument-validation evidence about the OLD selector's plumbing, NEVER
 * evidence for or against the runtime hypothesis (B vs C, B vs A, any
 * cross-arm delta). Those three artifacts are left byte-for-byte unmutated —
 * this classification lives here and in
 * `RES-2026-09-07-EXP-P1-ARM-B-SELECTION-FIDELITY-001.json`, never in the
 * persisted rows.
 *
 * Arm B now calls `services/invariants/taskScopedSelection.ts`'s
 * `selectTaskScopedInvariants` ONCE PER TASK, passing `task.prompt` (never
 * `task.keywords` — the answer-key field) as the intent. That module
 * implements the corrected order (intent -> relevance/role -> relational
 * completion -> standing calibration WITHIN the relevant set -> bounded
 * representation) and documents, in its own header, why a Stage 5
 * consequence/value calibration is a deliberate no-op in this version rather
 * than an invented score. `buildInvariantSlice` itself is untouched — Arm B
 * no longer calls it at all; the new module is a distinct pipeline over the
 * SAME underlying substrate/graph services, so every OTHER caller of
 * `buildInvariantSlice` is unaffected by this fix.
 *
 * A new, unseen `EXP-P1/rehearsal-task-set-provisional-v3` set exists for
 * evaluating the corrected selector — the 16-task v2 set is NOT reused as
 * the primary evaluation set for the corrected B treatment (it was designed
 * and its results already read under the OLD selector; re-scoring it would
 * not be "unseen" with respect to this fix).
 *
 * Server-only.
 */

import { selectTaskScopedInvariants, TASK_SCOPED_SELECTOR_VERSION } from '@/services/invariants/taskScopedSelection';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { latestFrozenCrystalArtifact, recordExecutionRun } from '@/services/research/artifacts';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';
import type {
  ExecutionRunArtifact,
  RehearsalArmId,
  RehearsalArmSummary,
  RehearsalArmTaskResult,
  RehearsalRunSummary,
  RehearsalTaskResult,
  TaskSetProvenance,
} from '@/types/research';

export const REHEARSAL_ARM_LABELS: Record<RehearsalArmId, string> = {
  A: 'Cold',
  B: 'Full Runtime',
  C: 'Flattened Invariants',
  D: 'Expert Prose',
};

export interface RehearsalTaskDefinition {
  id: string;
  kind: 'recall' | 'derivation';
  prompt: string;
  /** Used to (a) select this task's provisional/synthetic ground-truth
   *  grounding set from the frozen crystal's `memberSnapshot` by substring
   *  match on `statement`, and (b) mechanically score Arm D's prose (which
   *  has no discrete invariant ids to compare against). Never the real
   *  held-out answer key Austin will author — this is a rehearsal fixture. */
  keywords: string[];
}

export interface ProvisionalTaskSet {
  id: string;
  provenance: TaskSetProvenance;
  tasks: RehearsalTaskDefinition[];
}

/**
 * A small, checked-in, IRL-authored PROVISIONAL task set — never the sealed
 * held-out set the confirmatory protocol requires. Exists so the rehearsal
 * harness has something real to load without inventing per-run content or
 * waiting on external materials. Marked `provenance: 'provisional'`
 * unconditionally; a caller may substitute `provenance: 'synthetic'` fixtures
 * instead (e.g. generated from the frozen crystal's own members) but may
 * never mark anything `'external-held-out'` — that provenance describes
 * materials this codebase has no way to construct.
 */
export const PROVISIONAL_REHEARSAL_TASK_SET: ProvisionalTaskSet = {
  id: 'EXP-P1/rehearsal-task-set-provisional-v1',
  provenance: 'provisional',
  tasks: [
    { id: 'rehearsal-001', kind: 'recall', prompt: 'What does the governed record say about risk?', keywords: ['risk'] },
    { id: 'rehearsal-002', kind: 'recall', prompt: 'What does the governed record say about custody?', keywords: ['custody'] },
    {
      id: 'rehearsal-003',
      kind: 'derivation',
      prompt: 'How does the governed record relate settlement to value?',
      keywords: ['settlement', 'value'],
    },
    { id: 'rehearsal-004', kind: 'recall', prompt: 'What does the governed record say about governance?', keywords: ['governance'] },
    { id: 'rehearsal-005', kind: 'recall', prompt: 'What does the governed record say about reserves?', keywords: ['reserve'] },
    {
      id: 'rehearsal-006',
      kind: 'derivation',
      prompt: 'How does the governed record relate compliance to disclosure?',
      keywords: ['compliance', 'disclosure'],
    },
  ],
};

/**
 * A larger (16-task) provisional set — 2026-09-07, prepared after the
 * `actuallyGroundedInvariantIds` audit repair, per operator instruction: "If
 * the metric is valid, prepare a second internal-rehearsal task set of
 * roughly 12-18 provisional tasks, balanced between recall and derivation,
 * using only concepts genuinely groundable in frozen Crystal vP2." Unlike
 * `PROVISIONAL_REHEARSAL_TASK_SET` (which deliberately KEEPS two
 * zero-hit tasks as a live instrument diagnostic — see that set's own
 * history), every keyword below was verified, BEFORE authoring, to have at
 * least one real substring hit against `EXP-P1/crystal-vP2`'s actual 63
 * memberSnapshot statements (checked directly via the frozen row, not
 * guessed) — the exact discipline the `rehearsal-003`/`rehearsal-005` defect
 * was missing. 8 recall (single keyword) + 8 derivation (two keywords, BOTH
 * independently verified to hit — stronger than the mechanical minimum of
 * "at least one", so a derivation task's two-concept framing is genuinely
 * meaningful, not an artifact of one dead keyword riding on a live one).
 * Per-keyword hit counts against the live corpus at authoring time (kept
 * here for audit — never re-guessed later without re-verifying against the
 * actual frozen row): risk 13, custody 3, governance 2, compliance 15,
 * transparency 9, accountability 12, cybersecurity 9, data protection 4,
 * anti-money laundering 4, financial crime 5, cross-border 4, regulatory
 * framework 6, crypto-asset 6, market integrity 9, custodian 3, client asset
 * 2, personal data 5, trust 5, security measures 8, threat 7, trading 5,
 * market abuse 1, investment 4.
 */
export const LARGER_REHEARSAL_TASK_SET: ProvisionalTaskSet = {
  id: 'EXP-P1/rehearsal-task-set-provisional-v2',
  provenance: 'provisional',
  tasks: [
    { id: 'rehearsal-v2-001', kind: 'recall', prompt: 'What does the governed record say about risk?', keywords: ['risk'] },
    { id: 'rehearsal-v2-002', kind: 'recall', prompt: 'What does the governed record say about custody?', keywords: ['custody'] },
    { id: 'rehearsal-v2-003', kind: 'recall', prompt: 'What does the governed record say about governance?', keywords: ['governance'] },
    { id: 'rehearsal-v2-004', kind: 'recall', prompt: 'What does the governed record say about compliance?', keywords: ['compliance'] },
    { id: 'rehearsal-v2-005', kind: 'recall', prompt: 'What does the governed record say about transparency?', keywords: ['transparency'] },
    { id: 'rehearsal-v2-006', kind: 'recall', prompt: 'What does the governed record say about accountability?', keywords: ['accountability'] },
    { id: 'rehearsal-v2-007', kind: 'recall', prompt: 'What does the governed record say about cybersecurity?', keywords: ['cybersecurity'] },
    { id: 'rehearsal-v2-008', kind: 'recall', prompt: 'What does the governed record say about data protection?', keywords: ['data protection'] },
    {
      id: 'rehearsal-v2-009',
      kind: 'derivation',
      prompt: 'How does the governed record relate anti-money laundering obligations to financial crime?',
      keywords: ['anti-money laundering', 'financial crime'],
    },
    {
      id: 'rehearsal-v2-010',
      kind: 'derivation',
      prompt: 'How does the governed record relate cross-border activity to the need for a harmonized regulatory framework?',
      keywords: ['cross-border', 'regulatory framework'],
    },
    {
      id: 'rehearsal-v2-011',
      kind: 'derivation',
      prompt: 'How does the governed record relate crypto-asset activity to market integrity?',
      keywords: ['crypto-asset', 'market integrity'],
    },
    {
      id: 'rehearsal-v2-012',
      kind: 'derivation',
      prompt: 'How does the governed record relate custodian obligations to the protection of client assets?',
      keywords: ['custodian', 'client asset'],
    },
    {
      id: 'rehearsal-v2-013',
      kind: 'derivation',
      prompt: 'How does the governed record relate personal data protection to trust in financial services?',
      keywords: ['personal data', 'trust'],
    },
    {
      id: 'rehearsal-v2-014',
      kind: 'derivation',
      prompt: 'How does the governed record relate security measures to the threats they are meant to address?',
      keywords: ['security measures', 'threat'],
    },
    {
      id: 'rehearsal-v2-015',
      kind: 'derivation',
      prompt: 'How does the governed record relate trading activity to the prevention of market abuse?',
      keywords: ['trading', 'market abuse'],
    },
    {
      id: 'rehearsal-v2-016',
      kind: 'derivation',
      prompt: 'How does the governed record relate investment operations to cybersecurity risk management?',
      keywords: ['investment', 'cybersecurity'],
    },
  ],
};

/**
 * A THIRD provisional set (2026-09-07) — authored for evaluating the
 * CORRECTED Arm B selector (`selectTaskScopedInvariants`), never the 16-task
 * `LARGER_REHEARSAL_TASK_SET`. Per the operator instruction that produced the
 * selector fix: "run a new unseen internal rehearsal task set after the
 * corrected selector is frozen/versioned. Do not reuse the 16-task set as the
 * primary evaluation set for the corrected B treatment." Reusing v2 would not
 * be "unseen" with respect to this fix — its tasks and results were already
 * read under the OLD (task-blind) selector.
 *
 * Every keyword/phrase below is DELIBERATELY DISTINCT from every keyword used
 * in `PROVISIONAL_REHEARSAL_TASK_SET` (v1) and `LARGER_REHEARSAL_TASK_SET`
 * (v2) — fresh thematic ground (business continuity, AI governance,
 * distributed ledger, agentic commerce, market participants, fairness,
 * innovation, economic model), never risk/custody/governance/compliance/
 * transparency/accountability/cybersecurity/data-protection/AML/cross-border/
 * crypto-asset/market-integrity/custodian/client-asset/personal-data/trust/
 * security-measures/threat/trading/market-abuse/investment/financial-crime/
 * regulatory-framework, which v1/v2 already used. This set was NOT authored
 * by tuning against, or in response to, any observed 16-task outcome — it was
 * constructed independently from the frozen corpus's own untouched content,
 * the same way v2 was built from v1's.
 *
 * Every phrase was verified, by a live SQL count against
 * `EXP-P1/crystal-vP2`'s actual persisted `memberSnapshot` (never eyeballed),
 * to have at least one real substring hit BEFORE authoring the task prompts.
 * 8 recall (single keyword) + 8 derivation (two keywords, both independently
 * verified) — mirrors v2's own discipline. Real hit counts at authoring time,
 * queried directly against the live frozen row (kept here for audit, never
 * re-guessed without re-verifying against the actual frozen row): business
 * continuity 1, market participants 1, innovative technologies 1, artificial
 * intelligence 1, non-discrimination 1, distributed ledger technology 1,
 * agentic commerce 1, economic model 1, stressful conditions 1, informed
 * trading decisions 1, consumer protection 3, governance structures 1,
 * fairness 1, innovation 1, real-time 1, low-cost 1.
 *
 * A recall keyword is reused as one half of its own derivation task's pair
 * (e.g. 'agentic commerce' in both v3-007 and v3-015) — this mirrors
 * `LARGER_REHEARSAL_TASK_SET`'s own precedent (its 'cybersecurity' appears in
 * both a recall task and a derivation pair); the "distinct from v1/v2"
 * requirement is about not reusing v1/v2's OWN wording, not about internal
 * non-repetition within one set.
 */
export const UNSEEN_REHEARSAL_TASK_SET: ProvisionalTaskSet = {
  id: 'EXP-P1/rehearsal-task-set-provisional-v3',
  provenance: 'provisional',
  tasks: [
    { id: 'rehearsal-v3-001', kind: 'recall', prompt: 'What does the governed record say about business continuity?', keywords: ['business continuity'] },
    { id: 'rehearsal-v3-002', kind: 'recall', prompt: 'What does the governed record say about market participants?', keywords: ['market participants'] },
    { id: 'rehearsal-v3-003', kind: 'recall', prompt: 'What does the governed record say about innovative technologies?', keywords: ['innovative technologies'] },
    { id: 'rehearsal-v3-004', kind: 'recall', prompt: 'What does the governed record say about artificial intelligence?', keywords: ['artificial intelligence'] },
    { id: 'rehearsal-v3-005', kind: 'recall', prompt: 'What does the governed record say about non-discrimination?', keywords: ['non-discrimination'] },
    { id: 'rehearsal-v3-006', kind: 'recall', prompt: 'What does the governed record say about distributed ledger technology?', keywords: ['distributed ledger technology'] },
    { id: 'rehearsal-v3-007', kind: 'recall', prompt: 'What does the governed record say about agentic commerce?', keywords: ['agentic commerce'] },
    { id: 'rehearsal-v3-008', kind: 'recall', prompt: 'What does the governed record say about the economic model of digital currencies?', keywords: ['economic model'] },
    {
      id: 'rehearsal-v3-009',
      kind: 'derivation',
      prompt: 'How does the governed record relate business continuity planning to operating under stressful conditions?',
      keywords: ['business continuity', 'stressful conditions'],
    },
    {
      id: 'rehearsal-v3-010',
      kind: 'derivation',
      prompt: 'How does the governed record relate market participants to informed trading decisions?',
      keywords: ['market participants', 'informed trading decisions'],
    },
    {
      id: 'rehearsal-v3-011',
      kind: 'derivation',
      prompt: 'How does the governed record relate innovative technologies to consumer protection?',
      keywords: ['innovative technologies', 'consumer protection'],
    },
    {
      id: 'rehearsal-v3-012',
      kind: 'derivation',
      prompt: 'How does the governed record relate the use of artificial intelligence to the governance structures required to manage it?',
      keywords: ['artificial intelligence', 'governance structures'],
    },
    {
      id: 'rehearsal-v3-013',
      kind: 'derivation',
      prompt: 'How does the governed record relate non-discrimination to fairness in financial services?',
      keywords: ['non-discrimination', 'fairness'],
    },
    {
      id: 'rehearsal-v3-014',
      kind: 'derivation',
      prompt: 'How does the governed record relate distributed ledger technology to innovation in financial services?',
      keywords: ['distributed ledger technology', 'innovation'],
    },
    {
      id: 'rehearsal-v3-015',
      kind: 'derivation',
      prompt: 'How does the governed record relate agentic commerce to real-time transaction capability?',
      keywords: ['agentic commerce', 'real-time'],
    },
    {
      id: 'rehearsal-v3-016',
      kind: 'derivation',
      prompt: 'How does the governed record relate the economic model of digital currencies to low-cost transactions?',
      keywords: ['economic model', 'low-cost'],
    },
  ],
};


/** Arm C is a genuine SUBSET, never the whole frozen population — mirrors the
 *  registered protocol's own ⊆40% collection-size guard (README §"Collection-
 *  size guard"). Sorted by id (the same deterministic order `memberSnapshot`
 *  already carries) so the fixed slice is stable across repeated rehearsals
 *  of the same frozen generation. */
const ARM_C_SLICE_FRACTION = 0.4;

function buildFixedArmCSlice(members: HashCoveredMember[]): HashCoveredMember[] {
  const cap = Math.max(1, Math.floor(members.length * ARM_C_SLICE_FRACTION));
  return [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, cap);
}

/** A FIXED, IRL-authored provisional prose placeholder — never Austin's
 *  externally-authored Arm D expert prose. Built once per run, identical
 *  across every task (mirrors the registered protocol's "fixed once at
 *  freeze; identical across all tasks" property for the real Arm D). Because
 *  the real Arm D is deliberately curated WITHOUT access to the invariant
 *  collection's decomposition, this placeholder carries no discrete
 *  invariant-id citations — it is scored by keyword coverage of its TEXT,
 *  never by an id-overlap check, exactly like the real arm's structural
 *  role. */
function buildProvisionalArmDProse(members: HashCoveredMember[]): string {
  const sample = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 5);
  const body = sample.map((m) => m.statement).join(' ');
  return (
    '[PROVISIONAL REHEARSAL PROSE — NOT Austin\'s Arm D — INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE] ' +
    body
  );
}

function keywordCoverageScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const hay = text.toLowerCase();
  const hits = keywords.filter((k) => hay.includes(k.toLowerCase())).length;
  return hits / keywords.length;
}

/** Invariant-id RECALL only — never precision, never F1 (see
 *  `RehearsalScoreMetric`'s own doc for why that gap matters: an
 *  over-broad `retrievedIds` set — e.g. the whole frozen population —
 *  recalls 100% of ANY ground truth drawn from that population BY
 *  CONSTRUCTION, which is precisely the confound the available/selected
 *  split above exists to prevent upstream of this function ever being
 *  called with an unbounded set again). Returns 0 for an empty
 *  `groundTruthIds` — a defensive divide-by-zero guard, NOT a scoring-
 *  specification decision; callers MUST treat that case as `scorable: false`
 *  and exclude it from aggregates rather than trust this 0 as a real score. */
function idRecallScore(retrievedIds: string[], groundTruthIds: string[]): number {
  if (groundTruthIds.length === 0) return 0;
  const retrieved = new Set(retrievedIds);
  const hits = groundTruthIds.filter((id) => retrieved.has(id)).length;
  return hits / groundTruthIds.length;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface RehearsalEligibility {
  eligible: boolean;
  reason?: string;
  frozenCrystalArtifactId: string | null;
  frozenCrystalContentHash: string | null;
}

/** Whether an internal rehearsal may run right now — a frozen `crystal-
 *  version` generation with `executionDesignation: 'internal-pilot'`, and
 *  nothing else. Never checks Track 2's own (slow, multi-signal) programme
 *  composition — the same "governed act eligibility is independent of slow
 *  composition" discipline `FreezeVP2InternalPilotAction.tsx` already
 *  established (CI-2026-09-07-GOVERNED-ACT-ELIGIBILITY-INDEPENDENT-OF-SLOW-COMPOSITION-001). */
export async function rehearsalEligibility(experimentId: string): Promise<RehearsalEligibility> {
  const frozen = await latestFrozenCrystalArtifact(experimentId);
  if (!frozen) {
    return { eligible: false, reason: 'no frozen crystal-version generation exists yet', frozenCrystalArtifactId: null, frozenCrystalContentHash: null };
  }
  if (frozen.executionDesignation !== 'internal-pilot') {
    return {
      eligible: false,
      reason: `'${frozen.id}' is frozen as '${frozen.executionDesignation ?? 'confirmatory'}' — internal rehearsal requires an 'internal-pilot' designated freeze`,
      frozenCrystalArtifactId: frozen.id,
      frozenCrystalContentHash: frozen.contentHash,
    };
  }
  if (!frozen.memberSnapshot || frozen.memberSnapshot.length === 0) {
    return {
      eligible: false,
      reason: `'${frozen.id}' has no persisted memberSnapshot — cannot construct arms without the frozen hash pre-image`,
      frozenCrystalArtifactId: frozen.id,
      frozenCrystalContentHash: frozen.contentHash,
    };
  }
  return { eligible: true, frozenCrystalArtifactId: frozen.id, frozenCrystalContentHash: frozen.contentHash };
}

export interface RunRehearsalResult {
  ok: boolean;
  error?: string;
  receiptId?: string | null;
  runId?: string;
  taskResults?: RehearsalTaskResult[];
  /** The FULL persisted execution-run artifact — the same shape
   *  `getExecutionRun`/`GET .../rehearsal?runId=` returns for a past run, so
   *  a caller (the UI's "copy as JSON" affordance) has ONE shape to work
   *  with regardless of whether the run just completed or is being looked
   *  up later. */
  run?: ExecutionRunArtifact;
}

/**
 * Run the internal rehearsal — real four-arm construction against the frozen
 * substrate, mechanically scored, persisted as `runExecutionDesignation:
 * 'internal-rehearsal'`, `confirmatoryEligible: false`, unconditionally. Never
 * mutates the frozen crystal artifact (read-only against it); never touches
 * `EXPERIMENT_LIFECYCLE`/`recordExperimentRunLifecycle`.
 */
export async function runExpP1Rehearsal(input: {
  personaId: string;
  experimentId: string;
  taskSet?: ProvisionalTaskSet;
}): Promise<RunRehearsalResult> {
  const eligibility = await rehearsalEligibility(input.experimentId);
  if (!eligibility.eligible || !eligibility.frozenCrystalArtifactId) {
    return { ok: false, error: eligibility.reason ?? 'internal rehearsal is not eligible right now' };
  }

  const frozen = await latestFrozenCrystalArtifact(input.experimentId);
  const members = frozen?.memberSnapshot ?? [];
  if (members.length === 0) {
    return { ok: false, error: `'${eligibility.frozenCrystalArtifactId}' has no persisted memberSnapshot` };
  }
  const memberIds = new Set(members.map((m) => m.id));

  const taskSet = input.taskSet ?? PROVISIONAL_REHEARSAL_TASK_SET;
  if (taskSet.provenance === 'external-held-out') {
    return {
      ok: false,
      error: `an internal rehearsal may never load an 'external-held-out' task set — that provenance describes materials this codebase cannot construct (the confirmatory protocol's sealed set, Austin's own deliverable)`,
    };
  }
  if (taskSet.tasks.length === 0) {
    return { ok: false, error: `task set '${taskSet.id}' has no tasks` };
  }

  const domain = crystalDomainForExperiment(input.experimentId)?.domain;

  // Arm C — AVAILABLE is the whole frozen population it was carved from;
  // SELECTED is the fixed, pre-registered slice. Task-blind by protocol
  // definition — unchanged by the Arm B selection-fidelity fix.
  const armCAvailableIds = members.map((m) => m.id);
  const armCSlice = buildFixedArmCSlice(members);
  const armCSelectedIds = armCSlice.map((m) => m.id);

  // Arm D — fixed, IRL-authored provisional prose placeholder (never Austin's).
  const armDProse = buildProvisionalArmDProse(members);

  // Arm B diagnostics accumulated across tasks, for the run-level
  // armConfiguration summary below (2026-09-07 selection-fidelity fix: Arm B
  // is now computed PER TASK, so there is no longer one single set size to
  // report — see armBTaskDiagnostics).
  const armBTaskDiagnostics: { taskId: string; availableSize: number; selectedSize: number; usedRelevanceFallback: boolean }[] = [];

  const taskResults: RehearsalTaskResult[] = await Promise.all(
    taskSet.tasks.map(async (task) => {
      const groundTruthInvariantIds = members
        .filter((m) => task.keywords.some((k) => m.statement.toLowerCase().includes(k.toLowerCase())))
        .map((m) => m.id);
      const scorable = groundTruthInvariantIds.length > 0;
      const unscorableReason = scorable
        ? null
        : `no frozen invariant statement in '${eligibility.frozenCrystalArtifactId}' matched this task's keyword set (${task.keywords.join(', ')}) — nothing to score recall against; raw per-arm scores below are diagnostics only`;

      // Arm B — the corrected, task-scoped selector (2026-09-07 selection-
      // fidelity fix). `task.prompt` is the ONLY task field passed as intent
      // — never `task.keywords` (the answer-key field this rehearsal scores
      // against), so the selector can never see what it is being graded on.
      // Restricted to ids that are ALSO members of the FROZEN snapshot — the
      // live table may have moved on since freeze — mirroring the discipline
      // the old implementation already established for this exact reason.
      const armBSelection = await selectTaskScopedInvariants({
        intentText: task.prompt,
        domains: domain ? [domain] : undefined,
        restrictToIds: [...memberIds],
      });
      const armBAvailableIds = armBSelection.availableIds;
      const armBSelectedIds = armBSelection.selectedIds;
      armBTaskDiagnostics.push({
        taskId: task.id,
        availableSize: armBAvailableIds.length,
        selectedSize: armBSelectedIds.length,
        usedRelevanceFallback: armBSelection.usedRelevanceFallback,
      });

      const armResults: RehearsalArmTaskResult[] = [
        {
          armId: 'A',
          armLabel: REHEARSAL_ARM_LABELS.A,
          availableInvariantIds: [],
          selectedInvariantIds: [],
          // No model/runtime execution exists in this harness to extract
          // evidence-of-use from — null, never a copy of selectedInvariantIds.
          actuallyGroundedInvariantIds: null,
          scoreMetric: 'invariant-id-recall',
          score: idRecallScore([], groundTruthInvariantIds),
        },
        {
          armId: 'B',
          armLabel: REHEARSAL_ARM_LABELS.B,
          availableInvariantIds: armBAvailableIds,
          selectedInvariantIds: armBSelectedIds,
          actuallyGroundedInvariantIds: null,
          scoreMetric: 'invariant-id-recall',
          score: idRecallScore(armBSelectedIds, groundTruthInvariantIds),
        },
        {
          armId: 'C',
          armLabel: REHEARSAL_ARM_LABELS.C,
          availableInvariantIds: armCAvailableIds,
          selectedInvariantIds: armCSelectedIds,
          actuallyGroundedInvariantIds: null,
          scoreMetric: 'invariant-id-recall',
          score: idRecallScore(armCSelectedIds, groundTruthInvariantIds),
        },
        {
          armId: 'D',
          armLabel: REHEARSAL_ARM_LABELS.D,
          availableInvariantIds: [],
          selectedInvariantIds: [],
          actuallyGroundedInvariantIds: null,
          scoreMetric: 'keyword-substring-coverage',
          score: keywordCoverageScore(armDProse, task.keywords),
        },
      ];

      return { taskId: task.id, taskKind: task.kind, groundTruthInvariantIds, scorable, unscorableReason, armResults };
    }),
  );

  const recorded = await recordExecutionRun({
    personaId: input.personaId,
    experimentId: input.experimentId,
    runExecutionDesignation: 'internal-rehearsal',
    frozenCrystalArtifactId: eligibility.frozenCrystalArtifactId,
    frozenCrystalContentHash: eligibility.frozenCrystalContentHash,
    taskSetId: taskSet.id,
    taskSetProvenance: taskSet.provenance,
    armIds: ['A', 'B', 'C', 'D'],
    providerModel: 'deterministic-retrieval-v1',
    confirmatoryEligible: false,
    armDProvenance: 'provisional-irl-authored',
    armConfiguration: {
      armA: { description: 'Cold — no grounding material by protocol definition' },
      armB: {
        domain: domain ?? null,
        selectorVersion: TASK_SCOPED_SELECTOR_VERSION,
        selectionProcedure:
          'selectTaskScopedInvariants (services/invariants/taskScopedSelection.ts) — per-task: task.prompt intent ' +
          '-> lexical-overlap relevance/role eligibility (never a hard semanticType gate) -> graph expansion ' +
          '(depends_on/composes) before truncation -> standing calibration WITHIN the relevant+expanded set -> ' +
          'bounded representation. Replaces the pre-2026-09-07 single run-level buildInvariantSlice call — see ' +
          "this module's header, third audit section.",
        perTask: armBTaskDiagnostics,
        relevanceFallbackTaskCount: armBTaskDiagnostics.filter((d) => d.usedRelevanceFallback).length,
      },
      armC: {
        sliceFraction: ARM_C_SLICE_FRACTION,
        fixedSliceSize: armCSelectedIds.length,
        frozenPopulationSize: members.length,
      },
      armD: { proseSampleSize: 5, provenance: 'provisional-irl-authored' },
    },
    scoringConfiguration: {
      'invariant-id-recall':
        'hits / groundTruthInvariantIds.length, computed against selectedInvariantIds — invariant-id retrieval RECALL only (no precision/F1 computed); applies to arms A/B/C',
      'keyword-substring-coverage':
        'keyword substring hits / task.keywords.length against a FIXED prose blob (arm D) — a text-coverage metric, NOT id-based, not comparable arm-for-arm with the invariant-id-recall metric',
      unscorableRule:
        'a task with an empty groundTruthInvariantIds set (no frozen invariant statement matched its keywords) is scorable:false and excluded from every aggregate; its raw per-arm scores are retained for diagnostics only',
      actuallyGroundedInvariantIds:
        'always null in this harness — no model/runtime execution or evidence-of-use extraction step exists anywhere in this codebase for EXP-P1; score is computed from selectedInvariantIds directly, never from a demonstrated-use set (2026-09-07 instrument-validation audit)',
    },
    taskResults,
  });
  if (!recorded.ok) return { ok: false, error: recorded.error };

  return { ok: true, receiptId: recorded.receiptId, runId: recorded.artifact?.id, taskResults, run: recorded.artifact };
}

/**
 * A proper rehearsal summary (2026-09-07 instrument-validation finding) —
 * derived entirely from `taskResults` at read time, never persisted
 * redundantly. See `RehearsalRunSummary`'s own doc for what each field means
 * and why unscorable tasks and the two score metrics are never blended.
 */
export function summarizeRehearsalRun(run: Pick<ExecutionRunArtifact, 'armIds' | 'taskResults'>): RehearsalRunSummary {
  const scored = run.taskResults.filter((t) => t.scorable);
  const unscorable = run.taskResults.filter((t) => !t.scorable);

  const perArm: RehearsalArmSummary[] = run.armIds.map((armId) => {
    let armLabel: string = armId;
    let scoreMetric: RehearsalArmTaskResult['scoreMetric'] = 'invariant-id-recall';
    const overall: number[] = [];
    const recall: number[] = [];
    const derivation: number[] = [];
    for (const task of scored) {
      const armResult = task.armResults.find((a) => a.armId === armId);
      if (!armResult) continue;
      armLabel = armResult.armLabel;
      scoreMetric = armResult.scoreMetric;
      overall.push(armResult.score);
      (task.taskKind === 'derivation' ? derivation : recall).push(armResult.score);
    }
    return {
      armId,
      armLabel,
      scoreMetric,
      meanScoreOverall: mean(overall),
      meanScoreRecall: mean(recall),
      meanScoreDerivation: mean(derivation),
    };
  });

  const firstArmB = run.taskResults[0]?.armResults.find((a) => a.armId === 'B');
  const firstArmC = run.taskResults[0]?.armResults.find((a) => a.armId === 'C');

  return {
    taskCounts: { total: run.taskResults.length, scored: scored.length, unscorable: unscorable.length },
    unscorableTaskIds: unscorable.map((t) => t.taskId),
    perArm,
    frozenPopulationSize: firstArmC?.availableInvariantIds.length ?? null,
    armBAvailableSetSize: firstArmB?.availableInvariantIds.length ?? null,
    armBSelectedSetSize: firstArmB?.selectedInvariantIds.length ?? null,
    armCFixedSliceSize: firstArmC?.selectedInvariantIds.length ?? null,
    instrumentCaveat:
      'INTERNAL REHEARSAL — INSTRUMENT VALIDATION ONLY, NOT A SCIENTIFIC RESULT. The task set is provisional/synthetic (never the sealed, externally-authored held-out set); Arm D prose is an IRL-authored placeholder (never Austin\'s externally-authored expert prose); no live judge/model exists in this codebase — every score is mechanical invariant-id recall or keyword-substring coverage. No cross-arm or cross-run comparison from this run may be read as evidence for or against any registered EXP-P1 hypothesis.',
  };
}
