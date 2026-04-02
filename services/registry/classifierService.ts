/**
 * ClassifierService — maps a SourceQube to a canonical RegistryAssetClass.
 *
 * Examines the fetched manifest and source payload to determine whether
 * the asset should be packaged as a ToolQube, SkillQube, WorkflowQube,
 * or ConnectorQube, and which WrapperStrategy applies.
 */

import { emitReceipt } from "./receiptEmitter";
import { advanceIntakeStage } from "./intakeService";
import { getIntake } from "./persistence";
import {
  RegistryAssetClass,
  WrapperStrategy,
  IngestionSourceType,
  SourceManifest,
} from "@/types/registryIngestion";

export interface ClassificationResult {
  assetClass: RegistryAssetClass;
  wrapperStrategy: WrapperStrategy;
  detectedCapabilities: string[];
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export interface ClassifierResult {
  ok: boolean;
  classification?: ClassificationResult;
  error?: string;
}

export async function classifySource(
  intakeId: string,
  sourceType: IngestionSourceType,
  manifest: SourceManifest,
  payload: Record<string, unknown>
): Promise<ClassifierResult> {
  const intake = await getIntake(intakeId);
  if (!intake) return { ok: false, error: `Intake not found: ${intakeId}` };

  await advanceIntakeStage(intakeId, "source.classifying", intake.stageHistory);

  const classification = inferClassification(sourceType, manifest, payload);

  await advanceIntakeStage(intakeId, "source.classified", intake.stageHistory, {
    assetClass: classification.assetClass,
    wrapperStrategy: classification.wrapperStrategy,
    confidence: classification.confidence,
  });

  await emitReceipt({
    eventType: "source.classified",
    actorId: "system",
    tenantId: intake.tenantId,
    intakeId,
    payload: {
      assetClass: classification.assetClass,
      wrapperStrategy: classification.wrapperStrategy,
      confidence: classification.confidence,
      rationale: classification.rationale,
    },
  });

  return { ok: true, classification };
}

function inferClassification(
  sourceType: IngestionSourceType,
  manifest: SourceManifest,
  payload: Record<string, unknown>
): ClassificationResult {
  // Explicit override from submitter takes highest priority
  if (typeof payload.assetClass === "string") {
    const explicit = payload.assetClass as RegistryAssetClass;
    const validClasses: RegistryAssetClass[] = ["ToolQube", "SkillQube", "WorkflowQube", "ConnectorQube"];
    if (validClasses.includes(explicit)) {
      return {
        assetClass: explicit,
        wrapperStrategy: inferWrapperStrategy(explicit, sourceType, manifest),
        detectedCapabilities: extractCapabilities(manifest, payload),
        confidence: "high",
        rationale: "Explicit assetClass override from submitter",
      };
    }
  }

  // MCP endpoints → ConnectorQube
  if (sourceType === "mcp_endpoint") {
    return {
      assetClass: "ConnectorQube",
      wrapperStrategy: "mcp",
      detectedCapabilities: extractCapabilities(manifest, payload),
      confidence: "high",
      rationale: "MCP endpoint source type maps to ConnectorQube + mcp wrapper",
    };
  }

  // Workflow definitions → WorkflowQube
  if (sourceType === "workflow_def") {
    return {
      assetClass: "WorkflowQube",
      wrapperStrategy: "workflow",
      detectedCapabilities: extractCapabilities(manifest, payload),
      confidence: "high",
      rationale: "Workflow definition source type maps to WorkflowQube",
    };
  }

  const keywords = [...(manifest.keywords ?? [])].map((k) => k.toLowerCase());
  const name = (manifest.name ?? "").toLowerCase();
  const description = (manifest.description ?? "").toLowerCase();
  const combined = `${name} ${description} ${keywords.join(" ")}`;

  // Skill indicators
  const isSkill =
    keywords.some((k) => ["skill", "prompt", "chain", "agent-skill"].includes(k)) ||
    combined.includes("skill") ||
    combined.includes("research") ||
    combined.includes("draft") ||
    combined.includes("workflow-step") ||
    sourceType === "manual_bundle";

  if (isSkill) {
    return {
      assetClass: "SkillQube",
      wrapperStrategy: "skill",
      detectedCapabilities: extractCapabilities(manifest, payload),
      confidence: "medium",
      rationale: "Keywords or source type suggest a composable skill bundle",
    };
  }

  // Browser automation indicators
  const isBrowserOp =
    keywords.some((k) => ["browser", "playwright", "puppeteer", "selenium"].includes(k)) ||
    combined.includes("browser") ||
    combined.includes("automation") ||
    combined.includes("scrape");

  if (isBrowserOp) {
    return {
      assetClass: "ToolQube",
      wrapperStrategy: "browser",
      detectedCapabilities: extractCapabilities(manifest, payload),
      confidence: "medium",
      rationale: "Browser automation keywords detected",
    };
  }

  // Default: ToolQube with http wrapper for GitHub/package/archive imports
  return {
    assetClass: "ToolQube",
    wrapperStrategy: inferWrapperStrategy("ToolQube", sourceType, manifest),
    detectedCapabilities: extractCapabilities(manifest, payload),
    confidence: "low",
    rationale: "No strong signals detected; defaulting to ToolQube",
  };
}

function inferWrapperStrategy(
  assetClass: RegistryAssetClass,
  sourceType: IngestionSourceType,
  manifest: SourceManifest
): WrapperStrategy {
  if (assetClass === "ConnectorQube") return "mcp";
  if (assetClass === "WorkflowQube") return "workflow";
  if (assetClass === "SkillQube") return "skill";
  // ToolQube: check if it's a CLI/container pattern
  const name = (manifest.name ?? "").toLowerCase();
  const hasBin = (manifest.entryPoints ?? []).length > 0;
  if (hasBin || sourceType === "archive") return "cli_container";
  return "http";
}

function extractCapabilities(
  manifest: SourceManifest,
  payload: Record<string, unknown>
): string[] {
  const caps: string[] = [];
  if (Array.isArray(payload.capabilities)) {
    for (const c of payload.capabilities) {
      if (typeof c === "string") caps.push(c);
      else if (typeof c === "object" && c && typeof (c as Record<string, unknown>).name === "string") {
        caps.push((c as Record<string, unknown>).name as string);
      }
    }
  }
  if (Array.isArray(manifest.detectedCapabilities)) {
    caps.push(...manifest.detectedCapabilities);
  }
  if (Array.isArray(manifest.exports)) {
    caps.push(...manifest.exports.slice(0, 10));
  }
  return [...new Set(caps)];
}
