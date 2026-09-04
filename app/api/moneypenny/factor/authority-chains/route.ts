/**
 * POST /api/moneypenny/factor/authority-chains — establishes a Factor
 * authority chain (PRD §2.1). `mode: 'direct'` requires an existing active
 * delegation_grants row (services/factor/authorityChain.ts's
 * establishDirectChain refuses otherwise); `mode: 'moneypenny_mediated'`
 * requires the caller to explicitly assert `subdelegationPermitted: true`
 * — never inferred from a MoneyPenny session merely existing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { establishDirectChain, establishMediatedChain } from '@/services/factor/authorityChain';
import { respondError } from '../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const targetAgentRef = typeof body.targetAgentRef === 'string' ? body.targetAgentRef : null;
  const allowedActions = Array.isArray(body.allowedActions) ? body.allowedActions.filter((a): a is string => typeof a === 'string') : [];
  if (!targetAgentRef || allowedActions.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'targetAgentRef and a non-empty allowedActions array are required.' }, { status: 400 });
  }

  try {
    if (body.mode === 'moneypenny_mediated') {
      const mediatorAgentRef = typeof body.mediatorAgentRef === 'string' ? body.mediatorAgentRef : null;
      const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : null;
      if (!mediatorAgentRef || !expiresAt) {
        return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'mediatorAgentRef and expiresAt are required for mode=moneypenny_mediated.' }, { status: 400 });
      }
      const chain = await establishMediatedChain(admin, {
        principalPersonaId: persona.personaId,
        mediatorAgentRef,
        targetAgentRef,
        subdelegationPermitted: body.subdelegationPermitted === true,
        allowedActions,
        expiresAt,
      });
      return NextResponse.json({ ok: true, chain });
    }

    const targetAgentRootDid = typeof body.targetAgentRootDid === 'string' ? body.targetAgentRootDid : null;
    if (!targetAgentRootDid) {
      return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'targetAgentRootDid is required for mode=direct.' }, { status: 400 });
    }
    const chain = await establishDirectChain(admin, {
      principalPersonaId: persona.personaId,
      targetAgentRef,
      targetAgentRootDid,
      allowedActions,
    });
    return NextResponse.json({ ok: true, chain });
  } catch (err) {
    return respondError(err);
  }
}
