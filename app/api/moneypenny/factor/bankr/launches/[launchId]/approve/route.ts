/**
 * POST /api/moneypenny/factor/bankr/launches/[launchId]/approve — the ONE
 * route that may move a token_launches row to 'approved' (Factor + Aegis
 * Bankr PRD, Phase 5/9 hard boundary: "Factor never approves its own
 * token", "the final execution decision" belongs to MoneyPenny/the human
 * principal). Deliberately separate from launches/[launchId]/action/
 * route.ts — mirroring cases/[caseId]/decide-admission/route.ts's
 * separation of the human/MoneyPenny decision from Factor's own action
 * dispatch. Delegates entirely to services/factor/tokenLaunchService.ts's
 * approveTokenLaunch, which itself refuses without a ratified, admissible
 * Aegis assessment and recorded Bankr terms — this route adds no approval
 * logic of its own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { approveTokenLaunch } from '@/services/factor/tokenLaunchService';
import { respondError, resolveTenantId } from '../../../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ launchId: string }> }) {
  const { launchId } = await params;
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

  try {
    const launch = await approveTokenLaunch(admin, {
      id: launchId,
      tenantId: resolveTenantId(body.tenantId),
      approvedByPersonaId: persona.personaId,
      approvedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, launch });
  } catch (err) {
    return respondError(err);
  }
}
