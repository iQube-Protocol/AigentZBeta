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

// ─── Development Loop State ─────────────────────────────────────────────────

export type DevLoopStage =
  | 'intent_capture'
  | 'context_assembly'
  | 'gap_analysis'
  | 'consequence_modeling'
  | 'implementation'
  | 'consequence_validation'
  | 'complete';

export interface DevLoopState {
  sessionId: string;
  stage: DevLoopStage;
  intent: StructuredDevIntent | null;
  contextPack: ContextPack | null;
  gapAnalysis: CapabilityGapAnalysis | null;
  consequenceCanvas: ConsequenceCanvas | null;
  validationReport: ConsequenceValidationReport | null;
  receipts: string[];
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
