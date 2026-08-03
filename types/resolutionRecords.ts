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
export const RESOLUTION_RECORD_SCHEMA_VERSION = 'resolution-record/v2.0' as const;
export const CANDIDATE_INVARIANT_SCHEMA_VERSION = 'candidate-invariant/v2.0' as const;
export const EXPLORATION_ITEM_SCHEMA_VERSION = 'exploration-item/v1.0' as const;

/**
 * Superseded identifiers, newest-first — recorded in the type rather than only
 * in prose, so a reader meeting an old document can tell stale from foreign.
 * Nothing accepts these; the validator pins the current version exactly.
 *
 * WHY v2.0 AND NOT v1.1 (the CCR-001 precedent, verbatim in reasoning): the
 * format is a strict superset, which reads like a minor bump — but a v1.0
 * document does NOT validate under this contract, because `family` and
 * `projections` are REQUIRED and the whole point is that omitting them is an
 * error. An unclassified invariant and an unprojected lesson are the two states
 * this revision exists to abolish. A minor version signalling a compatibility
 * that does not exist is the misleading signal these records exist to remove.
 */
export const SUPERSEDED_RESOLUTION_SCHEMA_VERSIONS = ['resolution-record/v1.0'] as const;
export const SUPERSEDED_CANDIDATE_SCHEMA_VERSIONS = ['candidate-invariant/v1.0'] as const;

// ---------------------------------------------------------------------------
// THREE FAMILIES (operator ruling, 2026-08-03)
// ---------------------------------------------------------------------------

/**
 * The three families, after the operator's structural correction of 2026-08-03.
 * A FACET of the existing record — not a second store, not a second ladder.
 * Every family rides `COMPLETION_LIFECYCLE` exactly as before.
 *
 * ORDER IS NOT SEMANTIC — a set of kinds, not a ladder.
 */
export const INVARIANT_FAMILIES = ['engineering', 'constitutional', 'execution'] as const;
export type InvariantFamily = (typeof INVARIANT_FAMILIES)[number];

/**
 * THE FAMILIES, after the operator's structural correction of 2026-08-03.
 *
 *   engineering    — prevents software defects. Different in KIND from the
 *                    other two, and the operator was explicit: "Those aren't
 *                    UX. They're engineering." Actor/Subject/Owner separation,
 *                    canonical contract over inferred prose, schema-first
 *                    validation, canaries reproduce defects, resolution
 *                    records, diagnostic disclosure, contract consumption.
 *   constitutional — protects governance. Holds the ratified Constitutional
 *                    Time Principle and the rules about authority, ratification
 *                    and receipts.
 *   execution      — the CONSTITUTIONAL EXECUTION FAMILY: the six principles
 *                    that explain WHY the interface rules exist.
 *
 * **THERE IS NO `agency` / `ux` FAMILY, deliberately.** An earlier revision of
 * this file had one, and the operator removed it:
 *
 *   > "I think this is converging into something stronger than an 'Agency'
 *   >  family. What you've actually been discovering across these six
 *   >  occurrences is a constitutional execution principle that explains WHY
 *   >  the UX invariants exist."
 *
 *   > "Don't create 'UX invariants' as a separate canonical family. Instead
 *   >  say: these constitutional execution principles PROJECT into UX."
 *
 * UX is therefore a PROJECTION TARGET (`ux-framework`), not a family — which is
 * what stops the estate accumulating hundreds of parallel UX, workflow and
 * software rules that are really one principle wearing three hats. The payoff,
 * in the operator's words: *"the same underlying principle can be projected
 * into multiple domains without duplication or competing versions."*
 */
export const OPERATOR_NAMED_FAMILIES: readonly InvariantFamily[] = INVARIANT_FAMILIES;

/**
 * The Constitutional Execution Family, in the operator's order and wording
 * (2026-08-03). Pinned as data so the family cannot silently gain a seventh
 * member, and so each principle's canonical id is readable in one place.
 *
 * Every one is an EXISTING candidate re-parented, except `prepared-execution`
 * which the operator named and no prior record covered.
 */
export const CONSTITUTIONAL_EXECUTION_PRINCIPLES = [
  {
    slug: 'exception-isolation',
    name: 'Exception Isolation',
    candidateId: 'CI-2026-08-03-CONTROL-CONSTRAINS-RECORD-001',
    operatorText:
      'Unsafe records are isolated; safe records continue. Never block an executable subset because another subset requires review.',
  },
  {
    slug: 'exception-terminates-in-an-act',
    name: 'Exception Terminates in an Act',
    candidateId: 'CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001',
    operatorText:
      'Every exception surface must terminate in the smallest executable constitutional action. Never terminate in navigation, in investigation, or in "go somewhere else."',
  },
  {
    slug: 'execution-constraint-absorption',
    name: 'Execution Constraint Absorption',
    candidateId: 'CI-2026-08-03-EXECUTION-CONSTRAINT-ABSORPTION-001',
    operatorText:
      'Implementation constraints belong to the runtime unless they materially change the governed act (pagination, batching, retries, continuation tokens, API limits, chunking, rate limits). "Those belong to execution. Not governance."',
  },
  {
    slug: 'cognitive-load-minimization',
    name: 'Cognitive Load Minimization',
    candidateId: 'CI-2026-08-03-UX-MINIMIZE-CONSTITUTIONAL-COGNITIVE-LOAD-001',
    operatorText:
      'The operator makes constitutional DECISIONS; the system performs constitutional EXECUTION. Every unnecessary decision increases Time to Value.',
  },
  {
    slug: 'recommendation-before-interrogation',
    name: 'Recommendation Before Interrogation',
    candidateId: 'CI-2026-08-03-UX-RECOMMENDATION-PREPARED-IN-ADVANCE-001',
    operatorText:
      'If the system already possesses sufficient evidence to recommend a constitutional action, it should recommend before asking. "Not decide. Recommend."',
  },
  {
    slug: 'prepared-execution',
    name: 'Prepared Execution',
    candidateId: 'CI-2026-08-03-PREPARED-EXECUTION-001',
    operatorText:
      'When intent is fully specified, prepare execution. The operator approves prepared work rather than reconstructs work.',
  },
] as const;

/** The ratified principle every execution principle descends from. */
export const CONSTITUTIONAL_TIME_PRINCIPLE_ID = 'CI-2026-08-03-TTV-TTR-OBJECTIVE-001';

// ---------------------------------------------------------------------------
// THE CONSTITUTIONAL KNOWLEDGE PIPELINE (operator, 2026-08-03)
// ---------------------------------------------------------------------------

/**
 *   Observation → Resolution Record → Candidate Principle
 *       ├─ Structural Track    → Research
 *       └─ Constitutional Track → Constitutional Review
 *                 → Ratified Canon → projections
 *
 * The operator's critical qualification: **"Not every insight is an invariant,
 * and not every invariant belongs immediately in the canon."** The track says
 * which review a candidate is bound for; it is NOT a status and never implies
 * one. A candidate can sit at `candidate` on either track indefinitely.
 */
export const KNOWLEDGE_TRACKS = ['structural', 'constitutional'] as const;
export type KnowledgeTrack = (typeof KNOWLEDGE_TRACKS)[number];

/**
 * PROJECTION, NOT COPYING (`inv.engineering.036`/`037` applied to knowledge).
 * The operator: *"Nothing is copied. Everything is projected."*
 *
 * A record DECLARES where it should surface; the platform then knows where to
 * read it from. Nothing here writes into the target — declaring a projection
 * creates a pointer, never a duplicate.
 *
 * Every target below was VERIFIED to exist in this repo before being named
 * (CLAUDE.md No-Guessing). Adding a target means verifying its home first.
 */
export const PROJECTION_TARGETS = [
  /** `services/constitutional/**` — the constitutional service layer + CCR/CFS artifacts. */
  'constitutional-computing',
  /** `services/devCommandCenter/**` — the development command centre / dev loop. */
  'devon',
  /** `codexes/packs/irl/**` — the Institute's research corpus + foundation docs. */
  'irl',
  /** The agency/UX invariant class as consumed by surface work. */
  'ux-framework',
  /** `codexes/packs/alpha-knyt/**` — Venture Lab α methodology. */
  'venture-methodology',
  /**
   * `research_candidate_principles` / `_invariants` / `_backlog_items` via
   * `services/research/registryStore.ts` (CFS-051). The EXISTING research
   * register — a structural-track candidate projects ONTO it and is never
   * re-keyed into a rival table here.
   */
  'research-registry',
  /**
   * The invariant corpus proper — `codexes/packs/irl/foundation/canonical-invariants.seed.json`
   * plus the live DB corpus. A RATIFIED candidate graduates here; nothing below
   * `ratified` may declare it.
   */
  'invariant-corpus',
] as const;
export type ProjectionTarget = (typeof PROJECTION_TARGETS)[number];

/**
 * The projection declaration the operator specified, verbatim in shape:
 *   Potential projections: ✓ Constitutional Computing ✓ DevOn ✓ IRL …
 *   Research required: YES / Ratification required: YES
 */
export interface ProjectionDeclaration {
  targets: ProjectionTarget[];
  /** Does this need to go through research before it can be trusted? */
  researchRequired: boolean;
  /** Does this need an operator ratification act before it can be applied? */
  ratificationRequired: boolean;
  /** Which review this is bound for. Null when not yet decided — an honest state. */
  track: KnowledgeTrack | null;
}

// ---------------------------------------------------------------------------
// THE AGENT CLOSE-OUT CHECKLIST (operator, 2026-08-03)
// ---------------------------------------------------------------------------

/**
 * *"Instead of Claude inventing folders, every agent asks:"* — the eight
 * questions, each with a PREDEFINED destination. This constant IS the
 * checklist; the report renders it and the canary pins that every kind has a
 * destination, so a ninth cannot be added without deciding where it goes.
 *
 * `destination` is a repo path or a named existing register — never a folder
 * invented at close-out time, which is the behaviour this replaces.
 */
export const CLOSE_OUT_KINDS = [
  {
    kind: 'resolution-record',
    question: 'Did something break, resist repair, or resolve in a way worth preserving?',
    destination: 'codexes/packs/agentiq/resolution-records/records/',
  },
  {
    kind: 'candidate-principle',
    question: 'Is there a reusable idea here that is not yet a rule?',
    destination: 'codexes/packs/agentiq/resolution-records/exploration/',
  },
  {
    kind: 'candidate-structural-invariant',
    question: 'Is there a claim about how systems behave that research could test?',
    destination: 'research-registry (services/research/registryStore.ts — research_candidate_invariants)',
  },
  {
    kind: 'candidate-constitutional-principle',
    question: 'Does this govern authority, ratification, receipts or safe acts?',
    destination: 'codexes/packs/agentiq/resolution-records/candidate-invariants/ (family: constitutional)',
  },
  {
    kind: 'candidate-ux-principle',
    question: 'Does this protect the operator’s ability to act?',
    destination: 'codexes/packs/agentiq/resolution-records/candidate-invariants/ (family: agency)',
  },
  {
    kind: 'research-question',
    question: 'Is this an open question rather than an answer?',
    destination: 'codexes/packs/agentiq/resolution-records/exploration/ (track: structural)',
  },
  {
    kind: 'canon-amendment',
    question: 'Does the ratified canon itself need to change?',
    destination: 'codexes/packs/polity-core/items/AMENDMENT_RECORDS.md (operator act required)',
  },
  {
    kind: 'development-framework-amendment',
    question: 'Does a development rule every agent follows need to change?',
    destination: 'CLAUDE.md + its canary',
  },
] as const;

export type CloseOutKind = (typeof CLOSE_OUT_KINDS)[number]['kind'];

/**
 * The close-out RITUAL, in order. The operator named five stages; the order is
 * semantic (you cannot project what you have not extracted).
 */
export const CLOSE_OUT_RITUAL = [
  'resolution-review',
  'principle-extraction',
  'projection',
  'ratification',
  'retrieval-registration',
] as const;
export type CloseOutStage = (typeof CLOSE_OUT_RITUAL)[number];

// ---------------------------------------------------------------------------
// TTV / TTR — the ratified optimisation objective (operator act, 2026-08-03)
// ---------------------------------------------------------------------------

/**
 * *"Constitutional computing shall minimize Time to Value while minimizing Time
 * to Repair. Improvements in one objective shall not be achieved through
 * material degradation of the other. Constitutional safeguards constrain unsafe
 * acts; they shall accelerate constitutionally safe work."*
 *
 *   Minimize(TTV) subject to TTR remaining within constitutional bounds
 *
 * NOT `Minimize(TTR)` — that leads to paralysis. NOT `Minimize(TTV)` alone —
 * that leads to reckless automation.
 *
 * THIS IS NOT A NEW PRIMITIVE. The platform already carries this structure as
 * ratified Polity commentary and as shipped code:
 *
 *   • `services/polity/frameworks/polity-papers-commentary.v1.json` defines
 *     Proof of Time Saved in three layers — "(1) PUBLIC MENTAL MODEL =
 *     Time-to-Value; (2) INTERNAL METRIC = Proof of Time Saved, PoTS;
 *     (3) CONSTITUTIONAL PRINCIPLE = Net Value Acceleration = Time-to-Value
 *     minus Risk Repair Burden".
 *   • `services/venture/ventureOutcomeAccrual.ts::netValueAccelerationHours`
 *     computes it: `max(0, timeSavedHours − riskRepairHours)`.
 *
 * So the operator's ratified sentence is the DESIGN-TIME statement of the same
 * objective the platform already measures at outcome time. The design rule and
 * the metric are one concern with one home; this constant points at that home
 * rather than restating the arithmetic (`inv.engineering.036`).
 */
export const TTV_TTR_OBJECTIVE_SOURCES = [
  'services/polity/frameworks/polity-papers-commentary.v1.json',
  'services/venture/ventureOutcomeAccrual.ts',
  'types/ventureQube.ts',
] as const;

/**
 * The measurable dimensions the operator named. Kept as data so a design review
 * can enumerate them rather than recall them.
 * ORDER IS NOT SEMANTIC.
 */
export const TTV_DIMENSIONS = [
  'clicks',
  'navigation',
  'decisions',
  'elapsed-time',
  'interruptions',
  'operator-interventions',
] as const;

export const TTR_DIMENSIONS = [
  'scope-of-failure',
  'rollback-effort',
  'recovery-complexity',
  'repair-duration',
  'downstream-consequences',
] as const;

export type TtvDimension = (typeof TTV_DIMENSIONS)[number];
export type TtrDimension = (typeof TTR_DIMENSIONS)[number];

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
  /** Which of the three things this protects (operator ruling, 2026-08-03). */
  family: InvariantFamily;
  /**
   * True for a principle that GOVERNS the families rather than merely belonging
   * to one — today, only the ratified TTV/TTR objective.
   *
   * It exists because of one structural fact the operator's own hierarchy
   * requires: Execution-Constraint Absorption is an `agency` rule AND a direct
   * child of the (constitutional) TTV/TTR principle. A blanket "a child shares
   * its parent's family" rule — which is right for a corollary, since a
   * corollary of one family cannot belong to another — would refuse that. This
   * flag is the narrow, named exception: **a governing principle may parent any
   * family; a family rule may only parent within its own.**
   *
   * NOT self-serve: the validator requires `ratified` status, because only the
   * operator can designate a principle as governing, and `ratified` already
   * demands a named operator act.
   *
   * STATUS DOES NOT FLOW DOWN THIS EDGE (operator, verbatim): *"The child UX and
   * engineering constructs need not all be independently ratified merely because
   * the parent is ratified. They may remain candidate or validated
   * implementation invariants until their own evidence and enforcement points
   * justify promotion."* Nothing in this file or its service derives a child's
   * status from its parent's, and a canary pins that.
   */
  governingPrinciple: boolean;
  /**
   * The parent rule this is a corollary or specialisation of, when it has one.
   * FORMALISED 2026-08-03 — the parent/child relation previously lived in
   * `notes` prose, where nothing could read it, so a corollary could drift from
   * its parent silently. `null` for a root rule.
   *
   * A child MUST share its parent's `family`: a corollary of an agency rule
   * that claims to be an engineering rule is a mis-parenting, not a nuance.
   */
  parentCandidateId: string | null;
  /** Where this should surface, and what it must clear first. */
  projections: ProjectionDeclaration;
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
  /**
   * The candidate that absorbed this one, when it was collapsed rather than
   * kept. REQUIRED at status `deprecated` and forbidden otherwise — a retired
   * rule that does not say where it went leaves a dangling reference for every
   * doc that already cited it.
   *
   * This is the mechanism by which the ten `CI-…-UX-*` candidates were
   * collapsed onto the six execution principles without losing the trail.
   */
  supersededBy: string | null;
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
  /** Where this record should surface, and what it must clear first. */
  projections: ProjectionDeclaration;
}

// ---------------------------------------------------------------------------
// EXPLORATION WORKSPACE — "this is where IRL begins"
// ---------------------------------------------------------------------------

/**
 * Every UNRESOLVED idea. The operator: *"Some become constitutional principles.
 * Some become structural invariants. Some become papers. Some disappear. This is
 * where IRL begins."*
 *
 * The point of a separate shape is that an exploration item is NOT a candidate
 * invariant and must never be mistaken for one — it has no `status` on the
 * invariant ladder, no canary obligation, and asserts nothing. Giving it a
 * `CompletionStage` would put unresolved musing on the same ladder as an
 * enforced rule, which is precisely the collapse the operator's *"not every
 * insight is an invariant"* warns against.
 *
 * `disposition` is its own small vocabulary because none of the existing ones
 * fit: this is not a lifecycle, it is what became of the idea.
 */
export const EXPLORATION_DISPOSITIONS = [
  /** Still open. The default and the honest resting state. */
  'open',
  /** Became a candidate invariant — `becameCandidateId` names it. */
  'promoted-to-candidate',
  /** Went to the research register (CFS-051) as a question. */
  'routed-to-research',
  /** Considered and dropped. `notes` must say why — a silent disappearance is a loss. */
  'abandoned',
] as const;
export type ExplorationDisposition = (typeof EXPLORATION_DISPOSITIONS)[number];

export interface ExplorationItem {
  schemaVersion: typeof EXPLORATION_ITEM_SCHEMA_VERSION;
  /** e.g. `EXP-2026-08-03-CONSTITUTIONAL-COMMONS-001`. */
  explorationId: string;
  /** The idea, stated plainly. Not a rule — it need not be true. */
  question: string;
  /** Why it came up, and what would have to be true for it to matter. */
  context: string;
  /** What it would REQUIRE to become real. The operator's guard against half-building. */
  wouldRequire: string[];
  disposition: ExplorationDisposition;
  /** Set only when disposition is `promoted-to-candidate`. */
  becameCandidateId: string | null;
  /** Where it would surface IF it resolved. Declared early so routing is visible. */
  projections: ProjectionDeclaration;
  /** Resolution records / docs that raised it. */
  raisedBy: string[];
  notes: string[];
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
  /** Counts per family — the three things the registry protects. */
  byFamily: Record<InvariantFamily, number>;
  /**
   * Rules with a parent, grouped under it. DERIVED from `parentCandidateId`,
   * never hand-maintained — the corollary structure must be readable without
   * anyone remembering it.
   */
  ruleTrees: { parentCandidateId: string; statement: string; children: string[] }[];
  /** The Exploration Workspace, by disposition. Open items first. */
  exploration: { explorationId: string; question: string; disposition: ExplorationDisposition }[];
  /** Candidates that declare a projection target but have not cleared its gate. */
  pendingProjections: { candidateId: string; targets: ProjectionTarget[]; blockedBy: string }[];
  milestoneClose: MilestoneCloseResult;
}
