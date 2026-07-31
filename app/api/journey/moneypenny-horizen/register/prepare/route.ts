/**
 * POST /api/journey/moneypenny-horizen/register/prepare
 *
 * Register stage, step 1 of 3 (agent-selectable, 2026-07-31,
 * services/horizen/registrationClient.ts). Builds the unsigned Horizen
 * ERC-8004 registration transaction for the selected agent and returns it for
 * the operator to review — signs NOTHING. Mirrors
 * scripts/register-moneypenny-horizen.ts's own printed-tx-then-confirm gate,
 * translated from a blocking CLI readline prompt into a request/response the
 * Register stage UI can render as a review step.
 *
 * Spine-gated: resolves the caller's OWN active persona via getActivePersona
 * (recorded nowhere yet at this step — no receipt is written until broadcast).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { prepareAgentRegistration } from '@/services/horizen/registrationClient';

export const dynamic = 'force-dynamic';

interface PrepareBody {
  agentSlug?: string;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: PrepareBody = {};
  try {
    body = (await request.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.agentSlug) {
    return NextResponse.json({ ok: false, error: 'agentSlug is required' }, { status: 400 });
  }

  const origin = resolveRequestOrigin(request);
  const result = await prepareAgentRegistration({ agentSlug: body.agentSlug, agentCardBase: origin });

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}
