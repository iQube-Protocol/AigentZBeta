/**
 * POST /api/journey/constitutional-internet-bridge/act/connect-agent
 *
 * The "Connect an agent you already use" path of ACT. This is a SELF-REPORT
 * ("I've connected — continue"), not a verification of an actual Threshold
 * OAuth crossing — see CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE's own comment in
 * constitutionalInternetBridgeJourney.ts for why. Same fidelity as ORIENT's
 * orient_frontier_recorded and CHOOSE's book_interest: a best-effort
 * campaign_events row (recordCampaignEvent — no new schema), never a claim
 * of delegation, mandate, Standing, or transaction rights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import {
  CI_BRIDGE_CAMPAIGN_ID,
  CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE,
} from '@/services/journey/constitutionalInternetBridgeJourney';

export const dynamic = 'force-dynamic';

interface ConnectAgentBody {
  /** Which agent the visitor says they connected. 'claude' is the only path offered today. */
  agent?: string;
}

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
  const persona = await getActivePersona(req);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = getCommunityContentSupabase();
  const { data } = await admin
    .from('campaign_events')
    .select('id, metadata')
    .eq('campaign_id', CI_BRIDGE_CAMPAIGN_ID)
    .eq('persona_id', persona.personaId)
    .eq('event_type', CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE)
    .limit(1);

  const connected = Boolean(data && data.length > 0);
  return NextResponse.json({
    ok: true,
    connected,
    agent: connected ? ((data![0].metadata as { agent?: string } | null)?.agent ?? null) : null,
  });
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
  const persona = await getActivePersona(req);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: ConnectAgentBody = {};
  try {
    body = (await req.json()) as ConnectAgentBody;
  } catch {
    // Body is optional — defaults below still apply.
  }

  await recordCampaignEvent({
    campaignId: CI_BRIDGE_CAMPAIGN_ID,
    eventType: CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE,
    personaId: persona.personaId,
    metadata: { agent: body.agent ?? 'claude' },
  });

  return NextResponse.json({ ok: true, agentRelationshipStarted: true });
}
