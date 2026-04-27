/**
 * POST /api/codex/agentiq-os/ecosystem-signup
 *
 * Records a developer as a nanOS Bridge candidate. Emits a receipt-eligible
 * OrchestrationEvent that signals readiness for production ecosystem review.
 *
 * The nanOS Population Console will see this event via the AgentiQ OS Bridge
 * tab when querying orchestration_events for agentiq-os-cartridge candidates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

const BRIDGE_STAGES = [
  'open_onboarding',
  'developer_active',
  'contributor_candidate',
  'registry_candidate',
  'studio_candidate',
  'partner_candidate',
  'nanos_onboarded',
] as const;

type BridgeStage = typeof BRIDGE_STAGES[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      persona_id,
      bridge_stage,
      display_name,
      completed_missions = [],
      notes,
    } = body as {
      persona_id?: string;
      bridge_stage?: BridgeStage;
      display_name?: string;
      completed_missions?: string[];
      notes?: string;
    };

    if (!persona_id || typeof persona_id !== 'string') {
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    }

    const stage = (BRIDGE_STAGES.includes(bridge_stage as BridgeStage)
      ? bridge_stage
      : 'open_onboarding') as BridgeStage;

    const eventId = `signup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    void emitOrchestrationEvent({
      event_id: eventId,
      timestamp: new Date().toISOString(),
      event_type: 'z_delegated',
      from_role: 'aigent-z',
      to_role: 'aigent-c',
      reason: `AgentiQ OS ecosystem signup: ${stage} — persona ${persona_id}`,
      journey_stage: 'acolyte',
      active_cartridge: 'agentiq-os-cartridge',
      active_codex: 'agentiq-os-cartridge',
      receipt_eligible: true,
      metadata: {
        ecosystem_signup: true,
        bridge_stage: stage,
        persona_id,
        display_name: display_name ?? 'anonymous',
        completed_missions,
        notes: notes ?? '',
        agent_root_did: 'did:iqube:aigent-c-os-root',
        nanos_bridge_candidate: stage !== 'open_onboarding',
      },
    });

    const stageIndex = BRIDGE_STAGES.indexOf(stage);
    const nextStage = stageIndex < BRIDGE_STAGES.length - 1
      ? BRIDGE_STAGES[stageIndex + 1]
      : null;

    return NextResponse.json({
      ok: true,
      event_id: eventId,
      persona_id,
      bridge_stage: stage,
      next_stage: nextStage,
      receipt_eligible: true,
      message: stage === 'nanos_onboarded'
        ? 'Welcome to the nanOS ecosystem. The metaMe team will be in touch.'
        : `Registered as ${stage.replace(/_/g, ' ')}. Complete your next milestone to advance to ${nextStage?.replace(/_/g, ' ') ?? 'the final stage'}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
