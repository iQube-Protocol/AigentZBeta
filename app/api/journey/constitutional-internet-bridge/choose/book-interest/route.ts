/**
 * POST /api/journey/constitutional-internet-bridge/choose/book-interest
 *
 * Captures a "reserve / notify me" demand signal for The Constitutional
 * Internet book. Per the operator's explicit instruction: the existing KNYT
 * commerce engine (KnytStoreEpisodesTab's GN_SKUS product family,
 * PurchaseHandler, the `products`/`purchases` schema) has no wired paid
 * preorder path for a NEW book product today — building one is a genuine,
 * deliberate follow-on requiring an operator decision on price/SKU/rail, not
 * something to fabricate here. This route implements the safe, always-
 * available fallback the brief itself calls for: "preserve a separate
 * reserve / notify me demand action so launch is not blocked."
 *
 * Reuses the existing generic campaign event log (recordCampaignEvent →
 * campaign_events, already-existing table, no new schema) with a distinct
 * `book_interest` eventType — never labeled as a paid preorder. The
 * `book_preorder_started` / `book_preorder_completed` eventTypes are
 * reserved in the taxonomy (campaignRegistry.ts) for when a real SKU exists;
 * this route intentionally does not emit them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

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
    campaignId: CI_BRIDGE_CAMPAIGN_ID,
    eventType: 'book_interest',
    personaId: persona.personaId,
    metadata: { email },
  });

  return NextResponse.json({ ok: true, persisted: true });
}
