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
  validationReport: ConsequenceValidationReport | null;
  /** LLM-enriched implementation brief (PRD + plan + tasks). When present,
   *  buildImplementationPackage uses it instead of the derived brief. */
  implementationBrief?: string | null;
  /** ICE-7 Remediation fork output — set when a failed consequence check is
   *  remedied in the validation stage rather than accepted. */
  remediationPlan?: RemediationPlan | null;
  /** ICE-8 Deployment Authorization record — consequence-test-before-deploy. */
  deploymentAuthorization?: DeploymentAuthorization | null;
  receipts: DevLoopReceipt[];
  startedAt: string;
  updatedAt: string;
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
