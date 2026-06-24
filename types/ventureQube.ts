/**
 * Venture iQube — TypeScript type definitions
 *
 * Source of truth: codexes/packs/agentiq/updates/2026-06-01_venture-iqube-schema-v0.4.md
 *                  (and the v0.3, v0.2, v0.1 doc lineage referenced therein)
 *
 * The runtime Zod validator at services/iqube/ventureQubeSchema.ts must stay
 * in lockstep with the shapes here. When you extend a field, update both.
 *
 * v0.4 (2026-06-01) adds the nested `ventures[].myCartridge` block per
 * myCartridge PRD v0.2 §27 — captures the operator's intent for their own
 * cartridge (identity, purpose, tabs, Triad: Cartridge + Copilot + Wallet,
 * audience, activation catalogue opt-in). MVP: 1 venture per persona;
 * platform sys-admins may exceed.
 */

export type VentureQubeSchemaVersion =
  | "venture-iqube/v0.1"
  | "venture-iqube/v0.2"
  | "venture-iqube/v0.3"
  | "venture-iqube/v0.4"
  // v1.0 — the canonical 13-layer per-venture formation primitive (Founder
  // Office PRD v3 + VentureQube Spec v1). v0.1→v0.4 remain the operator
  // portfolio wrapper integrated with the aigentMe experience model; v1.0 is
  // the per-venture object a wrapper venture can graduate into. See the v1.0
  // section at the bottom of this file.
  | "venture-iqube/v1.0";

export type CartridgeSlugV04 =
  | "metame"
  | "knyt"
  | "qriptopian"
  | "marketa"
  | "agentiq-os"
  | "venture-lab"
  | "mvl"
  | "moneypenny"
  | "studio"
  | "iqube-registry"
  | "legal-metacommons";

export type SpecialistId =
  | "marketa"
  | "quill"
  | "kn0w1"
  | "aigent-z"
  | "aigent-c"
  | "aigent-nakamoto"
  | "moneypenny"
  | "metaye";

export type CartridgeCategory =
  | "community"
  | "venture"
  | "knowledge"
  | "creative"
  | "media"
  | "franchise"
  | "learning"
  | "research"
  | "professional"
  | "private";

export type CartridgeVisibility = "public" | "private" | "invite-only" | "member-only";

export type CartridgeAudienceKind = "open" | "gated" | "franchise" | "inner-circle";

export type CartridgeAudienceSize = "1-10" | "10-100" | "100-1k" | "1k-10k" | "10k+";

export type CartridgeTabTemplateId =
  | "pulse-v1"
  | "codex-v1"
  | "experience-v1"
  | "active-v1"
  | "wallet-v1"
  | "ledger-v1"
  | "community-v1"
  | "members-v1"
  | "venture-v1"
  | "settings-v1"
  | "admin-v1"
  | "overview-v1";

export type CartridgeTabVisibility = "public" | "member" | "admin" | "invite" | "token-gated";

export type CartridgeCopilotSource = "aigentMe" | "cartridge-copilot" | "specialist";

export type CartridgeKbIngestSource = "mycanvas" | "myworkspace" | "uploads" | "codex" | "json_blob";

export type CartridgeKbEmbeddingScope = "cartridge" | "domain";

export type TokenId = "q-cent" | "usdc" | "knyt";

export type CartridgeRole =
  | "owner"
  | "admin"
  | "editor"
  | "contributor"
  | "member"
  | "partner"
  | "franchisee"
  | "correspondent"
  | "guest";

export type CartridgeReceiptKind =
  | "created"
  | "tab_visibility"
  | "member_invited"
  | "crypto_send"
  | "payment_request"
  | "reward_payout"
  | "codex_published"
  | "activation_submitted"
  | "activation_reviewed";

// ─── v0.1 / v0.2 / v0.3 shared shapes ─────────────────────────────────────

export interface VentureQubeOperator {
  displayLabel: string;
  archetype: string;
  tagline?: string;
  fioHandle?: string;
}

export interface VentureQubeStrategy {
  headline: string;
  thesis: string;
  currentStage?: string;
  blockers?: string[];
  constraints?: string[];
}

export interface VentureQubeObjective {
  id: string;
  title: string;
  summary?: string;
  impact: string;
  effort: string;
  horizon?: string;
  successCriteria?: string[];
  dependencies?: string[];
  specialistHint?: string;
}

export interface VentureQubePartner {
  name: string;
  role?: string;
  status?: string;
}

// ─── v0.4 myCartridge nested block ────────────────────────────────────────

export interface CartridgeTabSpec {
  slug: string;
  templateId: CartridgeTabTemplateId;
  visibility: CartridgeTabVisibility;
  primary: boolean;
  tokenGate?: { tokenId: TokenId; minBalance: string };
}

export interface CartridgeIdentity {
  configured: true;
  slug: string;
  title: string;
  description: string;
  purpose: string;
  category: CartridgeCategory;
  visibility: CartridgeVisibility;
  // T0 — server-only; the spine resolves this from the active persona,
  // not from the JSON. Included in the type for completeness but the
  // ingest validator strips it from any client-supplied payload.
  ownerPersonaId?: string;
}

export interface CartridgeAudience {
  kind: CartridgeAudienceKind;
  estimatedSize: CartridgeAudienceSize;
  languages: string[];
}

export interface CartridgeCopilotConfig {
  source: CartridgeCopilotSource;
  cartridgeCopilotPersonaId?: string;
  promptContext: string;
}

export interface CartridgeKnowledgeBaseConfig {
  ingestSources: CartridgeKbIngestSource[];
  embeddingScope: CartridgeKbEmbeddingScope;
  jsonBlob?: {
    uri: string;
    uploadedAt: string;
    sizeBytes: number;
  };
}

export interface CartridgeCodexConfig {
  enabled: boolean;
  rootTabSlug: "codex";
  registryEligible?: boolean;
  mintingEnabled?: boolean;
}

export interface CartridgeWalletConfig {
  enabled: boolean;
  tokenWhitelist: TokenId[];
  primitives: {
    cryptoSend: boolean;
    cryptoReceive: boolean;
    paymentRequest: boolean;
    rewardPayout: boolean;
  };
}

export interface CartridgeTriadConfig {
  copilot: CartridgeCopilotConfig;
  knowledgeBase: CartridgeKnowledgeBaseConfig;
  codex: CartridgeCodexConfig;
  wallet: CartridgeWalletConfig;
}

export interface CartridgeSpecialistsConfig {
  available: SpecialistId[];
  primary?: SpecialistId;
}

export interface CartridgeActiveTab {
  slug: string;
  catalogId: string;
  metrics: string[];
  actions: string[];
}

export interface CartridgeMembershipModelConfig {
  rolesEnabled: CartridgeRole[];
  invitePolicy: "owner-only" | "admin-allowed" | "public-request";
  membershipReceipts: boolean;
}

export interface CartridgeStateChangeReceiptsConfig {
  enabled: boolean;
  receiptKinds: CartridgeReceiptKind[];
}

export interface MyCartridgeBlock extends CartridgeIdentity {
  audience: CartridgeAudience;
  template: CartridgeTabTemplateId | "custom";
  tabs: CartridgeTabSpec[];
  smartTriad: CartridgeTriadConfig;
  specialists: CartridgeSpecialistsConfig;
  activeTab: CartridgeActiveTab;
  membershipModel: CartridgeMembershipModelConfig;
  stateChangeReceipts: CartridgeStateChangeReceiptsConfig;
  // Pins the {Cartridge, Copilot, Wallet} Triad shape. Legacy "smartTriad"
  // top-level alias is rejected at ingest with a migration error.
  triadNomenclature: "v0.2";
  // Activation Catalogue opt-in toggled at wizard save. When true and
  // visibility === 'public', the active tab enters the approval chain
  // at `pending_metame` (MVP) or `pending_registry` (post-pilot).
  catalogueOptIn?: boolean;
}

// ─── Top-level venture wrapper (v0.1 → v0.4) ───────────────────────────────

export interface VentureQubeVenture {
  id: string;
  name: string;
  tagline?: string;
  stage?: string;
  cartridgeBindings?: string[];
  northStarKpi?: string;
  objectives: VentureQubeObjective[];
  partners?: VentureQubePartner[];
  notes?: string;
  // v0.4: nested myCartridge configuration block per myCartridge PRD §27.
  // MVP rule: at most one venture entry carries `myCartridge` per persona;
  // platform sys-admins may exceed.
  myCartridge?: MyCartridgeBlock;
}

export interface VentureQubeKpiRow {
  name: string;
  metric: string;
  current?: string | number | null;
  target: string | number;
  horizon: string;
  ventureId?: string;
}

export interface VentureQubePlanAction {
  title: string;
  ventureId: string;
  objectiveId?: string;
  owner?: string;
  due?: string;
  blocker?: string;
}

export interface VentureQubePlanHorizon {
  focus: string;
  actions: VentureQubePlanAction[];
}

export interface VentureQube {
  schemaVersion: VentureQubeSchemaVersion;
  emittedAt?: string;
  operator: VentureQubeOperator;
  strategy: VentureQubeStrategy;
  ventures: VentureQubeVenture[];
  plan: Record<string, VentureQubePlanHorizon>;
  specialistPreferences?: Record<string, string>;
  kpiBoard?: VentureQubeKpiRow[];
}

// Convenience alias — most callers care only about the v0.4 shape.
export type VentureQubeV04 = VentureQube & { schemaVersion: "venture-iqube/v0.4" };

// ───────────────────────────────────────────────────────────────────────────
// Product tiers (the operator-facing names for the two VentureQube schemas).
//
//   VentureQube Lite = the v0.1–v0.4 operator wrapper. The STANDARD / FREE path,
//     wired into the aigentMe experience-model onboarding (single-venture idea
//     incubation; position derived in the Lite experience-guide flow).
//   VentureQube Pro  = the v1.0 per-venture formation primitive. The PREMIUM
//     path (Step 4 gating): multi-venture/portfolio, advanced Pro experience-
//     guide intake fed by Standing declarations, Venture Lab Pro surfaces, and
//     multiple metaMe venture views in the Studio.
//
// The `venture-iqube/vX` schema versions remain the canonical protocol IDs;
// Lite/Pro are display labels mapped onto them.
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// Operating Model — the OPTIONAL "operating artifact" layer (Pro/Portfolio only)
//
// The core VentureQube (both the v0.x operator wrapper and the 13-layer v1.0
// venture) is a GENERAL-PURPOSE primitive: a student, founder, creator, venture
// studio, family office, or polity steward can all use it unchanged. It captures
// intent (Experience), execution structure (Venture), and Standing — but
// deliberately NOT day-to-day operations. Hardwiring "daily actions / campaigns
// / commercial goals" into the core would over-specialise what is becoming a
// powerful general-purpose operating primitive.
//
// The Operating Model is the separate, optional layer that turns a portfolio
// brief into a *living operational brief* aigentMe can execute against as a
// Chief of Staff. It lives ONLY on Venture Pro + Venture Portfolio — never on
// Lite / Core Experience, and never inside a VentureQubeV1. Three concerns,
// three homes:
//
//   Experience layer  → captures intent
//   Venture layer     → captures execution structure
//   Operating layer   → captures action            ← this
// ───────────────────────────────────────────────────────────────────────────

export interface OperatingObjective {
  objective: string;
  /**
   * Lifecycle so aigentMe can distinguish what to act on. Not a PM system —
   * just enough state to drive a daily brief.
   */
  status: "active" | "completed" | "blocked" | "deferred";
}

// ───────────────────────────────────────────────────────────────────────────
// Operator mode + Communication identity
//
// `operatorMode` flips how the operating layer is INTERPRETED — same schema,
// two utilizations:
//   • "operator"           — single-venture focus. The Lite/Experience venture
//                            is a SEED venture being incubated; it matures into
//                            a VentureQube Pro.
//   • "portfolio-operator" — multi-venture coordination (the "Operation Leap"
//                            shape). The Lite/operating layer is read as the
//                            PORTFOLIO ORCHESTRATION layer — the Why that spans
//                            every VentureQube Pro in the portfolio, not a venture
//                            being incubated. aigentMe uses this flag to decide
//                            whether to treat the operating brief as a single
//                            venture's plan or as portfolio-wide doctrine.
// ───────────────────────────────────────────────────────────────────────────
export type OperatorMode = "operator" | "portfolio-operator";

/**
 * CommunicationContext — the voice + signatory aigentMe MUST use when acting in
 * delegated authority for a given venture / partner conversation. aigentMe never
 * invents a voice; it reads this. Lives per-venture (the canonical home, for the
 * single-venture operator case) and aggregated into PortfolioCommunication.contexts
 * (the portfolio-operator case).
 */
export interface CommunicationContext {
  /** The brand/entity aigentMe speaks AS — e.g. "Polity Passport Bureau", "metaMe", "metaKnyt". */
  voiceEntity: string;
  /** Parent org referenced when useful — e.g. "metaProof". */
  parentOrganization?: string;
  /** Default signatory name — e.g. "Dele Atanda". */
  signatoryName?: string;
  /** Default signatory title — e.g. "CEO, metaProof". */
  signatoryTitle?: string;
  /** The strategic partner this voice is anchored to — e.g. "Project Liberty". */
  strategicPartner?: string;
  /** Themes the voice leads with. */
  primaryThemes?: string[];
  /** One-line positioning statement for the voice. */
  positioning?: string;
  /** Hard rules — e.g. "Lead with Polity Passport", "Do not communicate as Operation Leap". */
  communicationRules?: string[];
  /**
   * When true, aigentMe MUST NOT autonomously send external communications under
   * this context — it produces operator-review-only work. Internal codenames
   * (e.g. "Operation Leap") set this true and have no external voiceEntity.
   */
  isInternalOnly?: boolean;
}

/**
 * PortfolioCommunication — portfolio-wide communication doctrine for the
 * portfolio-operator case. Captures which voice LEADS, the unified core message
 * all lanes share, the role each lane plays, and the per-venture voices.
 */
export interface PortfolioCommunication {
  /** The lead primitive/voice across partner conversations — e.g. "Polity Passport". */
  leadEntity?: string;
  /** The unified core message every lane carries (ownership, accountability, progressive sovereignty). */
  unifiedMessage?: string;
  /** The role each lane plays in the unified narrative (e.g. Passport = launch primitive; metaMe = execution env; metaKnyt = cultural context). */
  laneRoles?: { entity: string; role: string }[];
  /** The per-venture/partner communication contexts. */
  contexts?: CommunicationContext[];
}

export interface VentureOperatingModel {
  /**
   * The OPERATIONAL expression of `portfolio.thesis` — what we are doing right
   * now in service of that Why. There is deliberately NO separate operating
   * thesis: `portfolio.thesis` is the single highest-order statement of intent
   * (the Why), and `mission` is the What-right-now. Keeping one thesis prevents
   * strategic and operating intent from drifting apart (tactical drift).
   */
  mission?: string;
  /**
   * The success metrics the operator steers toward — e.g. "4,000 Passport
   * holders", "$100K MRR", "25 Founder Office conversions". These are outcomes.
   */
  successMetrics?: string[];
  /** Objectives currently in flight, each with a lifecycle status. */
  activeObjectives?: OperatingObjective[];
  /** Strategic partners the operating brief depends on. */
  priorityPartners?: string[];
  /** The next concrete actions, in priority order. */
  priorityActions?: string[];
  /** Operating review cycle — how often: "weekly", "biweekly", "monthly". */
  reviewCadence?: string;
  /** When the next review is due (ISO date) — lets aigentMe auto-generate review briefs. */
  nextReviewDate?: string;
  /**
   * The single primary KPI the brief is judged against. Layered framing:
   *   • public mental model  → Time-to-Value (instantly understood)
   *   • internal metric      → Proof of Time Saved (PoTS, measurable)
   *   • constitutional principle → Net Value Acceleration (Time-to-Value minus
   *     Risk Repair Burden), which rolls up every venture's verified outcome
   *     accrual (see ProofOfOutcomeClaim). Free-text so an operator can name a
   *     different north star, but Net Value Acceleration is the default.
   */
  primaryMetric?: string;
  /**
   * How this operating layer is interpreted (see OperatorMode). Defaults to
   * "operator" (single venture) when absent; set "portfolio-operator" for a
   * portfolio orchestration brief.
   */
  operatorMode?: OperatorMode;
  /**
   * Portfolio-wide communication doctrine — which voice leads, the unified
   * message, lane roles, and the per-venture communication contexts aigentMe
   * uses when speaking in delegated authority. Portfolio-operator case.
   */
  portfolioCommunication?: PortfolioCommunication;
}

export type VentureQubeTier = "lite" | "pro";

export const VENTUREQUBE_TIER_LABEL: Record<VentureQubeTier, string> = {
  lite: "VentureQube Lite",
  pro: "VentureQube Pro",
};

/** Map a schema version to its product tier. v1.0 = Pro; everything else = Lite. */
export function ventureQubeTier(schemaVersion: VentureQubeSchemaVersion): VentureQubeTier {
  return schemaVersion === "venture-iqube/v1.0" ? "pro" : "lite";
}

// ───────────────────────────────────────────────────────────────────────────
// VentureQube v1.0 — "VentureQube Pro" — the canonical 13-layer
// venture-formation primitive (the premium / Step-4 path).
//
// Classification: ClusterQube specialization (registered in the iQube registry
// SoT with primitive_type='ClusterQube'). One VentureQube === one venture.
//
// Relationship to v0.4: v0.4 is the operator-centric portfolio wrapper wired
// into the aigentMe experience-model onboarding (idea incubation). A wrapper's
// ventures[] entry can GRADUATE into a full v1.0 VentureQube when the operator
// moves from incubating an idea to blueprinting a venture in the Venture Lab
// cartridge. The two coexist; v1.0 never replaces v0.4.
// ───────────────────────────────────────────────────────────────────────────

/** Venture lifecycle stage (Layer 1 / lifecycle). */
export type VentureStage =
  | "concept"
  | "validation"
  | "formation"
  | "launch"
  | "growth"
  | "scale"
  | "institution";

/** The Founder Office workflow path that produced or last advanced the venture. */
export type FounderPath = "discover" | "validate" | "architect";

/** Customer archetypes (Layer 4 examples — open-ended via `label`). */
export type VentureArchetypeKind =
  | "citizen"
  | "creator"
  | "founder_operator"
  | "executive"
  | "investor"
  | "institution"
  | "other";

/** Revenue model kinds (Layer 5). */
export type RevenueModelKind =
  | "subscription"
  | "services"
  | "licensing"
  | "commerce"
  | "transaction_fees"
  | "intelligence_services"
  | "venture_participation"
  | "other";

/** Agent consumers of the Delegation layer (Layer 9). */
export type VentureAgentConsumer =
  | "aigentMe"
  | "devon"
  | "marketa"
  | "venture-lab"
  | "investor-office";

/** A 0–100 confidence score; null when not yet estimated. */
export type ConfidenceScore = number | null;

// ── Layer 1 — Identity ──────────────────────────────────────────────────────
export interface VentureIdentityLayer {
  ventureName: string;
  ventureSlug: string;
  ventureDescription?: string;
  stage: VentureStage;
  // T2-safe public references only — never raw personaId/passportId.
  founderPublicRefs: string[];
  passportPublicRefs?: string[];
  standingPublicRefs?: string[];
  associatedIqubeIds?: string[];
}

// ── Layer 2 — Venture Thesis ────────────────────────────────────────────────
export interface VentureThesisLayer {
  mission?: string;
  vision?: string;
  problemStatement?: string;
  consequenceThesis?: string;
  valueProposition?: string;
  ventureCategory?: string;
  industryTags?: string[];
  marketTags?: string[];
  geographicScope?: string;
}

// ── Layer 3 — Intent ────────────────────────────────────────────────────────
export interface VentureIntentLayer {
  founderIntents: string[];
  ventureIntents: string[];
  citizenIntents?: string[];
  commonsIntents?: string[];
}

// ── Layer 4 — Signal Evidence ───────────────────────────────────────────────
export interface VentureSignalEvidenceItem {
  signalId: string;
  signalType: string;
  signalSource: string;
  confidenceScore: ConfidenceScore;
  standingScore: ConfidenceScore;
  proofOfWorkPotential?: ConfidenceScore;
  timestamp: string;
}

export interface VentureSignalEvidenceLayer {
  items: VentureSignalEvidenceItem[];
  // Roll-up confidence outputs (Standing-calibrated; computed, not declared).
  signalConfidence: ConfidenceScore;
  opportunityConfidence: ConfidenceScore;
  demandConfidence: ConfidenceScore;
  capabilityConfidence: ConfidenceScore;
}

// ── Layer 5 — Customer Archetype ────────────────────────────────────────────
export interface VentureArchetype {
  kind: VentureArchetypeKind;
  label: string;
  description?: string;
  painPoints?: string[];
  desiredOutcomes?: string[];
  valueReceived?: string;
  willingnessToPay?: string;
  priorityScore?: ConfidenceScore;
}

// ── Layer 6 — Revenue Architecture ──────────────────────────────────────────
export interface VentureRevenueEngine {
  engineType: RevenueModelKind;
  engineName: string;
  targetArchetypes?: string[];
  pricingModel?: string;
  pricingAssumptions?: string;
  priorityLevel?: number;
  estimatedRevenue?: string;
}

export interface VentureRevenueArchitectureLayer {
  engines: VentureRevenueEngine[];
}

// ── Layer 7 — Commercial Operating Model ────────────────────────────────────
export interface VentureCommercialModelLayer {
  targetPassports?: number;
  targetCitizens?: number;
  targetCreators?: number;
  targetFounders?: number;
  targetExecutives?: number;
  targetInvestors?: number;
  conversionAssumptions?: string[];
  acquisitionAssumptions?: string[];
  revenueTargets?: string[];
  mrrTargets?: string[];
  arrTargets?: string[];
  growthAssumptions?: string[];
}

// ── Layer 8 — Capability ────────────────────────────────────────────────────
export interface VentureCapabilityLayer {
  requiredCapabilities: string[];
  availableCapabilities: string[];
  capabilityGaps: string[];
  capabilityPriorities: string[];
}

// ── Layer 8b — Resource (canonical schema "Resource Layer") ─────────────────
export interface VentureResourceLayer {
  requiredPeople?: string[];
  requiredAgents?: string[];
  requiredTools?: string[];
  requiredIqubes?: string[];
  requiredCapital?: string[];
}

// ── Layer 9 — Execution ─────────────────────────────────────────────────────
export interface VentureExecutionPhase {
  phaseName: string;
  startDate?: string;
  endDate?: string;
  objectives: string[];
  deliverables: string[];
  dependencies?: string[];
  successMetrics?: string[];
}

export interface VentureExecutionLayer {
  phases: VentureExecutionPhase[];
}

// ── Layer 10 — Delegation (agent handoff) ───────────────────────────────────
export interface VentureAgentAssignment {
  agentType: VentureAgentConsumer;
  agentId?: string;
  responsibility: string;
  deliverables: string[];
  successMetrics?: string[];
}

export interface VentureDelegationLayer {
  assignments: VentureAgentAssignment[];
}

// ── Layer 11 — Outcome ──────────────────────────────────────────────────────

/** Verification lifecycle for an outcome accrual claim. */
export type OutcomeClaimVerificationStatus = "claimed" | "verified" | "rejected";

/**
 * Proof-of-Outcome claim — the verification-gated "Outcome Accrual Evidence"
 * primitive. A claim begins life self-declared (`verificationStatus: 'claimed'`)
 * and accrues NOTHING to Standing until a verifier moves it to `'verified'`.
 *
 * Net Value Acceleration (the refined PoTS) is computed, not stored:
 *   NVA hours = max(0, timeSavedHours − riskRepairHours)
 * i.e. time-to-value saved NET OF the time spent repairing risk the venture
 * introduced. Proof-of-Time-Saved is one dimension of outcome accrual, not the
 * whole story — `claimedValue` (monetary/strategic) and `riskProfile` round it
 * out. Standing accrual = NVA × confidence, applied once (idempotent via
 * `accruedAt`), and only for VERIFIED claims.
 */
export interface ProofOfOutcomeClaim {
  /** Stable id so accrual can be made idempotent and claims can be re-verified. */
  claimId: string;
  description: string;
  /** Claimed value delivered (free-text, e.g. "$40k ARR" / "2 launches"). */
  claimedValue?: string;
  /** Claimed time-to-value saved, in hours. The positive side of NVA. */
  timeSavedHours?: number;
  /** Time spent repairing risk the venture introduced, in hours. Subtracted. */
  riskRepairHours?: number;
  /** Qualitative risk posture of the claim (e.g. "low" / "speculative"). */
  riskProfile?: string;
  /** Gate: nothing accrues to Standing until this is 'verified'. */
  verificationStatus: OutcomeClaimVerificationStatus;
  /** T2-safe public ref / label of the verifier — never a raw personaId. */
  verifier?: string;
  verifiedAt?: string;
  /** 0–1 multiplier applied to NVA when accruing Standing (null when unset). */
  confidence?: number | null;
  /** Set once the verified claim has been accrued to Standing (idempotency). */
  accruedAt?: string;
  createdAt?: string;
}

export interface VentureOutcomeLayer {
  outcomes?: string[];
  /** @deprecated superseded by `proofOfOutcomeClaims`; retained for legacy reads. */
  proofOfTimeSaved?: string[];
  /** Verification-gated Outcome Accrual Evidence (the refined PoTS). */
  proofOfOutcomeClaims?: ProofOfOutcomeClaim[];
  standingChanges?: string[];
  lessonsLearned?: string[];
}

// ── Layer 12 — Governance ───────────────────────────────────────────────────
export interface VentureGovernanceLayer {
  riskScore?: ConfidenceScore;
  sensitivityScore?: ConfidenceScore;
  accuracyScore?: ConfidenceScore;
  verifiabilityScore?: ConfidenceScore;
  standingConfidence?: ConfidenceScore;
  proofOfWorkPotential?: ConfidenceScore;
  ventureConfidence?: ConfidenceScore;
}

// ── Layer 13 — Institutional ────────────────────────────────────────────────
export interface VentureInstitutionalLayer {
  ventureLabStatus?: string;
  investmentStatus?: string;
  commonsVisibility?: "private" | "commons" | "public";
  publicVisibility?: boolean;
  institutionalReadiness?: ConfidenceScore;
  institutionalClassification?: string;
}

/**
 * VentureQube v1.0 — the canonical per-venture formation primitive.
 *
 * `ventureId` is the registry-canonical UUID; T0 owner identity lives only on
 * the server-side `venture_qubes` row and is never embedded here (the layers
 * carry T2-safe public refs only).
 */
export interface VentureQubeV1 {
  schemaVersion: "venture-iqube/v1.0";
  ventureId: string;
  emittedAt?: string;
  lastPath?: FounderPath;
  /**
   * The voice + signatory aigentMe MUST use when communicating in delegated
   * authority for this venture (single-venture operator case). For a portfolio,
   * the per-venture voices are also aggregated into the operating model's
   * portfolioCommunication.contexts.
   */
  communicationContext?: CommunicationContext;
  identity: VentureIdentityLayer;
  thesis: VentureThesisLayer;
  intent: VentureIntentLayer;
  signalEvidence: VentureSignalEvidenceLayer;
  archetypes: VentureArchetype[];
  revenueArchitecture: VentureRevenueArchitectureLayer;
  commercialModel: VentureCommercialModelLayer;
  capability: VentureCapabilityLayer;
  resource: VentureResourceLayer;
  execution: VentureExecutionLayer;
  delegation: VentureDelegationLayer;
  outcome: VentureOutcomeLayer;
  governance: VentureGovernanceLayer;
  institutional: VentureInstitutionalLayer;
}

export const VENTURE_STAGES: VentureStage[] = [
  "concept",
  "validation",
  "formation",
  "launch",
  "growth",
  "scale",
  "institution",
];

/** Build an empty v1.0 VentureQube scaffold for a new venture. */
export function emptyVentureQubeV1(
  ventureId: string,
  name: string,
  slug: string,
  stage: VentureStage = "concept",
): VentureQubeV1 {
  return {
    schemaVersion: "venture-iqube/v1.0",
    ventureId,
    emittedAt: new Date().toISOString(),
    identity: {
      ventureName: name,
      ventureSlug: slug,
      stage,
      founderPublicRefs: [],
    },
    thesis: {},
    intent: { founderIntents: [], ventureIntents: [] },
    signalEvidence: {
      items: [],
      signalConfidence: null,
      opportunityConfidence: null,
      demandConfidence: null,
      capabilityConfidence: null,
    },
    archetypes: [],
    revenueArchitecture: { engines: [] },
    commercialModel: {},
    capability: {
      requiredCapabilities: [],
      availableCapabilities: [],
      capabilityGaps: [],
      capabilityPriorities: [],
    },
    resource: {},
    execution: { phases: [] },
    delegation: { assignments: [] },
    outcome: {},
    governance: {},
    institutional: {},
  };
}
