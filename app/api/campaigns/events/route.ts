import { NextRequest, NextResponse } from 'next/server';
import { emitCampaignEvent } from '@/services/campaign/campaignService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      campaignId,
      eventType,
      personaId,
      referrerPersonaId,
      contentId,
      source,
      metadata,
      tenantId,
      franchiseId,
    } = body || {};

    if (!campaignId || !eventType || !personaId) {
      return NextResponse.json(
        { error: 'campaignId, eventType, and personaId are required' },
        { status: 400 }
      );
    }

    const result = await emitCampaignEvent({
      campaignId,
      eventType,
      personaId,
      referrerPersonaId: referrerPersonaId || null,
      contentId: contentId || null,
      source: source || 'api',
      metadata: metadata || null,
      tenantId: tenantId || null,
      franchiseId: franchiseId || null,
    });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      dvnMessageId: result.dvnMessageId,
      state: result.stateView,
    });
  } catch (error) {
    console.error('[CampaignEvents] Failed to record event:', error);
    return NextResponse.json({ error: 'Failed to record campaign event' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
