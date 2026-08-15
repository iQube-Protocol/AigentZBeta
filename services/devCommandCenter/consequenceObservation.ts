/**
 * consequenceObservation — Phase 5: the closed loop through DCIR.
 *
 *   implementation → consequence observation →
 *     supported | challenged | falsified | unresolved | new-risk-observation
 *   → governed learning receipt (draft)
 *
 * DCIR is EXTENDED, never forked (operator ruling, 2026-08-15): the five new
 * `DcirEventKind` members were appended to the existing contract in
 * `types/dcir.ts`, and this module's only side effect is calling the five new
 * emitters in `services/dcir/eventStream.ts` — the same runtime that already
 * observes DevOn's nine `dev*` events.
 *
 * The hard distinction this module exists to hold: **DCIR produces evidence.
 * It does not canonize.** Nothing here writes to the invariant substrate or
 * the resolution-record registry. `draftLearningReceipt` returns an in-memory
 * DRAFT shaped like the real registry records — turning it into an actual
 * `ResolutionRecord` / `CandidateInvariant` file is a deliberate, governed act
 * a human takes, the same discipline every prior phase's JSON records in
 * `codexes/packs/agentiq/resolution-records/` were written under.
 *
 * @organ types/dcir.ts                             — the extended event contract
 * @organ services/dcir/eventStream.ts               — the five new emitters
 * @organ types/invariantEnvelope.ts                 — mayBeCitedAsEstablished
 * @organ types/resolutionRecords.ts                 — CompletionStage, ResolutionTrigger
 */

import {
  invariantChallengedEvent,
  invariantFalsifiedEvent,
  invariantSupportedEvent,
  invariantUnresolvedEvent,
  newRiskObservationEvent,
} from '@/services/dcir/eventStream';
import type { DcirEvent } from '@/types/dcir';
import type { ConsequenceFalsificationBinding } from '@/types/devCommandCenter';
import type { CompletionStage } from '@/types/capabilityCompletion';
import type { ResolutionTrigger } from '@/types/resolutionRecords';

// ---------------------------------------------------------------------------
// §1 The verdict vocabulary
// ---------------------------------------------------------------------------

export const CONSEQUENCE_OBSERVATION_VERDICTS = [
  'supported',
  'challenged',
  'falsified',
  'unresolved',
  'new-risk-observation',
] as const;
export type ConsequenceObservationVerdict = (typeof CONSEQUENCE_OBSERVATION_VERDICTS)[number];

/** What was actually seen, or nothing yet. `null` means genuinely no evidence. */
export interface ObservedEvidence {
  sawExpectedConsequence: boolean;
  sawProhibitedConsequence: boolean;
  evidenceRefs: string[];
}

export interface ConsequenceObservationInput {
  binding: ConsequenceFalsificationBinding;
  /** `null` when no evidence has been gathered yet — surfaced as `unresolved`. */
  observed: ObservedEvidence | null;
  /**
   * Refs (invariant refs, ProofOfRisk ids, risk-vector ids) that anticipated
   * this failure mode. Empty means NOTHING bound to this intent predicted it —
   * the precondition for CANARY-05.
   */
  anticipatedByRefs: readonly string[];
}

export interface ConsequenceObservationResult {
  verdict: ConsequenceObservationVerdict;
  invariantRef: string;
  event: DcirEvent;
}

/**
 * Observe one bound consequence against what was actually seen.
 *
 * ── CANARY-05: failure produces a risk observation FIRST ──────────────────
 *
 * A prohibited consequence firing is not automatically routed to `falsified`.
 * It is `falsified` only when something already bound to this intent
 * anticipated it — an invariant, a Proof of Risk, a risk vector. When NOTHING
 * anticipated it, the same observation is `new-risk-observation`: real
 * evidence of a real problem, but not yet evidence AGAINST any specific
 * invariant, because nothing claimed responsibility for preventing it. Wiring
 * an unanticipated failure straight to `falsified` would let a single
 * surprising observation directly edit whatever invariant happened to be
 * nearby — exactly the "failure becomes a candidate lesson, not an instant
 * invariant" discipline the resolution-record loop already enforces
 * (CLAUDE.md's Resolution → Invariant Loop), applied here to consequence
 * observation rather than to development retrospectives.
 *
 * ── CANARY-10: evidence may challenge established memory ──────────────────
 *
 * This function does not know or care whether `binding.invariantRef` names an
 * established invariant, a live candidate, or a discovery. It observes the
 * SAME way regardless, and it never inspects — let alone mutates — any
 * lifecycle field. An established invariant is exactly as challengeable as a
 * candidate; nothing here special-cases standing into unfalsifiability.
 */
export function observeConsequence(input: ConsequenceObservationInput): ConsequenceObservationResult {
  const { binding, observed, anticipatedByRefs } = input;
  const ref = binding.invariantRef;

  if (!observed) {
    return { verdict: 'unresolved', invariantRef: ref, event: invariantUnresolvedEvent(ref) };
  }

  if (observed.sawProhibitedConsequence) {
    if (anticipatedByRefs.length === 0) {
      const event = newRiskObservationEvent(`unanticipated: ${ref} — ${binding.observableFalsifier}`);
      return { verdict: 'new-risk-observation', invariantRef: ref, event };
    }
    return { verdict: 'falsified', invariantRef: ref, event: invariantFalsifiedEvent(ref) };
  }

  if (observed.sawExpectedConsequence) {
    return { verdict: 'supported', invariantRef: ref, event: invariantSupportedEvent(ref) };
  }

  // Evidence exists but neither the expected nor the prohibited consequence
  // was clearly seen — ambiguous, not silently rounded to either extreme.
  return { verdict: 'challenged', invariantRef: ref, event: invariantChallengedEvent(ref) };
}

// ---------------------------------------------------------------------------
// §2 The governed learning receipt — a DRAFT, never a write
// ---------------------------------------------------------------------------

/**
 * The only stages a DCIR-produced draft may express.
 *
 * ── CANARY-01: no auto-canonization, enforced structurally ────────────────
 *
 * `CompletionStage` has six members; this type admits two. A draft literally
 * cannot express `validated`, `ratified`, `canonical` or `deprecated` — not by
 * convention, by the type checker. Promoting a draft past `candidate` requires
 * a human to author the real registry file, the same act every resolution
 * record in this repo has been created by.
 */
export type DraftLifecycleStage = Extract<CompletionStage, 'observed' | 'candidate'>;

export interface CandidateInvariantDraft {
  /** Suggested id — a human names the real one on promotion. */
  suggestedCandidateId: string;
  statement: string;
  status: DraftLifecycleStage;
  /** The observation(s) that produced this draft. Real refs, never invented. */
  derivedFromRefs: string[];
}

export interface LearningReceiptDraft {
  suggestedResolutionId: string;
  trigger: ResolutionTrigger;
  observedFailure: string[];
  candidateInvariantDrafts: CandidateInvariantDraft[];
  /** A draft is always `observed` — the lowest rung, never asserted higher. */
  status: 'observed';
  generatedAt: string;
}

/**
 * Draft a learning receipt from a batch of observations.
 *
 * Only `falsified` and `new-risk-observation` verdicts produce a candidate
 * draft — `supported`, `challenged` and `unresolved` are evidence worth
 * keeping in the observation log (DCIR's own event stream) but do not, by
 * themselves, suggest a new invariant. `challenged` in particular is
 * DELIBERATELY EXCLUDED from drafting: it is evidence against something that
 * already exists, which belongs on THAT invariant's own record as an
 * `InvariantOccurrence`-style challenge, not as a proposal for a new one.
 */
export function draftLearningReceipt(
  observations: readonly ConsequenceObservationResult[],
  now: string,
): LearningReceiptDraft | null {
  const drafted = observations.filter(
    (o) => o.verdict === 'falsified' || o.verdict === 'new-risk-observation',
  );
  if (drafted.length === 0) return null;

  return {
    suggestedResolutionId: `RES-DRAFT-${now.slice(0, 10)}-CONSEQUENCE-OBSERVATION`,
    trigger: 'invariant-incomplete-or-misscoped',
    observedFailure: drafted.map((o) => `${o.verdict}: ${o.invariantRef}`),
    candidateInvariantDrafts: drafted.map((o) => ({
      suggestedCandidateId: `CI-DRAFT-${o.invariantRef}`,
      statement: `(draft — requires human authorship) Observed ${o.verdict} against ${o.invariantRef}.`,
      status: 'observed',
      derivedFromRefs: [o.invariantRef],
    })),
    status: 'observed',
    generatedAt: now,
  };
}
