/**
 * /api/moneypenny/architect — PRD-MPY-001 Phase 3, Architect mode.
 *
 * POST { intent } → drafts a financial structure/product proposal, grounded
 * in the `finance` invariant library, and persists it as an operational
 * artifact record via `moneyPennyArchitect.ts::draftFinancialStructure`.
 *
 * This route produces PROPOSALS ONLY. It must never import
 * `authorizeAgreement`, `acceptAgreement`, or `settlementExecutor` — those
 * belong to Runtime mode (Phase 4), a separate route.
 *
 * Spine-authenticated: any authenticated persona may use MoneyPenny's
 * Architect mode (no admin gate — this is an advisory/proposal surface, not
 * a steward tool).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { draftFinancialStructure } from '@/services/constitutional/moneyPennyArchitect';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { intent?: string };
  const intent = body.intent?.trim();
  if (!intent) return NextResponse.json({ ok: false, error: 'intent is required' }, { status: 400 });

  const result = await draftFinancialStructure({ intent });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
