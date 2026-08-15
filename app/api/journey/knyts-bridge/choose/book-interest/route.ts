/**
 * POST /api/journey/knyts-bridge/choose/book-interest
 *
 * Captures a "reserve / notify me" demand signal for metaKnyt Agentic
 * Graphic Novel (KNYTS Choose Reserve-form patch, three-item closure).
 * Mirrors constitutional-internet-bridge/choose/book-interest exactly:
 * reuses the existing generic campaign event log (recordCampaignEvent →
 * campaign_events, already-existing table, no new schema) with the same
 * `book_interest` eventType, scoped to KNYTS_BRIDGE_CAMPAIGN_ID instead of
 * the CI campaign. `contentId`/`metadata` identify the graphic novel so a
 * later CRM prospect-ingestion adapter has something to key on — that
 * adapter, and any product/SKU/preorder/payment flow, are deliberately NOT
 * built here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

export const dynamic = 'force-dynamic';

interface BookInterestBody {
  email?: string;
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
  let body: BookInterestBody;
  try {
    body = (await req.json()) as BookInterestBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }

  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    // Signed-out visitors can still express demand — CHOOSE never requires
    // Passport. Nothing to attribute this to server-side beyond the email
    // itself, so we simply acknowledge; there's no campaign_events row
    // without a personaId (recordCampaignEvent requires one).
    return NextResponse.json({ ok: true, persisted: false });
  }

  await recordCampaignEvent({
    campaignId: KNYTS_BRIDGE_CAMPAIGN_ID,
    eventType: 'book_interest',
    personaId: persona.personaId,
    contentId: 'metaknyt-agentic-graphic-novel',
    metadata: { email, product: 'metaKnyt Agentic Graphic Novel' },
  });

  return NextResponse.json({ ok: true, persisted: true });
}
