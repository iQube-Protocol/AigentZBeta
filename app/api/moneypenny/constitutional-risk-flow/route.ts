/**
 * GET /api/moneypenny/constitutional-risk-flow — Use Case Zero build-order
 * item 10a. Owner self-view over the Constitutional Risk Flow chain state
 * for one (persona, requestRef) pair — see
 * `services/vela/velaUnderwritingChainProjection.ts` for the full read-only
 * assembly this route is a thin wrapper over.
 *
 * Spine endpoint (calls `getActivePersona`) — any client call MUST use
 * `personaFetch`, never raw `fetch` (CLAUDE.md Identity & Access Spine,
 * PARAMOUNT). Persona-scoped throughout: `getConstitutionalRiskFlowState`
 * only ever reads the CALLING persona's own `activity_receipts` rows — the
 * same T1 self-view exposure class as every other persona-scoped
 * MoneyPenny read route (e.g. `/api/moneypenny/financial-profile`).
 *
 * `?requestRef=` is REQUIRED — there is no "list my requests" concept yet
 * (no route/UI in this codebase enumerates a persona's own requestRefs), so
 * the caller must already know which request to view (the panel's own text
 * input). 400 when absent/empty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const requestRef = req.nextUrl.searchParams.get('requestRef')?.trim() ?? '';
  if (!requestRef) {
    return NextResponse.json({ ok: false, error: 'requestRef is required' }, { status: 400 });
  }

  const state = await getConstitutionalRiskFlowState({ personaId: persona.personaId, requestRef });
  return NextResponse.json({ ok: true, state });
}
