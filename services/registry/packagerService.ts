/**
 * PackagerService — normalises a classified source into a canonical AgentiQ asset.
 *
 * Transforms the raw SourceQube + ClassificationResult into a proper
 * RegistryAsset (ToolQube | SkillQube | WorkflowQube | ConnectorQube)
 * with a PolicyQube and an initial version snapshot.
 *
 * IMPORTANT: SKILL.md-style input is treated as an import format only.
 * It is normalised into AgentiQ-native SkillQube + PolicyQube — not stored
 * as-is as the internal schema.
 */

import { createAsset, createSource, updateIntake, getIntake } from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import { advanceIntakeStage } from "./intakeService";
import type { ClassificationResult } from "./classifierService";
import {
  CapabilityDescriptor,
  PolicyClass,
  RegistryAssetClass,
  SourceManifest,
  WrapperStrategy,
} from "@/types/registryIngestion";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Derives the default PolicyClass from the WrapperStrategy. */
function defaultPolicyClass(wrapperStrategy: WrapperStrategy, assetClass: RegistryAssetClass): PolicyClass {
  switch (wrapperStrategy) {
    case "browser": return "browser_operator";
    case "cli_container": return "sandbox_exec";
    case "mcp": return "network_limited";
    case "http": return "network_limited";
    case "skill": return "read_only";
    case "workflow": return "network_limited";
    default: return "read_only";
  }
}

function buildCapabilities(
  manifest: SourceManifest,
  detected: string[]
): CapabilityDescriptor[] {
  return detected.map((name) => ({
    name,
    description: `Detected capability: ${name}`,
    tags: [],
  }));
}

export interface PackageResult {
  ok: boolean;
  assetId?: string;
  error?: string;
}

export async function packageAsset(
  intakeId: string,
  sourceId: string,
  manifest: SourceManifest,
  classification: ClassificationResult,
  submitterPayload: Record<string, unknown>
): Promise<PackageResult> {
  const intake = await getIntake(intakeId);
  if (!intake) return { ok: false, error: `Intake not found: ${intakeId}` };

  await advanceIntakeStage(intakeId, "asset.packaging", intake.stageHistory, {
    assetClass: classification.assetClass,
  });
  await updateIntake(intakeId, { status: "packaging" });

  const assetId = generateId("asset");
  const rawName = (submitterPayload.name as string) ?? manifest.name ?? "unnamed-asset";
  const name = rawName;
  const slug = slugify(rawName);
  const description = (submitterPayload.description as string) ?? manifest.description;
  const policyClass = defaultPolicyClass(classification.wrapperStrategy, classification.assetClass);
  const capabilities = buildCapabilities(manifest, classification.detectedCapabilities);
  const tags = [
    ...(manifest.keywords ?? []),
    ...(Array.isArray(submitterPayload.tags) ? (submitterPayload.tags as string[]) : []),
  ].slice(0, 20);

  // Build class-specific metadata
  const metadata: Record<string, unknown> = {
    sourceManifest: manifest,
    classificationRationale: classification.rationale,
    classificationConfidence: classification.confidence,
  };

  if (classification.assetClass === "SkillQube") {
    // Normalise SKILL.md-style payload into native SkillQube fields
    metadata.steps = extractSkillSteps(submitterPayload, manifest);
  }
  if (classification.assetClass === "WorkflowQube") {
    metadata.workflowEngine = (submitterPayload.engine as string) ?? "inline";
    metadata.triggerType = (submitterPayload.triggerType as string) ?? "manual";
  }
  if (classification.assetClass === "ConnectorQube") {
    metadata.endpointUrl = intake.sourceUri;
    metadata.authScheme = (submitterPayload.authScheme as string) ?? "none";
  }

  try {
    await createAsset({
      assetId,
      tenantId: intake.tenantId,
      assetClass: classification.assetClass,
      name,
      slug,
      description,
      sourceId,
      intakeId,
      policyClass,
      wrapperStrategy: classification.wrapperStrategy,
      interfaceSchema: (submitterPayload.interfaceSchema as Record<string, unknown>) ?? {},
      capabilities,
      tags,
      metadata,
      createdBy: intake.submittedBy,
    });

    await updateIntake(intakeId, {
      assetId,
      status: "validating",
    });

    await advanceIntakeStage(intakeId, "asset.packaged", intake.stageHistory, { assetId });

    await emitReceipt({
      eventType: "asset.packaged",
      actorId: intake.submittedBy,
      tenantId: intake.tenantId,
      intakeId,
      assetId,
      payload: {
        assetId,
        assetClass: classification.assetClass,
        name,
        slug,
        policyClass,
        wrapperStrategy: classification.wrapperStrategy,
      },
    });

    return { ok: true, assetId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Packaging failed";
    await advanceIntakeStage(intakeId, "ingestion.failed", intake.stageHistory, undefined, errMsg);
    await updateIntake(intakeId, { status: "failed", failureReason: errMsg });
    return { ok: false, error: errMsg };
  }
}

/** Extracts skill steps from SKILL.md-style or structured payload. */
function extractSkillSteps(
  payload: Record<string, unknown>,
  manifest: SourceManifest
): Array<{ name: string; tool?: string; prompt?: string }> {
  if (Array.isArray(payload.steps)) {
    return (payload.steps as Array<Record<string, unknown>>).map((s) => ({
      name: String(s.name ?? "step"),
      tool: typeof s.tool === "string" ? s.tool : undefined,
      prompt: typeof s.prompt === "string" ? s.prompt : undefined,
    }));
  }
  // Parse SKILL.md-style `## Steps` section from description if present
  const description = (payload.skillMdContent as string) ?? (manifest.description ?? "");
  const stepLines = description
    .split("\n")
    .filter((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))
    .slice(0, 20)
    .map((l, i) => ({ name: l.replace(/^[-*]\s+/, "").trim() || `step-${i + 1}` }));
  return stepLines;
}
