/**
 * invariantEvidence — Homecoming III Phase 5: binding observed consequences
 * back to the Invariant Development Envelope, and emitting DCIR's
 * invariant-evidence events.
 *
 * ── What this closes ────────────────────────────────────────────────────────
 *
 * Phase 4 bound a consequence to a falsifiable claim
 * (`ConsequenceFalsificationBinding` — invariantRef, expected/prohibited
 * consequence, observable falsifier). Phase 5's Consequence Validation stage
 * then OBSERVES what actually happened (`ConsequenceValidationItem.verdict`).
 * This module is the missing link between the two: it reads the verdict a
 * bound consequence actually received and classifies what that means for the
 * invariant/candidate it was testing — closing
 *
 *   implementation → consequence observation → invariant evidence
 *
 * ── Purity boundary ─────────────────────────────────────────────────────────
 *
 * Classification (`classifyConsequenceEvidence`, `bindConsequenceEvidence`)
 * and the derived proof-of-risk update (`applyEvidenceToProofsOfRisk`) are
 * pure — no I/O, no clock read except via caller-supplied `now`. Only
 * `emitEvidenceEvents` touches the DCIR event stream, and even that is pure
 * construction (`emitDcirEvent` itself performs no I/O — see
 * `services/dcir/eventStream.ts`). The caller owns appending to the buffer,
 * exactly as every other DCIR-emitting surface does.
 *
 * ── CANARY-09: provider identity is not constitutional semantics ───────────
 *
 * No function here accepts a provider, model or vendor parameter. The
 * classification is a pure function of `ConsequenceValidationItem.verdict`
 * and the existing falsification binding — nothing else can move it.
 */

import {
  invariantChallengedEvent,
  invariantFalsifiedEvent,
  invariantSupportedEvent,
  invariantUnresolvedEvent,
} from '@/services/dcir/eventStream';
import type { DcirEvent } from '@/types/dcir';
import type {
  ConsequenceCanvas,
  ConsequenceEntry,
  ConsequenceValidationItem,
  ConsequenceValidationReport,
} from '@/types/devCommandCenter';
import type { InvariantEvidenceKind, InvariantEvidenceObservation } from '@/types/devLoopLearning';
import type { ProofOfRisk } from '@/types/invariantEnvelope';

// ---------------------------------------------------------------------------
// Classification — the ONE mapping from an observed verdict to evidence
// ---------------------------------------------------------------------------

/**
 * The single canonical mapping from `ValidationVerdict` to
 * `InvariantEvidenceKind` (CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001
 * applied to this classification: one reader, so no consumer reimplements
 * it and drifts).
 *
 *  - `satisfied`  → `supported`  — the expected consequence was observed.
 *  - `partial`    → `challenged` — neither clean confirmation nor the
 *                    prohibited outcome; the binding does not fully hold as
 *                    stated, without having been shown false.
 *  - `unintended` → `falsified`  — the PROHIBITED consequence was observed,
 *                    or an unintended effect contradicts the claim.
 *  - `unresolved` → `unresolved` — verbatim; no evidence was produced either way.
 *
 * NOTE the storage detail this depends on: `addValidationItem`
 * (consequenceValidator.ts) buckets BOTH `'unresolved'` and `'partial'`
 * verdicts into `report.unresolved` — the bucket a validation item lands in
 * is not the same as its own `verdict` field, so this function reads
 * `item.verdict` directly and must never infer a kind from which bucket an
 * item was found in.
 */
export function evidenceKindForVerdict(verdict: ConsequenceValidationItem['verdict']): InvariantEvidenceKind {
  switch (verdict) {
    case 'satisfied':
      return 'supported';
    case 'partial':
      return 'challenged';
    case 'unintended':
      return 'falsified';
    case 'unresolved':
      return 'unresolved';
  }
}

/** Every consequence entry in a canvas, regardless of which list it's in. */
function allConsequenceEntries(canvas: ConsequenceCanvas): ConsequenceEntry[] {
  return [...canvas.shouldHappen, ...canvas.shouldNeverHappen];
}

/** Every validation item in a report, regardless of which bucket holds it. */
function allValidationItems(report: ConsequenceValidationReport): ConsequenceValidationItem[] {
  return [...report.satisfied, ...report.unresolved, ...report.unintended];
}

/**
 * Bind one validation item back to the invariant its consequence tested.
 *
 * Returns `null` for a consequence with no falsification binding — most
 * consequences assert nothing causal (`partitionByCausalClaim`,
 * `implementationContext.ts`) and manufacturing an observation for them
 * would be evidence for a claim nobody made.
 */
export function classifyConsequenceEvidence(
  item: ConsequenceValidationItem,
  canvas: ConsequenceCanvas,
  now: string,
): InvariantEvidenceObservation | null {
  const entry = allConsequenceEntries(canvas).find((e) => e.id === item.consequenceId);
  const binding = entry?.falsification;
  if (!binding) return null;

  return {
    invariantRef: binding.invariantRef,
    kind: evidenceKindForVerdict(item.verdict),
    basis: item.evidence,
    consequenceRef: item.consequenceId,
    dcirEventId: null,
    observedAt: now,
  };
}

/** Every observation a validation report yields, in report order. */
export function bindConsequenceEvidence(
  report: ConsequenceValidationReport,
  canvas: ConsequenceCanvas,
  now: string,
): InvariantEvidenceObservation[] {
  const observations: InvariantEvidenceObservation[] = [];
  for (const item of allValidationItems(report)) {
    const observation = classifyConsequenceEvidence(item, canvas, now);
    if (observation) observations.push(observation);
  }
  return observations;
}

// ---------------------------------------------------------------------------
// Emission — one observation, one DCIR event
// ---------------------------------------------------------------------------

const EMITTER_FOR_KIND: Record<InvariantEvidenceKind, (ref: string, label: string) => DcirEvent> = {
  supported: invariantSupportedEvent,
  challenged: invariantChallengedEvent,
  falsified: invariantFalsifiedEvent,
  unresolved: invariantUnresolvedEvent,
};

/**
 * Emit one DCIR event per observation, in order. Pure construction — the
 * caller owns appending the results to its own event log
 * (`appendDcirEvent`), exactly as every existing DCIR-emitting surface does.
 */
export function emitEvidenceEvents(observations: readonly InvariantEvidenceObservation[]): DcirEvent[] {
  return observations.map((o) => EMITTER_FOR_KIND[o.kind](o.invariantRef, o.basis));
}

/**
 * Stamp `dcirEventId` onto each observation from its emitted event, by
 * position. Kept as an explicit step (rather than folded into emission)
 * so a caller that only wants the pure classification never has to touch
 * the event stream to get it.
 */
export function withEmittedEventIds(
  observations: readonly InvariantEvidenceObservation[],
  events: readonly DcirEvent[],
): InvariantEvidenceObservation[] {
  return observations.map((o, i) => ({ ...o, dcirEventId: events[i]?.id ?? null }));
}

// ---------------------------------------------------------------------------
// Proof-of-risk update — evidence reaches the risk field too
// ---------------------------------------------------------------------------

/**
 * Apply evidence to the `ProofOfRisk`s it bears on, updating `status`.
 *
 * A proof with NO matching observation keeps its origin-honest status
 * (`projected` or `observed`) — absence of evidence is not evidence of
 * absence, and this function never invents a verdict for a proof nothing
 * has tested yet.
 *
 * Multiple observations on one proof: `falsified` wins over `challenged`
 * wins over `supported` — a single confirmed prohibited outcome outweighs
 * any number of confirmations, because "sometimes it fails" IS the risk
 * being proven relevant, not a fact averaged away by other successes.
 */
export function applyEvidenceToProofsOfRisk(
  proofs: readonly ProofOfRisk[],
  observations: readonly InvariantEvidenceObservation[],
): ProofOfRisk[] {
  const byRef = new Map<string, InvariantEvidenceKind[]>();
  for (const o of observations) {
    const kinds = byRef.get(o.invariantRef) ?? [];
    kinds.push(o.kind);
    byRef.set(o.invariantRef, kinds);
  }

  const severityOrder: InvariantEvidenceKind[] = ['falsified', 'challenged', 'supported', 'unresolved'];
  const worstKind = (kinds: InvariantEvidenceKind[]): InvariantEvidenceKind | null => {
    for (const k of severityOrder) if (kinds.includes(k)) return k;
    return null;
  };

  const kindToProofStatus: Record<InvariantEvidenceKind, ProofOfRisk['status'] | null> = {
    falsified: 'falsified',
    challenged: 'challenged',
    supported: 'supported',
    unresolved: null,
  };

  return proofs.map((proof) => {
    const touching = proof.invariantRefs.flatMap((ref) => byRef.get(ref) ?? []);
    if (touching.length === 0) return proof;
    const worst = worstKind(touching);
    const nextStatus = worst ? kindToProofStatus[worst] : null;
    return nextStatus ? { ...proof, status: nextStatus } : proof;
  });
}

// ---------------------------------------------------------------------------
// CANARY-10 surface — established material CAN be challenged by evidence
// ---------------------------------------------------------------------------

/**
 * Refs of ESTABLISHED envelope members (constitutional + ratified/canonical)
 * that received challenging or falsifying evidence this cycle.
 *
 * This is the canary surface for CANARY-10: retrieved structural memory is
 * not exempt from evidence merely because it is established. This function
 * does NOT rewrite any registry's lifecycle — that is a human/registry act
 * elsewhere — it only makes the challenge VISIBLE, which is the whole of
 * what evidence is entitled to do without an operator ratifying a change.
 */
export function establishedRefsUnderChallenge(
  establishedRefs: readonly string[],
  observations: readonly InvariantEvidenceObservation[],
): string[] {
  const established = new Set(establishedRefs);
  const challenged = new Set(
    observations.filter((o) => o.kind === 'challenged' || o.kind === 'falsified').map((o) => o.invariantRef),
  );
  return [...established].filter((ref) => challenged.has(ref));
}
