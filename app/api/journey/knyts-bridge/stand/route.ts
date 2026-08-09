/**
 * GET /api/journey/knyts-bridge/stand
 *
 * Read-only projection of the caller's KNYTS Bridge crossings — reactions,
 * campaign-tagged shares, and inspired remixes. See
 * services/journey/knytsBridgeStand.ts for what this is (and is not).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getKnytsBridgeStand } from '@/services/journey/knytsBridgeStand';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req).catch(() => null);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
    }
    const supabase = getCommunityContentSupabase();
    const stand = await getKnytsBridgeStand(supabase, persona.personaId);
    return NextResponse.json({ ok: true, stand });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}
