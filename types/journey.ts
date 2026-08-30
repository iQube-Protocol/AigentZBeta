/**
 * Guided Journey Runtime — type contract (PRD-GJR-001).
 *
 * A journey carries a person, agent or partner through a live sequence of
 * platform actions using: a compact interactive journey bar; existing
 * authoritative platform surfaces; a context-aware Companion; real platform
 * state and receipts; a defined destination. This is orchestration, not a
 * new identity/wallet/delegation/admission system — every mechanism a stage
 * references already exists (see services/journey/journeySurfaceRegistry.ts).
 *
 * Journey Guidance Principle (§5.1): button clicked != stage complete.
 * authoritative state + required receipt = stage complete. Client navigation
 * may select a stage; it never sets completion (services/journey/resolveJourneyState.ts).
 *
 * See codexes/packs/agentiq/updates/2026-07-30_prd-gjr-001-guided-journey-runtime.md
 * for the full spec this file implements (§8, §11.1).
 */

export type JourneyStageState =
  | 'NOT_STARTED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REFUSED'
  | 'COMPLETE'
  | 'QUARANTINED';

/**
 * 'external-url' (Composable Overlay Principle, §5.9) — the browser itself is
 * a valid surface, including for a partner's own live environment (e.g.
 * Horizen's real registry page for a registered agent). Never a metaMe-
 * internal route.
 */
export type JourneySurfaceMode =
  | 'iframe'
  | 'component'
  | 'modal'
  | 'drawer'
  | 'receipt-view'
  | 'external-url';

export interface JourneySurfaceRef {
  mode: JourneySurfaceMode;
  /** Key into JOURNEY_SURFACES (services/journey/journeySurfaceRegistry.ts). */
  ref: string;
  route?: string;
  /** Required when mode is 'external-url' — the real external page to open. */
  url?: string;
  entityRef?: string;
  props?: Record<string, unknown>;
  /** Human-readable note on what this surface is, for build traceability. */
  note?: string;
}

/**
 * The MONOTONIC constitutional ladder (operator ruling, 2026-08-03):
 *
 *   REGISTERED → VERIFIED | VERIFIED_WITH_EXCEPTION → CLAIMED
 *              → PASSPORT_ISSUED → DELEGATED
 *
 * Distinct from `JourneyStageState`, and deliberately so. A stage STATE is a
 * rendering of one stage right now and may legitimately be READY, BLOCKED or
 * IN_PROGRESS. A MILESTONE is a constitutional fact about the subject that,
 * once reached, is never un-reached by a later stage's failure.
 *
 * Four of the five rungs correspond exactly to a `SettledPredicate`
 * (services/journey/settledFacts.ts): REGISTERED ← `is_registered`,
 * CLAIMED ← `control_is_proven`, PASSPORT_ISSUED ← `passport_is_issued`,
 * DELEGATED ← `delegation_is_granted`. VERIFIED has NO predicate, and that
 * absence is the point: verification enriches an agent's observable state, it
 * does not establish a constitutional fact about her (PRD-GJR-001 §3.7,
 * "transparency is a gateway, never a grant").
 */
export type JourneyMilestone =
  | 'REGISTERED'
  | 'VERIFIED'
  | 'VERIFIED_WITH_EXCEPTION'
  | 'CLAIMED'
  | 'PASSPORT_ISSUED'
  | 'DELEGATED';

export interface JourneyStageDefinition {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  actor: string;
  subjectRef: string;
  /**
   * One or more real, live surfaces composed together for this stage (§5.9 —
   * composition, never forking). The Companion/journey narration is always an
   * overlay on top of these — never counted as a "surface" itself.
   */
  surfaces: JourneySurfaceRef[];
  prerequisites: string[];
  permittedActions: string[];
  completionEvidence: string[];
  receiptTypes: string[];
  /**
   * Suppress the stage-level Evidence Receipts drawer (operator direction,
   * 2026-08-02). Set ONLY where the stage's own surface already surfaces its
   * receipts natively — Delegate, Deploy and aigentMe each render receipts in
   * their own modals, so the drawer beneath them is a second, redundant
   * rendering of the same evidence.
   *
   * This does NOT blank `receiptTypes`: which receipts a stage emits is a
   * fact about the stage and stays declared (the journey definition is read
   * by more than the drawer). Only the duplicate RENDERING is suppressed.
   */
  receiptsSurfacedNatively?: boolean;
  /**
   * Every action type in `receiptTypes` names the SUBJECT AGENT (never an
   * orchestrator) in `agentsInvoked` — set ONLY where this has been verified
   * true for every type in the list (operator directive, 2026-08-08:
   * "A registration receipt can satisfy an agent's Register stage iff the
   * receipt subject is that exact runtime agent").
   *
   * When true, the stage's Evidence Receipts drawer (StageReceiptsDrawer,
   * via JourneyRunSurface) additionally scopes its query to the currently
   * selected agent, so a persona that has acted on multiple agents (e.g. the
   * operator registering both Nakamoto and MoneyPenny) never sees one
   * agent's receipts while viewing another's stage — the defect that
   * surfaced on Register: MoneyPenny's `pending_registration` stage
   * displaying Aigent Nakamoto's `HORIZEN_AGENT_REGISTERED` receipt, because
   * `/api/assistant/receipts` filtered only by actionType and the ACTING
   * persona (the operator), never by the receipt's subject.
   *
   * Left `undefined`/`false` for stages whose receipt types are NOT
   * uniformly subject-tagged — e.g. Verify's `agreement_formed`/
   * `agreement_authorized` carry only `agentsInvoked: ['aigent-z']` (the
   * orchestrator), never the subject agent (constitutionalAgreement.ts).
   * Applying the filter there would silently hide those receipts for every
   * agent rather than fix the underlying gap, so it stays unset until that
   * write-side is separately corrected.
   */
  receiptsScopedToSubjectAgent?: boolean;
  /**
   * Which rung of the monotonic ladder this stage establishes, when it
   * establishes one. Stages that carry no constitutional milestone (Deploy,
   * Standing, aigentMe) leave it undefined rather than inventing a rung — the
   * ladder is the operator's five, not one-per-stage.
   */
  milestone?: JourneyMilestone;
  companion: { before: string; during?: string; complete: string; refused?: string };
  /**
   * The top-row rotating narrator (Threshold Guide header compaction,
   * 2026-08-10) — two terse phrases, alternated by `RotatingStatusLine`:
   * what is currently happening, and the constitutional consequence that
   * act has (or will have). Deliberately distinct from `companion` above,
   * which is longer-form prose for a different surface (the companion
   * chat/narration overlay) — this is a one-line label, not a sentence.
   * Optional: a journey that omits it (e.g. Validation Programme) falls
   * back to rendering the stage's own `description` instead, unchanged.
   */
  narrator?: { active: string; consequence: string };
  /**
   * A POST-ACTIVATION BRANCH, not a step on the admission line (operator
   * ruling, 2026-08-03).
   *
   * The admission spine — Register -> Claim -> Passport -> Delegate ->
   * aigentMe — establishes the agent and its bounded authority, and is
   * linear. After it, two INDEPENDENT branches run in parallel and neither
   * gates the other:
   *
   *   'factory'    — ingestion into the agent factory / iQube Registry.
   *                  Establishes PARTICIPATION and Standing ELIGIBILITY.
   *   'capability' — Pulse / P&L verification. Establishes eligibility for
   *                  the financial-services runtime and other specialists.
   *
   * These are distinct state AXES, deliberately not collapsed into one
   * blocking sequence. Verify sat at position 2 of the spine and, because a
   * local table was missing, immobilised Claim, Passport, delegation and
   * activation — an optional partner enrichment holding personhood hostage.
   *
   * A branch stage carries no `nextStageId`: nothing waits on it.
   */
  branch?: 'factory' | 'capability';
  nextStageId?: string;
  /**
   * Consequence Fork rendering hint (Threshold Journey — Orient + Consequence
   * Fork, 2026-08-09) — presentation-only, never a completion/gating input.
   *
   * Purely additive: undefined for every stage on the linear admission spine
   * and for any journey that has not opted in. `JourneyRunSurface` renders
   * the spine exactly as before for those stages; only stages that declare a
   * position are grouped into a three-pronged fork after the spine ends.
   * Which stages actually branch, and what (if anything) gates them, is
   * still entirely `prerequisites`/`completionEvidence` — this field decides
   * WHERE a stage's node is drawn, never whether it is reachable or
   * complete. A stage may carry `branch` (a state-axis grouping, see above)
   * and `forkPosition` (a rendering position) independently — neither
   * implies the other.
   */
  forkPosition?: 'upper' | 'middle' | 'lower';

  // JOURNEY SPINE EXTENSIONS — below this line (backward compatible; optional fields)
  /**
   * Step requirement classification (SPEC-JS-001 §6, JS-LAW-002).
   * Defaults to 'required' for backward compatibility with existing journeys.
   */
  requirement?: StepRequirement;

  /**
   * Generic condition expression for stage satisfaction (SPEC-JS-001 §6).
   * If provided, evaluated alongside completionEvidence.
   * Maps to authoritative sources; never manufactures authorization.
   */
  satisfactionCondition?: ConditionExpression;

  /**
   * Dependency graph expressions (SPEC-JS-001 §7).
   * Allows DAG structure vs. linear prerequisites.
   * Evaluated alongside prerequisites for backward compatibility.
   */
  dependencies?: ConditionExpression[];

  /**
   * Explicit actor role typing (SPEC-JS-001 §14.2).
   * Distinguishes principal, delegate, either, system, counterparty.
   */
  actorRole?: ActorRole;

  // SURFACE INDEPENDENCE — below this line (backward compatible; optional fields)
  /**
   * Surface Independence of Constitutional Acts (operator directive,
   * 2026-08-26): which channel(s) may ORIGINATE the evidence that satisfies
   * this stage. Absence (undefined) preserves existing behaviour exactly —
   * every existing journey definition that omits this field is a native-UI-
   * only stage, unchanged.
   *
   * This is an ORIGINATION contract only, never a resolution one:
   * `resolveJourneyState` stays channel-blind (SPEC-JS-001 §9) and reads
   * ONLY the authoritative platform state, regardless of which channel wrote
   * it. Declaring 'mcp' here means an MCP tool is PERMITTED to invoke the
   * same canonical service a native surface would; it never lets the MCP
   * layer mark a stage complete by assertion. The evidence must still land
   * in the exact same authoritative record either surface writes to — see
   * services/threshold/mcpConstitutionalActs.ts for the OCSGA acceptance
   * case wiring this first.
   */
  completionChannels?: Array<'native-ui' | 'mcp' | 'agent' | 'system'>;
  /**
   * Origination requirements for a channel declared MCP/agent-eligible above
   * — the evidentiary floor an out-of-band origination must still clear.
   * Deliberately minimal: this is NOT a second authorization framework. It
   * names what an MCP-originating write tool must have obtained BEFORE it
   * may call the same canonical service a native surface calls — never a
   * substitute for that canonical service's own checks (actorType==='principal',
   * membership, exchange status, etc.), which remain the real enforcement and
   * run unchanged regardless of origin channel.
   */
  originRequirements?: {
    /** The stage requires an explicit, non-inferred consent action from the
     *  principal — never inferred from conversational prose (constitutional
     *  invariant 4, 2026-08-26 directive). */
    explicitPrincipalConsent?: boolean;
    /** Reserved for a future channel that can produce a real cryptographic
     *  principal signature over the declaration (unused by the OCSGA MCP
     *  pilot, which uses authenticated-principal attestation instead — see
     *  the origin-channel labelling in types/reciprocalExchange.ts). */
    principalSignatureRequired?: boolean;
    /** Bounded-authority MCP tools must resolve real, scoped, delegated
     *  authority (the T0<->T2 session seam) before writing — never a
     *  client-asserted identity. */
    boundedAuthorityRequired?: boolean;
    /** Receipt/act types the authoritative write must produce for THIS
     *  stage's evidence to be honestly satisfied, regardless of channel. */
    requiredReceiptTypes?: string[];
  };
}

/**
 * Journey Runtime copilot invariant (item 1, semantic repair 2026-08-25).
 *
 * Every Journey has exactly one guide/copilot identity, resolved from the
 * CANONICAL cartridge copilot configuration (`data/codex-configs.ts`'s
 * `CodexConfig.copilot`) — a REFERENCE, never a hand-copied agent id/name/
 * accentColor. `services/journey/journeyCopilotResolver.ts`'s
 * `resolveJourneyCopilot()` is the ONE place a journey's copilot identity is
 * actually resolved; it throws (fails visibly, never guesses) if
 * `cartridgeSlug` doesn't resolve to a cartridge with a configured
 * `copilot.agent`. `promptPlaceholder`/`quickPrompts` may be overridden per
 * journey — the agent identity (id/name) and its accentColor never are,
 * since those are what make the guide recognizable across surfaces.
 */
export interface JourneyCopilotReference {
  /** The cartridge (`data/codex-configs.ts` `CodexConfig.slug`) whose canonical `copilot` config this journey's guide resolves from. */
  cartridgeSlug: string;
  /** Journey-specific override — the resolved agent identity/accentColor are never overridden. */
  promptPlaceholder?: string;
  /** Journey-specific override — the resolved agent identity/accentColor are never overridden. */
  quickPrompts?: string[];
}

export interface JourneyDefinition {
  id: string;
  version: string;
  label: string;
  partner?: string;
  destination?: string;
  subjectRef: string;
  stages: JourneyStageDefinition[];
  /**
   * Optional definitional phase groupings (SPEC-JS-001 §9) — which stage ids
   * belong to which named phase, and that phase's own completion condition.
   * Additive: a journey definition that omits this is unaffected. Distinct
   * from JourneyRuntimeState.phases (JourneyPhase[] below), which records
   * resolved runtime/history; this field is the static grouping a resolver
   * or renderer can consume to label progress by phase rather than raw
   * stage id.
   */
  phases?: JourneyPhase[];
  /**
   * The journey's copilot/guide identity — a Journey Runtime invariant
   * (item 1, 2026-08-25). Required: `JourneyRunSurface` mounts exactly one
   * shared floating copilot for the whole journey spine from this
   * reference, replacing the per-page duplicate copilot mounts every
   * journey previously had to build for itself.
   */
  copilot: JourneyCopilotReference;
}

export interface JourneyStageRuntimeState {
  stageId: string;
  state: JourneyStageState;
  evidencePresent: string[];
  evidenceMissing: string[];
  receiptRefs: string[];
  refusalReason?: string;
}

export interface JourneyRuntimeState {
  journeyId: string;
  journeyVersion: string;
  subjectRef: string;
  currentStageId: string;
  stages: JourneyStageRuntimeState[];
  complete: boolean;

  // JOURNEY SPINE EXTENSIONS — below this line (backward compatible; optional fields)
  targetStageId?: string; // Declared destination (SPEC-JS-001 §1)
  phases?: JourneyPhase[]; // Versioning/history (SPEC-JS-001 §9, JS-LAW-007)
  lastUpdatedAt?: string; // When state last changed
  interactionContext?: InteractionContext; // Mutual awareness projection
  /**
   * OCSGA early invitation entry (2026-08-25) — the Reciprocal Artifact
   * Exchange (PRD-IRL-AX-001) this participant is associated with, either
   * party, as resolved by the Ian journey's own state route from the
   * canonical `listMyExchanges` read. `null`/absent means no invitation has
   * been associated yet. Constitutional distinction: an associated invite is
   * a collaboration/admission context — it must never be read as proof of
   * personhood, Passport issuance, delegation, or artifact/exchange
   * completion evidence; those each have their own dedicated evidence keys.
   * Currently populated only by app/api/journey/ian/state/route.ts — every
   * other journey simply never sets it.
   */
  activeExchangeId?: string | null;
  /**
   * OCSGA early invitation entry (2026-08-25) — whether the operator holds a
   * USABLE Polity Citizen Passport, resolved server-side via the SAME
   * canonical read app/api/journey/moneypenny-horizen/state/route.ts already
   * uses (services/identity/passportPrincipal.ts's
   * `loadUsableCitizenPassportForAuthProfile` + `isPassportUsable`) — never
   * re-derived from a stage's own `evidencePresent` array, whose field names
   * are keyed to each journey's own `completionEvidence` declarations rather
   * than a stable cross-journey contract. Currently populated only by Ian's
   * OCSGA journey route.
   */
  citizenPassportUsable?: boolean;
  /**
   * OCSGA Presence recognition fix (2026-08-27) — the recognized Citizen
   * Passport's class and T2-safe public reference (services/identity/
   * passportPrincipal.ts's `personaPublicRef` — NEVER the raw Passport
   * UUID), populated only when `citizenPassportUsable` is true. Lets a
   * recognized-state UI (PassportBureauApplyTab's "you already hold a
   * Passport" banner) name WHAT was recognized instead of a bare boolean.
   * `null` when no usable Citizen Passport was found.
   */
  citizenPassportClass?: string | null;
  citizenPassportRef?: string | null;
  /**
   * OCSGA structural admission fix (2026-08-26) — whether this participant's
   * Reciprocal Artifact Exchange membership was recognized/provisioned via
   * an active `research-lab` CAS grant scoped to the OCSGA workspace (as
   * opposed to a manually-entered `rax-` invitation code, or not admitted
   * at all). Distinct from `activeExchangeId` (which only says an exchange
   * IS associated, not how): this tells a surface like
   * `IanOrientationPanel` whether it may honestly say "your Research Lab
   * grant admitted you" instead of implying the participant typed an
   * invitation code. `undefined`/absent means not evaluated (no persona, or
   * a journey that hasn't wired this check) — never coerced to `false`.
   * Currently populated only by app/api/journey/ian/state/route.ts, via
   * services/journey/boundaryResearchExchangeAdmission.ts.
   */
  ocsgaGrantAdmitted?: boolean;
}

export interface CompanionJourneyContext {
  journeyId: string;
  journeyVersion: string;
  stageId: string;
  stageState: JourneyStageState;
  subjectRef: string;
  actorRef: string;
  partner?: string;
  destination?: string;
  authoritySummary: {
    control: 'unverified' | 'verified';
    authority: 'none' | 'pending' | 'bounded';
    mandate: 'none' | 'pending' | 'active' | 'expired';
  };
  missingRequirements: string[];
  availableActions: string[];
  receiptRefs: string[];
}

/**
 * Bounded Companion intents (§11.1) — the Guided Sovereignty Principle (§5.4)
 * enforced in the type, not merely by convention. Sovereign acts (accepting a
 * passport, claiming an agent, granting delegation, approving a mandate) have
 * NO code path here — they are structurally absent, not merely forbidden.
 * REQUEST_SOVEREIGN_ACTION only ever surfaces the act for the human operator
 * to perform through the real surface underneath; it never performs it.
 */
export type CompanionJourneyIntent =
  | 'EXPLAIN_STAGE'
  | 'OPEN_SURFACE'
  | 'PREPARE_ACTION'
  | 'SHOW_EVIDENCE'
  | 'SHOW_REFUSAL'
  | 'REQUEST_SOVEREIGN_ACTION';

/**
 * JOURNEY SPINE EXTENSIONS (SPEC-JS-001) — below this line are types that
 * extend the Guided Journey Runtime into Journey Spine. These are additive
 * to the existing contract and maintain backward compatibility.
 */

/**
 * Actor role semantics — distinguishes principal, delegate, and system actors.
 * PURELY DESCRIPTIVE: a display/documentation label a stage carries, never
 * itself a runtime gate — resolveJourneyState never reads it
 * (tests/threshold-mcp-constitutional-rituals.test.ts's own canary asserts
 * this). Any actual authorization for a specific act lives in that act's own
 * canonical service function (e.g. services/research/reciprocalExchange.ts),
 * never here.
 *
 * See SPEC-JS-001 §14.2. Corrected 2026-08-30: this previously also cited a
 * CLAUDE.md "Artifact Deposit Actor" constraint — no such numbered
 * constraint exists in CLAUDE.md, and the citation was found dangling by a
 * constitutional audit (codexes/packs/agentiq/updates/2026-08-30_ocsga-
 * delegated-completion-and-ctp-001-delegability-correction.md). Delegability
 * is explicit authority, not an exception to constitutional action —
 * non-delegability requires an explicit constitutional basis (a ratified
 * invariant, PRD, or spec text), never an assumption encoded only as a
 * comment.
 */
export enum ActorRole {
  PRINCIPAL = 'principal',
  DELEGATE = 'delegate',
  EITHER = 'either',
  SYSTEM = 'system',
  COUNTERPARTY = 'counterparty',
}

/**
 * Step requirement classification — determines whether a step is mandatory,
 * optional, conditional, or future. Replaces binary "must do/must not do" with
 * nuanced progression semantics (SPEC-JS-001 §2, JS-LAW-002).
 */
export enum StepRequirement {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
  CONDITIONAL = 'conditional',
  FUTURE = 'future',
}

/**
 * Extended step state model (SPEC-JS-001 §8, JS-LAW-008).
 * Distinguishes waiting/blocked/refused states to prevent "incomplete progress bar" UX.
 */
export enum StepState {
  COMPLETE = 'complete',
  READY = 'ready',
  OPTIONAL = 'optional',
  WAITING = 'waiting',
  BLOCKED = 'blocked',
  FUTURE = 'future',
  REFUSED = 'refused',
  SUPERSEDED = 'superseded',
}

/**
 * Generic condition expression for satisfaction/dependency evaluation.
 * Maps to authoritative state sources; does not manufacture authorization.
 * Adapter pattern (SPEC-JS-001 §1). Corrected 2026-08-30: the "CLAUDE.md
 * constraint 1" this used to also cite does not exist — see ActorRole's own
 * doc comment above for the same correction and its source.
 *
 * Examples:
 *   { type: 'settled-fact', value: 'is_registered' }
 *   { type: 'receipt', value: 'horizen_agent_registered' }
 *   { type: 'composite', operator: 'and', operands: [...] }
 */
export type ConditionExpression = {
  type: 'settled-fact' | 'receipt' | 'composite' | 'boolean';
  value?: string; // field name (settled fact), receipt type, or boolean literal
  operator?: 'and' | 'or' | 'not';
  operands?: ConditionExpression[];
};

/**
 * Experience intent with explicit provenance — declared, observed, and inferred
 * are kept separate (SPEC-JS-001 §10.1-10.3, JS-LAW-006).
 */
export interface ExperienceIntentProjection {
  declaredPreferences?: Record<string, unknown>;
  observedBehavior?: Record<string, unknown>;
  inferredPreferences?: Array<{
    preference: Record<string, unknown>;
    confidence: number;
    rationale: string;
  }>;
  provenance: {
    declared: string[]; // source references
    observed: string[]; // event types / behavior signals
    inferred: string[]; // inference rule ids
  };
}

/**
 * Authority projection — what the owning capability permits, not Journey Spine policy.
 * Explicitly separates recommendation from authorization (SPEC-JS-001 §18).
 */
export interface AuthorityProjection {
  permitted: boolean;
  reason?: string;
  principalRequired?: boolean;
  delegateMayAssist?: boolean;
  delegateMaySign?: boolean;
}

/**
 * Delegation context — active delegation info, if applicable.
 */
export interface DelegationProjection {
  active: boolean;
  agentId?: string;
  scope?: string;
}

/**
 * Mutual awareness projection (SPEC-JS-001 §5) — bounds what Companion, Experience,
 * and future Differ/Adaptive Engine can consume without coupling them or leaking
 * authorization decisions into multiple independent systems.
 *
 * CRITICAL: `recommendedNextActions` ≠ `authorityContext.permitted`
 * Journey Spine may recommend what to do; Constitutional Computing decides what you can do.
 */
export interface InteractionContext {
  participantRef: string;
  personaRef?: string;
  journeyId: string;
  journeyVersion: string;
  currentStageId: string;
  targetStageId?: string;

  // Stage readiness — canonical UX state model
  readyStageIds: string[];
  completedStageIds: string[];
  waitingStageIds: string[];
  blockedStageIds: string[];
  optionalStageIds: string[];
  futureStageIds?: string[];

  // Capability availability — what surfaces exist
  availableCapabilities: string[];

  // Required conditions for progression — what must be true
  requiredConditions: ConditionExpression[];

  // Authority context — from owning capability, never manufactured by Journey Spine
  authorityContext?: AuthorityProjection;

  // Delegation state if applicable
  delegationContext?: DelegationProjection;

  // Experience signals with explicit provenance
  experienceIntent?: ExperienceIntentProjection;

  // Recommendations (clearly labeled as such)
  recommendedNextActions?: string[];

  // Companion integration seam
  companionGuidance?: {
    currentPhase: string;
    explanation: string;
    nextSteps?: string[];
  };

  // Presentation hints for future Differ
  presentationHints?: Array<{
    layout?: 'linear' | 'dag' | 'graph';
    density?: 'compact' | 'normal' | 'detailed';
    mode?: 'modal' | 'embedded' | 'cartridge';
  }>;
}

/**
 * Journey phase — supports versioning and history (SPEC-JS-001 §9, JS-LAW-007).
 * Allows evolution (v1 → v2 → v3) while preserving historical phase evidence.
 */
export interface JourneyPhase {
  version: string;
  activeSince: string;
  title: string;
  description?: string;
  stageIds: string[];
  completionCondition: ConditionExpression;
  supersededBy?: string;
}
