/**
 * POST /api/journey/constitutional-internet-bridge/passport/intent
 *
 * PASSPORT's post-crossing "What would you like to do in the Polity?"
 * signal — a preference/signal for aigentMe, NOT an authority grant. It is
 * not constitutional state, never gates any JourneyDefinition stage, and is
 * never presented as Standing or delegation (see the operator's own
 * framing in ConstitutionalInternetBridgePassportRoom.tsx). Mirrors
 * .../orient/route.ts exactly: best-effort via the existing generic
 * campaign event log (services/campaign/campaignService.ts's
 * recordCampaignEvent writes to the already-existing `campaign_events`
 * table — no new schema), never blocks the visitor, and a signed-out
 * visitor's choice is simply not persisted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

export const dynamic = 'force-dynamic';

interface PassportIntentBody {
  actionMode?: string;
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
  let body: PassportIntentBody;
  try {
    body = (await req.json()) as PassportIntentBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  await recordCampaignEvent({
    campaignId: CI_BRIDGE_CAMPAIGN_ID,
    eventType: 'passport_polity_intent_recorded',
    personaId: persona.personaId,
    metadata: {
      actionMode: body.actionMode ?? null,
    },
  });

  return NextResponse.json({ ok: true, persisted: true });
}
