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
 * the starting point IRL-EXP-001 (Intent Projection Fidelity) tests against a
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
 * The programme's work packages, order-pinned. WP0 (Invariant Theory) is added
 * BEFORE Intent Science: until we define what an invariant IS — what makes
 * something invariant, how invariants compose/conflict, whether they are
 * hierarchical or domain-independent — we cannot rigorously discover them. The
 * strategic centre (Aletheon, 2026-07-09): Intent Science determines WHICH
 * reasoning substrate should exist; Knowledge Compression is one MECHANISM for
 * constructing it. Invariant Intelligence is the overarching discipline.
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
 * The reference IRL-EXP-001 Stage A judges predictions against — NOT a "gold
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
 * IRL-EXP-002 (Reasoning Entropy Reduction) is a FOUR-arm comparison, not two
 * (Aletheon, 2026-07-09). The point is not "does it beat naïve RAG" (easy) but
 * "does it beat our OWN best existing architecture" — the intellectually honest
 * bar. Order is the comparison ladder from least to most engineered baseline,
 * ending at the experimental arm.
 */
export const IRL_EXP002_ARMS = [
  'large-context', // dump everything, no retrieval
  'naive-rag', // top-k embedding retrieval
  'existing-kb', // the platform's production KB retrieval (the honest bar)
  'invariant-runtime', // the experimental arm
] as const;

export type IRLExp002Arm = (typeof IRL_EXP002_ARMS)[number];

/**
 * Propagation Fidelity (Aletheon, 2026-07-09) — a primary metric and the object
 * of IRL-EXP-003: the degree to which downstream artifacts preserve the intended
 * invariant set ACROSS MODALITIES. Generate across these modalities from ONE
 * invariant set, then ask blind reviewers to reconstruct the original set; high
 * reconstructability = high propagation fidelity. A new benchmark.
 */
export const PROPAGATION_MODALITIES = ['article', 'story', 'image', 'ux', 'prd'] as const;

export type PropagationModality = (typeof PROPAGATION_MODALITIES)[number];
