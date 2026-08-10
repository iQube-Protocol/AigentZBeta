/**
 * GET /api/journey/knyts-bridge/state
 *
 * Assembles the AuthoritativePlatformState for the KNYTS Bridge Crossing
 * journey (services/journey/knytsBridgeCrossingJourney.ts) from real reads,
 * then resolves it via resolveJourneyState() — same shape as
 * /api/journey/validation-programme/state.
 *
 * Unlike every other journey route in this codebase, an unauthenticated
 * caller is NOT a 401 here: HOMECOMING and VIEW are deliberately browsable
 * signed-out (the public front door calls this route to know whether to
 * show "claim your Passport" or the Remix/Stand surfaces), so `passport`
 * simply resolves NOT_STARTED/READY for a signed-out caller rather than the
 * route refusing to answer at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { KNYTS_BRIDGE_CROSSING_JOURNEY, KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

export const dynamic = 'force-dynamic';

/* EVERY EXIT IS A NAMED ANSWER — see validation-programme/state's own
   header for why an unhandled throw must still return a diagnosable JSON
   body rather than an empty 500. */
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
  // Not gated on auth — see file header. A signed-out caller's persona is
  // simply null, and every stage's evidence stays honestly missing.
  const persona = await getActivePersona(req).catch(() => null);
  const personaAuthenticated = Boolean(persona?.personaId);

  let crossingPublished = false;
  let crossingHasConsequence = false;

  if (persona?.personaId) {
    const supabase = getCommunityContentSupabase();

    const { data: crossings } = await supabase
      .from('community_generated_content')
      .select('id, status')
      .eq('creator_persona_id', persona.personaId)
      .eq('campaign_tag', KNYTS_BRIDGE_CAMPAIGN_ID)
      .in('status', ['shared', 'runtime_promoted']);

    crossingPublished = Boolean(crossings && crossings.length > 0);

    if (crossingPublished) {
      // Minimal real "consequence" signal for v1 — at least one recorded
      // share under this campaign. This is deliberately NOT the full
      // Standing doctrine's richer multi-signal formula (the KNYT signal
      // tray is only 6-of-9 actions real and has no persisted reward
      // ledger read — see the approved plan's gap #2); it is the smallest
      // fact that is actually true and checkable today.
      const { data: shares } = await supabase
        .from('social_share_analytics')
        .select('id')
        .eq('persona_id', persona.personaId)
        .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID)
        .limit(1);
      crossingHasConsequence = Boolean(shares && shares.length > 0);
    }
  }

  const platformState: AuthoritativePlatformState = {
    stages: {
      passport: { personaAuthenticated },
      remix: { crossingPublished },
      stand: { crossingHasConsequence },
    },
  };

  const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, platformState);

  return NextResponse.json({ ok: true, state: runtimeState, personaAuthenticated });
}
