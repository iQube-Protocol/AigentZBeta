/**
 * Client-side orchestration event emitter.
 *
 * POSTs to /api/runtime/orchestration so UI-side role transitions (NBE
 * launches, signal invocations, cartridge entries) join the same
 * orchestration_events audit trail as server-emitted events. Fire-and-forget:
 * failures are logged but never thrown — the audit trail must not block UX.
 *
 * For server-side emission use `emitOrchestrationEvent` from
 * ./orchestrationEvents directly (skips the HTTP hop).
 */

import { personaFetch } from "@/utils/personaSpine";
import type {
  AgentRoleId,
  JourneyStage,
  OrchestrationEventType,
} from "@/types/orchestration";

export interface ClientOrchestrationEventInput {
  event_type: OrchestrationEventType;
  persona_id: string;
  journey_stage?: JourneyStage | null;
  active_cartridge?: string | null;
  active_codex?: string | null;
  from_role?: AgentRoleId | null;
  to_role?: AgentRoleId | null;
  reason?: string;
  receipt_eligible?: boolean;
  metadata?: Record<string, unknown>;
}

export async function emitClientOrchestrationEvent(
  input: ClientOrchestrationEventInput,
): Promise<void> {
  try {
    await personaFetch("/api/runtime/orchestration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      personaIdHint: input.persona_id,
    });
  } catch (e) {
    console.warn("[emitClientOrchestrationEvent] failed", e);
  }
}
