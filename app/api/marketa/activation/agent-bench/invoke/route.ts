/**
 * POST /api/marketa/activation/agent-bench/invoke
 *
 * Agent Bench's invoke action (design doc §8 — "Agent Bench's existing
 * direct-call action... Rewire" — the piece named as not-yet-built).
 * Direct pattern (design doc §0): the operator clicked a specific card's
 * capability action, so `requestingAgentId` IS the resolved provider —
 * there is no orchestrator between an operator's Bench click and the agent
 * whose card they clicked.
 *
 * Body: { capabilityId: string, agentId: string }. `agentId` is the SAME
 * `runtimeAgentId` Agent Bench's own read model already carries as
 * `row.candidateId` — this route resolves the capability's current provider
 * itself (services/registry/capabilityProviderResolution.ts) rather than
 * trusting `agentId` as an instruction; a mismatch is refused
 * (`PROVIDER_MISMATCH`) by the gateway itself, not by this route.
 *
 * Spine-gated (getActivePersona) — every capability invocation carries a
 * real principal, same as every other governed act in this codebase.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { invokeCapability } from '@/services/registry/invocationGateway';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: { capabilityId?: string; agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const capabilityId = typeof body.capabilityId === 'string' ? body.capabilityId.trim() : '';
  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : '';
  if (!capabilityId || !agentId) {
    return NextResponse.json({ error: 'capabilityId and agentId are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const envelope: CapabilityInvocation = {
    mode: 'capability',
    invocationId: `capinv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    principalRef: personaPublicRef(persona.personaId),
    originatingSurface: 'agent-bench',
    requestingAgentId: agentId, // direct pattern — no orchestrator
    targetAgentId: agentId,
    capabilityId,
    runtimeMembershipRef: 'financial-services',
    executionMode: 'shadow',
    intent: `Agent Bench operator invocation of '${capabilityId}'`,
    input: {},
    policyBindingRefs: [],
    delegationDepth: 0,
    invocationPath: [],
    maxInvocationDepth: 2,
  };

  const decision = await invokeCapability(envelope, persona.personaId);
  return NextResponse.json({ ok: decision.decision === 'allow', decision }, { headers: { 'Cache-Control': 'no-store' } });
}
