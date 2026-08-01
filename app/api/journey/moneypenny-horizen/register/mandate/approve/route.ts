/**
 * POST /api/journey/moneypenny-horizen/register/mandate/approve
 *
 * Register ceremony, step 2 (Wallet Signing Topology, operator ruling
 * 2026-08-01). The operator's OWN wallet has signed the mandate payload
 * client-side (never a raw-message-signing surface — this is the one
 * purpose-bound payload the "Authorize registration" Pending Action ever
 * asks for); this route verifies the recovered signer against the
 * operator's on-file wallet address, records evidence, and — only on
 * success — creates the follow-on agent-role SigningRequest that appears in
 * the subject agent's OWN wallet as "Approve invocation of custodied key."
 *
 * Spine-gated: getActivePersona resolves the caller, cross-checked against
 * the request's own principalPersonaId — a request cannot be approved by
 * anyone other than the persona it was prepared for.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { approvePrincipalRegistrationMandate } from '@/services/horizen/registerCeremony';

export const dynamic = 'force-dynamic';

interface ApproveBody {
  requestId?: string;
  signature?: string;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: ApproveBody = {};
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.requestId || !body.signature) {
    return NextResponse.json({ ok: false, error: 'requestId and signature are required' }, { status: 400 });
  }

  const origin = resolveRequestOrigin(request);
  const result = await approvePrincipalRegistrationMandate(
    { requestId: body.requestId, principalPersonaId: persona.personaId, signature: body.signature },
    { agentCardBase: origin },
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    mandateRequest: result.value.mandateRequest,
    agentInvocationRequest: result.value.agentInvocationRequest,
  });
}
