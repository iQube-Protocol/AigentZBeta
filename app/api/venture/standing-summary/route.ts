/**
 * GET /api/venture/standing-summary — the active persona's Standing +
 * reputation + verified-fact summary, in the shape the Founder Office surfaces
 * use to show "what Standing is feeding into your VentureQube."
 *
 * T1-safe: the caller is resolved through the spine; only aggregate/derived
 * values are returned (no raw persona/passport ids).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readStandingForVenture } from '@/services/venture/standingForVenture';

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
  const summary = await readStandingForVenture(admin, persona.personaId);
  // Collapse facts to counts-by-domain to keep the surface light.
  const factCounts: Record<string, number> = {};
  for (const [domain, facts] of Object.entries(summary.factsByDomain)) {
    factCounts[domain] = facts.length;
  }
  return NextResponse.json({
    ok: true,
    standing: summary.standing,
    reputation: summary.reputation,
    factCountsByDomain: factCounts,
    hasStandingSignal: summary.hasStandingSignal,
  });
}
