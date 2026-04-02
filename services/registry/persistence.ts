/**
 * Registry Ingestion Factory — Supabase persistence layer
 *
 * All table access for the ingestion factory goes through this module.
 * Follows the same rowToModel / requireSupabase pattern as services/pipeline/persistence.ts
 */

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import {
  IntakeQube,
  SourceQube,
  SourceManifest,
  RegistryAssetSummary,
  RegistryAsset,
  PolicyQube,
  ValidationQube,
  ValidationArtifact,
  ValidationStageResult,
  TrustScore,
  TrustFactors,
  PublicationQube,
  ReceiptQube,
  RegistryReview,
  IngestionStage,
  IngestionStatus,
  IngestionStageEvent,
  RegistryAssetClass,
  TrustBand,
  PolicyClass,
  WrapperStrategy,
  CapabilityDescriptor,
  ReceiptEventType,
  AssetListFilter,
  CreateIntakeRequest,
  CreateAssetRequest,
} from "@/types/registryIngestion";
import { IngestionSourceType } from "@/types/registryIngestion";

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new Error(
      "Registry persistence unavailable — Supabase client could not be initialised."
    );
  }
  return supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntakeQube
// ─────────────────────────────────────────────────────────────────────────────

function rowToIntake(row: Record<string, unknown>): IntakeQube {
  return {
    intakeId: row.intake_id as string,
    tenantId: row.tenant_id as string,
    submittedBy: row.submitted_by as string,
    sourceType: row.source_type as IngestionSourceType,
    sourceUri: (row.source_uri as string) ?? undefined,
    sourcePayload: (row.source_payload as Record<string, unknown>) ?? {},
    status: row.status as IngestionStatus,
    currentStage: row.current_stage as IngestionStage,
    stageHistory: (row.stage_history as IngestionStageEvent[]) ?? [],
    assetId: (row.asset_id as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    failureReason: (row.failure_reason as string) ?? undefined,
  };
}

export async function createIntake(req: CreateIntakeRequest & { intakeId: string }): Promise<IntakeQube> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_intakes")
    .insert({
      intake_id: req.intakeId,
      tenant_id: req.tenantId,
      submitted_by: req.submittedBy,
      source_type: req.sourceType,
      source_uri: req.sourceUri ?? null,
      source_payload: req.sourcePayload ?? {},
      status: "received",
      current_stage: "intake.created",
      stage_history: [],
    })
    .select("*")
    .single();
  if (error) throw new Error(`createIntake failed: ${error.message}`);
  return rowToIntake(data as Record<string, unknown>);
}

export async function getIntake(intakeId: string): Promise<IntakeQube | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_intakes")
    .select("*")
    .eq("intake_id", intakeId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return rowToIntake(data as Record<string, unknown>);
}

export async function updateIntake(
  intakeId: string,
  patch: Partial<Pick<IntakeQube, "status" | "currentStage" | "stageHistory" | "assetId" | "failureReason">>
): Promise<IntakeQube> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.currentStage !== undefined) row.current_stage = patch.currentStage;
  if (patch.stageHistory !== undefined) row.stage_history = patch.stageHistory;
  if (patch.assetId !== undefined) row.asset_id = patch.assetId;
  if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason;
  const { data, error } = await supabase
    .from("registry_intakes")
    .update(row)
    .eq("intake_id", intakeId)
    .select("*")
    .single();
  if (error) throw new Error(`updateIntake failed: ${error.message}`);
  return rowToIntake(data as Record<string, unknown>);
}

export async function listIntakes(tenantId: string, limit = 50): Promise<IntakeQube[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_intakes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToIntake(r as Record<string, unknown>));
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceQube
// ─────────────────────────────────────────────────────────────────────────────

function rowToSource(row: Record<string, unknown>): SourceQube {
  return {
    sourceId: row.source_id as string,
    intakeId: row.intake_id as string,
    sourceType: row.source_type as IngestionSourceType,
    uri: (row.uri as string) ?? undefined,
    contentHash: (row.content_hash as string) ?? undefined,
    contentSize: (row.content_size as number) ?? undefined,
    manifest: (row.manifest as SourceManifest) ?? {},
    rawRefs: (row.raw_refs as string[]) ?? [],
    fetchStatus: row.fetch_status as SourceQube["fetchStatus"],
    fetchedAt: (row.fetched_at as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function createSource(
  fields: Omit<SourceQube, "createdAt">
): Promise<SourceQube> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_sources")
    .insert({
      source_id: fields.sourceId,
      intake_id: fields.intakeId,
      source_type: fields.sourceType,
      uri: fields.uri ?? null,
      content_hash: fields.contentHash ?? null,
      content_size: fields.contentSize ?? null,
      manifest: fields.manifest ?? {},
      raw_refs: fields.rawRefs ?? [],
      fetch_status: fields.fetchStatus,
      fetched_at: fields.fetchedAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createSource failed: ${error.message}`);
  return rowToSource(data as Record<string, unknown>);
}

export async function updateSource(
  sourceId: string,
  patch: Partial<Pick<SourceQube, "contentHash" | "contentSize" | "manifest" | "rawRefs" | "fetchStatus" | "fetchedAt">>
): Promise<SourceQube> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.contentHash !== undefined) row.content_hash = patch.contentHash;
  if (patch.contentSize !== undefined) row.content_size = patch.contentSize;
  if (patch.manifest !== undefined) row.manifest = patch.manifest;
  if (patch.rawRefs !== undefined) row.raw_refs = patch.rawRefs;
  if (patch.fetchStatus !== undefined) row.fetch_status = patch.fetchStatus;
  if (patch.fetchedAt !== undefined) row.fetched_at = patch.fetchedAt;
  const { data, error } = await supabase
    .from("registry_sources")
    .update(row)
    .eq("source_id", sourceId)
    .select("*")
    .single();
  if (error) throw new Error(`updateSource failed: ${error.message}`);
  return rowToSource(data as Record<string, unknown>);
}

export async function getSourceByIntake(intakeId: string): Promise<SourceQube | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_sources")
    .select("*")
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToSource(data as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
// RegistryAsset
// ─────────────────────────────────────────────────────────────────────────────

function rowToAsset(row: Record<string, unknown>): RegistryAsset {
  return {
    assetId: row.asset_id as string,
    assetClass: row.asset_class as RegistryAssetClass,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string) ?? undefined,
    iconUrl: (row.icon_url as string) ?? undefined,
    sourceId: (row.source_id as string) ?? undefined,
    intakeId: (row.intake_id as string) ?? undefined,
    currentVersion: row.current_version as string,
    trustBand: row.trust_band as TrustBand,
    publicationStatus: row.publication_status as string,
    policyClass: row.policy_class as PolicyClass,
    wrapperStrategy: row.wrapper_strategy as WrapperStrategy,
    interfaceSchema: (row.interface_schema as Record<string, unknown>) ?? {},
    capabilities: (row.capabilities as CapabilityDescriptor[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  } as RegistryAsset;
}

export async function createAsset(req: CreateAssetRequest & { assetId: string }): Promise<RegistryAsset> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_assets")
    .insert({
      asset_id: req.assetId,
      tenant_id: req.tenantId,
      asset_class: req.assetClass,
      name: req.name,
      slug: req.slug,
      description: req.description ?? null,
      icon_url: req.iconUrl ?? null,
      source_id: req.sourceId ?? null,
      intake_id: req.intakeId ?? null,
      current_version: "0.1.0",
      trust_band: "L1_EXPERIMENTAL",
      publication_status: "draft",
      policy_class: req.policyClass ?? "read_only",
      wrapper_strategy: req.wrapperStrategy ?? "http",
      interface_schema: req.interfaceSchema ?? {},
      capabilities: req.capabilities ?? [],
      tags: req.tags ?? [],
      metadata: req.metadata ?? {},
      created_by: req.createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createAsset failed: ${error.message}`);
  return rowToAsset(data as Record<string, unknown>);
}

export async function getAsset(assetId: string): Promise<RegistryAsset | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_assets")
    .select("*")
    .eq("asset_id", assetId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return rowToAsset(data as Record<string, unknown>);
}

export async function updateAsset(
  assetId: string,
  patch: Partial<Pick<RegistryAsset, "trustBand" | "publicationStatus" | "policyClass" | "currentVersion">>
): Promise<RegistryAsset> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.trustBand !== undefined) row.trust_band = patch.trustBand;
  if (patch.publicationStatus !== undefined) row.publication_status = patch.publicationStatus;
  if (patch.policyClass !== undefined) row.policy_class = patch.policyClass;
  if (patch.currentVersion !== undefined) row.current_version = patch.currentVersion;
  const { data, error } = await supabase
    .from("registry_assets")
    .update(row)
    .eq("asset_id", assetId)
    .select("*")
    .single();
  if (error) throw new Error(`updateAsset failed: ${error.message}`);
  return rowToAsset(data as Record<string, unknown>);
}

export async function listAssets(filter: AssetListFilter): Promise<RegistryAssetSummary[]> {
  const supabase = requireSupabase();
  let q = supabase
    .from("registry_assets")
    .select("asset_id,asset_class,name,slug,description,icon_url,current_version,trust_band,publication_status,policy_class,tags,created_at,updated_at");

  if (filter.tenantId) q = q.eq("tenant_id", filter.tenantId);
  if (filter.assetClass) q = q.eq("asset_class", filter.assetClass);
  if (filter.trustBand) q = q.eq("trust_band", filter.trustBand);
  if (filter.publicationStatus) q = q.eq("publication_status", filter.publicationStatus);
  if (filter.policyClass) q = q.eq("policy_class", filter.policyClass);
  if (filter.search) {
    q = q.or(`name.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
  }

  q = q.order("updated_at", { ascending: false })
       .range(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50) - 1);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    assetId: r.asset_id,
    assetClass: r.asset_class as RegistryAssetClass,
    name: r.name,
    slug: r.slug,
    description: r.description ?? undefined,
    iconUrl: r.icon_url ?? undefined,
    currentVersion: r.current_version,
    trustBand: r.trust_band as TrustBand,
    publicationStatus: r.publication_status,
    policyClass: r.policy_class as PolicyClass,
    tags: r.tags ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationQube
// ─────────────────────────────────────────────────────────────────────────────

function rowToValidation(row: Record<string, unknown>): ValidationQube {
  return {
    validationId: row.validation_id as string,
    assetId: row.asset_id as string,
    versionId: (row.version_id as string) ?? undefined,
    triggeredBy: row.triggered_by as string,
    status: row.status as ValidationQube["status"],
    stagesCompleted: (row.stages_completed as ValidationStageResult[]) ?? [],
    overallResult: (row.overall_result as ValidationQube["overallResult"]) ?? undefined,
    trustBandCap: (row.trust_band_cap as TrustBand) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function createValidation(
  fields: Omit<ValidationQube, "createdAt" | "completedAt" | "stagesCompleted" | "overallResult" | "trustBandCap" | "summary">
): Promise<ValidationQube> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_validations")
    .insert({
      validation_id: fields.validationId,
      asset_id: fields.assetId,
      version_id: fields.versionId ?? null,
      triggered_by: fields.triggeredBy,
      status: fields.status,
      stages_completed: [],
    })
    .select("*")
    .single();
  if (error) throw new Error(`createValidation failed: ${error.message}`);
  return rowToValidation(data as Record<string, unknown>);
}

export async function updateValidation(
  validationId: string,
  patch: Partial<Pick<ValidationQube, "status" | "stagesCompleted" | "overallResult" | "trustBandCap" | "summary" | "completedAt">>
): Promise<ValidationQube> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.stagesCompleted !== undefined) row.stages_completed = patch.stagesCompleted;
  if (patch.overallResult !== undefined) row.overall_result = patch.overallResult;
  if (patch.trustBandCap !== undefined) row.trust_band_cap = patch.trustBandCap;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  const { data, error } = await supabase
    .from("registry_validations")
    .update(row)
    .eq("validation_id", validationId)
    .select("*")
    .single();
  if (error) throw new Error(`updateValidation failed: ${error.message}`);
  return rowToValidation(data as Record<string, unknown>);
}

export async function getValidation(validationId: string): Promise<ValidationQube | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_validations")
    .select("*")
    .eq("validation_id", validationId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return rowToValidation(data as Record<string, unknown>);
}

export async function listValidationsForAsset(assetId: string): Promise<ValidationQube[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_validations")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToValidation(r as Record<string, unknown>));
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationArtifact
// ─────────────────────────────────────────────────────────────────────────────

export async function createValidationArtifact(
  fields: Omit<ValidationArtifact, "createdAt">
): Promise<ValidationArtifact> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_validation_artifacts")
    .insert({
      artifact_id: fields.artifactId,
      validation_id: fields.validationId,
      stage: fields.stage,
      artifact_type: fields.artifactType,
      content: fields.content,
      content_hash: fields.contentHash ?? null,
      passed: fields.passed ?? null,
      cap_trust_band: fields.capTrustBand ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createValidationArtifact failed: ${error.message}`);
  const r = data as Record<string, unknown>;
  return {
    artifactId: r.artifact_id as string,
    validationId: r.validation_id as string,
    stage: r.stage as ValidationArtifact["stage"],
    artifactType: r.artifact_type as ValidationArtifact["artifactType"],
    content: r.content as Record<string, unknown>,
    contentHash: (r.content_hash as string) ?? undefined,
    passed: (r.passed as boolean) ?? undefined,
    capTrustBand: (r.cap_trust_band as TrustBand) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export async function listArtifactsForValidation(validationId: string): Promise<ValidationArtifact[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_validation_artifacts")
    .select("*")
    .eq("validation_id", validationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    artifactId: r.artifact_id,
    validationId: r.validation_id,
    stage: r.stage,
    artifactType: r.artifact_type,
    content: r.content ?? {},
    contentHash: r.content_hash ?? undefined,
    passed: r.passed ?? undefined,
    capTrustBand: r.cap_trust_band ?? undefined,
    createdAt: r.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// TrustScore
// ─────────────────────────────────────────────────────────────────────────────

function rowToTrustScore(row: Record<string, unknown>): TrustScore {
  return {
    scoreId: row.score_id as string,
    assetId: row.asset_id as string,
    validationId: (row.validation_id as string) ?? undefined,
    trustBand: row.trust_band as TrustBand,
    numericScore: Number(row.numeric_score),
    factors: (row.factors as TrustFactors) ?? {} as TrustFactors,
    explanation: (row.explanation as string) ?? undefined,
    computedBy: row.computed_by as string,
    createdAt: row.created_at as string,
  };
}

export async function createTrustScore(score: Omit<TrustScore, "createdAt">): Promise<TrustScore> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_trust_scores")
    .insert({
      score_id: score.scoreId,
      asset_id: score.assetId,
      validation_id: score.validationId ?? null,
      trust_band: score.trustBand,
      numeric_score: score.numericScore,
      factors: score.factors,
      explanation: score.explanation ?? null,
      computed_by: score.computedBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createTrustScore failed: ${error.message}`);
  return rowToTrustScore(data as Record<string, unknown>);
}

export async function getLatestTrustScore(assetId: string): Promise<TrustScore | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_trust_scores")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToTrustScore(data as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
// PublicationQube
// ─────────────────────────────────────────────────────────────────────────────

function rowToPublication(row: Record<string, unknown>): PublicationQube {
  return {
    publicationId: row.publication_id as string,
    assetId: row.asset_id as string,
    versionId: (row.version_id as string) ?? undefined,
    validationId: (row.validation_id as string) ?? undefined,
    scoreId: (row.score_id as string) ?? undefined,
    trustBand: row.trust_band as TrustBand,
    policyClass: row.policy_class as PolicyClass,
    publishedBy: row.published_by as string,
    publishedAt: (row.published_at as string) ?? undefined,
    revokedAt: (row.revoked_at as string) ?? undefined,
    revokedBy: (row.revoked_by as string) ?? undefined,
    revokeReason: (row.revoke_reason as string) ?? undefined,
    status: row.status as PublicationQube["status"],
    receiptId: (row.receipt_id as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function createPublication(pub: Omit<PublicationQube, "createdAt">): Promise<PublicationQube> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_publications")
    .insert({
      publication_id: pub.publicationId,
      asset_id: pub.assetId,
      version_id: pub.versionId ?? null,
      validation_id: pub.validationId ?? null,
      score_id: pub.scoreId ?? null,
      trust_band: pub.trustBand,
      policy_class: pub.policyClass,
      published_by: pub.publishedBy,
      published_at: pub.publishedAt ?? null,
      status: pub.status,
      notes: pub.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createPublication failed: ${error.message}`);
  return rowToPublication(data as Record<string, unknown>);
}

export async function updatePublication(
  publicationId: string,
  patch: Partial<Pick<PublicationQube, "status" | "publishedAt" | "revokedAt" | "revokedBy" | "revokeReason" | "receiptId">>
): Promise<PublicationQube> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  if (patch.revokedAt !== undefined) row.revoked_at = patch.revokedAt;
  if (patch.revokedBy !== undefined) row.revoked_by = patch.revokedBy;
  if (patch.revokeReason !== undefined) row.revoke_reason = patch.revokeReason;
  if (patch.receiptId !== undefined) row.receipt_id = patch.receiptId;
  const { data, error } = await supabase
    .from("registry_publications")
    .update(row)
    .eq("publication_id", publicationId)
    .select("*")
    .single();
  if (error) throw new Error(`updatePublication failed: ${error.message}`);
  return rowToPublication(data as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
// ReceiptQube
// ─────────────────────────────────────────────────────────────────────────────

export async function createReceipt(receipt: Omit<ReceiptQube, "createdAt">): Promise<ReceiptQube> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_receipts")
    .insert({
      receipt_id: receipt.receiptId,
      asset_id: receipt.assetId ?? null,
      intake_id: receipt.intakeId ?? null,
      invocation_id: receipt.invocationId ?? null,
      event_type: receipt.eventType,
      actor_id: receipt.actorId,
      tenant_id: receipt.tenantId,
      payload: receipt.payload,
      content_hash: receipt.contentHash ?? null,
      dvn_message_id: receipt.dvnMessageId ?? null,
      dvn_submitted_at: receipt.dvnSubmittedAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createReceipt failed: ${error.message}`);
  const r = data as Record<string, unknown>;
  return {
    receiptId: r.receipt_id as string,
    assetId: (r.asset_id as string) ?? undefined,
    intakeId: (r.intake_id as string) ?? undefined,
    invocationId: (r.invocation_id as string) ?? undefined,
    eventType: r.event_type as ReceiptEventType,
    actorId: r.actor_id as string,
    tenantId: r.tenant_id as string,
    payload: (r.payload as Record<string, unknown>) ?? {},
    contentHash: (r.content_hash as string) ?? undefined,
    dvnMessageId: (r.dvn_message_id as string) ?? undefined,
    dvnSubmittedAt: (r.dvn_submitted_at as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export async function listReceiptsForAsset(assetId: string, limit = 50): Promise<ReceiptQube[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_receipts")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    receiptId: r.receipt_id,
    assetId: r.asset_id ?? undefined,
    intakeId: r.intake_id ?? undefined,
    invocationId: r.invocation_id ?? undefined,
    eventType: r.event_type as ReceiptEventType,
    actorId: r.actor_id,
    tenantId: r.tenant_id,
    payload: r.payload ?? {},
    contentHash: r.content_hash ?? undefined,
    dvnMessageId: r.dvn_message_id ?? undefined,
    dvnSubmittedAt: r.dvn_submitted_at ?? undefined,
    createdAt: r.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// RegistryReview
// ─────────────────────────────────────────────────────────────────────────────

function rowToReview(row: Record<string, unknown>): RegistryReview {
  return {
    reviewId: row.review_id as string,
    assetId: row.asset_id as string,
    validationId: (row.validation_id as string) ?? undefined,
    reviewerId: row.reviewer_id as string,
    reviewerType: row.reviewer_type as RegistryReview["reviewerType"],
    decision: (row.decision as RegistryReview["decision"]) ?? undefined,
    requestedTrustBand: (row.requested_trust_band as TrustBand) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    evidenceRefs: (row.evidence_refs as string[]) ?? [],
    createdAt: row.created_at as string,
    decidedAt: (row.decided_at as string) ?? undefined,
  };
}

export async function createReview(
  fields: Omit<RegistryReview, "createdAt" | "decidedAt" | "decision">
): Promise<RegistryReview> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_reviews")
    .insert({
      review_id: fields.reviewId,
      asset_id: fields.assetId,
      validation_id: fields.validationId ?? null,
      reviewer_id: fields.reviewerId,
      reviewer_type: fields.reviewerType,
      requested_trust_band: fields.requestedTrustBand ?? null,
      notes: fields.notes ?? null,
      evidence_refs: fields.evidenceRefs ?? [],
    })
    .select("*")
    .single();
  if (error) throw new Error(`createReview failed: ${error.message}`);
  return rowToReview(data as Record<string, unknown>);
}

export async function updateReview(
  reviewId: string,
  patch: Partial<Pick<RegistryReview, "decision" | "notes" | "decidedAt">>
): Promise<RegistryReview> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.decision !== undefined) row.decision = patch.decision;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.decidedAt !== undefined) row.decided_at = patch.decidedAt;
  const { data, error } = await supabase
    .from("registry_reviews")
    .update(row)
    .eq("review_id", reviewId)
    .select("*")
    .single();
  if (error) throw new Error(`updateReview failed: ${error.message}`);
  return rowToReview(data as Record<string, unknown>);
}

export async function listReviewsForAsset(assetId: string): Promise<RegistryReview[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("registry_reviews")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToReview(r as Record<string, unknown>));
}
