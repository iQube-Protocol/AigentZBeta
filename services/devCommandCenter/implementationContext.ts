/**
 * implementationContext — Phase 4: what actually reaches the model, and the
 * evidentiary bridge that justifies it.
 *
 * Three concerns, deliberately in one module because they are one act:
 * deciding what is materially relevant to an intent, proving that decision,
 * and composing it into a prompt without losing what each piece has earned.
 *
 *  1. `emitProofOfRisk` — the EVIDENTIARY BRIDGE. Establishes that a risk
 *     vector and its repair path are materially relevant to THIS intent. It is
 *     not a second risk model: it carries a `RiskVectorRef` by reference and
 *     restates none of it (operator ruling, 2026-08-15).
 *
 *  2. `bindFalsification` — attaches a falsifier to a consequence, but only
 *     where a causal proposition is actually under test.
 *
 *  3. `composeImplementationContext` — compression that preserves the Phase 1
 *     epistemic boundaries. Compression may drop irrelevant material; it may
 *     never collapse lifecycle or provenance.
 *
 * @organ INVARIANT_BUDGET            services/invariants/resolution.ts
 * @organ renderMarkedInvariantBlock  types/invariantEnvelope.ts
 * @organ partitionByEpistemicStanding services/devCommandCenter/invariantEnvelope.ts
 */

import { INVARIANT_BUDGET } from '@/services/invariants/resolution';
import { partitionByEpistemicStanding, partitionByCausalClaim as partitionByCausalClaimPure } from '@/services/devCommandCenter/envelopeViews';
import {
  epistemicMarker,
  mayBeCitedAsEstablished,
  type EnvelopeInvariant,
  type IntentRiskField,
  type ProofOfRisk,
  type RiskMagnitude,
  type RiskVectorRef,
} from '@/types/invariantEnvelope';
import type { ConsequenceEntry, ConsequenceFalsificationBinding } from '@/types/devCommandCenter';

// ---------------------------------------------------------------------------
// §1 Proof of Risk — the evidentiary bridge
// ---------------------------------------------------------------------------

export interface ProofOfRiskInput {
  id: string;
  intentRef: string;
  /** Carried BY REFERENCE. The vector is not restated or re-modelled. */
  vector: RiskVectorRef;
  origin: ProofOfRisk['origin'];
  initiatingCondition: string;
  adverseConsequence: string;
  /** Envelope members this risk bears on. Never prose. */
  invariantRefs?: string[];
  repairPath?: string | null;
  reversibility?: ProofOfRisk['reversibility'];
  blastRadius?: string | null;
  severity?: RiskMagnitude;
  probability?: RiskMagnitude;
  uncertainty?: RiskMagnitude;
  /** Real references only. An empty list is honest; an invented one is not. */
  evidenceRefs?: string[];
  now: string;
}

/**
 * Emit the evidence that a risk is materially relevant to this intent.
 *
 * WHAT THIS IS NOT: a second risk model. `RiskVectorRef` already names the
 * risk; this records that the risk BEARS ON THIS INTENT and what repairing it
 * would cost. Duplicating the vector's own fields here would create two
 * descriptions of one risk that could disagree — the parallel-implementation
 * defect applied to evidence.
 *
 * Magnitudes default to `'unknown'`, never to 0. A fabricated 0.3 is
 * indistinguishable downstream from a measured one; `'unknown'` is a different
 * claim and stays visible as one (PRD §12).
 *
 * `status` starts at the origin's own honesty level: a projected risk is
 * `projected`, an observed one is `observed`. Nothing here can emit
 * `supported` — support is something evidence does later, not something an
 * emitter may assert about itself.
 */
export function emitProofOfRisk(input: ProofOfRiskInput): ProofOfRisk {
  return {
    id: input.id,
    intentRef: input.intentRef,
    riskVectorRef: input.vector,
    origin: input.origin,
    invariantRefs: input.invariantRefs ?? [],
    initiatingCondition: input.initiatingCondition,
    adverseConsequence: input.adverseConsequence,
    severity: input.severity ?? 'unknown',
    probability: input.probability ?? 'unknown',
    uncertainty: input.uncertainty ?? 'unknown',
    repairPath: input.repairPath ?? null,
    reversibility: input.reversibility ?? 'unknown',
    blastRadius: input.blastRadius ?? null,
    evidenceRefs: input.evidenceRefs ?? [],
    status: input.origin === 'observed' ? 'observed' : 'projected',
    createdAt: input.now,
  };
}

/**
 * True when the field's vectors are all bridged by at least one proof.
 *
 * An unbridged vector is a risk nobody has argued is relevant here — which is
 * a legitimate state during discovery and a defect at implementation time. The
 * predicate reports it rather than deciding what to do about it.
 */
export function unbridgedVectors(field: IntentRiskField, proofs: readonly ProofOfRisk[]): RiskVectorRef[] {
  const bridged = new Set(proofs.map((p) => p.riskVectorRef?.id).filter(Boolean));
  return field.vectors.filter((v) => !bridged.has(v.id));
}

// ---------------------------------------------------------------------------
// §2 Falsification binding — only where a causal claim is under test
// ---------------------------------------------------------------------------

/**
 * Attach a falsifier to a consequence.
 *
 * DELIBERATELY A SEPARATE ACT from creating the consequence. Most consequences
 * assert nothing causal and must stay unbound: "the column renders" is a fact
 * about the UI, not a proposition about the world. Binding every consequence
 * to an invariant would manufacture causal claims to satisfy a schema, and a
 * registry of manufactured claims is worse than an empty one because each
 * entry looks like evidence (operator ruling, 2026-08-15).
 */
export function bindFalsification(
  entry: ConsequenceEntry,
  binding: ConsequenceFalsificationBinding,
): ConsequenceEntry {
  return { ...entry, falsification: binding };
}

/**
 * The consequences that carry a causal claim, and those that do not.
 *
 * RELOCATED to `envelopeViews.ts` (2026-08-15, same client-bundle fix as
 * `partitionByEpistemicStanding` above) — re-exported here so existing
 * importers of this module are unaffected.
 */
export const partitionByCausalClaim = partitionByCausalClaimPure;

// ---------------------------------------------------------------------------
// §3 Implementation context — compression that preserves epistemic boundaries
// ---------------------------------------------------------------------------

/**
 * The five sections the operator required the prompt to keep distinct.
 *
 * Order is constitutional data. It runs from what BOUNDS the work, through
 * what is KNOWN, to what is merely SIGNAL, ending at what is OPEN — so a
 * reader who stops early has read the binding material, and a reader who
 * reaches the end knows what is not settled.
 */
export const CONTEXT_SECTIONS = [
  'constitutional-constraints',
  'established-invariants',
  'candidate-and-risk-signals',
  'live-discoveries',
  'unresolved-material-uncertainty',
] as const;
export type ContextSection = (typeof CONTEXT_SECTIONS)[number];

export const SECTION_HEADING: Record<ContextSection, string> = {
  'constitutional-constraints':
    '### Constitutional constraints (non-negotiable — these bound what may be built)',
  'established-invariants':
    '### Established invariants (ratified or canonical — may be relied upon as ground)',
  'candidate-and-risk-signals':
    '### Candidate signals (NOT established — reason WITH these, never FROM them)',
  'live-discoveries':
    '### Live discoveries (found during this run — in no registry, have earned nothing)',
  'unresolved-material-uncertainty':
    '### Unresolved (no answer was found — do not resolve these by inference)',
};

export interface ImplementationContext {
  sections: Record<ContextSection, string[]>;
  /** Refs carried into the prompt, by section. */
  carried: Record<ContextSection, string[]>;
  /** Refs dropped by the budget. Never silent. */
  omittedRefs: string[];
  budgetApplied: number;
  text: string;
}

/**
 * Compose the implementation prompt with epistemic boundaries intact.
 *
 * ── The rule this enforces ────────────────────────────────────────────────
 *
 * "Compression may remove irrelevant material; it must never collapse
 * lifecycle/provenance distinctions" (operator, 2026-08-15).
 *
 * So the budget cuts WITHIN sections and never merges them. Dropping a
 * candidate is compression. Moving a candidate into the established section
 * to save a heading is erasure, and the two are easy to confuse when the only
 * visible effect is a shorter prompt.
 *
 * Constitutional constraints are admitted before anything else and are NOT
 * subject to the budget: they bound what may be built at all, and a budget
 * that can silently remove the bounds is not a budget, it is a hazard.
 */
export function composeImplementationContext(
  invariants: readonly EnvelopeInvariant[],
  unresolvedQuestions: readonly string[],
  budget: number = INVARIANT_BUDGET.withSessionMemory,
): ImplementationContext {
  /*
   * THE CONSTRAINTS SECTION IS PROVENANCE **AND** STANDING, NOT PROVENANCE ALONE.
   *
   * A constitutional-substrate member at status `proposed` is a HYPOTHESIS
   * ABOUT CONSTITUTIONAL MATTERS — not a constraint. Routing it into the
   * constraints heading by provenance alone would present an unratified
   * proposal as something that bounds what may be built, which is the exact
   * lifecycle collapse this composition exists to prevent. It is an easy
   * defect to write, because "constitutional" reads like a standing claim when
   * it is only a source claim.
   *
   * So the constraints section takes constitutional members that are ALSO
   * citable as established; the remainder fall through to signals, where their
   * marker already says what they are.
   */
  const constitutional = invariants.filter(
    (i) => i.provenance === 'constitutional-substrate' && mayBeCitedAsEstablished(i.lifecycle),
  );
  const constitutionalSet = new Set(constitutional);
  const rest = invariants.filter((i) => !constitutionalSet.has(i));
  const { established, signals, discoveries } = partitionByEpistemicStanding(rest);

  // The budget applies to everything EXCEPT the constitutional bound.
  let remaining = Math.max(0, budget);
  const take = <T>(xs: readonly T[]): T[] => {
    const out = xs.slice(0, remaining);
    remaining -= out.length;
    return out;
  };
  const keptEstablished = take(established);
  const keptSignals = take(signals);
  const keptDiscoveries = take(discoveries);

  const line = (i: EnvelopeInvariant) =>
    `- ${epistemicMarker(i.lifecycle)} ${i.statement} (${i.ref}, ${i.provenance})`;

  /*
   * ONE MEMBERSHIP DECISION, THREE PROJECTIONS.
   *
   * `sections` (rendered text), `carried` (refs) and `keptSet` (omission
   * bookkeeping) are all derived from THIS map and nothing else. An earlier
   * version computed each from its own expression, which meant a change to
   * one could leave the others describing a different membership — two
   * readers of one fact, drifting (CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001).
   *
   * Found by mutation testing: charging constitutional members to the budget
   * altered the rendered sections while `carried` went on reporting the old
   * membership, so the canary asserting on `carried` stayed green against a
   * composer that had genuinely changed behaviour.
   */
  const membership: Record<ContextSection, EnvelopeInvariant[]> = {
    'constitutional-constraints': constitutional,
    'established-invariants': keptEstablished,
    'candidate-and-risk-signals': keptSignals,
    'live-discoveries': keptDiscoveries,
    'unresolved-material-uncertainty': [],
  };

  const sections: Record<ContextSection, string[]> = {
    'constitutional-constraints': membership['constitutional-constraints'].map(line),
    'established-invariants': membership['established-invariants'].map(line),
    'candidate-and-risk-signals': membership['candidate-and-risk-signals'].map(line),
    'live-discoveries': membership['live-discoveries'].map(line),
    'unresolved-material-uncertainty': unresolvedQuestions.map((q) => `- ${q}`),
  };

  const carried: Record<ContextSection, string[]> = {
    'constitutional-constraints': membership['constitutional-constraints'].map((i) => i.ref),
    'established-invariants': membership['established-invariants'].map((i) => i.ref),
    'candidate-and-risk-signals': membership['candidate-and-risk-signals'].map((i) => i.ref),
    'live-discoveries': membership['live-discoveries'].map((i) => i.ref),
    'unresolved-material-uncertainty': [],
  };

  const keptSet = new Set<EnvelopeInvariant>(Object.values(membership).flat());

  const text = CONTEXT_SECTIONS.filter((s) => sections[s].length > 0)
    .map((s) => `${SECTION_HEADING[s]}\n${sections[s].join('\n')}`)
    .join('\n\n');

  return {
    sections,
    carried,
    // Identity-keyed, per CI-2026-08-15-COLLECTION-KEY-UNIQUENESS-001: a ref is
    // not unique within an envelope, so a ref-keyed Set would silently mark a
    // dropped occurrence as carried.
    omittedRefs: invariants.filter((i) => !keptSet.has(i)).map((i) => i.ref),
    budgetApplied: budget,
    text,
  };
}

/**
 * Every ref that appears in an established-reading section.
 *
 * The canary surface for the boundary rule: nothing whose lifecycle fails
 * `mayBeCitedAsEstablished` may appear here, whatever the budget did.
 */
export function establishedSectionRefs(ctx: ImplementationContext): string[] {
  return [...ctx.carried['constitutional-constraints'], ...ctx.carried['established-invariants']];
}

/** Members wrongly placed in an established-reading section. Empty is correct. */
export function misplacedInEstablished(
  ctx: ImplementationContext,
  invariants: readonly EnvelopeInvariant[],
): string[] {
  const established = new Set(establishedSectionRefs(ctx));
  return invariants
    .filter((i) => established.has(i.ref) && !mayBeCitedAsEstablished(i.lifecycle))
    .map((i) => i.ref);
}
