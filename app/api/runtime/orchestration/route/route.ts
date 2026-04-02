/**
 * POST /api/runtime/orchestration/route
 *
 * Runtime routing stub — decides which orchestration role (metaMe, Aigent Z,
 * Aigent C, cartridge lead, specialist) should handle the current request.
 *
 * Epic 1 — AGT-105
 * Canonical source: docs/agent-harness/aigent-z-aigent-c-contract.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import type {
  RoutingRequest,
  RoutingResponse,
  AgentRoleId,
  HandoffPayload,
  OrchestrationDecision,
  JourneyStateSummary,
} from '@/types/orchestration';

export const dynamic = 'force-dynamic';

/**
 * Routing priority chain (deterministic):
 * 1. Policy violation → metaMe Guardian
 * 2. System/capability routing → Aigent Z
 * 3. Customer-facing interaction → Aigent C
 * 4. Active cartridge context → Cartridge Lead
 * 5. Bounded specialist task → Specialist
 * 6. Default → Aigent C with Z supervision
 */
function resolveActiveRole(request: RoutingRequest): AgentRoleId {
  // 1. Policy flags always go to guardian
  if (hasPolicyViolation(request)) return 'metame-guardian';

  // 2. System/routing decisions go to Z
  if (request.context_type === 'system_event') return 'aigent-z';
  if (request.context_type === 'guardian_check') return 'metame-guardian';

  // 3. Active cartridge actions go to cartridge lead
  if (request.context_type === 'cartridge_action' && request.active_cartridge) {
    return 'cartridge-lead';
  }

  // 4. User messages with active cartridge go to cartridge lead (if deep)
  if (
    request.context_type === 'user_message' &&
    request.active_cartridge &&
    request.journey_state_summary.experience_depth !== 'pill' &&
    request.journey_state_summary.experience_depth !== 'capsule'
  ) {
    return 'cartridge-lead';
  }

  // 5. Default: Aigent C handles customer interaction
  return 'aigent-c';
}

function hasPolicyViolation(request: RoutingRequest): boolean {
  const forbidden = request.policy_envelope.forbidden_actions;
  // Check for common policy violations in content
  const dangerPatterns = [
    /production\s+database/i,
    /service.role.key/i,
    /live.wallet/i,
    /sovereign.*iqube.*expose/i,
  ];
  return dangerPatterns.some((p) => p.test(request.content)) ||
    forbidden.some((f) => request.content.toLowerCase().includes(f.toLowerCase()));
}

function buildHandoff(
  fromRole: AgentRoleId,
  toRole: AgentRoleId,
  request: RoutingRequest
): HandoffPayload {
  return {
    handoff_id: crypto.randomUUID(),
    from_agent: fromRole,
    to_agent: toRole,
    reason: `Routing from ${fromRole} to ${toRole} based on context type: ${request.context_type}`,
    user_context_summary: `User is at journey stage ${request.journey_state_summary.journey_stage}. Active cartridge: ${request.active_cartridge ?? 'none'}.`,
    journey_state_summary: request.journey_state_summary,
    policy_envelope: request.policy_envelope,
    open_tasks: [],
    return_conditions: ['task_complete', 'policy_escalation', 'user_exit'],
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerIdentityContext(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Partial<RoutingRequest>;

    if (!body.journey_state_summary || !body.context_type) {
      return NextResponse.json(
        { error: 'journey_state_summary and context_type are required' },
        { status: 400 }
      );
    }

    const routingRequest: RoutingRequest = {
      persona_id: caller.authProfileId,
      tenant_id: body.tenant_id ?? 'default',
      session_id: body.session_id ?? crypto.randomUUID(),
      context_type: body.context_type,
      content: body.content ?? '',
      journey_state_summary: body.journey_state_summary,
      active_cartridge: body.active_cartridge ?? null,
      policy_envelope: body.policy_envelope ?? {
        tenant_id: body.tenant_id ?? 'default',
        persona_id: caller.authProfileId,
        allowed_surfaces: ['runtime', 'codex'],
        forbidden_actions: [],
        disclosure_class: 'persona',
        requires_guardian_approval: false,
        cartridge_scope: body.active_cartridge ?? null,
      },
    };

    const activeRole = resolveActiveRole(routingRequest);
    const previousRole: AgentRoleId = 'aigent-c'; // default previous role for stub

    const shouldHandoff = activeRole !== previousRole;
    const handoff = shouldHandoff
      ? buildHandoff(previousRole, activeRole, routingRequest)
      : null;

    const decision: OrchestrationDecision = {
      decision_id: crypto.randomUUID(),
      active_role: activeRole,
      handoff,
      nbe_recommendation: null, // populated by NBE engine in Epic 2
      policy_flags: hasPolicyViolation(routingRequest)
        ? ['policy_violation_detected']
        : [],
      receipt_eligible: activeRole === 'metame-guardian' || shouldHandoff,
      timestamp: new Date().toISOString(),
    };

    // Emit orchestration event (fire and forget)
    void emitOrchestrationEvent({
      event_id: crypto.randomUUID(),
      timestamp: decision.timestamp,
      event_type: shouldHandoff ? 'c_took_control' : 'z_delegated',
      from_role: previousRole,
      to_role: activeRole,
      reason: `Resolved via routing chain for context_type=${routingRequest.context_type}`,
      journey_stage: routingRequest.journey_state_summary.journey_stage,
      active_cartridge: routingRequest.active_cartridge,
      active_codex: routingRequest.journey_state_summary.active_codex,
      receipt_eligible: decision.receipt_eligible,
      metadata: { session_id: routingRequest.session_id },
    });

    const response: RoutingResponse = {
      active_role: activeRole,
      decision,
      should_handoff: shouldHandoff,
      handoff,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
