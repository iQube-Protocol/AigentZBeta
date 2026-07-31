/**
 * GET /api/iqubes/[id]/policy
 *
 * Public policy summary for `id`. Returns ONLY the agent-readable
 * slice — allowed actions, policy/DVN requirements, visibility,
 * and an explicit "private payload is never exposed via this
 * route" assertion (`private_payload_exposed: false`).
 *
 * PRD §13 security rule: this route MUST never expose BlakQube
 * payload data. The shape is intentionally narrow and the Zod
 * schema's `private_payload_exposed: z.literal(false)` is the
 * structural lock — any code path that would set it true would
 * fail the schema validator and surface as a 500 rather than
 * leak.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildIQubeCard } from '@/services/iqube/legibility/cardBuilder';
import { getLegibilitySource } from '@/services/iqube/legibility/registry';
import {
  IQubePolicyResponseSchema,
  safeValidate,
} from '@/services/iqube/legibility/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=60');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(_req: NextRequest, props: RouteParams) {
  const params = await props.params;
  const id = params.id?.trim();
  if (!id) {
    return withCors(NextResponse.json({ error: 'Missing id' }, { status: 400 }));
  }

  const source = await getLegibilitySource(id);
  if (!source) {
    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }

  const card = buildIQubeCard(source);

  const candidate = {
    iqube_id: card.iqube_id,
    policy_id: card.policy.policy_id,
    visibility_state: card.visibility_state,
    allowed_actions: card.agent_permissions.allowed_actions,
    requires_policy_check: card.agent_permissions.requires_policy_check ?? [],
    requires_dvn_receipt: card.agent_permissions.requires_dvn_receipt ?? [],
    // Structural lock — see file header. The schema's literal(false)
    // means any drift here is caught at validation, not at runtime.
    private_payload_exposed: false as const,
  };

  const validated = safeValidate(IQubePolicyResponseSchema, candidate, `policy[${id}]`);
  if (!validated) {
    return withCors(NextResponse.json(
      { error: 'Invalid policy response' },
      { status: 500 },
    ));
  }

  return withCors(NextResponse.json(validated));
}
