/**
 * EXCEPTION ISOLATION — the ONE shared operating model for the whole Track 2
 * and experiment-readiness pipeline (operator ruling, 2026-08-03).
 *
 *   > "Local uncertainty produces local quarantine. Global stoppage is
 *   >  reserved for global integrity failure."
 *
 * ── The constitutional-operational invariant this implements ────────────────
 *
 *   > "Constitutional control constrains the unsafe act; it does not
 *   >  immobilize the safe remainder."
 *
 * Recorded at the operator's own chosen level: a **constitutional-operational
 * invariant governing workflow orchestration** — NOT a ratified structural or
 * scientific claim. The operator was explicit that whether this pattern
 * generalises across domains and experiments is something the pipeline may
 * later produce evidence ABOUT; asserting it as a scientific structural
 * invariant now would be exactly the hypothesis-as-canon error CLAUDE.md's
 * epistemic-honesty discipline forbids.
 *
 * ── The governing rule ──────────────────────────────────────────────────────
 *
 *   > "An exception blocks only the source, invariant, relationship or act to
 *   >  which the exception applies. It must not block unrelated eligible
 *   >  records unless the anomaly compromises the integrity of the whole
 *   >  batch."
 *
 * Normal response to an anomaly: identify it → separate it → explain it →
 * CONTINUE PROCESSING THE UNAFFECTED SET → preserve it in an exception queue →
 * return to it only when its resolution is actually required.
 *
 * ── TWO AXES, deliberately not conflated ────────────────────────────────────
 *
 * The operator named these as different dimensions, and modelling them as one
 * enum is the mistake that produces "the batch is blocked because a record is":
 *
 *   RECORD DISPOSITION   what happens to ONE record — of ANY kind: a source,
 *                        a candidate invariant, a provenance record, a
 *                        validation outcome, a relationship edge, a crystal
 *                        assignment, a review artifact.
 *                        ready | ready-with-warning | exception | refused
 *
 *   PROGRAMME PROGRESSION  how far a STAGE has got.
 *                        not-started | in-progress | partially-complete |
 *                        complete | blocked
 *
 * A stage may be `partially-complete` because it holds unresolved `exception`
 * records while having processed every `ready` record. That sentence is the
 * whole model.
 *
 * ── Why ONE module and not seven ────────────────────────────────────────────
 *
 * Every stage can meet an anomalous record. Seven bespoke implementations of
 * "how this stage quarantines things" would be seven vocabularies and seven
 * chances to quietly re-invent "everything stops" (inv.engineering.036/037).
 * A stage's job is to CLASSIFY its records into this vocabulary — never to
 * re-decide what the vocabulary means or what an exception does to a batch.
 *
 * Pure and isomorphic: no I/O, no clock, no node builtins, so both the server
 * stages and the client surfaces share exactly this model. The cohort-hash and
 * receipt side (which needs sha256) lives in `cohortAuthorization.ts`.
 */

// ── AXIS 1 · RECORD DISPOSITION — any record, any stage ─────────────────────

/**
 * What happens to ONE record. Deliberately record-KIND-agnostic: the same four
 * values classify a candidate source, a candidate invariant, a provenance
 * record, a validation outcome, an edge, a crystal assignment and a review
 * artifact. If this ever becomes a sources-only enum, the shared model has
 * been lost.
 *
 *   ready               proceeds now, no reservation recorded.
 *   ready-with-warning  proceeds NOW, with the warning carried INTO THE
 *                       RECEIPT. A WARNING IS NOT A REFUSAL — amber is not
 *                       prohibition, and treating this cohort as a blocker is
 *                       the precise defect this module closes.
 *   exception           does NOT proceed in this act; preserved, visible and
 *                       revisited only when its resolution is actually
 *                       required.
 *   refused             a constitutional refusal — stays outside
 *                       ingestion/assignment entirely.
 */
export type RecordDisposition = 'ready' | 'ready-with-warning' | 'exception' | 'refused';

export const RECORD_DISPOSITIONS: readonly RecordDisposition[] = [
  'ready',
  'ready-with-warning',
  'exception',
  'refused',
];

/** The two dispositions that EXECUTE in the current act. Derived from the
 *  vocabulary above and read everywhere — never restated as a second list,
 *  because a stage that forgot `ready-with-warning` would silently reimpose
 *  perfection as the precondition for progress. */
export const EXECUTABLE_DISPOSITIONS: ReadonlySet<RecordDisposition> = new Set([
  'ready',
  'ready-with-warning',
]);

export function isExecutable(disposition: RecordDisposition): boolean {
  return EXECUTABLE_DISPOSITIONS.has(disposition);
}

/**
 * The UI's categorical distinction (ruling §5): amber is NOT prohibition.
 * Derived from the disposition so no surface can invent a fifth colour or
 * paint a warning as a refusal.
 */
export type IsolationSignal = 'green' | 'amber' | 'red';

export function signalForDisposition(disposition: RecordDisposition): IsolationSignal {
  if (disposition === 'ready') return 'green';
  if (disposition === 'ready-with-warning') return 'amber';
  return 'red';
}

// ── AXIS 2 · PROGRAMME PROGRESSION — per stage ──────────────────────────────

/**
 * How far a STAGE has got. `partially-complete` is the value the whole ruling
 * turns on: it means every executable record was processed AND some records
 * remain as exceptions. It is emphatically not `blocked`.
 *
 * `unknown` is retained by `track2Programme.ts`'s own status union for a
 * signal that could not be READ, which is a different thing from any value
 * here; this union covers only the progression a stage's own counts can prove.
 */
export type ProgrammeProgression =
  | 'not-started'
  | 'in-progress'
  | 'partially-complete'
  | 'complete'
  | 'blocked';

// ── The exception record — the operator's shape, one shape for every stage ──

/** What KIND of record an exception attaches to. */
export type ExceptionScope = 'source' | 'invariant' | 'edge' | 'artifact' | 'batch';

/** Which stage produced it. Kept as its own union so this module stays free of
 *  a circular import with `track2Programme.ts`. */
export type IsolationStage =
  | 'review-and-admit'
  | 'extract-candidates'
  | 'review-and-promote'
  | 'classify-provenance'
  | 'validate'
  | 'add-relationships'
  | 'assign-to-crystal'
  | 'run-readiness';

/**
 * The cause groups the single Exceptions surface groups by (ruling §8). A
 * stage needing a genuinely new cause adds it HERE, so the surface never meets
 * a group it cannot render.
 */
export type ExceptionCauseGroup =
  | 'exact-duplicate'
  | 'unresolved-artifact-identity'
  | 'unreadable-content'
  | 'low-confidence-classification'
  | 'provenance-conflict'
  | 'licence-access'
  | 'out-of-domain';

export const EXCEPTION_CAUSE_GROUPS: readonly ExceptionCauseGroup[] = [
  'exact-duplicate',
  'unresolved-artifact-identity',
  'unreadable-content',
  'low-confidence-classification',
  'provenance-conflict',
  'licence-access',
  'out-of-domain',
];

export const EXCEPTION_CAUSE_LABEL: Record<ExceptionCauseGroup, string> = {
  'exact-duplicate': 'Exact duplicates',
  'unresolved-artifact-identity': 'Unresolved artifact identity',
  'unreadable-content': 'Unreadable content',
  'low-confidence-classification': 'Low-confidence classification',
  'provenance-conflict': 'Provenance conflict',
  'licence-access': 'Licence / access issue',
  'out-of-domain': 'Out of domain',
};

/**
 * The DEFAULT consequence for an acquisition-stage exception, stated once
 * (ruling §8). A stage that means something different must say so explicitly —
 * it never gets there by omission.
 */
export const DEFAULT_ACQUISITION_CONSEQUENCE =
  'Does not block continued corpus acquisition. Does not enter the experimental crystal unless resolved.';

/**
 * ONE exception — TYPED AND CONSEQUENTIAL, in the operator's own shape.
 *
 *   > "This is what stops the system from treating all amber notices alike."
 *
 * The FOUR separate `blocks*` booleans are the point. An exception can block
 * nothing at all, or block a freeze only, and the system must be able to tell
 * those apart. A single `blocking: boolean` — or a warning string — collapses
 * exactly the distinction this record exists to carry.
 *
 * **`blocksFreeze` is never asserted per-cause.** It is COMPUTED from whether
 * the crystal that actually remains can still pass its pre-registered
 * readiness criteria (`computeFreezeBlocking` below). An unresolved source or
 * an excluded invariant sitting OUTSIDE the crystal is a disclosed limitation,
 * not a blocker.
 */
export interface IsolationException {
  scope: ExceptionScope;
  /** The affected record's own id. Never a batch id unless `scope: 'batch'` —
   *  an exception that names a batch instead of a record IS the global-blocker
   *  defect. */
  recordId: string;
  /** Human-readable identity of the affected record. Never a substitute for
   *  `recordId`. */
  recordLabel: string;
  /** WHY — the observed fact. */
  cause: string;
  causeGroup: ExceptionCauseGroup;
  /** Which of the two non-executing dispositions this is. */
  disposition: Extract<RecordDisposition, 'exception' | 'refused'>;
  stage: IsolationStage;
  /** Does this prevent the CURRENT stage from completing over its remainder?
   *  Almost always false — that is the entire ruling. */
  blocksCurrentStage: boolean;
  /** Does this prevent crystal assignment of OTHER, eligible invariants? */
  blocksCrystalAssignment: boolean;
  /** Does this prevent the readiness report from being run/trusted? */
  blocksReadiness: boolean;
  /** Does the freeze genuinely depend on resolving this? COMPUTED — see
   *  `computeFreezeBlocking`, never hardcoded from the cause. */
  blocksFreeze: boolean;
  /** WHAT FOLLOWS from it. */
  consequence: string;
  /** WHAT WOULD RESOLVE IT — a steward-actionable next step. */
  recommendedAction: string;
  /** The milestone past which resolution can no longer wait, or `null` when
   *  it can be deferred indefinitely without affecting the programme. */
  deferrableUntil: string | null;
}

// ── Population disclosure — the counterweight guardrail (ruling §5) ─────────

/**
 * The FULL population, always. The operator flagged this as the counterweight
 * to everything else:
 *
 *   > "isolating exceptions must not allow the system to quietly reduce the
 *   >  corpus until readiness passes."
 *
 * Exception isolation WITHOUT population disclosure is a worse failure than
 * the batch-blocking it replaces: it produces a technically passing but
 * materially narrow crystal that appears complete. Every dashboard shows these
 * totals and **the freeze package must preserve them**.
 */
/**
 * The EIGHT fields, in the operator's own shape (2026-08-03 freeze-schema
 * authorization). This is the schema the frozen artifact carries, so it is
 * declared once here and consumed by every surface, receipt and freeze package
 * — never restated with a different field set.
 *
 * A stage that genuinely cannot observe a count reports the honest value it
 * CAN observe rather than guessing one; the freeze package, which sees the
 * whole pipeline, is where all eight are real.
 */
export interface PopulationDisclosure {
  discovered: number;
  admitted: number;
  candidatesExtracted: number;
  validated: number;
  assignedToCrystal: number;
  excludedWithWarnings: number;
  exceptions: number;
  refused: number;
}

/** The operator's own rendering, so every surface states the population the
 *  same way and none can quietly omit a line. */
export function renderPopulationDisclosure(p: PopulationDisclosure): string {
  return (
    `Discovered: ${p.discovered} / Admitted: ${p.admitted} / ` +
    `Candidates extracted: ${p.candidatesExtracted} / Validated: ${p.validated} / ` +
    `Assigned to crystal: ${p.assignedToCrystal} / Excluded with warnings: ${p.excludedWithWarnings} / ` +
    `Exceptions: ${p.exceptions} / Refused: ${p.refused}`
  );
}

// ── Global stop — EXTREMELY RARE, and enumerated ────────────────────────────

/**
 * The ONLY conditions that stop a whole batch (ruling §5). Each compromises
 * the validity of EVERY record in the act. Missing metadata on three sources
 * is NOT one of these, and there is deliberately no open-ended "other" member:
 * a new global stop is a named addition to this union, argued on its own terms.
 */
export type GlobalStopReason =
  | 'wrong-acquisition-domain'
  | 'recommendation-set-changed'
  | 'steward-identity-unresolved'
  | 'wrong-corpus-target'
  | 'governing-declaration-absent';

export interface GlobalStop {
  reason: GlobalStopReason;
  detail: string;
}

export const GLOBAL_STOP_LABEL: Record<GlobalStopReason, string> = {
  'wrong-acquisition-domain': 'The acquisition domain loaded is not the one this act targets',
  'recommendation-set-changed': 'The prepared recommendation set no longer matches the displayed records',
  'steward-identity-unresolved': 'The steward performing this act could not be resolved',
  'wrong-corpus-target': 'This batch would write to a different corpus than the one displayed',
  'governing-declaration-absent': 'The governing domain declaration is absent or revoked',
};

// ── The batch summary ───────────────────────────────────────────────────────

export interface IsolationCounts {
  total: number;
  ready: number;
  readyWithWarning: number;
  exceptions: number;
  refused: number;
  /** ready + readyWithWarning — what "Admit N eligible records" acts on.
   *  Computed once here so no surface renders a count its own button
   *  disagrees with. */
  executable: number;
}

/** ONE record's disposition, as a stage reports it. */
export interface DispositionAssignment {
  recordId: string;
  disposition: RecordDisposition;
  /** Required for `exception` and `refused` — a non-executing record with no
   *  exception record would be invisible on the Exceptions surface. */
  exception?: IsolationException;
  /** Non-fatal deficiencies carried INTO THE RECEIPT for a
   *  `ready-with-warning` record. */
  warnings?: string[];
}

export interface IsolationSummary {
  counts: IsolationCounts;
  /** The record ids the primary action will act on, in input order. */
  executableRecordIds: string[];
  exceptions: IsolationException[];
  /**
   * Whether the primary action is available. TRUE whenever at least one record
   * is executable AND no global-stop condition holds.
   *
   * **Acceptance criterion #1.** The presence of exceptions MUST NOT make this
   * false: three anomalous sources cannot disable admission of thirty eligible
   * ones.
   */
  primaryActionEnabled: boolean;
  globalStop: GlobalStop | null;
  progression: ProgrammeProgression;
  /** One line the surface leads with, e.g. "29 sources can proceed now." */
  headline: string;
}

/**
 * Fold a stage's per-record dispositions into counts, the executable set, the
 * exception list and the stage's own progression.
 *
 * `globalStop` is supplied by the CALLER, because only the caller can observe
 * the five batch-integrity conditions (they are facts about the request, not
 * about any record). It is the ONLY thing that can disable the primary action
 * — no quantity of exceptions ever does.
 */
export function summarizeIsolation(
  assignments: readonly DispositionAssignment[],
  globalStop: GlobalStop | null = null,
  noun: string = 'record',
): IsolationSummary {
  const counts: IsolationCounts = {
    total: assignments.length,
    ready: 0,
    readyWithWarning: 0,
    exceptions: 0,
    refused: 0,
    executable: 0,
  };
  const executableRecordIds: string[] = [];
  const exceptions: IsolationException[] = [];

  for (const a of assignments) {
    switch (a.disposition) {
      case 'ready':
        counts.ready += 1;
        break;
      case 'ready-with-warning':
        counts.readyWithWarning += 1;
        break;
      case 'exception':
        counts.exceptions += 1;
        break;
      case 'refused':
        counts.refused += 1;
        break;
    }
    if (isExecutable(a.disposition)) executableRecordIds.push(a.recordId);
    if (a.exception) exceptions.push(a.exception);
  }
  counts.executable = counts.ready + counts.readyWithWarning;

  // The presence of exceptions is deliberately NOT consulted. The only things
  // that can withhold the primary action are (a) nothing to act on and (b) a
  // genuine batch-integrity failure.
  const primaryActionEnabled = counts.executable > 0 && globalStop === null;

  const plural = counts.executable === 1 ? noun : `${noun}s`;
  const headline = globalStop
    ? `No ${noun} can proceed: ${GLOBAL_STOP_LABEL[globalStop.reason]}. ${globalStop.detail}`
    : counts.executable > 0
      ? `${counts.executable} ${plural} can proceed now.`
      : counts.total === 0
        ? `No ${noun} is awaiting this act.`
        : `No ${noun} can proceed yet — every one is quarantined or refused.`;

  return {
    counts,
    executableRecordIds,
    exceptions,
    primaryActionEnabled,
    globalStop,
    progression: progressionFromCounts(counts, globalStop),
    headline,
  };
}

/**
 * A stage's honest progression from its own counts (ruling §1/§6).
 *
 * `blocked` is returned ONLY when work is outstanding and NONE of it is
 * executable — or a genuine global stop holds. A stage holding 29 executable
 * records and 3 exceptions is `partially-complete`, never `blocked`; returning
 * `blocked` there would reintroduce the paralysis at the reporting layer after
 * the execution layer had already been fixed.
 */
export function progressionFromCounts(
  counts: IsolationCounts,
  globalStop: GlobalStop | null = null,
): ProgrammeProgression {
  if (globalStop) return 'blocked';
  if (counts.total === 0) return 'not-started';
  const unresolved = counts.exceptions;
  if (counts.executable === 0) return unresolved > 0 || counts.refused > 0 ? 'blocked' : 'not-started';
  // Some records will never proceed (exceptions outstanding) but every
  // executable one can — the value the whole ruling turns on.
  if (unresolved > 0) return 'partially-complete';
  return 'in-progress';
}

// ── blocksFreeze — DERIVED from the crystal that actually remains ───────────

/**
 * The pre-registered readiness criteria a remaining crystal must still pass
 * (ruling §3). These are the names `crystalReadiness.ts` ALREADY emits — this
 * is a pin against that engine, never a second set of criteria.
 *
 * The operator listed nine by prose name; eight map exactly onto existing
 * check names. The mapping, recorded honestly rather than forced:
 *
 *   sufficient selection space  → `selection-space`
 *   derivational headroom       → `derivation-headroom`
 *   structural diversity        → `structural-diversity`
 *   provenance eligibility      → `provenance-eligibility`
 *   lifecycle integrity         → `lifecycle-validation-integrity`
 *   relationship density        → `relationship-density`
 *   graph connectivity          → `graph-connectivity`
 *   acceptable orphan rate      → `orphan-detection`
 *   duplicate control           → `duplicate-detection`
 *
 * All nine map. No criterion was invented, renamed, or dropped.
 */
export const PRE_REGISTERED_READINESS_CHECKS: readonly string[] = [
  'selection-space',
  'derivation-headroom',
  'structural-diversity',
  'provenance-eligibility',
  'lifecycle-validation-integrity',
  'relationship-density',
  'graph-connectivity',
  'orphan-detection',
  'duplicate-detection',
];

/** The minimum a caller must tell `computeFreezeBlocking` about the crystal
 *  that REMAINS. Structurally satisfied by `CrystalReadinessReport`. */
export interface RemainingCrystalReadiness {
  checks: readonly { name: string; passed: boolean; detail: string }[];
  invariantCount: number;
}

/**
 * Recompute every exception's `blocksFreeze` from the ACTUAL assigned crystal.
 *
 *   > "If the assigned crystal passes, unrelated exclusions remain disclosed
 *   >  limitations rather than blockers."
 *
 * The rule, exactly: an exception blocks the freeze ONLY when it is IN the
 * crystal's own scope (an invariant or edge the crystal is constituted from)
 * AND the remaining crystal is failing a pre-registered readiness criterion.
 *
 * A `source`-scope exception can never block a freeze on its own: a source
 * that never entered the corpus is not a member of the crystal, so it cannot
 * be the reason the crystal fails. It stays a DISCLOSED LIMITATION, which is
 * what `PopulationDisclosure` exists to carry.
 *
 * Returns a NEW array — the inputs are not mutated, so a caller can always
 * compare "as asserted" against "as computed".
 */
export function computeFreezeBlocking(
  exceptions: readonly IsolationException[],
  remaining: RemainingCrystalReadiness,
): IsolationException[] {
  const failing = remaining.checks.filter(
    (c) => !c.passed && PRE_REGISTERED_READINESS_CHECKS.includes(c.name),
  );
  const crystalIsPassing = failing.length === 0;
  return exceptions.map((e) => {
    // Only invariant- and edge-scope exceptions are even candidates: those are
    // the record kinds the crystal is constituted from.
    const inCrystalScope = e.scope === 'invariant' || e.scope === 'edge';
    const blocksFreeze = inCrystalScope && !crystalIsPassing;
    return blocksFreeze === e.blocksFreeze ? e : { ...e, blocksFreeze };
  });
}

/** The exceptions that genuinely block a freeze — those and no others. Call
 *  `computeFreezeBlocking` first; this only filters. */
export function freezeBlockingExceptions(exceptions: readonly IsolationException[]): IsolationException[] {
  return exceptions.filter((e) => e.blocksFreeze);
}

/** Exceptions grouped by cause, for the single Exceptions surface. Empty
 *  groups are omitted; order follows `EXCEPTION_CAUSE_GROUPS` so the surface
 *  is stable between renders. */
export function groupExceptionsByCause(
  exceptions: readonly IsolationException[],
): { causeGroup: ExceptionCauseGroup; label: string; exceptions: IsolationException[] }[] {
  return EXCEPTION_CAUSE_GROUPS.map((causeGroup) => ({
    causeGroup,
    label: EXCEPTION_CAUSE_LABEL[causeGroup],
    exceptions: exceptions.filter((e) => e.causeGroup === causeGroup),
  })).filter((g) => g.exceptions.length > 0);
}

// ── The critical path (ruling §6) ───────────────────────────────────────────

/**
 * What the surface must continually answer: *"What is the next act that moves
 * EXP-P1 toward a reviewable frozen crystal?"* — rendered as the operator
 * specified.
 */
export interface CriticalPath {
  /** "Validate 54 provenance-classified invariants." */
  nextSafeAct: string;
  /** "8 provenance exceptions." — what remains outside the path. */
  deferred: string;
  /** "Exceptions do not block validation of the eligible cohort." */
  milestoneImpact: string;
}

export function buildCriticalPath(input: {
  stageLabel: string;
  actVerb: string;
  noun: string;
  counts: IsolationCounts;
  freezeBlockers: number;
}): CriticalPath {
  const { counts } = input;
  const plural = counts.executable === 1 ? input.noun : `${input.noun}s`;
  return {
    nextSafeAct:
      counts.executable > 0
        ? `${input.actVerb} ${counts.executable} ${plural}.`
        : `Nothing can proceed at ${input.stageLabel} — resolve the outstanding exceptions.`,
    deferred:
      counts.exceptions + counts.refused > 0
        ? `${counts.exceptions} exception(s)` + (counts.refused > 0 ? `, ${counts.refused} refused` : '') + '.'
        : 'Nothing deferred.',
    milestoneImpact:
      input.freezeBlockers > 0
        ? `${input.freezeBlockers} exception(s) genuinely block the freeze — the remaining eligible crystal cannot pass a pre-registered readiness criterion without them.`
        : counts.exceptions + counts.refused > 0
          ? `Exceptions do not block ${input.stageLabel} of the eligible cohort. They remain disclosed limitations.`
          : 'No exceptions outstanding.',
  };
}
