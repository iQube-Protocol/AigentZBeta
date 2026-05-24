/**
 * POST /api/capabilities/invoke
 *
 * Smoke / dogfood endpoint for the Capability Gateway. Resolves the
 * caller's persona via the spine, builds a minimal `PolicyEnvelope`
 * from the request body, and runs the work order through
 * `executeCapability()` (gateway → adapter → receipt).
 *
 * Body:
 *   {
 *     adapter:           'openclaw',
 *     capability_intent? 'tool_gather' | 'tool_execute' | 'plan_step',
 *     capability_class:  'read' | 'search' | 'compose' | 'send' | 'write' | 'payment' | 'execute',
 *     tool_name:         string,
 *     input:             object,
 *     origin_surface:    string,
 *     cartridge:         string,
 *     policy?: {
 *       disclosure_class:           'public' | 'tenant' | 'persona' | 'sovereign',
 *       allowed_surfaces?:          string[],
 *       forbidden_actions?:         string[],
 *       requires_guardian_approval? boolean,
 *       cartridge_scope?:           string | null,
 *     },
 *     hasGuardianApproval? boolean,
 *   }
 *
 * Returns the AdapterResult plus the workOrder + receiptId so callers
 * can correlate against the activity_receipts table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { executeCapability } from '@/services/capabilities/execute';
import type { CapabilityClass, CapabilityIntent, PolicyEnvelope } from '@/services/capabilities/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  adapter?: 'openclaw';
  capability_intent?: CapabilityIntent;
  capability_class?: CapabilityClass;
  tool_name?: string;
  input?: Record<string, unknown>;
  origin_surface?: string;
  cartridge?: string;
  policy?: Partial<{
    disclosure_class: PolicyEnvelope['disclosure_class'];
    allowed_surfaces: string[];
    forbidden_actions: string[];
    requires_guardian_approval: boolean;
    cartridge_scope: string | null;
  }>;
  hasGuardianApproval?: boolean;
  cohortId?: string;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  if (!body.tool_name || !body.capability_class || !body.origin_surface || !body.cartridge) {
    return NextResponse.json(
      { ok: false, error: 'missing-fields', detail: 'tool_name, capability_class, origin_surface, cartridge are required' },
      { status: 400 },
    );
  }

  // Build the server-side PolicyEnvelope. T0 (`persona_id`, `tenant_id`)
  // is populated here and never crosses into the adapter.
  const envelope: PolicyEnvelope = {
    tenant_id: 'default',
    persona_id: persona.personaId,
    disclosure_class: body.policy?.disclosure_class ?? 'persona',
    allowed_surfaces: body.policy?.allowed_surfaces ?? [],
    forbidden_actions: body.policy?.forbidden_actions ?? [],
    requires_guardian_approval: body.policy?.requires_guardian_approval ?? false,
    cartridge_scope: body.policy?.cartridge_scope ?? null,
  };

  const result = await executeCapability({
    persona,
    envelope,
    adapter: body.adapter ?? 'openclaw',
    capability_intent: body.capability_intent ?? 'tool_gather',
    capability_class: body.capability_class,
    tool_name: body.tool_name,
    input: body.input ?? {},
    origin_surface: body.origin_surface,
    cartridge: body.cartridge,
    hasGuardianApproval: body.hasGuardianApproval ?? false,
    cohortId: body.cohortId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, stage: result.stage, reason: result.reason, detail: result.detail },
      { status: result.stage === 'gateway' && result.reason === 'persona-required' ? 401 : 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      workOrder: {
        workOrderId: result.workOrder.workOrderId,
        adapter: result.workOrder.adapter,
        capability_intent: result.workOrder.capability_intent,
        capability_class: result.workOrder.capability_class,
        tool_name: result.workOrder.tool_name,
        approval_state: result.workOrder.approval_state,
        policyHash: result.workOrder.policy.policyHash,
        cohortAliasCommitment: result.workOrder.policy.cohortAliasCommitment,
        issued_at: result.workOrder.issued_at,
      },
      result: result.adapterResult,
      receiptId: result.receiptId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
