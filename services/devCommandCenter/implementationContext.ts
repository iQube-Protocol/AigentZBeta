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
import { tokenizeStatement } from '@/services/devCommandCenter/bearingDiscovery';
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

// ---------------------------------------------------------------------------
// §3a Causal relevance — admission ranks by relevance, not registry order
//
// Homecoming III Phase 6 Closure (2026-08-15). The live dogfood against the
// real, 33-member devon-projected candidate registry found that admission
// ranked by array order (registry-accumulation order) within each epistemic
// bucket, then sliced each bucket SEQUENTIALLY from a shared budget. Both
// halves of that design are the defect:
//
//  1. WITHIN a bucket, array order is not relevance — an unrelated candidate
//     registered earlier beat the single most on-point candidate for this
//     intent purely by insertion position.
//  2. ACROSS buckets, signals took the ENTIRE remaining budget before
//     discoveries were even considered, so any live discovery — however
//     relevant — was structurally guaranteed zero admission once the signal
//     population alone exceeded the budget.
//
// The repair is admission/ranking, not capacity: `INVARIANT_BUDGET` is
// unchanged. Candidate signals and live discoveries are pooled into ONE
// relevance-ranked competition for the shared non-established budget, so a
// highly relevant discovery can outrank a low-relevance signal — then the
// admitted pool is split back into its own section by `provenance` for
// rendering, so lifecycle/provenance separation in the OUTPUT is untouched;
// only the SLICING decision is joint.
// ---------------------------------------------------------------------------

export interface CausalRelevanceContext {
  /** The intent's own text (goal + rawInput + desired outcomes, caller-joined). */
  intentText?: string;
  /** Residual material uncertainty this cycle didn't resolve, caller-joined. */
  unresolvedText?: string;
  /**
   * Invariant refs a `ProofOfRisk` ties to a vector in the CURRENT
   * `IntentRiskField` — i.e. structurally proven relevant to the risk this
   * cycle is actually reasoning about, not merely retrieved. See
   * `deriveRiskDrivenRefs` below.
   */
  riskDrivenRefs?: ReadonlySet<string>;
}

/**
 * The refs a risk is materially relevant to, restricted to vectors that are
 * actually IN the current risk field — a `ProofOfRisk` for a retired or
 * foreign vector must not lend its invariants borrowed relevance here.
 */
export function deriveRiskDrivenRefs(
  proofsOfRisk: readonly ProofOfRisk[],
  riskField: IntentRiskField | null,
): Set<string> {
  const currentVectorIds = new Set((riskField?.vectors ?? []).map((v) => v.id));
  const refs = new Set<string>();
  for (const proof of proofsOfRisk) {
    if (!proof.riskVectorRef || !currentVectorIds.has(proof.riskVectorRef.id)) continue;
    for (const ref of proof.invariantRefs) refs.add(ref);
  }
  return refs;
}

/**
 * Bounded [0,1] keyword-overlap fallback for material with no structural
 * relevance signal — reuses `tokenizeStatement` (the SAME tokenizer
 * `claimKey` uses for convergence matching) rather than a second,
 * independently-tuned similarity metric. Deliberately bounded well below the
 * structural-tie scores below: a keyword match is a weak, honest heuristic
 * (the same "bootstrap-heuristic-v1" candor the risk model already applies
 * to itself), never allowed to outrank a proven causal tie.
 */
function tokenOverlapScore(statement: string, against: string): number {
  if (!against) return 0;
  const a = new Set(tokenizeStatement(statement));
  const b = new Set(tokenizeStatement(against));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/**
 * Score one member's causal relevance to the current intent/risk field.
 *
 * Ordered by confidence, highest first, each tier strictly outranking the
 * next regardless of how many lower-tier members exist — this is what
 * "compete by relevance, not accumulation" actually requires: a hundred
 * keyword-overlap-only signals must never outweigh one structurally-proven
 * risk-driven finding.
 *
 *  4.x — proven relevant to the CURRENT risk field via a real ProofOfRisk.
 *  3.5 — this run's OWN discovery process already established the tie:
 *        positive bearing is intent-driven by construction; negative bearing
 *        is risk-driven by construction (`bearingDiscovery.ts`).
 *  1-2 — an actually-ASSESSED materiality (never 'unknown') is a real signal.
 *  0-1 — keyword overlap against the intent text and residual uncertainty —
 *        the honest fallback for established/signal members with no
 *        structural tie. Zero context and zero overlap score exactly 0,
 *        which a stable sort leaves in its ORIGINAL order — so a caller that
 *        supplies no relevance context reproduces today's array-order
 *        behavior exactly (no silent change for existing callers).
 */
export function causalRelevanceScore(item: EnvelopeInvariant, ctx: CausalRelevanceContext): number {
  if (ctx.riskDrivenRefs?.has(item.ref)) return 4;
  if (item.recoveries.some((r) => r.route === 'intent-driven' || r.route === 'risk-driven')) return 3.5;
  if (typeof item.materiality === 'number') return 1 + Math.max(0, Math.min(1, item.materiality));
  return (
    tokenOverlapScore(item.statement, ctx.intentText ?? '') +
    tokenOverlapScore(item.statement, ctx.unresolvedText ?? '') * 1.5
  );
}

/**
 * Rank by `causalRelevanceScore`, STABLE (ties keep their input order) —
 * explicit index tiebreak rather than relying on engine sort stability, so
 * the "no context supplied → today's array-order behavior" guarantee holds
 * regardless of runtime.
 */
function rankByCausalRelevance(
  items: readonly EnvelopeInvariant[],
  ctx: CausalRelevanceContext,
): EnvelopeInvariant[] {
  return items
    .map((item, index) => ({ item, index, score: causalRelevanceScore(item, ctx) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .map((r) => r.item);
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
 *
 * ── Admission order (Phase 6 Closure, 2026-08-15) ───────────────────────────
 *
 * 1. Constitutional — unconditional, as always.
 * 2. Established — admitted next from the shared budget, internally ranked
 *    by causal relevance so a materially-applicable established member is
 *    never crowded out by a less relevant one (requirement 2).
 * 3. Signals + discoveries — pooled into ONE causal-relevance ranking and
 *    admitted together from what remains, then split back into their own
 *    sections by provenance. This is the actual repair: a highly relevant
 *    live discovery or risk-driven finding can now outrank an unrelated
 *    signal for the shared budget, instead of every signal being admitted
 *    before any discovery is even considered (requirements 3, 4, 5).
 */
export function composeImplementationContext(
  invariants: readonly EnvelopeInvariant[],
  unresolvedQuestions: readonly string[],
  budget: number = INVARIANT_BUDGET.withSessionMemory,
  relevance: CausalRelevanceContext = {},
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

  // Established is admitted next, ranked internally by relevance so a
  // materially-applicable member can never be crowded out by a less
  // relevant one even if the established population itself grows large.
  const keptEstablished = take(rankByCausalRelevance(established, relevance));

  // Signals and discoveries POOL for what remains, ranked TOGETHER by
  // relevance — the actual repair. Splitting them into their own sections
  // AFTER admission (by `provenance`, never by re-deriving membership)
  // keeps rendering's lifecycle/provenance separation exactly as before;
  // only the shared slice decision changed.
  const admittedPool = take(rankByCausalRelevance([...signals, ...discoveries], relevance));
  const keptSignals = admittedPool.filter((i) => i.provenance !== 'live-discovery');
  const keptDiscoveries = admittedPool.filter((i) => i.provenance === 'live-discovery');

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
