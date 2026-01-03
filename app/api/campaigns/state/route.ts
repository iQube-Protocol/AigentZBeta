import { NextRequest, NextResponse } from 'next/server';
import { getCampaignStateViewsForPersona } from '@/services/campaign/campaignService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
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
