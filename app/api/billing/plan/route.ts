/**
 * GET /api/billing/plan — the active persona's plan tier + Venture Lab
 * entitlements (venture_tier, ventureLabAccess, ventureLimit). T1-safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getPersonaPlan,
  PLAN_LABEL,
  VENTURE_TIER_LABEL,
} from '@/services/billing/personaPlan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }
  const plan = await getPersonaPlan(admin, persona.personaId);
  return NextResponse.json({
    ok: true,
    ...plan,
    planLabel: PLAN_LABEL[plan.planTier],
    ventureTierLabel: VENTURE_TIER_LABEL[plan.ventureTier],
  });
}
