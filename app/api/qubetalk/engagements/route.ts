/**
 * GET /api/qubetalk/engagements[?state=needs_user]
 *
 * Every engagement across EVERY publication the caller owns — "show me
 * responses that need me" (§10). Same service function Runtime's
 * Engagement tab and aigentMe's compact seam both call.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listEngagementsForOwner } from '@/services/qubetalk/engagement';
import type { QubeTalkEngagementState } from '@/types/qubetalk';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const state = req.nextUrl.searchParams.get('state');
  const result = await listEngagementsForOwner(persona.personaId, state ? (state as QubeTalkEngagementState) : undefined);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, engagements: result.value }, { headers: NO_STORE });
}
