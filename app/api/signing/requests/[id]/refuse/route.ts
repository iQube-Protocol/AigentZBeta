/**
 * POST /api/signing/requests/[id]/refuse
 *
 * Either wallet's "decline" action on a pending Pending Action (Wallet
 * Signing Topology, operator ruling 2026-08-01). A principal may only refuse
 * their OWN request; refusing an agent-role request is likewise scoped to
 * the request's own principalPersonaId (the operator who is entitled to act
 * on that agent's behalf for this ceremony), consistent with every other
 * route in this substrate never trusting a caller-declared identity beyond
 * what getActivePersona resolves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSigningRequest, updateSigningRequest } from '@/services/signing/signingRequestStore';

export const dynamic = 'force-dynamic';

interface RefuseBody {
  reason?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;
  const existing = await getSigningRequest(id);
  if (!existing) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
  if (existing.principalPersonaId !== persona.personaId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ ok: false, refusalCode: 'NOT_PENDING', error: `request is "${existing.status}", not pending` }, { status: 409 });
  }

  let body: RefuseBody = {};
  try {
    body = (await request.json()) as RefuseBody;
  } catch {
    // Body is optional for a refusal.
  }

  const updated = await updateSigningRequest(id, {
    status: 'refused',
    refusalCode: 'OPERATOR_DECLINED',
    refusalDetail: body.reason ?? 'declined from the wallet',
  });
  return NextResponse.json({ ok: true, request: updated });
}
