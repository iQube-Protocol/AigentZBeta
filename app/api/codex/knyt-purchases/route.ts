/**
 * KNYT Purchases API
 * 
 * GET /api/codex/knyt-purchases?personaId=<personaId>
 * 
 * Fetches KNYT purchases for a persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';

export const dynamic = 'force-dynamic';

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

    // Extract owned character names from direct purchases
    const ownedCharacters = new Set<string>(
      purchases
        .filter(p => p.character_name)
        .map(p => p.character_name as string)
    );

    // SKU-EXPANSION: any bundle SKU with grants_character_cards=true grants
    // virtual ownership of every character poster in the catalog. The grid
    // matches by character UUID OR character name (whichever the row uses),
    // so add both.
    try {
      const expanded = await getOwnedAssetIds(personaId, 'metaKnyts');
      const expandedIds = new Set([...expanded.direct, ...expanded.expanded]);
      if (expandedIds.size > 0) {
        const { data: charRows } = await supabase
          .from('codex_media_assets')
          .select('id, title')
          .in('id', Array.from(expandedIds))
          .eq('asset_kind', 'character_poster')
          .eq('status', 'active');
        for (const row of charRows ?? []) {
          if (row.id) ownedCharacters.add(row.id as string);
          if (row.title) ownedCharacters.add(row.title as string);
        }
      }
    } catch (e) {
      console.error('[knyt-purchases] SKU expansion failed', e);
    }

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
