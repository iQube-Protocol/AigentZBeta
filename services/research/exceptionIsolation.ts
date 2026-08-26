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
  | 'out-of-domain'
  /**
   * ADDED 2026-08-26, by the route this type's own comment prescribes ("A stage
   * needing a genuinely new cause adds it HERE, so the surface never meets a
   * group it cannot render").
   *
   * The validation gate (`validateInvariant`) returns a per-check verdict, and a
   * record that fails `consistency`, `groundedness` or `canonical_form` is an
   * exception whose cause is the failing CHECK — not a duplicate, not unreadable
   * content, and not a provenance CONFLICT (a missing provenance is an absence,
   * and forcing it into `provenance-conflict` would report an absence as a
   * disagreement). Every group above was a wrong home, so this is a named
   * addition rather than the nearest fit.
   */
  | 'validation-check-failed';

export const EXCEPTION_CAUSE_GROUPS: readonly ExceptionCauseGroup[] = [
  'exact-duplicate',
  'unresolved-artifact-identity',
  'unreadable-content',
  'low-confidence-classification',
  'provenance-conflict',
  'licence-access',
  'out-of-domain',
  'validation-check-failed',
];

export const EXCEPTION_CAUSE_LABEL: Record<ExceptionCauseGroup, string> = {
  'exact-duplicate': 'Exact duplicates',
  'unresolved-artifact-identity': 'Unresolved artifact identity',
  'unreadable-content': 'Unreadable content',
  'low-confidence-classification': 'Low-confidence classification',
  'provenance-conflict': 'Provenance conflict',
  'licence-access': 'Licence / access issue',
  'out-of-domain': 'Out of domain',
  'validation-check-failed': 'Validation check failed',
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
  /**
   * The TYPED successor to `recommendedAction`'s free prose. Optional here
   * only so the existing Track 2 construction sites keep compiling; every new
   * exception surface must supply it. See `ExecutableAct` below for why.
   */
  acts?: NonEmptyActs;
  /** The milestone past which resolution can no longer wait, or `null` when
   *  it can be deferred indefinitely without affecting the programme. */
  deferrableUntil: string | null;
}

// ── EVERY EXCEPTION TERMINATES IN AN ACT — structurally, not by review ──────

/**
 * ONE executable treatment: a button, not a sentence.
 *
 * ── Why this type exists (CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001) ──
 *
 * That candidate invariant records its own unresolved follow-up verbatim:
 *
 *   > "OPEN, and deliberately not resolved here: `IsolationException.
 *   >  recommendedAction` is free prose, which is what allowed a navigation
 *   >  instruction to satisfy the type. A typed action (a discriminated union
 *   >  of executable treatments) would make the defect structurally
 *   >  impossible rather than canaried."
 *
 * This is that type. Prose could satisfy `recommendedAction` while saying
 * "Decide this source individually in the review queue" — a navigation
 * instruction, which the ruling forbids. An `ExecutableAct` cannot be a
 * navigation instruction, because `kind` is a closed set of things the system
 * DOES and `label` sits beside it rather than standing in for it.
 *
 * `detail` carries the exact payload the operator would otherwise have to go
 * and find — the migration path, the SQL, the stage to open — because
 * "never make the operator search" is the sibling rule enforced by the same
 * canaries.
 */
export type ExecutableActKind =
  /** Apply a named migration to the environment that lacks it. */
  | 'apply-migration'
  /** Make PostgREST re-read the schema after a migration landed. */
  | 'reload-schema-cache'
  /** Re-run the observation that failed. Never a fix — a re-read. */
  | 're-check'
  /** Take the operator to the surface where the act is performed. */
  | 'open-stage'
  /** Perform the stage's own constitutional ceremony. */
  | 'perform-ceremony'
  /** Record the exception as seen and proceed with the safe remainder. */
  | 'acknowledge-and-continue'
  /** Resolve one record's own anomaly (dedupe, reclassify, supersede). */
  | 'resolve-record'
  /** Show the recorded evidence gaps without changing any state. */
  | 'view-audit-gaps';

export interface ExecutableAct {
  /** Stable id a surface dispatches on. Never a sentence. */
  actId: string;
  kind: ExecutableActKind;
  /** Imperative button text — "Apply migration", never "You should…". */
  label: string;
  /** What the act operates on: a stage id, a record id, a surface ref. */
  target?: string;
  /** The exact payload — migration path, SQL, command. Never a description
   *  of where to find it. */
  detail?: string;
}

/**
 * At least one act. A `readonly [T, ...T[]]` tuple makes "an exception with no
 * executable treatment" a COMPILE error rather than a review finding — which
 * is the difference between an invariant and advice.
 */
export type NonEmptyActs = readonly [ExecutableAct, ...ExecutableAct[]];

/**
 * The domain-free exception shape, shared by the research pipeline and the
 * Guided Journey Runtime.
 *
 * `IsolationException` above is the Track 2-shaped record: its `causeGroup`
 * and `stage` unions are corpus vocabulary, and widening them so a journey
 * stage could use them would hand the corpus Exceptions surface groups it
 * cannot render (this module's own warning, a few types up). So the two share
 * the AXES — `RecordDisposition`, `isExecutable`, `signalForDisposition`, and
 * the act type above — and differ only in the domain vocabulary each carries.
 * That is one model with two records, not two models.
 */
export interface ExceptionRecord {
  /** Stable code the surface groups and tests assert on. Never free prose. */
  code: string;
  /** The affected record — never a batch id. */
  recordId: string;
  recordLabel: string;
  /** WHY — the observed fact, stated as what IS true. */
  cause: string;
  disposition: Extract<RecordDisposition, 'exception' | 'refused'>;
  /** WHAT FOLLOWS — and, for a non-blocking exception, what does NOT follow. */
  consequence: string;
  /** Does this stop the act it attaches to? A non-blocking exception is
   *  `false`, and that is the whole point of recording it separately. */
  blocksCurrentAct: boolean;
  acts: NonEmptyActs;
  deferrableUntil: string | null;
}

/** True when an exception offers at least one executable treatment. Reads the
 *  typed `acts` only — prose in `recommendedAction` cannot satisfy it. */
export function terminatesInAct(
  exception: Pick<ExceptionRecord, 'acts'> | Pick<IsolationException, 'acts'>,
): boolean {
  return Array.isArray(exception.acts) && exception.acts.length > 0;
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

// ── PIPELINE CONTINUITY — the declared subject of every stage (ruling 2026-08-03) ──

/**
 * THE FIVE POPULATIONS A STAGE MAY DECLARE (operator ruling, 2026-08-03).
 *
 *   > "Each stage should explicitly declare one of: current crystal · admitted
 *   >  corpus · ratified corpus · assigned crystal · excluded records. The
 *   >  pipeline must never silently change population."
 *
 * ── Why this is a TYPE and not a comment ───────────────────────────────────
 *
 * Stage 2, 3 and 4 of the Track 2 programme operated over the experimental
 * crystal under construction. Stage 5 read the ratified domain registry
 * instead. Both readings were correct code; neither stage said what it was
 * reading; so the surface could report *17 promoted invariants exist* and
 * *there are no invariants to classify* on the same screen, and nothing in the
 * system could notice that both cannot be true. A population that is only
 * implied cannot be checked. Declared, it can.
 *
 * The five are DISTINCT POPULATIONS, not five names for one:
 *
 * | Population | What it actually is |
 * |---|---|
 * | `admitted-corpus` | the acquisition-domain source corpus and the evidence rows admitted from it |
 * | `current-crystal` | the experimental cohort THIS run produced — extracted candidates, the invariants promoted from them |
 * | `assigned-crystal` | the members actually admitted to the ratified crystal domain |
 * | `ratified-corpus` | the standing domain registry, all-time, independent of any run |
 * | `excluded-records` | records explicitly and visibly removed from a population, with a stated reason |
 *
 * `ratified-corpus` is in the vocabulary precisely so the substitution that
 * caused this ruling is NAMEABLE. It is a legitimate population to read — it
 * is never a legitimate silent substitute for `current-crystal`.
 */
export type DeclaredPopulation =
  | 'admitted-corpus'
  | 'current-crystal'
  | 'assigned-crystal'
  | 'ratified-corpus'
  | 'excluded-records';

export const DECLARED_POPULATIONS: readonly DeclaredPopulation[] = [
  'admitted-corpus',
  'current-crystal',
  'assigned-crystal',
  'ratified-corpus',
  'excluded-records',
];

export const DECLARED_POPULATION_LABEL: Record<DeclaredPopulation, string> = {
  'admitted-corpus': 'admitted corpus',
  'current-crystal': 'current crystal',
  'assigned-crystal': 'assigned crystal',
  'ratified-corpus': 'ratified corpus',
  'excluded-records': 'excluded records',
};

/**
 * ONE stage's declaration of what it is reasoning about.
 *
 * `consumes` and `produces` differ ONLY at a stage that deliberately
 * transforms one population into another (extraction turns an admitted corpus
 * into a candidate cohort; assignment turns that cohort into crystal members).
 * Everywhere else they are equal, and a difference that is not a declared
 * transform is exactly the silent substitution this model exists to expose.
 *
 * `source` names the actual substrate read. It is what lets a reviewer check
 * the declaration against reality instead of believing it — a stage that
 * declares `current-crystal` and names a registry-wide query in `source` is
 * caught by reading two adjacent lines.
 */
export interface PopulationDeclaration {
  consumes: DeclaredPopulation;
  produces: DeclaredPopulation;
  source: string;
}

/** A stage that declares a population — the minimum `checkPopulationContinuity`
 *  needs. Declared structurally so this module never imports a pipeline. */
export interface PopulationDeclaringStage {
  id: string;
  ordinal: number;
  population: PopulationDeclaration;
}

/**
 * A place where the pipeline changed what it was reasoning about without
 * saying so.
 */
export interface PopulationContinuityBreak {
  fromStageId: string;
  toStageId: string;
  /** What the upstream stage declared it hands on. */
  produced: DeclaredPopulation;
  /** What the downstream stage declared it reads. */
  consumed: DeclaredPopulation;
  detail: string;
}

/**
 * THE PIPELINE CONTINUITY CHECK.
 *
 *   > "Every stage consumes the declared output population of the previous
 *   >  stage. A stage may narrow that population only through explicit,
 *   >  receipted exclusions. It may never silently substitute a different
 *   >  population."
 *
 * The head stage consumes nothing upstream, so its `consumes` is unconstrained
 * — but it must still be DECLARED, which the type already guarantees.
 */
export function checkPopulationContinuity(
  stages: readonly PopulationDeclaringStage[],
): PopulationContinuityBreak[] {
  const ordered = [...stages].sort((a, b) => a.ordinal - b.ordinal);
  const breaks: PopulationContinuityBreak[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const here = ordered[i];
    if (prev.population.produces === here.population.consumes) continue;
    breaks.push({
      fromStageId: prev.id,
      toStageId: here.id,
      produced: prev.population.produces,
      consumed: here.population.consumes,
      detail:
        `${here.id} reads the ${DECLARED_POPULATION_LABEL[here.population.consumes]} but ${prev.id} hands on ` +
        `the ${DECLARED_POPULATION_LABEL[prev.population.produces]}. Those are different populations, so any ` +
        `count either stage reports is about a different subject from the other's.`,
    });
  }
  return breaks;
}

/**
 * THE HANDOVER ACCOUNT between two adjacent stages — the arithmetic that makes
 * a substitution detectable rather than merely forbidden.
 *
 *   > "If Stage 4 outputs N promoted candidates, Stage 5 must receive those
 *   >  same N candidates (minus any explicitly excluded records). It must be
 *   >  impossible for Stage 5 to report 'no invariants' unless Stage 4 also
 *   >  reported zero."
 *
 * Same identity shape as Stage 3's completion rule
 * (`batchedExtraction.extractionProgression`), one level up: there it is
 * `processed + excluded === admitted population`, here it is
 * `received + excluded === declaredOut`. The rule is the same rule — a stage
 * cannot claim to have finished a population it cannot count.
 */
export interface PopulationHandover {
  fromStageId: string;
  toStageId: string;
  /** The population the pair is meant to be reasoning about. */
  population: DeclaredPopulation;
  /** N — what the upstream stage declared it produced. */
  declaredOut: number;
  /** What the downstream stage actually received. */
  received: number;
  /** Explicitly and visibly removed between the two — the ONLY legitimate
   *  narrowing (`CI-2026-08-03-EXCLUSION-VISIBLE-NOT-DISCARDED-001`). */
  excluded: number;
  /** One stated reason per exclusion. An exclusion without a reason is not an
   *  exclusion, it is a disappearance. */
  exclusionReasons: string[];
}

/** `received + excluded === declaredOut`, and nothing else. */
export function handoverReconciles(h: PopulationHandover): boolean {
  return h.received + h.excluded === h.declaredOut;
}

/**
 * The breach sentence, or `null` when the handover accounts for itself.
 *
 * Returned as prose a surface can render verbatim so the operator meets the
 * discontinuity itself rather than a downstream symptom of it — the symptom
 * (*"there are no invariants to classify"*) is what cost this session.
 */
export function handoverBreach(h: PopulationHandover): string | null {
  if (handoverReconciles(h)) return null;
  const unaccounted = h.declaredOut - h.received - h.excluded;
  return (
    `POPULATION DISCONTINUITY between ${h.fromStageId} and ${h.toStageId}: ` +
    `${h.fromStageId} declared ${h.declaredOut} ${DECLARED_POPULATION_LABEL[h.population]} record(s); ` +
    `${h.toStageId} received ${h.received} with ${h.excluded} explicitly excluded — ` +
    (unaccounted > 0
      ? `${unaccounted} record(s) unaccounted for.`
      : `${-unaccounted} record(s) MORE than were handed on, so it is reading a different population.`) +
    ` Neither stage's count can be trusted until the two describe the same subject.`
  );
}

/** The account in one line, for a receipt or a surface. */
export function renderHandover(h: PopulationHandover): string {
  return (
    `${h.fromStageId} → ${h.toStageId} over the ${DECLARED_POPULATION_LABEL[h.population]}: ` +
    `${h.declaredOut} handed on, ${h.received} received, ${h.excluded} explicitly excluded` +
    (h.exclusionReasons.length > 0 ? ` (${h.exclusionReasons.join('; ')})` : '') +
    '. ' +
    (handoverReconciles(h)
      ? `Accounted: ${h.received} + ${h.excluded} = ${h.declaredOut}.`
      : (handoverBreach(h) as string))
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
  // Added 2026-08-26 (IRL Review #001, remediation cycle 1). `boundary-coverage`
  // is a `scientific-readiness`-tier gate in `crystalReadiness.ts`, so omitting
  // it here would mean an in-scope exception did NOT block a freeze when the
  // ONLY failing gate was boundary coverage — the two lists would silently
  // disagree about what "the crystal is passing" means.
  //
  // This list is a hand-maintained MIRROR of the executable contract
  // (`crystalInstrumentSuite.ts::CRYSTAL_READINESS_CHECK_CONTRACT`), deliberately
  // not an import: deriving it would pull the whole instrument suite (and its
  // substrate-touching dependencies) into this module for a list of strings.
  // Per this repo's source-of-truth rule, a mirror that cannot be derived gets a
  // PARITY CANARY instead — `tests/source-of-truth-parity.test.ts` fails the
  // build if this list and the contract's names ever diverge.
  'boundary-coverage',
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
