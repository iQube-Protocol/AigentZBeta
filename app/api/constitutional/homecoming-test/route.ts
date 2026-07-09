/**
 * GET /api/constitutional/homecoming-test — the Homecoming Test, live (CFS-023).
 *
 * The Chrysalis Homecoming acceptance surface: Constitutional Presence computed
 * per delegate against the actual platform state (agent_root_identity,
 * agent_persona, delegation_grants, issued passports) instead of asserted in
 * prose. Every rung is checked read-only; a failed read degrades that ONE rung
 * to `pending`, never fakes it green. Admin-gated (spine).
 *
 * T2-safe: the response carries delegate ids (T1-safe labels), agent classes,
 * presence rung labels, and evidence strings — never a T0 personaId, authProfileId,
 * or raw passport id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { assessConstitutionalPresence } from '@/services/homecoming/constitutionalPresence';
import { CONSTITUTIONAL_PRESENCE_LADDER, HOMECOMING_TEST_DIMENSIONS } from '@/types/homecoming';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const report = await assessConstitutionalPresence();
    return NextResponse.json({
      ok: true,
      test: 'Homecoming Test',
      programme: 'CFS-023 · Chrysalis Homecoming',
      ladder: CONSTITUTIONAL_PRESENCE_LADDER,
      dimensions: HOMECOMING_TEST_DIMENSIONS,
      computedAt: new Date().toISOString(),
      ...report,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
