/**
 * Invariant evidence, failure-learning and the learning receipt — the
 * canonical type contract. Homecoming III bootstrap, Phase 5.
 *
 * Contract-first, façade-not-fork (the `types/dcir.ts` / `types/
 * invariantEnvelope.ts` precedent): types + pinned constants + the minimum
 * pure runtime needed to make the contract enforceable. Runtime composition
 * lives in `services/devCommandCenter/{invariantEvidence,failureLearning,
 * learningReceipt}.ts`.
 *
 * ── The loop this contract closes ──────────────────────────────────────────
 *
 *   implementation → consequence observation → invariant evidence →
 *   governed learning
 *
 * Every organ this composes over already exists: `types/dcir.ts` (the event
 * vocabulary, appended not forked), `types/invariantEnvelope.ts` (the
 * envelope, ProofOfRisk, ConsequenceBinding, Falsifier), `types/
 * devCommandCenter.ts` (ConsequenceValidationReport, RemediationPlan), and
 * `types/resolutionRecords.ts` (ResolutionRecord, CandidateInvariant, the
 * ONE registry learning already writes into). This file adds no new
 * registry and no new persistence mechanism — see §4.
 *
 * ── Constitutional cautions baked into this contract ───────────────────────
 *
 *  1. **A failure is not an invariant** (CANARY-05). `RiskObservation` has no
 *     `status` field on the `CompletionStage` ladder — the same design
 *     choice `ExplorationItem` makes for an unresolved idea. It cannot be
 *     mistaken for a candidate because its shape has nowhere to put a stage.
 *     The only path from an observation to a candidate is
 *     `RecurrencePortabilityAssessment`, and even that path caps at
 *     `'candidate'` (§3) — never higher, by construction.
 *
 *  2. **Provider identity is not constitutional semantics** (CANARY-09).
 *     Nothing in this file accepts a provider, model, or vendor identifier as
 *     an input to a classification. `InvariantEvidenceKind` is a function of
 *     WHAT was observed; it is not, and must never become, a function of
 *     WHICH system produced the observation.
 *
 *  3. **Nothing here canonizes** (requirement 6). No type in this file can
 *     express `'ratified'` or `'canonical'` as a value it PRODUCES — the
 *     draft-producing functions in `failureLearning.ts` are typed to return
 *     only `DraftCandidateStage`, a proper subset of `CompletionStage`.
 *
 *  4. **One registry, reused — never a second one.** `LearningReceipt` is a
 *     REPORT (the same idiom as `ResolutionRegistryReport` in
 *     `types/resolutionRecords.ts`): a computed view assembled from the
 *     envelope, the evidence log and the existing registry types. Anything
 *     durable it proposes is shaped as a `ResolutionRecord` /
 *     `CandidateInvariant` — the SAME two types every other resolution
 *     writes — and validated with the SAME validators
 *     (`services/invariants/resolutionRecords.ts`). Persisting a proposal is
 *     the existing manual, reviewed convention every other record in the
 *     registry already follows; nothing here writes to disk.
 *
 *  5. **Scope is not context-binding** (operator ruling, 2026-08-15 —
 *     `RES-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`). `InvariantScope`
 *     (`types/invariantEnvelope.ts`) answers WHERE a causal proposition
 *     applies; it is not extended with a `developer`/`user` rung, and never
 *     will be, because authorized personal/project relevance is a SEPARATE
 *     axis from causal scope. That axis — recorded as a design requirement,
 *     not implemented here — would represent `platform / workspace / project
 *     / developer / principal-user / session-intent`, deferred to Crystal 2.0
 *     / post-threshold. Until it exists, `RiskObservation`/
 *     `RecurrencePortabilityAssessment` carry no personal-context field, and
 *     any future caller that wires a persistent, cross-session store MUST
 *     pre-filter to an authorized scope before pooling (see the caller
 *     contract on `assessRecurrencePortability`,
 *     `services/devCommandCenter/failureLearning.ts`) — never by adding a
 *     `personaId`-shaped field here, which `DEV_LOOP_FORBIDDEN_STATE_KEYS`
 *     (below) already forbids on `DevLoopState` for the same T0-isolation
 *     reason.
 */

import type { CompletionStage } from './capabilityCompletion';
import type {
  EnvelopeInvariant,
  IntentRiskField,
  ProofOfRisk,
  RiskVectorRef,
} from './invariantEnvelope';
import type { CandidateInvariant, ResolutionRecord } from './resolutionRecords';

// ---------------------------------------------------------------------------
// §0 Schema version
// ---------------------------------------------------------------------------

export const INVARIANT_EVIDENCE_SCHEMA_VERSION = 'invariant-evidence/v1.0' as const;
export const RISK_OBSERVATION_SCHEMA_VERSION = 'risk-observation/v1.0' as const;
export const LEARNING_RECEIPT_SCHEMA_VERSION = 'learning-receipt/v1.0' as const;

// ---------------------------------------------------------------------------
// §1 Invariant evidence — the DCIR-observable classification
// ---------------------------------------------------------------------------

/**
 * How an observed consequence bears on an invariant or candidate it was
 * bound to. 1:1 with the four `Invariant*` DCIR event kinds appended in
 * `types/dcir.ts` — this is the DOMAIN vocabulary; the DCIR kinds are its
 * OBSERVATION-RUNTIME projection. Two names for the same four states would
 * be the parallel-implementation defect applied to a taxonomy, so this
 * union is the one place the four states are enumerated and the event
 * emitters (`services/dcir/eventStream.ts`) are switched over it, never
 * independently re-listed.
 */
export const INVARIANT_EVIDENCE_KINDS = ['supported', 'challenged', 'falsified', 'unresolved'] as const;
export type InvariantEvidenceKind = (typeof INVARIANT_EVIDENCE_KINDS)[number];

/**
 * One observation binding a consequence back to the invariant/candidate it
 * tested. `dcirEventId` is populated once the observation has actually been
 * emitted onto the event stream — null is honest for an observation computed
 * but not yet emitted (pure classification and emission are separate acts,
 * mirroring `bearingDiscovery.ts`'s purity boundary).
 */
export interface InvariantEvidenceObservation {
  invariantRef: string;
  kind: InvariantEvidenceKind;
  /** What was actually observed — a T2-safe label, never a full body. */
  basis: string;
  /** The consequence entry this observation was derived from, where one exists. */
  consequenceRef: string | null;
  dcirEventId: string | null;
  observedAt: string;
}

// ---------------------------------------------------------------------------
// §2 Failure learning — a failure produces evidence, never a rule
// ---------------------------------------------------------------------------

/**
 * A material failure, observed. Deliberately NOT on the `CompletionStage`
 * ladder — the same design the operator made for `ExplorationItem`
 * (`types/resolutionRecords.ts`): a shape with no `status` field cannot be
 * mistaken for one further along a ladder it was never placed on
 * (CANARY-05).
 */
export interface RiskObservation {
  schemaVersion: typeof RISK_OBSERVATION_SCHEMA_VERSION;
  id: string;
  intentRef: string;
  sessionRef: string;
  /** Where it was observed — a capability id, subsystem or surface. Mirrors
   *  `InvariantOccurrence.site` (types/resolutionRecords.ts) deliberately:
   *  recurrence across DIFFERENT sites is what portability means in both
   *  places, and reusing the word keeps that single meaning legible. */
  site: string;
  /** What was seen, in enough detail to recognise a repeat. */
  description: string;
  initiatingCondition: string;
  adverseConsequence: string;
  /** The risk vector this observation bears on, where the field already
   *  projected one. Null when this failure was NOT projected — the honest
   *  case a `NewRiskObservation` event exists to surface. */
  relatedRiskVectorId: string | null;
  /** Real references only — commits, tests, receipts. Never invented. */
  evidenceRefs: string[];
  observedAt: string;
}

/**
 * The gate between a risk observation and a candidate invariant.
 *
 * Recurrence alone is not portability: the SAME site failing twice is one
 * fragile site, not a general lesson (this mirrors `InvariantOccurrence`'s
 * own discipline in `types/resolutionRecords.ts`, where a `cross-capability`
 * claim requires occurrences in more than one capability). `portable`
 * therefore requires BOTH a recurrence count ≥ 2 AND at least two DISTINCT
 * sites — the same shape recurring somewhere else, not the same place
 * failing again.
 */
export interface RecurrencePortabilityAssessment {
  observationId: string;
  /** This observation plus every prior observation judged the same claim. */
  recurrenceCount: number;
  distinctSites: string[];
  portable: boolean;
  rationale: string;
  assessedAt: string;
}

/**
 * The ceiling a Phase 5 auto-generated candidate draft may reach — NEVER the
 * full `CompletionStage`. Structural, not conventional: a function typed to
 * return this union cannot express `'validated'`, `'ratified'` or
 * `'canonical'` regardless of what its author intends, the same technique
 * `BehaviouralInvariant.status` (`types/dcir.ts`) uses to make canonization
 * unrepresentable rather than merely forbidden (requirement 6, CANARY-01).
 *
 * `'candidate'` is reachable — the whole point of the failure-learning path
 * is to eventually produce a real `CandidateInvariant` record when the
 * evidence earns it — but nothing below this file, nor anything in
 * `failureLearning.ts`, may construct one any higher.
 */
export type DraftCandidateStage = Extract<CompletionStage, 'candidate'>;

// ---------------------------------------------------------------------------
// §3 The learning receipt — the governed artifact at end of cycle
// ---------------------------------------------------------------------------

/**
 * The governed artifact produced at the end of a development cycle
 * (requirement 5). A REPORT, not a registry — see the file header's §4. Every
 * field is either a real ref into existing structures (the envelope, the
 * evidence log, the resolution-record registry) or a draft in the EXISTING
 * `ResolutionRecord`/`CandidateInvariant` shape. Nothing here is written to
 * disk by this contract or by the functions that build it; persisting a
 * draft is the same manual, reviewed act every other record already follows.
 */
export interface LearningReceipt {
  schemaVersion: typeof LEARNING_RECEIPT_SCHEMA_VERSION;
  intentRef: string;
  sessionRef: string;
  /** The intent this cycle served, stated plainly (never re-derived from
   *  the statement text elsewhere — one source, carried by reference). */
  intentStatement: string;
  /** Refs of envelope members citable as established (constitutional +
   *  ratified/canonical) that this cycle actually relied upon. */
  establishedInvariantsUsed: string[];
  /** Refs of envelope members that are real and relevant but NOT
   *  established — candidates, projected signals, live discoveries. */
  candidateOrLiveInvariantsUsed: string[];
  /** ProofOfRisk ids whose origin was 'projected'. */
  projectedRisks: string[];
  /** ProofOfRisk ids whose origin was 'observed', plus every RiskObservation
   *  id raised this cycle — the two real sources of "a risk was observed". */
  observedRisks: string[];
  /** Evidence of kind 'supported'. */
  evidenceSupporting: InvariantEvidenceObservation[];
  /** Evidence of kind 'challenged' or 'falsified'. */
  evidenceChallengingOrFalsifying: InvariantEvidenceObservation[];
  /** What was actually done to repair or remediate — free-text descriptions,
   *  carried from the existing `RemediationEntry.learningNote` /
   *  `RemediationPlan`, never re-authored here. */
  repairPerformed: string[];
  /** Evidence of kind 'unresolved', plus the envelope's own
   *  `unresolvedQuestions` — material questions this cycle did not settle. */
  unresolvedMaterialQuestions: string[];
  /** Recommendations about scope/projection for whoever reviews this
   *  receipt — never a decision this artifact makes for them. */
  scopeRecommendations: string[];
  /**
   * A draft resolution record, where this cycle's evidence warrants one.
   * `null` is the honest default: not every development cycle produces a
   * resolution worth recording (the same milestone-triggered discipline
   * `RESOLUTION_TRIGGERS` already imposes on every other record).
   */
  draftResolutionRecord: ResolutionRecord | null;
  /**
   * Draft candidate invariants this cycle's failure-learning path produced.
   * Empty is the common and honest case — see `DraftCandidateStage` above:
   * a single, non-portable failure yields NO candidate, only a
   * `RiskObservation` (CANARY-05).
   */
  draftCandidateInvariants: CandidateInvariant[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// §4 Trace provenance — what the acceptance demonstration must preserve
// ---------------------------------------------------------------------------

/**
 * The full causal trace the Phase 5 acceptance demonstration must show,
 * end to end, with provenance and lifecycle status intact at every link.
 * Pinned as data — order is constitutional, and a canary walks it — rather
 * than left as prose a later reader could silently shorten.
 */
export const PHASE5_ACCEPTANCE_TRACE = [
  'intent',
  'initial-risk-field',
  'bearing-discovery',
  'invariant-development-envelope',
  'compressed-implementation-context',
  'implementation-consequence',
  'dcir-invariant-evidence-event',
  'resolution-record-or-candidate-learning-artifact',
] as const;
export type Phase5TraceLink = (typeof PHASE5_ACCEPTANCE_TRACE)[number];

// Re-exported for callers that only need the evidence/failure-learning
// surface without importing the full envelope contract.
export type { EnvelopeInvariant, IntentRiskField, ProofOfRisk, RiskVectorRef };
