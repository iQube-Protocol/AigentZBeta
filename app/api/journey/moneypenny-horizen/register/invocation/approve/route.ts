/**
 * POST /api/journey/moneypenny-horizen/register/invocation/approve
 *
 * Register ceremony, step 3 (Wallet Signing Topology, operator ruling
 * 2026-08-01). The subject agent's OWN wallet (e.g. Aigent Nakamoto's, at
 * /aigents/nakamoto) explicitly approves invocation of its custodied key —
 * THIS is the only moment `AgentKeyService` is touched to sign and broadcast
 * the Horizen registration transaction. The private key never leaves
 * AgentKeyService/broadcastAgentRegistration's stack frame — this route
 * only carries the explicit approval, never a key.
 *
 * No body beyond requestId: this action has no signature payload from the
 * caller (unlike the principal mandate) — approving IS the trigger for the
 * bounded custody service, per the ruling's governing distinction: "The
 * agent signature controls or executes the agent-side act... custody may
 * remain bounded behind the wallet."
 *
 * Spine-gated: getActivePersona resolves the caller. Not further
 * admin-restricted — mirrors the existing access level of
 * app/(shell)/aigents/[agentKey]/page.tsx, which already mounts
 * AgentWalletDrawer with no additional gate of its own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { approveAgentRegistryInvocation } from '@/services/horizen/registerCeremony';

export const dynamic = 'force-dynamic';

interface ApproveBody {
  requestId?: string;
}

/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 *
 * An unanticipated throw here — a Supabase client error, a partner socket
 * dropped, an import that fails at runtime — left the platform to answer, and
 * what it sends is not guaranteed to be JSON and can be nothing at all. A
 * thrown error is still information; discarding it and returning silence is
 * the defect. Enforced across every journey route by
 * tests/journey-response-honesty.test.ts.
 */
export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: ApproveBody = {};
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.requestId) {
    return NextResponse.json({ ok: false, error: 'requestId is required' }, { status: 400 });
  }

  const origin = resolveRequestOrigin(request);
  const result = await approveAgentRegistryInvocation({ requestId: body.requestId }, { agentCardBase: origin });

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    txHash: result.value.txHash,
    ownerWalletAddress: result.value.ownerWalletAddress,
    network: result.value.network,
  });
}
