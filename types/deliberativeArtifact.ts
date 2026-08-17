/**
 * Deliberative Artifact Composition — types for the deliberation seam
 * that sits between NBE dispatch and artifact generation.
 *
 * Governs which artifact types require operator judgment before generation,
 * and what state machine governs that deliberation.
 */

// ─── Composition Policy ──────────────────────────────────────────────────────

export type DeliberativeArtifactType = 'venture-report' | 'venture-reintroduction';

export type CompositionMode = 'direct' | 'deliberative';

export type EvidenceMode = 'none' | 'contextual' | 'platform-native';

export type ApprovalGate = 'draft-before-execute' | 'brief-before-draft';

export interface ArtifactCompositionPolicy {
  /** The artifact type this policy governs. */
  artifactType: string;
  /** direct: generate immediately after NBE selection; deliberative: mount brief first. */
  compositionMode: CompositionMode;
  /** What evidence to assemble and include in the brief. */
  evidenceMode?: EvidenceMode;
  /** When approval is required (deliberative only). */
  approvalGate?: ApprovalGate;
  /** Optional template id for the deliberation layout. */
  deliberationTemplate?: string;
}

// ─── Deliberation State Machine ──────────────────────────────────────────────

export type DeliberationState =
  | 'proposed'
  | 'context_assembling'
  | 'deliberating'
  | 'brief_ready'
  | 'approved_for_draft'
  | 'drafted'
  | 'cancelled';

export interface DeliberationBrief {
  /** Unique identifier for this deliberation session. */
  deliberationId: string;
  /** The artifact type being deliberated. */
  artifactType: string;
  /** The NBE that triggered this deliberation. */
  nbeId: string;
  /** Current state in the lifecycle. */
  state: DeliberationState;
  /** Structured brief object — evolves as operator provides input. */
  briefSpec: Record<string, unknown>;
  /** Material questions that remain unresolved. */
  unresolvedQuestions: string[];
  /** Whether the brief is sufficiently complete for draft generation. */
  isComplete: boolean;
  /** Error message if deliberation failed (state: cancelled). */
  error?: string;
  /** Timestamp when this deliberation started. */
  createdAt: string;
  /** Timestamp of last update. */
  updatedAt: string;
}

// ─── Evidence Maturity Classification ────────────────────────────────────────

export type EvidenceMaturity =
  | 'built'
  | 'activated'
  | 'verified_in_use'
  | 'in_progress'
  | 'planned'
  | 'blocked';

export interface ReportEvidenceItem {
  /** Unique identifier for this evidence item. */
  id: string;
  /** Domain/area this evidence pertains to (e.g. 'product', 'partnerships'). */
  domain: string;
  /** Human-readable title. */
  title: string;
  /** Brief description. */
  summary: string;
  /** Maturity classification. */
  state: EvidenceMaturity;
  /** When this evidence was created/observed (if applicable). */
  occurredAt?: string;
  /** Source type (e.g. 'activity_receipt', 'venture_objective', 'deployment_record'). */
  sourceType: string;
  /** Reference to the source system (receipt id, objective id, etc.). */
  sourceRef?: string;
  /** Confidence level (0-1) if uncertain. */
  confidence?: number;
  /** Disclosure class for this evidence (public, tenant, persona, sovereign). */
  disclosure?: 'public' | 'tenant' | 'persona' | 'sovereign';
}

// ─── Venture Report Specific Brief ───────────────────────────────────────────

export interface VentureReportBriefSpec {
  /** Purpose of the report (internal review, partner update, investor update, etc.). */
  purpose?: 'internal' | 'partner' | 'investor' | 'product' | 'full' | 'custom';
  /** Custom purpose text if purpose === 'custom'. */
  customPurpose?: string;
  /** Reporting period start (ISO date) or 'current' for immediate state. */
  periodStart?: string;
  /** Reporting period end (ISO date) or null for 'through today'. */
  periodEnd?: string;
  /** Disclosure level. */
  disclosure?: 'internal' | 'partner' | 'investor' | 'public';
  /** Areas in scope (product, bridges, pilots, partnerships, research, commercial). */
  scope?: string[];
  /** Emphasis/priority areas. */
  emphasis?: string[];
  /** Desired outcome/what reader should do. */
  desiredOutcome?: string;
  /** Whether experimental/incomplete work should be included. */
  includeExperimental?: boolean;
  /** Proposed report structure (section titles). */
  proposedSections?: string[];
}

// ─── Venture Reintroduction Specific Brief ──────────────────────────────────

export interface VentureReintroductionBriefSpec extends VentureReportBriefSpec {
  /** Who the reintroduction is for (individual name / org, optional). */
  audience?: string;
  /** When did the audience last meaningfully interact with the venture? */
  lastInteraction?: string;
  /** What do they likely remember/understand (summary)? */
  likelyPriorUnderstanding?: string;
  /** What is the desired outcome of this reintroduction? */
  reintroductionGoal?: string;
  /** Is prior understanding known (explicit previous communication) or inferred? */
  priorUnderstandingSource?: 'explicit_previous_report' | 'known_last_interaction' | 'operator_statement' | 'unknown';
}
