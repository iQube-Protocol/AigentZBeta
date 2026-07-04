/**
 * Consequence Engineering Operating Model — type contracts (CFS-006a).
 *
 * "How constitutional intelligence actually executes." The canonical pipeline
 * Intent → Knowledge Curation → Knowledge Compression → Risk → Value →
 * Capability → Consequence Forecasting → Planning → Execution → Observation →
 * Standing → Registry Update → Knowledge Evolution — expressed by the products
 * that flow between stages. The pipeline is recursive: Standing produces new
 * knowledge that feeds the next Intent (the flywheel).
 *
 * T0 discipline: no personaId on any record type here. The runner accepts the
 * acting persona as an opaque parameter and keeps it out of returned products.
 */

import type { AgentDisposition } from './orchestration';
import type { InvariantEdgeType, InvariantNamespace } from './invariants';
import type { RiskAssessment } from '@/services/registry/phase2/risk';
import type { ValueAssessment } from '@/services/registry/phase2/value';

/** The thirteen canonical stages, named by their output product. */
export type ConsequenceStage =
  | 'intent'
  | 'knowledge_curation'
  | 'knowledge_compression'
  | 'risk_analysis'
  | 'value_analysis'
  | 'capability_composition'
  | 'consequence_forecasting'
  | 'planning'
  | 'execution'
  | 'observation'
  | 'standing'
  | 'registry_update'
  | 'knowledge_evolution';

export interface StageDefinition {
  stage: ConsequenceStage;
  /** The product this stage emits (the thing that flows to the next stage). */
  product: string;
  purpose: string;
  /** True for the stages introduced by Phase 3 (consume the invariant substrate). */
  isNew: boolean;
}

// ── Stage products ─────────────────────────────────────────────────────

/**
 * KnowledgeQube (CFS-006a Knowledge Curation) — the minimum coherent set of
 * validated knowledge for an intent. Lean: a curated bundle of refs, not a
 * new table (starts on the IntentQube storage philosophy).
 */
export interface KnowledgeQube {
  intentRef: string;
  contextDomain: string | null;
  invariantIds: string[];
  /** Dependency-closure ids pulled in beyond the directly-matched set. */
  closureIds: string[];
  namespaces: InvariantNamespace[];
  coherent: boolean;
}

export interface ConsequenceNode {
  invariantId: string;
  statement: string;
  /** How this node was reached from the action's knowledge. */
  via: InvariantEdgeType | 'seed';
  /** constrains/contradicts nodes are cautionary. */
  cautionary: boolean;
}

/**
 * Consequence graph (CFS-006a Consequence Forecasting) — the forecast of what
 * follows from acting on the composed capability, traversed over enables /
 * constrains / contradicts edges.
 */
export interface ConsequenceForecast {
  seedInvariantIds: string[];
  nodes: ConsequenceNode[];
  enables: number;
  constrains: number;
  contradicts: number;
  /** True when a canonical constraint/contradiction is implicated → escalate. */
  forcesEscalation: boolean;
  rationale: string;
}

export interface StageReceiptRef {
  stage: ConsequenceStage;
  receiptId: string | null;
  summary: string;
}

/**
 * A run of the operating model up to (and optionally past) the Planning gate.
 * T1-safe — carries products + refs, never the acting personaId.
 */
export interface ConsequenceRun {
  runId: string;
  intentRef: string;
  reachedStage: ConsequenceStage;
  disposition: AgentDisposition;
  knowledge: KnowledgeQube | null;
  compressedInvariantIds: string[];
  risk: RiskAssessment | null;
  value: ValueAssessment | null;
  capabilityQubeId: string | null;
  forecast: ConsequenceForecast | null;
  awaitingApproval: boolean;
  stageReceipts: StageReceiptRef[];
}
