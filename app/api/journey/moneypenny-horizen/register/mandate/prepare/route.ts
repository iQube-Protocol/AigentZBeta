/**
 * POST /api/journey/moneypenny-horizen/register/mandate/prepare
 *
 * Register ceremony, step 1 (Wallet Signing Topology, operator ruling
 * 2026-08-01). Creates the PRINCIPAL-role SigningRequest — "authorize
 * registration" — the operator's own wallet must sign before anything else
 * happens. Signs NOTHING itself; only prepares the request the wallet's
 * Pending Actions section will render.
 *
 * This is the FIRST step of the Register stage now — the old direct
 * register/prepare + register/broadcast routes (which fired a real
 * server-custodial signature as the consequence of a single authenticated
 * "confirm" click) are retired. There is no administrative fallback: this
 * ceremony is the only path from "operator wants to register this agent" to
 * a signed, broadcast Horizen transaction.
 *
 * Spine-gated: getActivePersona resolves the operator, who becomes the
 * request's principalPersonaId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { prepareRegistrationMandate } from '@/services/horizen/registerCeremony';

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
  const result = await prepareRegistrationMandate(
    { agentSlug: body.agentSlug, principalPersonaId: persona.personaId },
    { agentCardBase: origin },
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, request: result.value });
}
