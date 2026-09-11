/**
 * POST /api/moneypenny/factor/authority-chains/[chainId]/revoke —
 * immediate revocation (PRD §9.7/§9.17). The caller's own personaId is
 * passed as `expectedPrincipalPersonaId` — revokeChain refuses when the
 * chain belongs to a DIFFERENT principal (Phase 2 cross-principal
 * isolation closure), so a persona can only revoke chains they themselves
 * established.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { revokeChain } from '@/services/factor/authorityChain';
import { respondError } from '../../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // A body is optional here — reason defaults below.
  }

  try {
    await revokeChain(admin, chainId, persona.personaId, persona.personaId, typeof body.reason === 'string' ? body.reason : 'revoked via API');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondError(err);
  }
}
