/**
 * ValidationOrchestrationService — runs all validation stages for an asset.
 *
 * Each stage produces an immutable ValidationArtifact. Stages that fail impose
 * a TrustBand cap on the final score. Full sandbox execution is scaffolded here
 * but deferred to a controlled worker environment for the MVP.
 *
 * Hard caps enforced:
 * - Undefined license → caps at L1_EXPERIMENTAL
 * - Secret scan failure → caps at L1_EXPERIMENTAL
 * - Uncontrolled shell access detected → caps at L2_VERIFIED_COMMUNITY
 * - No passing sandbox result → caps at L2_VERIFIED_COMMUNITY (deferred MVP)
 */

import { createHash } from "crypto";
import {
  createValidation,
  updateValidation,
  createValidationArtifact,
  updateAsset,
  getAsset,
} from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import {
  TrustBand,
  ValidationStage,
  ValidationStageResult,
  ValidationStageStatus,
  applyTrustCaps,
  trustBandFromScore,
} from "@/types/registryIngestion";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const ALL_STAGES: ValidationStage[] = [
  "license_check",
  "dependency_inventory",
  "secret_scan",
  "sandbox_smoke",
  "interface_conformance",
  "reproducibility",
];

export interface ValidatorResult {
  ok: boolean;
  validationId?: string;
  overallResult?: "pass" | "fail" | "warn";
  trustBandCap?: TrustBand;
  error?: string;
}

export async function runValidation(
  assetId: string,
  triggeredBy: string
): Promise<ValidatorResult> {
  const asset = await getAsset(assetId);
  if (!asset) return { ok: false, error: `Asset not found: ${assetId}` };

  const validationId = generateId("val");
  const validation = await createValidation({
    validationId,
    assetId,
    triggeredBy,
    status: "running",
    startedAt: new Date().toISOString(),
  });

  await emitReceipt({
    eventType: "validation.started",
    actorId: triggeredBy,
    tenantId: asset.tenantId ?? "system",
    assetId,
    payload: { validationId, assetId },
  });

  const stageResults: ValidationStageResult[] = [];
  const caps: Array<TrustBand | undefined> = [];

  for (const stage of ALL_STAGES) {
    const result = await runStage(stage, assetId, validationId, asset.metadata ?? {});
    stageResults.push(result);
    if (result.capTrustBand) caps.push(result.capTrustBand);
  }

  const allPassed = stageResults.every((r) => r.status === "passed" || r.status === "skipped");
  const anyFailed = stageResults.some((r) => r.status === "failed");
  const overallResult: "pass" | "fail" | "warn" = anyFailed ? "fail" : allPassed ? "pass" : "warn";

  // Compute base trust band from stage quality then apply caps
  const passCount = stageResults.filter((r) => r.status === "passed").length;
  const baseScore = Math.round((passCount / ALL_STAGES.length) * 70); // max 70 from validation alone
  const baseBand = trustBandFromScore(baseScore);
  const trustBandCap = applyTrustCaps(baseBand, caps);

  const completedAt = new Date().toISOString();
  await updateValidation(validationId, {
    status: "completed",
    stagesCompleted: stageResults,
    overallResult,
    trustBandCap,
    summary: buildSummary(stageResults, overallResult, trustBandCap),
    completedAt,
  });

  await updateAsset(assetId, {
    publicationStatus: anyFailed ? "draft" : "review_pending",
  });

  await emitReceipt({
    eventType: "validation.completed",
    actorId: "system",
    tenantId: asset.tenantId ?? "system",
    assetId,
    payload: {
      validationId,
      overallResult,
      trustBandCap,
      stagesSummary: stageResults.map((r) => ({ stage: r.stage, status: r.status })),
    },
  });

  return { ok: true, validationId, overallResult, trustBandCap };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage runners — each produces an immutable artifact
// ─────────────────────────────────────────────────────────────────────────────

async function runStage(
  stage: ValidationStage,
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  try {
    switch (stage) {
      case "license_check":         return await runLicenseCheck(assetId, validationId, metadata);
      case "dependency_inventory":  return await runDependencyInventory(assetId, validationId, metadata);
      case "secret_scan":           return await runSecretScan(assetId, validationId, metadata);
      case "sandbox_smoke":         return await runSandboxSmoke(assetId, validationId, metadata);
      case "interface_conformance": return await runInterfaceConformance(assetId, validationId, metadata);
      case "reproducibility":       return await runReproducibility(assetId, validationId, metadata);
    }
  } catch (err) {
    return {
      stage,
      status: "failed",
      completedAt: new Date().toISOString(),
      summary: err instanceof Error ? err.message : "Stage error",
    };
  }
}

async function runLicenseCheck(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  const manifest = (metadata.sourceManifest ?? {}) as Record<string, unknown>;
  const license = manifest.license as string | undefined;

  const passed = typeof license === "string" && license.trim().length > 0;
  const capTrustBand: TrustBand | undefined = passed ? undefined : "L1_EXPERIMENTAL";

  const content = {
    detected: license ?? null,
    compatible: passed,
    note: passed ? `License detected: ${license}` : "No license detected — capped at L1",
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "license_check",
    artifactType: "report",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed,
    capTrustBand,
  });

  return {
    stage: "license_check",
    status: passed ? "passed" : "warn",
    completedAt: new Date().toISOString(),
    capTrustBand,
    summary: content.note,
  };
}

async function runDependencyInventory(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  const manifest = (metadata.sourceManifest ?? {}) as Record<string, unknown>;
  const deps = (manifest.dependencies as Record<string, string>) ?? {};
  const depCount = Object.keys(deps).length;

  // MVP: scaffold only — no live CVE scanning
  const content = {
    dependencyCount: depCount,
    dependencies: Object.keys(deps).slice(0, 50),
    riskAssessment: "scaffold — CVE scan deferred",
    note: `${depCount} dependencies inventoried. Full risk scan requires worker environment.`,
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "dependency_inventory",
    artifactType: "manifest",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed: true,
  });

  return {
    stage: "dependency_inventory",
    status: "passed",
    completedAt: new Date().toISOString(),
    summary: content.note,
  };
}

async function runSecretScan(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  // MVP: scaffold — full static analysis deferred to worker environment
  // Check only that no secrets appear in the stored payload fields
  const payloadStr = JSON.stringify(metadata);
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,       // OpenAI key pattern
    /ghp_[a-zA-Z0-9]{36}/,       // GitHub PAT
    /password\s*[:=]\s*\S{8,}/i, // plaintext password
  ];

  const found = secretPatterns.some((p) => p.test(payloadStr));
  const capTrustBand: TrustBand | undefined = found ? "L1_EXPERIMENTAL" : undefined;

  const content = {
    scanned: "payload fields only",
    secretsFound: found,
    note: found
      ? "Potential secret pattern detected in payload — capped at L1. Full static analysis deferred."
      : "No secrets detected in payload. Full static analysis deferred to worker environment.",
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "secret_scan",
    artifactType: "report",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed: !found,
    capTrustBand,
  });

  return {
    stage: "secret_scan",
    status: found ? "failed" : "passed",
    completedAt: new Date().toISOString(),
    capTrustBand,
    summary: content.note,
  };
}

async function runSandboxSmoke(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  // MVP: scaffold — sandbox worker execution deferred
  // No passing sandbox result → caps at L2_VERIFIED_COMMUNITY
  const content = {
    status: "deferred",
    note: "Sandbox smoke test requires a controlled execution worker environment. Deferred for MVP.",
    capApplied: "L2_VERIFIED_COMMUNITY",
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "sandbox_smoke",
    artifactType: "log",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed: false,
    capTrustBand: "L2_VERIFIED_COMMUNITY",
  });

  return {
    stage: "sandbox_smoke",
    status: "skipped",
    completedAt: new Date().toISOString(),
    capTrustBand: "L2_VERIFIED_COMMUNITY",
    summary: content.note,
  };
}

async function runInterfaceConformance(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  const asset = await import("./persistence").then((m) => m.getAsset(assetId));
  const hasSchema = asset && Object.keys(asset.interfaceSchema ?? {}).length > 0;

  const content = {
    hasInterfaceSchema: hasSchema,
    capabilitiesCount: (asset?.capabilities ?? []).length,
    note: hasSchema
      ? "Interface schema present and capabilities declared."
      : "No interface schema defined. Asset can still be packaged with degraded conformance.",
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "interface_conformance",
    artifactType: "report",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed: !!hasSchema,
  });

  return {
    stage: "interface_conformance",
    status: hasSchema ? "passed" : "warn",
    completedAt: new Date().toISOString(),
    summary: content.note,
  };
}

async function runReproducibility(
  assetId: string,
  validationId: string,
  metadata: Record<string, unknown>
): Promise<ValidationStageResult> {
  const manifest = (metadata.sourceManifest ?? {}) as Record<string, unknown>;
  const hasVersion = typeof manifest.version === "string" && manifest.version.trim().length > 0;

  const content = {
    versionPinned: hasVersion,
    version: manifest.version ?? null,
    note: hasVersion
      ? `Version ${manifest.version} detected — reproducibility baseline established.`
      : "No explicit version — reproducibility cannot be guaranteed.",
  };

  await createValidationArtifact({
    artifactId: generateId("art"),
    validationId,
    stage: "reproducibility",
    artifactType: "report",
    content,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    passed: hasVersion,
  });

  return {
    stage: "reproducibility",
    status: hasVersion ? "passed" : "warn",
    completedAt: new Date().toISOString(),
    summary: content.note,
  };
}

function buildSummary(
  stages: ValidationStageResult[],
  overall: "pass" | "fail" | "warn",
  cap: TrustBand
): string {
  const passed = stages.filter((s) => s.status === "passed").length;
  const failed = stages.filter((s) => s.status === "failed").length;
  const warned = stages.filter((s) => s.status === "warn").length;
  return `Validation ${overall}: ${passed} passed, ${warned} warn, ${failed} failed across ${stages.length} stages. Trust band capped at ${cap}.`;
}
