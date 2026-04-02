/**
 * journeyTelemetry.ts — Sprint 5, COD-501/503
 *
 * Emits telemetry for stage changes, NBE recommendations, handoffs,
 * and activations into orchestration_events. Also exposes guardian
 * recommendation input builder for COD-501 card binding.
 */

import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

export type JourneyTelemetryEvent =
  | 'stage_change'
  | 'nbe_recommendation'
  | 'handoff_initiated'
  | 'experience_activated'
  | 'investor_reactivation';

export interface JourneyTelemetryPayload {
  event: JourneyTelemetryEvent;
  persona_id: string;
  from_stage?: string;
  to_stage?: string;
  from_depth?: string;
  to_depth?: string;
  experience_id?: string;
  disposition?: string;
  agent_id?: string;
  rationale?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a journey telemetry event to orchestration_events.
 * Non-fatal — failures are logged but do not throw.
 */
export async function emitJourneyTelemetry(payload: JourneyTelemetryPayload): Promise<void> {
  await emitOrchestrationEvent({
    event_type: payload.event,
    actor_agent_id: payload.agent_id ?? 'aigent-z',
    persona_id: payload.persona_id,
    experience_id: payload.experience_id ?? null,
    payload: {
      from_stage: payload.from_stage,
      to_stage: payload.to_stage,
      from_depth: payload.from_depth,
      to_depth: payload.to_depth,
      disposition: payload.disposition,
      rationale: payload.rationale,
      ...payload.metadata,
    },
  });
}

/**
 * COD-501 — Build guardian recommendation context from journey state.
 * This structures the input for the NBE engine / guardian policy check.
 */
export function buildGuardianRecommendationInput(params: {
  personaId: string;
  stage: string;
  depth: string;
  experienceId?: string;
  disposition?: string;
}): Record<string, unknown> {
  return {
    persona_id: params.personaId,
    journey_stage: params.stage,
    current_depth: params.depth,
    current_experience_id: params.experienceId ?? null,
    proposed_disposition: params.disposition ?? 'act',
    policy_check_required: params.stage === 'zero' || params.disposition === 'escalate',
    timestamp: new Date().toISOString(),
  };
}
