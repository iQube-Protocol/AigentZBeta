/**
 * AgentiQ Registry Ingestion Factory — canonical types
 *
 * These types govern the full ingestion pipeline from raw external source
 * through to a published, governed, composable iQube asset.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Source types
// ─────────────────────────────────────────────────────────────────────────────

export type IngestionSourceType =
  | "github_repo"
  | "package_ref"
  | "mcp_endpoint"
  | "archive"
  | "manual_bundle"
  | "workflow_def"
  | "make_scenario";

// ─────────────────────────────────────────────────────────────────────────────
// Asset classes
// ─────────────────────────────────────────────────────────────────────────────

export type RegistryAssetClass =
  | "ToolQube"
  | "SkillQube"
  | "WorkflowQube"
  | "ConnectorQube"
  | "AigentQube";

// ─────────────────────────────────────────────────────────────────────────────
// Trust bands — ordered L1 (lowest) → L5 (highest)
// ─────────────────────────────────────────────────────────────────────────────

export type TrustBand =
  | "L1_EXPERIMENTAL"
  | "L2_VERIFIED_COMMUNITY"
  | "L3_PRODUCTION_CANDIDATE"
  | "L4_PRODUCTION_APPROVED"
  | "L5_CORE_SOVEREIGN";

export const TRUST_BAND_ORDER: TrustBand[] = [
  "L1_EXPERIMENTAL",
  "L2_VERIFIED_COMMUNITY",
  "L3_PRODUCTION_CANDIDATE",
  "L4_PRODUCTION_APPROVED",
  "L5_CORE_SOVEREIGN",
];

export const TRUST_BAND_LABELS: Record<TrustBand, string> = {
  L1_EXPERIMENTAL: "L1 Experimental",
  L2_VERIFIED_COMMUNITY: "L2 Verified Community",
  L3_PRODUCTION_CANDIDATE: "L3 Production Candidate",
  L4_PRODUCTION_APPROVED: "L4 Production Approved",
  L5_CORE_SOVEREIGN: "L5 Core Sovereign",
};

// ─────────────────────────────────────────────────────────────────────────────
// Policy classes — governs how an asset may be invoked
// ─────────────────────────────────────────────────────────────────────────────

export type PolicyClass =
  | "read_only"
  | "network_limited"
  | "sandbox_exec"
  | "browser_operator"
  | "secret_bound"
  | "human_approval_required";

export const POLICY_CLASS_LABELS: Record<PolicyClass, string> = {
  read_only: "Read Only",
  network_limited: "Network Limited",
  sandbox_exec: "Sandbox Execution",
  browser_operator: "Browser Operator",
  secret_bound: "Secret Bound",
  human_approval_required: "Human Approval Required",
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper strategies — no raw imported asset invocation permitted
// ─────────────────────────────────────────────────────────────────────────────

export type WrapperStrategy =
  | "http"
  | "cli_container"
  | "mcp"
  | "browser"
  | "skill"
  | "workflow";

// ─────────────────────────────────────────────────────────────────────────────
// Validation stages
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationStage =
  | "license_check"
  | "dependency_inventory"
  | "secret_scan"
  | "sandbox_smoke"
  | "interface_conformance"
  | "reproducibility";

export type ValidationStageStatus = "pending" | "running" | "passed" | "failed" | "warn" | "skipped";

export interface ValidationStageResult {
  stage: ValidationStage;
  status: ValidationStageStatus;
  completedAt?: string;
  capTrustBand?: TrustBand;  // ceiling imposed by this stage
  summary?: string;
  artifactId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt event types — all factory state transitions emit a receipt
// ─────────────────────────────────────────────────────────────────────────────

export type ReceiptEventType =
  | "intake.created"
  | "source.fetched"
  | "source.classified"
  | "asset.packaged"
  | "validation.started"
  | "validation.completed"
  | "trust.assigned"
  | "review.approved"
  | "review.rejected"
  | "asset.published"
  | "asset.invoked"
  | "asset.version.deprecated";

// ─────────────────────────────────────────────────────────────────────────────
// Ingestion pipeline stage names (mirrors pipeline_runs convention)
// ─────────────────────────────────────────────────────────────────────────────

export type IngestionStage =
  | "intake.created"
  | "source.fetching"
  | "source.fetched"
  | "source.classifying"
  | "source.classified"
  | "asset.packaging"
  | "asset.packaged"
  | "validation.starting"
  | "validation.running"
  | "validation.completed"
  | "trust.scoring"
  | "trust.scored"
  | "review.pending"
  | "review.approved"
  | "review.rejected"
  | "asset.publishing"
  | "asset.published"
  | "ingestion.failed";

export type IngestionStatus =
  | "received"
  | "fetching"
  | "classifying"
  | "packaging"
  | "validating"
  | "scored"
  | "review_pending"
  | "published"
  | "rejected"
  | "failed";

export interface IngestionStageEvent {
  stage: IngestionStage;
  enteredAt: string;
  exitedAt?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntakeQube — represents a single inbound submission
// ─────────────────────────────────────────────────────────────────────────────

export interface IntakeQube {
  intakeId: string;
  tenantId: string;
  submittedBy: string;
  sourceType: IngestionSourceType;
  sourceUri?: string;
  sourcePayload: Record<string, unknown>;
  status: IngestionStatus;
  currentStage: IngestionStage;
  stageHistory: IngestionStageEvent[];
  assetId?: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceQube — fetched + fingerprinted source artifact
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceManifest {
  name?: string;
  version?: string;
  license?: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  entryPoints?: string[];
  exports?: string[];
  detectedCapabilities?: string[];
  [key: string]: unknown;
}

export interface SourceQube {
  sourceId: string;
  intakeId: string;
  sourceType: IngestionSourceType;
  uri?: string;
  contentHash?: string;
  contentSize?: number;
  manifest: SourceManifest;
  rawRefs: string[];
  fetchStatus: "pending" | "completed" | "failed";
  fetchedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability descriptor — common to all asset classes
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolQube — wraps a single external tool or API
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolQube {
  assetId: string;
  tenantId: string;
  assetClass: "ToolQube";
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sourceId?: string;
  intakeId?: string;
  currentVersion: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  wrapperStrategy: WrapperStrategy;
  interfaceSchema: Record<string, unknown>;
  capabilities: CapabilityDescriptor[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SkillQube — wraps a composable skill bundle
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillQube {
  assetId: string;
  tenantId: string;
  assetClass: "SkillQube";
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sourceId?: string;
  intakeId?: string;
  currentVersion: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  wrapperStrategy: WrapperStrategy;
  interfaceSchema: Record<string, unknown>;
  capabilities: CapabilityDescriptor[];
  steps?: Array<{ name: string; tool?: string; prompt?: string }>;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowQube — wraps a multi-step workflow definition
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowQube {
  assetId: string;
  tenantId: string;
  assetClass: "WorkflowQube";
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sourceId?: string;
  intakeId?: string;
  currentVersion: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  wrapperStrategy: WrapperStrategy;
  interfaceSchema: Record<string, unknown>;
  capabilities: CapabilityDescriptor[];
  workflowEngine?: string;  // n8n | make | inline | langchain
  triggerType?: string;     // webhook | schedule | manual | event
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorQube — wraps an MCP server or external integration endpoint
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectorQube {
  assetId: string;
  tenantId: string;
  assetClass: "ConnectorQube";
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sourceId?: string;
  intakeId?: string;
  currentVersion: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  wrapperStrategy: WrapperStrategy;
  interfaceSchema: Record<string, unknown>;
  capabilities: CapabilityDescriptor[];
  endpointUrl?: string;
  authScheme?: string;  // bearer | api_key | oauth2 | none
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Union type covering all asset classes
export type RegistryAsset = ToolQube | SkillQube | WorkflowQube | ConnectorQube;

// Lightweight summary used in list views
export interface RegistryAssetSummary {
  assetId: string;
  assetClass: RegistryAssetClass;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  currentVersion: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PolicyQube — governs invocation of an asset
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyQube {
  policyId: string;
  assetId: string;
  policyClass: PolicyClass;
  allowedHosts: string[];
  allowedPaths: string[];
  secretRefs: string[];
  requiresHumanApproval: boolean;
  approvalTimeoutS: number;
  maxExecSeconds: number;
  maxOutputBytes: number;
  customRules: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationQube — header for a validation run
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationQube {
  validationId: string;
  assetId: string;
  versionId?: string;
  triggeredBy: string;
  status: "started" | "running" | "completed" | "failed";
  stagesCompleted: ValidationStageResult[];
  overallResult?: "pass" | "fail" | "warn";
  trustBandCap?: TrustBand;
  summary?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationArtifact — immutable evidence from a validation stage
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationArtifact {
  artifactId: string;
  validationId: string;
  stage: ValidationStage;
  artifactType: "report" | "log" | "hash" | "manifest";
  content: Record<string, unknown>;
  contentHash?: string;
  passed?: boolean;
  capTrustBand?: TrustBand;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust score factors
// ─────────────────────────────────────────────────────────────────────────────

export interface TrustFactors {
  provenanceQuality: number;       // 0–1: is origin known and verifiable?
  licenseClarity: number;          // 0–1: is license clearly identified and compatible?
  maintenancePosture: number;      // 0–1: is the source actively maintained?
  dependencyRisk: number;          // 0–1 (inverted: 1 = low risk)
  privilegeFootprint: number;      // 0–1 (inverted: 1 = minimal privilege)
  validationPassQuality: number;   // 0–1: how well did validation stages pass?
  reproducibility: number;         // 0–1: is execution deterministic and reproducible?
  wrapperIsolationQuality: number; // 0–1: how well is the asset isolated in its wrapper?
}

// ─────────────────────────────────────────────────────────────────────────────
// TrustScore — computed trust assignment
// ─────────────────────────────────────────────────────────────────────────────

export interface TrustScore {
  scoreId: string;
  assetId: string;
  validationId?: string;
  trustBand: TrustBand;
  numericScore: number;  // 0–100
  factors: TrustFactors;
  explanation?: string;
  computedBy: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PublicationQube
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicationQube {
  publicationId: string;
  assetId: string;
  versionId?: string;
  validationId?: string;
  scoreId?: string;
  trustBand: TrustBand;
  policyClass: PolicyClass;
  publishedBy: string;
  publishedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  status: "pending" | "published" | "revoked";
  receiptId?: string;
  notes?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ReceiptQube — immutable audit event
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptQube {
  receiptId: string;
  assetId?: string;
  intakeId?: string;
  invocationId?: string;
  eventType: ReceiptEventType;
  actorId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  contentHash?: string;
  dvnMessageId?: string;
  dvnSubmittedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryReview {
  reviewId: string;
  assetId: string;
  validationId?: string;
  reviewerId: string;
  reviewerType: "human" | "agent";
  decision?: "approved" | "rejected" | "deferred";
  requestedTrustBand?: TrustBand;
  notes?: string;
  evidenceRefs: string[];
  createdAt: string;
  decidedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust band enforcement rules
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the highest trust band a score of `numeric` can achieve. */
export function trustBandFromScore(numeric: number): TrustBand {
  if (numeric >= 90) return "L5_CORE_SOVEREIGN";
  if (numeric >= 75) return "L4_PRODUCTION_APPROVED";
  if (numeric >= 55) return "L3_PRODUCTION_CANDIDATE";
  if (numeric >= 30) return "L2_VERIFIED_COMMUNITY";
  return "L1_EXPERIMENTAL";
}

/** Enforces hard caps from validation results. */
export function applyTrustCaps(
  computed: TrustBand,
  caps: Array<TrustBand | undefined>
): TrustBand {
  let result = computed;
  for (const cap of caps) {
    if (!cap) continue;
    if (TRUST_BAND_ORDER.indexOf(cap) < TRUST_BAND_ORDER.indexOf(result)) {
      result = cap;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// API request/response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateIntakeRequest {
  tenantId: string;
  submittedBy: string;
  sourceType: IngestionSourceType;
  sourceUri?: string;
  sourcePayload?: Record<string, unknown>;
}

export interface CreateAssetRequest {
  tenantId: string;
  assetClass: RegistryAssetClass;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sourceId?: string;
  intakeId?: string;
  policyClass?: PolicyClass;
  wrapperStrategy?: WrapperStrategy;
  interfaceSchema?: Record<string, unknown>;
  capabilities?: CapabilityDescriptor[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface AssetListFilter {
  assetClass?: RegistryAssetClass;
  trustBand?: TrustBand;
  publicationStatus?: string;
  policyClass?: PolicyClass;
  search?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}
