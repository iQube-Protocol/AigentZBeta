/**
 * Resolution records + candidate invariants — the type contract for the
 * resolution-to-invariant feedback loop (operator instruction, 2026-08-03).
 *
 * THE OPERATING PRINCIPLE (operator's words):
 *
 *   > "A resolved problem is not complete until the resolution has been
 *   >  converted into reusable development knowledge."
 *
 * Closing a ticket records WHAT changed. It does not preserve why the defect
 * happened, which earlier assumption proved false, what evidence identified the
 * root cause, which tempting fixes were rejected, what rule should prevent
 * recurrence, what canary would detect regression, or whether the lesson is
 * local or estate-wide. That is the information agents repeatedly lose.
 *
 * ── EXTENDS, DOES NOT FORK ──────────────────────────────────────────────────
 *
 * This is deliberately NOT a new lifecycle vocabulary. `inv.engineering.036`
 * ("one authoritative location per concern") and `inv.engineering.037` ("a
 * parallel implementation of an existing capability is a defect") forbid it,
 * and the repo already has the ladder this loop needs:
 *
 *   COMPLETION_LIFECYCLE  (types/capabilityCompletion.ts, CCR-001 §9)
 *     observed → candidate → validated → ratified → canonical → deprecated
 *
 * That ladder is REUSED here verbatim — `ResolutionRecord.status` and
 * `CandidateInvariant.status` are both `CompletionStage`. The operator's
 * seven-rung prose ladder maps onto it WITHOUT minting a third vocabulary
 * (`map, don't unify` — the operator's own 2026-07-27 ruling, which
 * `tests/capability-completion.test.ts` already canaries):
 *
 *   | Operator's rung                          | Represented as                       |
 *   |------------------------------------------|--------------------------------------|
 *   | Resolution observed                      | status `observed`                    |
 *   | Candidate lesson                         | status `observed`, `lesson` written  |
 *   | Candidate invariant                      | status `candidate` + a CI record     |
 *   | Applied in another implementation        | CI.occurrences.length > 1 (DATA)     |
 *   | Validated by reuse / regression prevented| status `validated`                   |
 *   | Ratified operational invariant           | status `ratified` + `ratifiedSource` |
 *   | Included in capability + agent context   | status `canonical`                   |
 *
 * "Applied in another implementation" is deliberately modelled as EVIDENCE
 * (a second recorded occurrence) rather than as a self-declared status word.
 * A rung an agent can simply assert is not a rung; a rung that requires a
 * second incident on the record is. This is the operator's own guard against
 * "a lesson should not immediately become a canonical invariant merely because
 * a fix worked once".
 *
 * ── THREE REQUIRED OUTPUTS PER RESOLUTION ───────────────────────────────────
 *
 *   1. the resolution record  — the factual account (this file's `ResolutionRecord`)
 *   2. the candidate invariant — the compressed reusable rule (`CandidateInvariant`)
 *   3. the canary              — the executable mechanism (`CandidateInvariant.canaries`)
 *
 *   > "Without the canary, the invariant is advisory prose. Without the
 *   >  invariant, the canary is an isolated test whose purpose will eventually
 *   >  be forgotten."
 *
 * `runMilestoneCloseCheck` in services/invariants/resolutionRecords.ts refuses
 * to report clear while any of the three is missing where the ladder requires it.
 *
 * ── WHERE A RATIFIED CANDIDATE GOES ─────────────────────────────────────────
 *
 * Nowhere new. A candidate the operator ratifies graduates into the structures
 * that already exist — it does NOT stay here as a second canon:
 *   • `ReproductionInvariant` inside a Capability Completion Artifact (CCR-001),
 *     which already carries {statement, provenance, defect, canaries, status};
 *   • the seed crystal `codexes/packs/irl/foundation/canonical-invariants.seed.json`,
 *     via the normal `proposed → validated → canonical` lifecycle.
 * This registry is the LIGHTWEIGHT CAPTURE at the moment of repair, and the
 * defect→invariant mapping data whose absence is the recorded reason CAN-CCR-6
 * is deferred (see tests/capability-completion.test.ts header).
 *
 * PURE: types + pinned vocabularies + total projections. No I/O, no clock.
 * T1-safe by construction: nothing here holds a personaId, a caseId, or any
 * other T0 identifier, and nothing may be added that does.
 */

import type { CompletionStage } from './capabilityCompletion';
import { COMPLETION_LIFECYCLE } from './capabilityCompletion';

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/**
 * Follows the repo's `<kebab-domain-slug>/v<major>.<minor>` convention
 * (cf. `capability-completion-artifact/v2.0`, `venture-iqube/v1.0`).
 * A record declaring any other version is refused rather than coerced.
 */
export const RESOLUTION_RECORD_SCHEMA_VERSION = 'resolution-record/v1.0' as const;
export const CANDIDATE_INVARIANT_SCHEMA_VERSION = 'candidate-invariant/v1.0' as const;

// ---------------------------------------------------------------------------
// Cadence — WHEN the loop runs (operator: "Do not do this on every push.")
// ---------------------------------------------------------------------------

/**
 * The ten milestone/resolution triggers the operator enumerated. The loop is
 * MILESTONE-TRIGGERED, never commit-triggered: a record exists because one of
 * these fired, and `trigger` names which one.
 *
 * ORDER IS NOT SEMANTIC — a set of kinds, not a ladder. Nothing may read
 * position in this array as rank.
 */
export const RESOLUTION_TRIGGERS = [
  /** 1. A problem required multiple repair cycles. */
  'multi-cycle-repair',
  /** 2. A supposedly resolved defect reappeared. */
  'defect-recurred',
  /** 3. A test or canary encoded the defect instead of detecting it. */
  'canary-encoded-the-defect',
  /** 4. Two subsystems disagreed about the same canonical state. */
  'subsystems-disagreed',
  /** 5. A local anomaly blocked an unaffected batch. */
  'local-anomaly-blocked-batch',
  /** 6. A governance boundary was confused with a software condition. */
  'governance-boundary-confused',
  /** 7. A successful implementation established a reusable pattern. */
  'reusable-pattern-established',
  /** 8. A milestone became demonstrably complete. */
  'milestone-complete',
  /** 9. A workaround was replaced by the canonical implementation. */
  'workaround-replaced',
  /** 10. A failure revealed an existing invariant was incomplete or misscoped. */
  'invariant-incomplete-or-misscoped',
] as const;

export type ResolutionTrigger = (typeof RESOLUTION_TRIGGERS)[number];

/**
 * The triggers that mean *this already came back or already resisted repair*.
 * A record with one of these and no canary is the exact "advisory prose" state
 * the loop exists to eliminate, so the milestone-close check treats a missing
 * canary here as a BLOCKER rather than a warning.
 */
export const RECURRENCE_CLASS_TRIGGERS: readonly ResolutionTrigger[] = [
  'multi-cycle-repair',
  'defect-recurred',
  'canary-encoded-the-defect',
];

// ---------------------------------------------------------------------------
// Scope — the operator's vocabulary
// ---------------------------------------------------------------------------

/**
 * Whether the lesson binds only where it was found, or across capabilities.
 *
 * `cross-capability` is a CLAIM about generality and must be earned: the
 * milestone-close check requires a `cross-capability` candidate to carry
 * occurrences in more than one capability. This mirrors CCR-001 §8's
 * `cross-capability-recurrence` provenance kind ("the same shape recurred
 * across two or more capabilities") rather than inventing a second meaning
 * for the same word.
 */
export const RESOLUTION_SCOPES = ['local', 'cross-capability'] as const;
export type ResolutionScope = (typeof RESOLUTION_SCOPES)[number];

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * The operator's exact evidence shape. Every field is a list of REAL
 * references — CLAUDE.md's no-guessing rule applies with full force here: an
 * invented commit hash or test name makes the whole record worse than absent,
 * because it looks verifiable. A field with nothing real to put in it stays `[]`.
 */
export interface ResolutionEvidence {
  /** Short commit SHAs, as they appear in `git log --oneline`. */
  commits: string[];
  /** Repo-relative test paths. Resolved on disk by the canary. */
  tests: string[];
  /** Receipt ids / action types, where a receipt records the act. */
  receipts: string[];
  /** Incident, issue or update-doc references. */
  incidentRefs: string[];
}

// ---------------------------------------------------------------------------
// One occurrence of a candidate invariant's defect shape
// ---------------------------------------------------------------------------

/**
 * A single time this shape was observed. THIS IS THE RECURRENCE SIGNAL.
 *
 * The operator: *"the ladder step 'Applied in another implementation /
 * Validated by reuse or regression prevention' is already satisfied for those
 * two by the historical record"*. Recurrence is therefore never a number an
 * agent types — it is `occurrences.length`, derived, with each entry naming a
 * distinct site and its evidence. One anecdote cannot inflate itself.
 */
export interface InvariantOccurrence {
  /** Where it happened — a capability id, subsystem or surface. */
  site: string;
  /** What was observed, in enough detail to recognise a repeat. */
  defect: string;
  /** The resolution record this occurrence was captured in. */
  resolutionId: string;
  /** Commits / tests / docs proving THIS occurrence. Never invented. */
  evidence: string[];
}

// ---------------------------------------------------------------------------
// The candidate invariant — output 2 of 3
// ---------------------------------------------------------------------------

/**
 * The compressed reusable rule. Held as its OWN record, referenced by id from
 * every resolution record that produced it, so that one rule with three
 * incidents is one candidate with three occurrences — not three near-duplicate
 * strings in three files.
 *
 * `status` is `CompletionStage`, REUSED from CCR-001. An agent may raise it no
 * higher than `validated`; `ratified` and `canonical` require `ratifiedSource`
 * naming a real operator act. That is the hypothesis-vs-canon discipline
 * CLAUDE.md already binds this repo to, applied to engineering lessons.
 */
export interface CandidateInvariant {
  schemaVersion: typeof CANDIDATE_INVARIANT_SCHEMA_VERSION;
  /** e.g. `CI-2026-08-03-ACTOR-SUBJECT-OWNER-001`. */
  candidateId: string;
  /** The rule, stated as something that must remain true. One sentence. */
  statement: string;
  /**
   * How the operator classified it, where they did. Verbatim — a paraphrase of
   * a classification is a different classification. Null when unclassified.
   */
  classification: string | null;
  scope: ResolutionScope;
  status: CompletionStage;
  /**
   * Repo-relative paths of the executable proofs enforcing this rule, each with
   * the assertion it makes. EMPTY IS LEGAL AND VISIBLE: a candidate whose
   * enforcement point does not exist yet is recorded honestly and flagged by
   * the milestone-close check — "an invariant without a canary is advisory
   * prose" — rather than being held back until it looks finished.
   */
  canaries: CandidateCanary[];
  /** Every recorded sighting. Length IS the recurrence count. */
  occurrences: InvariantOccurrence[];
  /** Resolution record ids this candidate was derived from. */
  derivedFrom: string[];
  /**
   * The operator act that ratified it. MUST be null below `ratified`, MUST be
   * present at `ratified` and above. No agent may write this from its own
   * judgement (CLAUDE.md: an agent message is never operator consent).
   */
  ratifiedSource: string | null;
  /** Anything that must not be lost: wording shifts, scope limits, open questions. */
  notes: string[];
}

export interface CandidateCanary {
  /** Repo-relative path. Resolved on disk by the canary test. */
  path: string;
  /** What it asserts — so its purpose survives the person who wrote it. */
  assertion: string;
  /**
   * OS-9 — was this canary verified to FAIL against the pre-fix code?
   * `false` is an honest state, not a failure to report.
   */
  verifiedFailingBeforeFix: boolean;
}

// ---------------------------------------------------------------------------
// The resolution record — output 1 of 3 (the operator's exact shape)
// ---------------------------------------------------------------------------

export interface ResolutionRecord {
  schemaVersion: typeof RESOLUTION_RECORD_SCHEMA_VERSION;
  /** e.g. `RES-2026-08-02-AGENT-REGISTRATION-001`. */
  resolutionId: string;
  /** The capability this resolution belongs to. */
  capability: string;
  /** The milestone at which it was captured. */
  milestone: string;
  /** What went wrong, in one paragraph a reader can act on. */
  problem: string;
  /** What was actually seen — symptoms, not diagnoses. */
  observedFailure: string[];
  /** Why it happened — the assumptions that proved false. */
  rootCauses: string[];
  /** What was done. */
  resolution: string[];
  /** The tempting fixes considered and rejected, and why. */
  rejectedApproaches: string[];
  /** `candidateId`s in the candidate-invariant registry. Never free prose. */
  candidateInvariants: string[];
  /** Repo-relative canary paths this resolution produced or repaired. */
  canaries: string[];
  scope: ResolutionScope;
  status: CompletionStage;
  /** Which cadence rule fired. The loop is milestone-triggered, never per-push. */
  trigger: ResolutionTrigger;
  evidence: ResolutionEvidence;
  /** Update docs this record MINES rather than duplicates (inv.engineering.036). */
  sourceDocs: string[];
  /** ISO date (YYYY-MM-DD) the resolution was captured. */
  date: string;
}

// ---------------------------------------------------------------------------
// Ladder helpers — REUSED, never redefined
// ---------------------------------------------------------------------------

/**
 * Rank on `COMPLETION_LIFECYCLE`. `deprecated` is the ladder's terminus in the
 * array but asserts no maturity, so it is excluded from ordering comparisons
 * and returns -1 — the same honesty `mapCompletionStage` shows by projecting it
 * to `null` rather than inventing a crystal status for it.
 */
export function ladderRank(stage: CompletionStage): number {
  if (stage === 'deprecated') return -1;
  return COMPLETION_LIFECYCLE.indexOf(stage);
}

/** True when `stage` is at or above `floor` on the reused ladder. */
export function atOrAbove(stage: CompletionStage, floor: CompletionStage): boolean {
  const s = ladderRank(stage);
  const f = ladderRank(floor);
  return s >= 0 && f >= 0 && s >= f;
}

/**
 * The highest stage an AGENT may write without an operator act. Above this, the
 * record must carry `ratifiedSource`. Pinned as a constant so the rule is
 * stated once and read by both the validator and its canary.
 */
export const AGENT_MAX_STAGE: CompletionStage = 'validated';

// ---------------------------------------------------------------------------
// Validation + report results (path-addressed, per the CCR-001 validator idiom)
// ---------------------------------------------------------------------------

export interface ResolutionIssue {
  /** JSON-ish path of the fault, e.g. `candidateInvariants[1]`. */
  path: string;
  message: string;
}

export interface ResolutionValidationResult {
  valid: boolean;
  issues: ResolutionIssue[];
}

export type MilestoneFindingSeverity = 'blocker' | 'warning' | 'question';

export interface MilestoneCloseFinding {
  severity: MilestoneFindingSeverity;
  /** The record or candidate the finding is about; null for registry-wide. */
  subjectId: string | null;
  message: string;
}

export interface MilestoneCloseResult {
  /** True only when there are no blockers AND the open question was answered. */
  clear: boolean;
  findings: MilestoneCloseFinding[];
}

/**
 * The small dashboard the operator asked for: open resolutions, candidate
 * invariants, validated invariants, unresolved recurrence risks.
 */
export interface ResolutionRegistryReport {
  generatedFor: string;
  totals: {
    resolutions: number;
    candidates: number;
    canaries: number;
    candidatesWithoutCanary: number;
  };
  /** Resolutions not yet at `validated`. */
  openResolutions: { resolutionId: string; status: CompletionStage; capability: string; trigger: ResolutionTrigger }[];
  /** Every candidate below `validated`, with its recurrence count. */
  candidateInvariants: { candidateId: string; statement: string; status: CompletionStage; occurrences: number; canaries: number }[];
  /** Every candidate at `validated` or above. */
  validatedInvariants: { candidateId: string; statement: string; status: CompletionStage; occurrences: number; canaries: number }[];
  /**
   * A shape that has recurred (or resisted repair) and is NOT yet protected by
   * an executable mechanism. This is the list that predicts the next regression.
   */
  unresolvedRecurrenceRisks: { candidateId: string; statement: string; occurrences: number; reason: string }[];
  milestoneClose: MilestoneCloseResult;
}
