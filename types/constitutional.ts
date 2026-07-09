/**
 * Constitutional Reasoning Services — the canonical type contract.
 * Operation Chrysalis 2.0 (CFS-015), Strand One, Phase 1.
 *
 * Contract-first, façade-not-fork: every service interface here NAMES an
 * existing production organ (see the `@organ` tags) rather than replacing it.
 * New capability enters by implementing these interfaces over the organs —
 * extend by composition, never by parallel implementation (the identity-spine
 * rule applied to reasoning). Stub slots (§4) define extension points whose
 * implementations are deferred; a stub result is ALWAYS the honest
 * `{ evaluated: false }` shape (CFS-014 precedent) — never fabricated data.
 *
 * Pattern source: types/access.ts (the spine's canonical contract file).
 */

import type {
  IntentQubeRecord,
  IntentQubeCreateInput,
  IntentStatus,
} from '@/services/iqube/intentQube';
import type {
  GroundingContext,
  InvariantSlice,
  KnowledgeManifest,
} from '@/services/invariants/grounding';
import type { CoherenceResult } from '@/services/coherence';
import type {
  ActivityReceiptRecord,
  ActivityActionType,
} from '@/services/receipts/activityReceiptService';

// ---------------------------------------------------------------------------
// §0 Shared primitives
// ---------------------------------------------------------------------------

/** The independently routable reasoning stages (CFS-015, Model Router). */
export type ReasoningStage =
  | 'intent'
  | 'context'
  | 'capability'
  | 'risk'
  | 'value'
  | 'price'
  | 'consequence'
  | 'validation';

export const REASONING_STAGES: readonly ReasoningStage[] = [
  'intent',
  'context',
  'capability',
  'risk',
  'value',
  'price',
  'consequence',
  'validation',
] as const;

/**
 * Honest-stub result envelope (CFS-014 precedent): a deferred capability
 * reports `evaluated: false` with a reason — it never fabricates a value.
 */
export interface Unevaluated {
  evaluated: false;
  reason: string;
}

export type MaybeEvaluated<T> = ({ evaluated: true } & T) | Unevaluated;

/**
 * NBEPlan — the long-missing named type for the `nbe_plans` row. Intents
 * piggyback on this table via the sentinel-packed rationale
 * (`__intent_qube_v1__:` — services/iqube/intentQube.ts). Field names mirror
 * the DB columns; this is a READ shape, not a write contract.
 */
export interface NBEPlan {
  id: string;
  persona_id: string;
  experience_id: string;
  disposition: 'ask' | 'act' | 'wait' | 'escalate' | 'deny';
  next_experience_depth: string;
  rationale: string | null;
  expires_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// §1 The six Constitutional Reasoning Services (CFS-015 Strand One)
// ---------------------------------------------------------------------------

/**
 * Intent Service → IntentQube.
 * @organ services/iqube/intentQube.ts (production)
 */
export interface IntentService {
  create(input: IntentQubeCreateInput): Promise<IntentQubeRecord>;
  get(intentId: string): Promise<IntentQubeRecord | null>;
  setStatus(intentId: string, status: IntentStatus): Promise<void>;
  children(parentIntentId: string, personaId: string): Promise<IntentQubeRecord[]>;
}

/**
 * ContextPack — the Context Service artifact. The ontology-resolved,
 * invariant-grounded context a reasoning stage receives BEFORE inference
 * (Canonical Ontology principle: resolution precedes reasoning).
 */
export interface ResolvedTerm {
  /** Surface form encountered in the input. */
  term: string;
  /** Canonical form per the terminology canon / invariant ontology. */
  canonical: string;
  /** Where the resolution came from. */
  source: 'terminology-canon' | 'invariant-ontology' | 'both';
  /** Governing invariant ids (seed ids, e.g. inv.constitutional.011). */
  invariantIds: string[];
}

export interface ContextPack {
  /** Terms resolved against canon before reasoning. */
  resolvedTerms: ResolvedTerm[];
  /** The invariant grounding slice for this context. */
  slice: InvariantSlice;
  /** Canon version stamp (cache key discipline, CFS-006 §3). */
  canonVersion: string;
  /** ISO timestamp of assembly. */
  assembledAt: string;
}

/**
 * Context Service → ContextPack.
 * @organ services/invariants/grounding.ts (production) +
 *        services/constitutional/ontologyResolver.ts (Phase 1 build)
 */
export interface ContextService {
  /** Full manifest for session-start knowledge initialization. */
  initialize(context?: GroundingContext): Promise<KnowledgeManifest>;
  /** Ontology-resolved pack for one reasoning call. */
  assemble(text: string, context?: GroundingContext): Promise<ContextPack>;
}

/**
 * CapabilityGapReport — the Capability Service artifact. Bridges the two
 * existing capability subsystems (registry trust-scoring ↔ work-order
 * gateway), which today have no discovery/ranking path between them.
 * @organ services/registry/* + services/capabilities/* (bridge = Phase 2 build)
 */
export interface CapabilityMatch {
  assetId: string;
  name: string;
  capabilities: string[];
  trustScore: number | null;
  version: string | null;
}

export interface CapabilityGapReport {
  requested: string[];
  matches: CapabilityMatch[];
  gaps: string[];
  recommendation: string | null;
}

export interface CapabilityService {
  discover(requested: string[]): Promise<MaybeEvaluated<{ report: CapabilityGapReport }>>;
}

/**
 * ConsequenceCanvas — the Consequence Service artifact.
 * @organ services/consequence/ (production core: runConsequencePipeline /
 *        executeApproved / forecastConsequences). The canvas is the forecast
 *        plus its disposition — already what the pipeline computes.
 */
export interface ConsequenceCanvas {
  seedInvariantIds: string[];
  /** From forecastConsequences — enabled/constrained/contradicted reach. */
  forecast: unknown; // ConsequenceForecast — kept opaque here to avoid a runtime import cycle; the organ owns the shape
  disposition: 'proceed' | 'ask' | 'escalate' | 'deny';
  forcesEscalation: boolean;
}

export interface ConsequenceService {
  forecast(seedInvariantIds: string[]): Promise<ConsequenceCanvas>;
}

/**
 * ValidationReport — the Validation Service artifact.
 * @organ services/coherence/ (partial: semantic/narrative/style real;
 *        experience/reasoning honest stubs) + scripts/verify-spine.mjs
 */
export interface ValidationReport {
  coherence: CoherenceResult;
  /** Non-coherence checks (spine smoke, canaries) when run. */
  checks: { name: string; pass: boolean; detail?: string }[];
  pass: boolean;
}

export interface ValidationService {
  validate(subject: unknown): Promise<ValidationReport>;
}

/**
 * DevelopmentReceipt — the Receipt Service artifact. A development-lifecycle
 * receipt IS an activity receipt with invariants_used instrumentation.
 * @organ services/receipts/activityReceiptService.ts + DVN pipeline (production)
 */
export type DevelopmentReceipt = ActivityReceiptRecord;

export interface ReceiptService {
  record(input: {
    personaId: string;
    actionType: ActivityActionType;
    summary: string;
    invariantsUsed?: string[];
  }): Promise<DevelopmentReceipt | null>;
}

// ---------------------------------------------------------------------------
// §2 Canonical Ontology Service (CFS-015 — NEW, Phase 1)
// ---------------------------------------------------------------------------

/**
 * Resolves names, entities, primitives, protocols, and relationships against
 * the invariant ontology + terminology canon BEFORE reasoning (constitutional
 * principle: canonical ontology takes precedence over conversational
 * inference). Implementation: services/constitutional/ontologyResolver.ts.
 */
export interface OntologyResolution {
  resolvedTerms: ResolvedTerm[];
  /** Terms encountered but unresolvable — surfaced, never silently dropped. */
  unresolved: string[];
  canonVersion: string;
}

export interface CanonicalOntologyService {
  resolve(text: string): Promise<OntologyResolution>;
}

// ---------------------------------------------------------------------------
// §3 Model Router (CFS-015 — NEW, Phase 1)
// ---------------------------------------------------------------------------

export type ConstitutionalProviderId = 'anthropic' | 'openai' | 'venice';

export interface StageRoute {
  stage: ReasoningStage;
  provider: ConstitutionalProviderId;
  model: string;
  /** Why this route (config source: default | modelqube | override). */
  source: 'default' | 'modelqube' | 'override';
  /** Phase 2 (ModelQube routing): the invariants that govern the routing
   *  decision — present when `source === 'modelqube'`. The routing decision is
   *  constitutional data, not a literal. */
  governingInvariants?: string[];
  /** True when the resolved route is the open-weight sovereign floor
   *  (inv.sovereignty.100/102) — reasoning under full sovereignty. */
  sovereignFloor?: boolean;
}

export interface RoutedCallResult {
  text: string;
  provider: ConstitutionalProviderId;
  model: string;
  /** True when the call landed on a fallback rather than the routed target. */
  degraded: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Per-STAGE provider/model routing over the existing provider chain.
 * Sovereign-survivability contract: the fallback ladder always terminates at
 * the open-weight provider (venice); a routed call may degrade, it must not
 * constitutionally fail while any provider is reachable.
 * Implementation: services/constitutional/modelRouter.ts (wraps, never forks,
 * the llmDraftHelper chain).
 */
export interface ModelRouter {
  routeFor(stage: ReasoningStage): StageRoute;
  call(stage: ReasoningStage, system: string, user: string, maxTokens?: number): Promise<RoutedCallResult>;
}

// ---------------------------------------------------------------------------
// §4 Stubbed Constitutional Services (CFS-015 — interfaces now, impl deferred)
// ---------------------------------------------------------------------------
// Every stub returns MaybeEvaluated<...>: `{ evaluated: false, reason }` until
// its implementation is ratified. Existing seams: assessRisk/assessValue are
// already throwing phase-2 stubs in services/consequence/stages.ts.

export interface RiskAssessment {
  score: number; // 0..1
  factors: string[];
}
export interface RiskQubeService {
  assess(subject: { intentId?: string; invariantIds?: string[] }): Promise<MaybeEvaluated<RiskAssessment>>;
}

export interface ValueAssessment {
  score: number; // 0..1
  rationale: string;
}
export interface ValueQubeService {
  assess(subject: { intentId?: string; invariantIds?: string[] }): Promise<MaybeEvaluated<ValueAssessment>>;
}

export interface PriceAssessment {
  /** Q¢ integer cents — NEVER a USD float (CLAUDE.md Q¢ canon). */
  amountQc: number;
  basis: string;
}
export interface PriceQubeService {
  price(subject: { intentId?: string; capability?: string }): Promise<MaybeEvaluated<PriceAssessment>>;
}

export interface RegistryRouterService {
  route(capability: string): Promise<MaybeEvaluated<{ assetId: string }>>;
}
export interface AgentRouterService {
  route(intent: { intentType: string }): Promise<MaybeEvaluated<{ agentId: string }>>;
}
export interface ConsequenceRouterService {
  route(forecastRef: string): Promise<MaybeEvaluated<{ handler: string }>>;
}
export interface StandingIntelligenceService {
  summarize(personaScopeToken: string): Promise<MaybeEvaluated<{ summary: string }>>;
}
export interface PortfolioIntelligenceService {
  summarize(portfolioId: string): Promise<MaybeEvaluated<{ summary: string }>>;
}

// ---------------------------------------------------------------------------
// §5 The pipeline + the improvement loop, named (CFS-015 Strand Two)
// ---------------------------------------------------------------------------

/**
 * The Constitutional Capability Pipeline — the canonical innovation
 * lifecycle. Renamed from "development pipeline" (2026-07-06 amendment):
 * what it produces is CAPABILITY, not code — development is one
 * implementation mechanism among several (config, registry updates, prompts,
 * policy, schemas, knowledge, automation, docs). The Implementation Pack is
 * the artifact produced immediately BEFORE the implementation stage, not a
 * stage itself. Order is constitutional data (sequencing corollary of
 * Law XV): stages compose in THIS order.
 */
export const CONSTITUTIONAL_CAPABILITY_PIPELINE = [
  'intent',
  'context',
  'capability',
  'risk',
  'value',
  'price',
  'consequence',
  'implementation',
  'validation',
  'receipt',
  'learning',
] as const;

export type ConstitutionalPipelineStage = (typeof CONSTITUTIONAL_CAPABILITY_PIPELINE)[number];

/**
 * The Constitutional Improvement Loop (CFS-015 amendment 2026-07-06) — the
 * self-improvement cycle that runs alongside the Capability Pipeline. Its
 * terminus is IMPROVED CAPABILITY, not improved code: learning is
 * remembering; improvement is becoming better (Constitutional Improvement,
 * CFS-015 principle 7). Order is constitutional data.
 */
export const CONSTITUTIONAL_IMPROVEMENT_LOOP = [
  'capability',
  'operation',
  'observation',
  'receipt',
  'learning',
  'improved-capability',
] as const;

export type ConstitutionalImprovementStage = (typeof CONSTITUTIONAL_IMPROVEMENT_LOOP)[number];

/**
 * The Chrysalis Test's acceptance-criterion ids (CFS-015 final acceptance
 * test, computed live by /api/constitutional/chrysalis-test). Pinned here so
 * acceptance criteria cannot silently vanish — the canary asserts the set.
 */
export const CHRYSALIS_CRITERIA_IDS = [
  'constitutional-reasoning',
  'reasoning-surfaces-governed',
  'rendering-governed',
  'develops-capabilities',
  'generates-receipts',
  'validates-outcomes',
  'learns-operationally',
  'sovereignty',
  'provider-interchangeability',
  'deployment-native',
] as const;

/**
 * The Sovereignty Scale (operator refinement, 2026-07-06): sovereignty is
 * operator CONTROL over the intelligence supply — a scale, not a boolean.
 * Its essence is the ability to choose and switch providers free of
 * commercial or platform lock-in (S1); open weights are its maximum (S3).
 * Order is meaning — pinned by canary. Glossary: "Sovereignty Scale".
 *
 *   s0-dependent        single-provider lock-in — no sovereignty
 *   s1-interchangeable  operator chooses/switches providers, no lock-in (the essence)
 *   s2-substitutable    validated substitutes complete the constitutional battery
 *   s3-open-weight      open-weight carries constitutional operation (maximum control)
 */
export const SOVEREIGNTY_SCALE = [
  's0-dependent',
  's1-interchangeable',
  's2-substitutable',
  's3-open-weight',
] as const;
export type SovereigntyRung = (typeof SOVEREIGNTY_SCALE)[number];

