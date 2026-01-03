import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCampaignStateViewsForPersona } from '@/services/campaign/campaignService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function resolvePersonaId(personaId: string): Promise<string | null> {
  if (isUuid(personaId)) return personaId;

  const normalized = personaId.trim().toLowerCase();

  const { data: personaRow } = await supabase
    .from('persona')
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPersonaId = searchParams.get('personaId');

    if (!rawPersonaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    const personaId = await resolvePersonaId(rawPersonaId);
    if (!personaId) {
      return NextResponse.json({ error: 'personaId not found' }, { status: 404 });
    }

    const campaigns = await getCampaignStateViewsForPersona(personaId);

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('[CampaignState] Failed to fetch campaign state:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign state' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
