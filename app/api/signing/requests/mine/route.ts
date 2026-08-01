/**
 * GET /api/signing/requests/mine
 *
 * A principal's OWN pending Pending Actions — the wallet drawer's Pending
 * Actions section reads this (Wallet Signing Topology, operator ruling
 * 2026-08-01). Owner self-view exception (CLAUDE.md): returns only the
 * caller's own persona's rows, verified server-side via getActivePersona —
 * never another persona's.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listPendingSigningRequestsForPrincipal } from '@/services/signing/signingRequestStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const requests = await listPendingSigningRequestsForPrincipal(persona.personaId);
  return NextResponse.json({ ok: true, requests });
}
