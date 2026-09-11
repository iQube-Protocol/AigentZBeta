/**
 * Invariant Intelligence — the CRP-002 programme contracts (metaMe IRL).
 *
 * Contract-first, like types/constitutional.ts and types/dcir.ts: this file is
 * the Phase 1 CONTRACT only — order-pinned constitutional data + pure helpers,
 * no runtime organs. It encodes the two primitives the CRP-002 charter names:
 *
 *   1. The reframed iQube pipeline (§2 of CRP-002) — order-pinned constitutional
 *      data. Curation is DELIBERATELY ABSENT: it is the RESULT of invariant
 *      discovery, not a stage (the charter's central reframing).
 *   2. The Intent Grammar (§3) — the candidate intent primitives + a CANDIDATE
 *      intent→invariant-concern mapping. This is a HYPOTHESIS WP1 refines or
 *      refutes (CRP-002 honest limits), NEVER asserted as canonical. It enters
 *      the substrate as proposed content only (Law XI); the canary pins the
 *      STRUCTURE (the primitive set, total coverage), not the truth of the map.
 *
 * Order constants are constitutional data (sequencing corollary of Law XV),
 * canary-pinned in tests/invariant-intelligence.test.ts.
 *
 * Isomorphic: no fs, no DB, no clock, no network — safe anywhere.
 */

// ---------------------------------------------------------------------------
// §1 The reframed iQube pipeline (CRP-002 §2) — order pinned
// ---------------------------------------------------------------------------

/**
 * The iQube pipeline, reframed so intent is the organising principle of the
 * whole downstream flow. `invariant-discovery` replaces "curation" as an
 * ACTIVITY — curation is now the RESULT of discovering the invariants, so it is
 * not a stage. `knowledge-qube` is the executable, versioned compressed
 * knowledge object the downstream stages project. Order is meaning — pinned by
 * canary. Intent first, price last.
 */
export const IQUBE_PIPELINE = [
  'intent',
  'invariant-discovery',
  'knowledge-compression',
  'knowledge-qube',
  'risk',
  'value',
  'consequence',
  'price',
] as const;

export type IQubePipelineStage = (typeof IQUBE_PIPELINE)[number];

/**
 * The downstream stages that are CONSTITUTIONAL PROJECTIONS of the KnowledgeQube
 * — not independent analyses (CRP-002 §2, "the elegant consequence"). Each
 * inherits the SAME invariant basis; changing the intent (hence the invariant
 * set) reprojects all of them. They are exactly the tail of IQUBE_PIPELINE after
 * `knowledge-qube`.
 */
export const PROJECTION_STAGES = ['risk', 'value', 'consequence', 'price'] as const;

export type ProjectionStage = (typeof PROJECTION_STAGES)[number];

/** True iff a stage is a projection of the KnowledgeQube (not a front-end step). */
export function isProjectionStage(stage: string): stage is ProjectionStage {
  return (PROJECTION_STAGES as readonly string[]).includes(stage);
}

/** The stages that come AFTER `stage` in the pipeline (empty if last/unknown). */
export function stagesDownstreamOf(stage: IQubePipelineStage): IQubePipelineStage[] {
  const i = IQUBE_PIPELINE.indexOf(stage);
  return i < 0 ? [] : IQUBE_PIPELINE.slice(i + 1);
}

// ---------------------------------------------------------------------------
// §2 The Intent Grammar (CRP-002 §3) — CANDIDATE hypothesis (WP1 refines)
// ---------------------------------------------------------------------------

/**
 * The candidate intent primitives — the hypothesis that intent has an ONTOLOGY
 * (not a list of intents but a small closed set of primitives), each of which
 * naturally selects a different class of invariants. WP1 (Intent Science)
 * refines or refutes this set; the canary pins the STRUCTURE (that these are the
 * chartered candidates), not that the set is final. Composition of primitives is
 * a WP1 question, not encoded here.
 */
export const INTENT_PRIMITIVES = [
  'acquire-knowledge',
  'explain',
  'compare',
  'design',
  'predict',
  'diagnose',
  'evaluate',
  'create',
  'govern',
  'negotiate',
  'collaborate',
  'teach',
  'verify',
] as const;

export type IntentPrimitive = (typeof INTENT_PRIMITIVES)[number];

/**
 * Candidate invariant-CONCERN classes — the recurring categories of governing
 * principle an intent tends to project (generalised from the CRP-002 §1
 * examples). This is a starting vocabulary WP2 (Invariant Discovery) refines; it
 * is NOT the platform's `inv.*` namespace taxonomy (that is the substrate the
 * discovered invariants land in).
 */
export const INVARIANT_CONCERN_CLASSES = [
  'disclosure', // what is revealed / minimum disclosure
  'agency', // control, progressive agency, delegation
  'standing', // action gives standing, reputation
  'human-primacy', // human-first, care, responsibility
  'explainability', // transparency, reasoning traceability
  'fairness', // equity, non-discrimination
  'safety', // harm prevention, risk avoidance
  'verification', // proof, authentication, validation
  'governance', // rules, policy, jurisdiction
  'accountability', // responsibility for outcomes, audit
  'value', // worth, incentives, pricing basis
  'coherence', // consistency, non-contradiction
] as const;

export type InvariantConcernClass = (typeof INVARIANT_CONCERN_CLASSES)[number];

/**
 * The CANDIDATE intent→concern bias — the HYPOTHESIS that a given intent
 * primitive projects a characteristic set of invariant concern classes. This is
 * the starting point EXP-006 (Intent Projection Fidelity) tests against a
 * human-curated reference; it is NEVER asserted as a finding. The canary pins
 * TOTAL COVERAGE (every primitive mapped, every value a known concern class),
 * not the correctness of any individual mapping.
 */
export const CANDIDATE_INTENT_BIAS: Record<IntentPrimitive, InvariantConcernClass[]> = {
  'acquire-knowledge': ['disclosure', 'verification', 'coherence'],
  explain: ['explainability', 'human-primacy', 'coherence'],
  compare: ['coherence', 'verification', 'value'],
  design: ['agency', 'coherence', 'safety'],
  predict: ['verification', 'coherence', 'safety'],
  diagnose: ['verification', 'explainability', 'accountability'],
  evaluate: ['value', 'fairness', 'accountability'],
  create: ['agency', 'coherence', 'value'],
  govern: ['governance', 'accountability', 'fairness', 'standing'],
  negotiate: ['value', 'agency', 'fairness'],
  collaborate: ['agency', 'standing', 'human-primacy'],
  teach: ['explainability', 'human-primacy', 'fairness'],
  verify: ['verification', 'accountability', 'coherence'],
};

/** The candidate concern classes an intent primitive is hypothesised to project
 *  (empty for an unknown primitive). A hypothesis surface, not a truth. */
export function candidateIntentBias(primitive: string): InvariantConcernClass[] {
  return (CANDIDATE_INTENT_BIAS as Record<string, InvariantConcernClass[]>)[primitive] ?? [];
}

// ---------------------------------------------------------------------------
// §3 The work packages (CRP-002 + Aletheon amendment 2026-07-09) — WP0 added
// ---------------------------------------------------------------------------

/**
 * The programme's work packages, order-pinned. WP0 — **Foundations of Invariant
 * Intelligence (Emergent)** — is listed first but is NOT a prerequisite: under
 * Option 1A (Experimental Theory Formation, Aletheon 2026-07-09) WP0 EMERGES from
 * the experiments rather than gating them. Prescribing invariant theory first
 * risks a taxonomy the experiments merely confirm; instead WP0 CONSUMES the
 * experimental outputs (Invariant Deltas) and synthesises progressively stronger
 * definitions. The strategic centre: Intent Science determines WHICH reasoning
 * substrate should exist; Knowledge Compression is one MECHANISM for constructing
 * it. Invariant Intelligence is the overarching discipline.
 */
export const INVARIANT_INTELLIGENCE_WORKSTREAMS = [
  'wp0-invariant-theory',
  'wp1-intent-science',
  'wp2-invariant-discovery',
  'wp3-knowledge-compression',
  'wp4-invariant-runtime',
] as const;

export type InvariantIntelligenceWorkstream = (typeof INVARIANT_INTELLIGENCE_WORKSTREAMS)[number];

// ---------------------------------------------------------------------------
// §4 Canonical Invariant Reference Set (CIRS) — the VERSIONED reference
// ---------------------------------------------------------------------------

/**
 * The reference EXP-006 Stage A judges predictions against — NOT a "gold
 * set" (that implies the truth is already discovered). It is the Canonical
 * Invariant Reference Set: versioned and cumulative, so the science is explicit
 * about what is still experimental vs ratified. A reference stays `experimental`
 * (confidence) / `ratified: false` until operator ratification (Law XI) promotes
 * it to `ratified` / `v1.0`.
 */
export type CIRSConfidence = 'experimental' | 'ratified';

export interface CanonicalInvariantReference {
  /** The intent (a primitive, or a natural-language intent phrase). */
  intent: string;
  /** The reference invariant set for this intent (concern classes or invariant refs). */
  candidateInvariants: string[];
  /** Experimental until ratified — never defaulted to ratified. */
  confidence: CIRSConfidence;
  /** Cumulative version, e.g. 'v0.1' (experimental) → 'v1.0' (ratified). */
  version: string;
  /** True iff operator-ratified (Law XI). `confidence === 'ratified'` iff this. */
  ratified: boolean;
}

// ---------------------------------------------------------------------------
// §5 Projection Rule — invariant → projection rule → projection
// ---------------------------------------------------------------------------

/**
 * The architectural distinction Aletheon flagged (2026-07-09): the runtime does
 * not merely retrieve invariants — it retrieves an invariant AND a PROJECTION
 * RULE (a strategy for rendering it). The SAME invariant renders differently
 * under a different projection rule; the invariant does not change, only the
 * projection. E.g. intent "teach a child" → style [concrete, narrative, simple];
 * intent "scientific paper" → style [formal, cited, analytical]. This becomes
 * central in Phase 3 (the Intent Engine); pinned here as the typed seam.
 */
export interface ProjectionRule {
  /** The rendering strategy — style axes applied to the invariant, not the
   *  invariant itself. */
  style: string[];
  /** The intent this projection rule serves (optional at the contract layer). */
  intent?: IntentPrimitive | null;
}

// ---------------------------------------------------------------------------
// §6 Founding Validation Series — measurement contracts (CRP-002 §5 + amendment)
// ---------------------------------------------------------------------------

/**
 * EXP-007 (Reasoning Entropy Reduction) is a FOUR-arm comparison, not two
 * (Aletheon, 2026-07-09). The point is not "does it beat naïve RAG" (easy) but
 * "does it beat our OWN best existing architecture" — the intellectually honest
 * bar. Order is the comparison ladder from least to most engineered baseline,
 * ending at the experimental arm.
 */
export const EXP007_ARMS = [
  'large-context', // dump everything, no retrieval
  'naive-rag', // top-k embedding retrieval
  'existing-kb', // the platform's production KB retrieval (the honest bar)
  'invariant-runtime', // the experimental arm
] as const;

export type Exp007Arm = (typeof EXP007_ARMS)[number];

/**
 * Propagation Fidelity (Aletheon, 2026-07-09) — a primary metric and the object
 * of EXP-008: the degree to which downstream artifacts preserve the intended
 * invariant set ACROSS MODALITIES. Generate across these modalities from ONE
 * invariant set, then ask blind reviewers to reconstruct the original set; high
 * reconstructability = high propagation fidelity. A new benchmark.
 */
export const PROPAGATION_MODALITIES = ['article', 'story', 'image', 'ux', 'prd'] as const;

export type PropagationModality = (typeof PROPAGATION_MODALITIES)[number];

// ---------------------------------------------------------------------------
// §7 Experimental Theory Formation (Option 1A; Aletheon 2026-07-09)
// ---------------------------------------------------------------------------

/**
 * The research loop — theory is DOWNSTREAM, not upstream (Option 1A). WP0
 * (Foundations of Invariant Intelligence) does not prescribe a taxonomy the
 * experiments then merely confirm (subtle confirmation bias); it EMERGES as the
 * accumulation of validated observations. Newton began with observations, not
 * mechanics; Darwin with specimens, not evolution. Order pinned; the loop closes
 * on `invariant-theory` — the accumulation, not the premise.
 */
export const INVARIANT_RESEARCH_LOOP = [
  'intent',
  'experimental-cirs',
  'invariant-projection',
  'knowledge-compression',
  'reasoning',
  'evaluation',
  'disagreement-analysis',
  'cirs-evolution',
  'invariant-theory',
] as const;

export type InvariantResearchLoopStage = (typeof INVARIANT_RESEARCH_LOOP)[number];

/**
 * Invariant Delta — every disagreement between a predicted invariant set and the
 * CIRS is CLASSIFIED and retained as first-class research data (the "research
 * gold" that WP0 synthesises into progressively stronger definitions). The
 * disagreement classes (Aletheon 2026-07-09): what KIND of gap each difference is.
 */
export const INVARIANT_DELTA_CLASSES = [
  'missing-invariant',
  'redundant-invariant',
  'incorrect-abstraction-level',
  'ontological-conflict',
  'domain-specific-specialization',
  'projection-error',
  'ambiguous-intent',
] as const;

export type InvariantDeltaClass = (typeof INVARIANT_DELTA_CLASSES)[number];

export interface InvariantDelta {
  /** The intent the projection was for. */
  intent: string;
  /** The invariants the projection predicted. */
  predicted: string[];
  /** The CIRS reference set compared against. */
  reference: string[];
  /** The specific differing items (what the classification is about). */
  difference: string[];
  /** What KIND of disagreement this is — the research datum. */
  classification: InvariantDeltaClass;
}

/**
 * The CIRS is NEVER static — a static reference becomes dogma, and dogma is the
 * enemy of science (Aletheon 2026-07-09). Every experiment may propose a
 * mutation to the reference; these are the operations that keep it alive.
 * Mutations are PROPOSALS (Law XI) — operator ratification promotes a mutated
 * CIRS to the next ratified version.
 */
export const CIRS_MUTATIONS = ['propose', 'merge', 'split', 'retire'] as const;

export type CIRSMutation = (typeof CIRS_MUTATIONS)[number];

// ---------------------------------------------------------------------------
// §8 The three research-intelligence roles (Aletheon 2026-07-09)
// ---------------------------------------------------------------------------

/**
 * Separation of powers that prevents the programme from becoming self-confirming
 * (the deepest methodological guard). Three DISTINCT cognitive roles:
 *
 *   - `generative`     — PROPOSES candidate invariant sets (produces the CIRS).
 *   - `evaluative`     — MEASURES projection fidelity + CLASSIFIES Invariant
 *                        Deltas. It never proposes invariants; it compares.
 *   - `constitutional` — DECIDES what enters the evolving invariant theory
 *                        (ratification, Law XI). It never generates or scores.
 *
 * The independence protocol that falls out of this (part of the EXP-006
 * protocol): the PRINCIPAL INVESTIGATORS do not author the CIRS — a generative
 * agent does, and it does so BLIND to any prior CIRS version. Independent
 * generation gives diversity of hypotheses; mutation (`CIRS_MUTATIONS`) gives
 * convergence. Editing a prior CIRS in place would anchor every version to the
 * first draft — forbidden by the protocol.
 */
export const RESEARCH_INTELLIGENCE_ROLES = ['generative', 'evaluative', 'constitutional'] as const;

export type ResearchIntelligenceRole = (typeof RESEARCH_INTELLIGENCE_ROLES)[number];
