/**
 * GET /api/journey/constitutional-internet-bridge/stand
 *
 * Serves the honest STAND projection — see
 * services/journey/constitutionalInternetBridgeStand.ts's header for why
 * this deliberately does NOT fabricate a Standing score from navigation,
 * viewing, or crossing the journey, the way the KNYTS Bridge's own STAND
 * panel copy currently does. Signed-out callers get an explicit
 * unauthenticated refusal — STAND has nothing honest to show before a
 * Passport exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getConstitutionalInternetBridgeStand } from '@/services/journey/constitutionalInternetBridgeStand';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return await getImpl(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(req: NextRequest) {
  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, refusalCode: 'UNAUTHENTICATED', error: 'Claim your Passport to see your constitutional standing.' }, { status: 401 });
  }

  const admin = getCommunityContentSupabase();
  const stand = await getConstitutionalInternetBridgeStand(admin, persona.personaId);

  return NextResponse.json({ ok: true, stand });
}
