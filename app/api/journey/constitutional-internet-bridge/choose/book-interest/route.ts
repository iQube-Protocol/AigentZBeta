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
 * Authenticated submissions keep recording the existing generic campaign
 * event (recordCampaignEvent -> campaign_events, `book_interest` eventType,
 * never a preorder eventType).
 *
 * Anonymous submissions (Homecoming Closeout, 2026-08-17) previously
 * returned `{ok:true, persisted:false}` and silently discarded the email —
 * the exact gap this closeout item fixes. They now resolve/dedupe through
 * the GENERIC CRM contact substrate (services/crm/genericContactResolver.ts
 * + crm_personas, crm_engagement_events — the same tables the KNYTS Bridge
 * activation uses, but via a resolver with no KNYT investor/tag semantics)
 * so an anonymous visitor's interest becomes a real, deduped CRM prospect
 * instead of vanishing. This deliberately does NOT reuse the KNYTS-specific
 * evidence table (knytsBridgeCampaignEvidence.ts) or emit any KNYTS
 * campaign evidence/reward — interest here is recorded as a
 * `constitutional_internet_book_interest` crm_engagement_event with zero
 * weight/pokwDelta (a notification signal, not a scored or paid action).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';
import { normalizeEmail } from '@/services/crm/campaignContactResolver';
import { resolveGenericContact } from '@/services/crm/genericContactResolver';
import { createEngagementEvent } from '@/services/crm/crmDataAccess';

const CI_CRM_TENANT_ID = 'polity'; // matches campaignRegistry.ts's tenantId for 'constitutional-internet-bridge'
const CI_BOOK_INTEREST_EVENT_TYPE = 'constitutional_internet_book_interest';

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

  const rawEmail = body.email?.trim();
  if (!rawEmail || !rawEmail.includes('@')) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(rawEmail);

  const persona = await getActivePersona(req).catch(() => null);

  // Generic CRM contact resolution/dedupe — works for both anonymous and
  // authenticated submitters. Same email submitted twice (anonymous or not)
  // resolves to the same crm_personas row rather than creating a duplicate.
  const contact = await resolveGenericContact({
    tenantId: CI_CRM_TENANT_ID,
    normalizedEmail,
    activePersonaId: persona?.personaId ?? null,
  });

  await createEngagementEvent({
    tenantId: CI_CRM_TENANT_ID,
    personaId: contact.crmPersonaId,
    eventType: CI_BOOK_INTEREST_EVENT_TYPE,
    weight: 0,
    pokwDelta: 0,
    source: 'constitutional_internet_bridge_choose',
    metadata: { email: rawEmail },
  });

  // Authenticated submitters ALSO keep the pre-existing identity-persona-
  // scoped campaign event (unchanged behavior — this closeout item only
  // fixes the anonymous path).
  if (persona?.personaId) {
    await recordCampaignEvent({
      campaignId: CI_BRIDGE_CAMPAIGN_ID,
      eventType: 'book_interest',
      personaId: persona.personaId,
      metadata: { email: rawEmail },
    });
  }

  return NextResponse.json({ ok: true, persisted: true, isNewSubmission: contact.isNewProspect });
}
