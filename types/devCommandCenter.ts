/**
 * Development Command Center types — Operation Chrysalis Phase 1
 *
 * Data contracts for the five MVP capabilities:
 * 1. Intent Distillation Engine
 * 2. Context Pack Generator
 * 3. Capability Gap Analyzer
 * 4. Consequence Canvas
 * 5. Post-Prompt Consequence Validator
 */

import type { AgentRoleId } from './orchestration';
import type { InvariantDevelopmentEnvelope } from './invariantEnvelope';

// ─── Capability 1: Structured Development Intent ────────────────────────────

export interface StructuredDevIntent {
  intentId: string;
  rawInput: string;
  goal: string;
  users: string[];
  constraints: string[];
  desiredOutcomes: string[];
  successCriteria: string[];
  relatedVentures: string[];
  relatedCartridges: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'draft' | 'refined' | 'approved' | 'in_progress' | 'validated' | 'complete';
  createdAt: string;
  updatedAt: string;
}

// ─── Capability 2: Context Pack ─────────────────────────────────────────────

export type ContextSourceKind =
  | 'prd'
  | 'architecture'
  | 'update'
  | 'cartridge'
  | 'governance'
  | 'registry_asset'
  | 'prior_decision'
  | 'receipt'
  | 'codebase'
  | 'claude_md';

export interface ContextPackItem {
  sourceKind: ContextSourceKind;
  sourcePath: string;
  title: string;
  relevanceScore: number;
  excerpt: string;
  reuseSignal: 'reuse' | 'extend' | 'reference';
}

export interface ContextPack {
  intentId: string;
  items: ContextPackItem[];
  assembledAt: string;
  totalTokenEstimate: number;
  reuseFirst: ContextPackItem[];
  extendSecond: ContextPackItem[];
  buildNewLast: ContextPackItem[];
}

// ─── Capability 3: Capability Gap Analysis ──────────────────────────────────

export interface ExistingCapability {
  name: string;
  location: string;
  description: string;
  reuseStrategy: 'use_directly' | 'extend' | 'wrap' | 'adapt';
  confidence: number;
}

export interface MissingCapability {
  name: string;
  description: string;
  estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large';
  dependencies: string[];
  suggestedLocation: string;
  /**
   * Homecoming III Phase 4 — THE CAUSAL SPLIT (PRD §15).
   *
   * `causalRequirement` is the condition that must hold for the intended
   * consequence to occur. `implementationMechanism` is one way of making it
   * hold. They are separate fields because they are separate KINDS of thing,
   * and the failure mode this prevents is recording the mechanism as though it
   * were the requirement:
   *
   *   mechanism   "a scheduler"
   *   requirement "submitted state eventually becomes independently observable
   *                to dependent consumers"
   *
   * A scheduler is not an invariant. It is one implementation of one. Record
   * the mechanism as the requirement and the invariant registry fills with
   * implementation choices, which cannot be reused, cannot be falsified, and
   * go stale the moment the mechanism is replaced.
   *
   * THE TEST OF A CORRECTLY-STATED REQUIREMENT: substitute a different
   * mechanism and the requirement must survive unchanged. A polling consumer,
   * a webhook and a scheduler are three mechanisms for the observability
   * requirement above; if swapping them alters the requirement's meaning, the
   * requirement was really a mechanism. Canaried in
   * tests/gap-analysis-causal-split.test.ts.
   *
   * Optional so existing gap analyses remain valid without migration; absence
   * means the split was never made, which is honest for a pre-Phase-4 record.
   */
  causalRequirement?: string;
  /** The proposed way to satisfy `causalRequirement`. Replaceable by design. */
  implementationMechanism?: string;
}

export interface CapabilityGapAnalysis {
  intentId: string;
  existing: ExistingCapability[];
  missing: MissingCapability[];
  reuseRatio: number;
  analysedAt: string;
}

// ─── Capability 4: Consequence Canvas ───────────────────────────────────────

export interface ConsequenceEntry {
  id: string;
  description: string;
  category: 'workflow' | 'data' | 'governance' | 'permission' | 'integration' | 'user_experience';
  severity: 'critical' | 'high' | 'medium' | 'low';
  /**
   * Homecoming III Phase 4 — falsification binding (PRD §16).
   *
   * PRESENT ONLY WHERE A CAUSAL PROPOSITION IS ACTUALLY BEING TESTED
   * (operator ruling, 2026-08-15). Most consequences are ordinary: "the tab
   * renders the new column", "the operator sees a confirmation". They assert
   * nothing causal, so they carry no binding.
   *
   * Forcing an invariant ref onto every consequence would manufacture causal
   * claims to satisfy a schema — and a registry of manufactured claims is
   * worse than none, because each one looks like evidence. Optional is the
   * point, not a convenience.
   */
  falsification?: ConsequenceFalsificationBinding;
}

/**
 * Binds a material causal assumption to what would prove it wrong.
 *
 * The chain the operator specified:
 *
 *   invariant / candidate → expected consequence → prohibited consequence
 *                         → observable falsifier → required evidence
 *
 * `invariantRef` may name an established invariant OR a live candidate; which
 * it is travels in the envelope's own lifecycle data, not here — this binding
 * does not re-state standing and must never be read as conferring it.
 */
export interface ConsequenceFalsificationBinding {
  /** The invariant or candidate whose truth this consequence tests. */
  invariantRef: string;
  /** What must be observable if it holds. */
  expectedConsequence: string;
  /** What must never be observable. */
  prohibitedConsequence: string;
  /** The observation that would falsify it. */
  observableFalsifier: string;
  /** Where that observation would be read from. */
  requiredEvidence: string[];
}

export interface ConsequenceCanvas {
  intentId: string;
  shouldHappen: ConsequenceEntry[];
  shouldNeverHappen: ConsequenceEntry[];
  workflowsActivated: string[];
  systemsAffected: string[];
  permissionsRequired: string[];
  successState: string;
  createdAt: string;
}

// ─── Capability 5: Consequence Validation ───────────────────────────────────

export type ValidationVerdict = 'satisfied' | 'unresolved' | 'unintended' | 'partial';

export interface ConsequenceValidationItem {
  consequenceId: string;
  description: string;
  verdict: ValidationVerdict;
  evidence: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ConsequenceValidationReport {
  intentId: string;
  canvasId: string;
  satisfied: ConsequenceValidationItem[];
  unresolved: ConsequenceValidationItem[];
  unintended: ConsequenceValidationItem[];
  workflowImpacts: string[];
  governanceImpacts: string[];
  testingRequirements: string[];
  overallVerdict: 'pass' | 'partial' | 'fail';
  validatedAt: string;
}

// ─── Constitutional Development Environment (CDE) — Remediation (ICE-7) ──────

/**
 * A single remedy for a failed / partially-failed consequence surfaced by the
 * Constitutional Validation stage. `learningNote` is the feedback-loop-for-
 * learning the operator asked for: the captured lesson from this remediation.
 */
export interface RemediationEntry {
  consequenceId: string;
  description: string;
  remedy: string;
  learningNote: string;
}

export interface RemediationPlan {
  intentId: string;
  remedies: RemediationEntry[];
  residualRisk: string;
  /** When true the loop returns to Constitutional Validation for a re-check;
   *  when false the operator has accepted residual risk and the loop proceeds. */
  revalidationRequired: boolean;
  createdAt: string;
}

// ─── CDE — Deployment Authorization (ICE-8) ─────────────────────────────────

/**
 * The authorization record for deployment. Execution stays human under CFS-016
 * D1 — this is the constitutional authorization record, not an executor. The
 * code runs in Claude Code; the receipt is the provenance that the consequence
 * test passed before deployment was authorized.
 */
export interface DeploymentAuthorization {
  intentId: string;
  authorized: boolean;
  constitutionalThresholdMet: boolean;
  rationale: string;
  /** Consequence ids still blocking deployment (empty when threshold met). */
  blockingConsequences: string[];
  authorizedAt: string;
}

// ─── Dev Receipts (three constitutional classes) ────────────────────────────

export type DevReceiptClass = 'development' | 'constitutional' | 'deployment';

/**
 * A receipt recorded during the dev loop. Extended from a bare id string to a
 * typed record so the Dev Receipts panel can group by constitutional class
 * (the receipt bug: nothing ever mutated `receipts`, so the panel was always
 * empty — every constitutional action now pushes its returned receiptId here).
 */
export interface DevLoopReceipt {
  id: string;
  actionType: string;
  class: DevReceiptClass;
  at: string;
}

// ─── Development Loop State ─────────────────────────────────────────────────

export type DevLoopStage =
  | 'intent_capture'
  | 'context_assembly'
  | 'gap_analysis'
  | 'consequence_modeling'
  | 'constitutional_decision'
  | 'implementation'
  | 'consequence_validation'
  | 'remediation'
  | 'deployment_authorization'
  | 'complete';

export interface DevLoopState {
  sessionId: string;
  stage: DevLoopStage;
  intent: StructuredDevIntent | null;
  contextPack: ContextPack | null;
  gapAnalysis: CapabilityGapAnalysis | null;
  consequenceCanvas: ConsequenceCanvas | null;
  /** CFS-029 §7.1 — the Constitutional Decision stage output: HOW the
   *  capability is realized (nine mechanisms + 'none'), decided BEFORE the
   *  Implementation Pack. Browser-safe projection of the service decision. */
  constitutionalDecision?: DevConstitutionalDecision | null;
  validationReport: ConsequenceValidationReport | null;
  /** LLM-enriched implementation brief (PRD + plan + tasks). When present,
   *  buildImplementationPackage uses it instead of the derived brief. */
  implementationBrief?: string | null;
  /** The generated Implementation Pack VIEW (T2-safe projection) — session
   *  state, not layout state, so returning to the Implement capsule rehydrates
   *  the pack instead of forcing a regeneration (fix 2026-07-13). */
  generatedPack?: Record<string, unknown> | null;
  /** ICE-7 Remediation fork output — set when a failed consequence check is
   *  remedied in the validation stage rather than accepted. */
  remediationPlan?: RemediationPlan | null;
  /** ICE-8 Deployment Authorization record — consequence-test-before-deploy. */
  deploymentAuthorization?: DeploymentAuthorization | null;
  /**
   * Homecoming III — the causal/risk field governing this intent (IDE 2.0).
   *
   * ONE OPTIONAL FIELD, DELIBERATELY. The envelope is HORIZONTAL: constructed
   * at `intent_capture` and progressively enriched across the existing stages,
   * never a stage of its own and never a second session store. Attaching it
   * here rather than beside the session is what keeps `DevLoopState` the
   * single source of truth for a development session (inv.engineering.036).
   *
   * Optional so every existing session — and `createDevLoopSession()`'s
   * pristine default — remains valid without migration. Absence means the
   * envelope has not been constructed, which is honest for a session that
   * predates it.
   */
  invariantEnvelope?: InvariantDevelopmentEnvelope | null;
  receipts: DevLoopReceipt[];
  startedAt: string;
  updatedAt: string;
}

// ─── Capability 4.5: Constitutional Decision (CFS-029 §7.1) ─────────────────

export interface DevConstitutionalDecision {
  /** One of the nine mechanisms, or 'none' (capability exists — compose it). */
  mechanism: string;
  noBuildRequired: boolean;
  rationale: string;
  alternatives: { mechanism: string; reason: string }[];
  decidedBy: 'llm' | 'heuristic';
  decidedAt: string;
}

// ─── Implementation Package (what gets sent to Claude Code) ─────────────────

export interface ImplementationPackage {
  intentId: string;
  brief: string;
  contextPack: ContextPack;
  gapAnalysis: CapabilityGapAnalysis;
  consequenceCanvas: ConsequenceCanvas;
  constraints: string[];
  claudeMdRules: string[];
  assembledAt: string;
}
