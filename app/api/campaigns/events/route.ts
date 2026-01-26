import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitCampaignEvent } from '@/services/campaign/campaignService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function resolvePersonaId(personaId: string | null | undefined): Promise<string | null> {
  if (!personaId) return null;
  if (isUuid(personaId)) return personaId;

  const normalized = personaId.trim().toLowerCase();

  const { data: personaRow } = await supabase
    .from('personas')
    .select('id')
    .eq('fio_handle', normalized)
    .maybeSingle();

  if (personaRow?.id) return personaRow.id;

  const { data: personasRow } = await supabase
    .from('personas')
    .select('id')
    .eq('fio_handle', normalized)
    .maybeSingle();

  return personasRow?.id || null;
}

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

    const resolvedPersonaId = await resolvePersonaId(personaId);
    if (!resolvedPersonaId) {
      return NextResponse.json({ error: 'personaId not found' }, { status: 404 });
    }

    const resolvedReferrerId = await resolvePersonaId(referrerPersonaId || null);

    const result = await emitCampaignEvent({
      campaignId,
      eventType,
      personaId: resolvedPersonaId,
      referrerPersonaId: resolvedReferrerId || null,
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
