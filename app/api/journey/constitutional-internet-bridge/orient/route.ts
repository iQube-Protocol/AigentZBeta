/**
 * POST /api/journey/constitutional-internet-bridge/orient
 *
 * ORIENT is not constitutional state — it never gates Passport, and it is
 * not a JourneyDefinition stage (see constitutionalInternetBridgeJourney.ts's
 * header). This route persists the visitor's three choices as an intent/
 * demand signal only, reusing the existing generic campaign event log
 * (services/campaign/campaignService.ts's recordCampaignEvent writes to the
 * already-existing `campaign_events` table — no new schema). Best-effort:
 * failure to persist never blocks the visitor from proceeding, and a
 * signed-out visitor's choices are simply not persisted (recordCampaignEvent
 * requires a personaId) — they still see their computed Frontier summary
 * client-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

export const dynamic = 'force-dynamic';

interface OrientBody {
  help?: string;
  preserve?: string;
  authority?: string;
}

export async function POST(req: NextRequest) {
  try {
    return await postImpl(req);
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

async function postImpl(req: NextRequest) {
  let body: OrientBody;
  try {
    body = (await req.json()) as OrientBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    // No session yet — ORIENT still works, it just has nothing to attribute
    // the demand signal to. The client already has its computed summary.
    return NextResponse.json({ ok: true, persisted: false });
  }

  await recordCampaignEvent({
    campaignId: CI_BRIDGE_CAMPAIGN_ID,
    eventType: 'orient_frontier_recorded',
    personaId: persona.personaId,
    metadata: {
      help: body.help ?? null,
      preserve: body.preserve ?? null,
      authority: body.authority ?? null,
    },
  });

  return NextResponse.json({ ok: true, persisted: true });
}
