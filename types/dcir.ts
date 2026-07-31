/**
 * Dynamic Constitutional Interaction Runtime (DCIR) — the canonical type
 * contract. Operation Chrysalis 2.0 Phase 3, CFS-020, increment D0.
 *
 * Contract-first, façade-not-fork: this file is the D0 CONTRACT only — no
 * runtime code lives here (types + pinned consts, nothing else). The organs
 * DCIR unifies already exist in production (see the `@organ` notes below and
 * CFS-020 §8's honest inventory); D1+ implementations enter by composing over
 * those organs, never by parallel implementation (the identity-spine rule
 * applied to interaction). Order constants are constitutional data
 * (sequencing corollary of Law XV) and are canary-pinned in
 * tests/constitutional-contracts.test.ts.
 *
 * Constitutional cautions baked into this contract (CFS-020, non-negotiable):
 *   1. Behavioural invariants are OBSERVED, never auto-canonical — the
 *      `BehaviouralInvariant.status` union deliberately cannot express
 *      'canonical' (inv.cybernetics.111: adaptation never bypasses
 *      ratification; inv.interaction.115).
 *   2. Affordances carry their constitutional basis and their capsule scope —
 *      they emerge WITHIN the operator's active context, never as orphan
 *      output (Content Capsule Containment, CLAUDE.md GOLDEN RULE;
 *      inv.interaction.117).
 *   3. The event stream is identifier-tier-disciplined from birth: T0
 *      identifiers (personaId, authProfileId, rootDid) NEVER appear in a
 *      DcirEvent — events carry T2-safe summaries and T1 display context
 *      only (Identity & Access Spine tiers).
 *   4. DCIR ships observe-mode-first (the CFS-017 precedent): observation
 *      instrumentation never blocks or mutates the surfaces it watches until
 *      gating is separately ratified.
 *
 * Pattern source: types/constitutional.ts (Chrysalis contract file discipline).
 */

// ---------------------------------------------------------------------------
// §0 The closed loop and the runtime domains (order pinned — canary-guarded)
// ---------------------------------------------------------------------------

/**
 * The DCIR closed bidirectional cognitive-action loop. Generation is never
 * terminal — it is a state transition: the loop runs continuously until the
 * constitutional objective is satisfied (inv.interaction.118). Order is
 * constitutional data; the canary pins it.
 */
export const DCIR_LOOP = [
  'conversation',
  'inference',
  'action',
  'observation',
  'state-update',
  'recommendation',
] as const;

export type DcirLoopStage = (typeof DCIR_LOOP)[number];

/**
 * The three DCIR runtime domains. Conversational (intent/reasoning → Intent
 * Objects, Context Objects, Recommendations, Policies, Confidence) and Action
 * (deterministic execution → artefacts) exist today in partial form; the
 * Observation Runtime is the missing third domain — it watches conversation,
 * tool outputs, documents, selection, editing, approval/rejection, undo,
 * navigation, workflow progress, and system events, making everything
 * observable. Order is constitutional data; the canary pins it.
 */
export const DCIR_RUNTIMES = ['conversational', 'action', 'observation'] as const;

export type DcirRuntime = (typeof DCIR_RUNTIMES)[number];

// ---------------------------------------------------------------------------
// §1 The event stream — the language of observation (tier-disciplined)
// ---------------------------------------------------------------------------

/**
 * Everything the Observation Runtime watches becomes an event. The kind
 * union is the operator's event vocabulary (CFS-020 §5): document lifecycle,
 * selection/editing, recommendation and artefact dispositions, undo,
 * navigation, workflow progress, tool outputs, conversation turns, persona
 * changes, and system events. Extend by appending — never repurpose a kind.
 */
export type DcirEventKind =
  | 'DocumentCreated'
  | 'DocumentEdited'
  | 'SelectionChanged'
  | 'RecommendationAccepted'
  | 'RecommendationRejected'
  | 'ArtifactApproved'
  | 'ArtifactRejected'
  | 'UndoPerformed'
  | 'NavigationOccurred'
  | 'WorkflowAdvanced'
  | 'ToolOutputProduced'
  | 'ConversationTurn'
  | 'PersonaChanged'
  | 'SystemEvent';

/**
 * Identifier-exposure tier of an event payload (Identity & Access Spine).
 * 't1-browser-safe' events may carry display labels and cartridge flags;
 * 't2-network-safe' events are the ONLY ones eligible for DVN anchoring and
 * carry commitments/summaries exclusively. There is deliberately no T0 tier:
 * a DcirEvent must never contain personaId, authProfileId, or rootDid.
 */
export type DcirEventTier = 't1-browser-safe' | 't2-network-safe';

export interface DcirEvent {
  /** Event id (server-issued). */
  id: string;
  kind: DcirEventKind;
  /** Which runtime domain emitted the event. */
  runtime: DcirRuntime;
  /**
   * T2-safe summary — category labels and commitment refs only, NEVER raw
   * identifiers or payload values (the activity-receipt `context_shared`
   * discipline generalized to the event stream).
   */
  summary: string;
  /** Tier marker — the payload's exposure ceiling, stamped at emission. */
  tier: DcirEventTier;
  /** Artefact commitment refs this event concerns (never raw storage URLs). */
  artefactRefs: string[];
  /**
   * Capsule/scope the event occurred within (capsule containment: derived
   * output renders inside the originating context, never orphaned).
   */
  capsuleScope: string | null;
  /** ISO timestamp. */
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// §2 Constitutional State — what replaces conversation history
// ---------------------------------------------------------------------------

/**
 * Intent Object — the Conversational Runtime's primary product. Every
 * conversational turn updates the constitutional state through one of these
 * (inv.interaction.112).
 * @organ services/iqube/intentQube.ts + services/devCommandCenter/
 *        stageOrchestrator.ts intent proposals (production partial forms)
 */
export interface IntentObject {
  id: string;
  /** The inferred intent, stated. */
  statement: string;
  /** Inference confidence 0..1 — honest, never defaulted to 1. */
  confidence: number;
  /** Where the intent came from. */
  source: 'conversation' | 'observation' | 'operator-explicit';
  status: 'active' | 'satisfied' | 'superseded' | 'abandoned';
}

/**
 * The Constitutional State snapshot — the single evolving state that
 * replaces conversation history as the reasoning substrate (CFS-020 §4).
 * Field list is the operator's; shapes are deliberately loose at D0 —
 * each field names the concern honestly and hardens in the increment that
 * implements its engine (D2), never before. `unknown` here means "the D2
 * Constitutional State Engine owns this shape", not "anything goes".
 */
export interface ConstitutionalStateSnapshot {
  /** Active Intent Objects — the loop's steering signal. */
  intent: IntentObject[];
  /** Operator goals in play (D2 hardens against experience_goals). */
  goals: unknown[];
  /** Governing policies (resolved constitutional policies, not free text). */
  policies: unknown[];
  /** Active constraints (capsule scope, tier ceilings, gating). */
  constraints: unknown[];
  /** Artefact commitment refs currently in the reasoning context —
   * every generated artefact lands here (inv.interaction.114): generate a
   * PDF and "make page three shorter" already knows which document,
   * version, and section. */
  activeArtefacts: string[];
  /** Prior artefact refs — superseded but reachable (lineage kept). */
  previousArtefacts: string[];
  /** Operator decisions observed (approvals, rejections, edits, undo). */
  operatorDecisions: unknown[];
  /** T1 persona surface ONLY — displayLabel + cartridgeFlags shape.
   * NEVER personaId/authProfileId/rootDid (T0 stays server-internal). */
  persona: { displayLabel: string; cartridgeFlags: Record<string, unknown> } | null;
  /** Standing summary (the flywheel's consequence axis). */
  standing: unknown;
  /** Operator preferences in effect. */
  preferences: unknown;
  /** Loop-level confidence 0..1 — how sure the runtime is about state. */
  confidence: number;
  /** Task graph — work decomposition (D2 hardens against intents/NBE). */
  taskGraph: unknown;
  /** Experience graph — journey/depth position (D2 hardens against
   * journey_states + the experience depth ladder). */
  experienceGraph: unknown;
  /** Workflow position (stage strips, lifecycle states). */
  workflow: unknown;
  /** ISO timestamp of the snapshot. */
  capturedAt: string;
}

// ---------------------------------------------------------------------------
// §3 Recommendations and affordances — generated, never static
// ---------------------------------------------------------------------------

/**
 * A recommendation is contextual to the CURRENT constitutional state —
 * never generated from conversation history alone (inv.interaction.116).
 */
export interface Recommendation {
  id: string;
  /** What is recommended, operator-readable. */
  action: string;
  /** Recommendation confidence 0..1. */
  confidence: number;
  /**
   * The contextual basis — WHICH state produced this recommendation.
   * Refs into the snapshot: intent ids, artefact refs, event ids. A
   * recommendation without a basis is constitutionally invalid.
   */
  contextualBasis: {
    intentIds: string[];
    artefactRefs: string[];
    eventIds: string[];
  };
  status: 'proposed' | 'accepted' | 'rejected' | 'expired';
}

/**
 * A UI affordance generated from inferred intent — recommendation engine,
 * not toolbar (inv.interaction.117). Every affordance carries its
 * constitutional basis AND its capsule scope: it emerges within the
 * operator's active context, never as orphan output (Capsule Containment
 * GOLDEN RULE).
 */
export interface Affordance {
  id: string;
  /** Operator-facing label. */
  label: string;
  /** Affordance surface kind (chip, pill CTA, inline action, layout). */
  kind: 'chip' | 'cta' | 'inline-action' | 'layout';
  /** The constitutional basis this affordance was generated FROM. */
  constitutionalBasis: {
    intentId: string | null;
    artefactRefs: string[];
    workflowStage: string | null;
    /** T1 cartridge flags consulted (e.g. isAdmin) — flags, never ids. */
    personaFlags: string[];
  };
  /** The capsule/context this affordance renders WITHIN — required: an
   * affordance with no scope is orphan output and must not render. */
  capsuleScope: string;
}

// ---------------------------------------------------------------------------
// §4 Behavioural invariants — observed patterns, never rules
// ---------------------------------------------------------------------------

/**
 * A behavioural invariant is an OBSERVED constitutional pattern discovered
 * by the Observation Runtime (e.g. "operator always edits before
 * approving") — NOT a rule (inv.interaction.115). Ratification boundary:
 * the status union deliberately cannot express 'canonical'. Observation may
 * promote 'observed' → 'proposed' (entering the substrate as a distinct
 * proposed class); canonization is the operator's act alone, recorded in
 * the invariant substrate — never in this type (inv.cybernetics.111:
 * constitutional adaptation never bypasses ratification).
 */
export interface BehaviouralInvariant {
  id: string;
  /** The observed pattern, stated as one sentence. */
  pattern: string;
  /** How many independent observations support the pattern. */
  evidenceCount: number;
  /** Event ids constituting the evidence (T2-safe refs). */
  evidenceEventIds: string[];
  /** 'observed' (runtime-local) or 'proposed' (submitted to the substrate
   * for operator ratification). 'canonical' is unrepresentable here BY
   * DESIGN — see the interface doc above. */
  status: 'observed' | 'proposed';
  /** ISO timestamp of first observation. */
  firstObservedAt: string;
}
