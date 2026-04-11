/**
 * IntakeService — accepts and records inbound ingestion submissions.
 *
 * This is the entry point for all Registry Ingestion Factory flows.
 * It validates the submission shape, persists the IntakeQube, and emits
 * an intake.created receipt.
 */

import { createIntake, updateIntake } from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import {
  CreateIntakeRequest,
  IntakeQube,
  IngestionStage,
  IngestionStageEvent,
} from "@/types/registryIngestion";

function generateId(): string {
  return `intake_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const VALID_SOURCE_TYPES = new Set([
  "github_repo",
  "package_ref",
  "mcp_endpoint",
  "archive",
  "manual_bundle",
  "workflow_def",
]);

export interface IntakeServiceResult {
  ok: boolean;
  intake?: IntakeQube;
  error?: string;
}

export async function submitIntake(req: CreateIntakeRequest): Promise<IntakeServiceResult> {
  if (!VALID_SOURCE_TYPES.has(req.sourceType)) {
    return { ok: false, error: `Unknown sourceType: ${req.sourceType}` };
  }
  if (!req.tenantId || !req.submittedBy) {
    return { ok: false, error: "tenantId and submittedBy are required" };
  }

  const intakeId = generateId();

  try {
    const intake = await createIntake({
      intakeId,
      tenantId: req.tenantId,
      submittedBy: req.submittedBy,
      sourceType: req.sourceType,
      sourceUri: req.sourceUri,
      sourcePayload: req.sourcePayload ?? {},
    });

    await emitReceipt({
      eventType: "intake.created",
      actorId: req.submittedBy,
      tenantId: req.tenantId,
      intakeId,
      payload: {
        intakeId,
        sourceType: req.sourceType,
        sourceUri: req.sourceUri,
      },
    });

    return { ok: true, intake };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Intake creation failed" };
  }
}

export async function advanceIntakeStage(
  intakeId: string,
  stage: IngestionStage,
  currentHistory: IngestionStageEvent[],
  metadata?: Record<string, unknown>,
  error?: string
): Promise<IntakeQube> {
  const event: IngestionStageEvent = {
    stage,
    enteredAt: new Date().toISOString(),
    metadata,
    error,
  };
  return updateIntake(intakeId, {
    currentStage: stage,
    stageHistory: [...currentHistory, event],
  });
}
