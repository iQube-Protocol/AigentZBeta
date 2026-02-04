/**
 * KNYT Purchases API
 * 
 * GET /api/codex/knyt-purchases?personaId=<personaId>
 * 
 * Fetches KNYT purchases for a persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    // Fetch purchases for the persona
    const { data: purchases, error } = await supabase
      .from('knyt_purchases')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Extract owned character names
    const ownedCharacters = new Set(
      purchases
        .filter(p => p.character_name)
        .map(p => p.character_name)
    );

    return NextResponse.json({
      purchases: purchases || [],
      ownedCharacters: Array.from(ownedCharacters)
    });
  } catch (error) {
    console.error('Error fetching KNYT purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KNYT purchases' },
      { status: 500 }
    );
  }
}
