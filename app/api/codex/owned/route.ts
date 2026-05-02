/**
 * API Route: Get Owned Codex Issues
 * GET /api/codex/owned?personaId=xxx
 * 
 * Returns all codex issues owned by a persona based on their entitlements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';
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
      return NextResponse.json({ 
        error: 'personaId is required' 
      }, { status: 400,  });
    }
    
    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(personaId);
    
    // Extract episode numbers from entitlements
    const ownedEpisodes = new Set<number>();

    // Get actual character asset IDs from codex_media_assets
    const characterAssetIds = new Set<string>();

    // SKU-EXPANSION: pull every asset_id the persona owns (direct + bundle-grant
    // unpacked via store_skus). For master_content_qubes ids of the form
    // mk_epNN_<type>_<tier> the DB episode_number is NN; the KNYT pricing
    // convention used by the cartridge UI is `pricingEp = dbEp - 1`.
    try {
      const expanded = await getOwnedAssetIds(personaId, 'metaKnyts');
      const allOwned = new Set<string>([...expanded.direct, ...expanded.expanded]);
      for (const id of allOwned) {
        const masterMatch = id.match(/^mk_ep(\d+)_/);
        if (masterMatch) {
          const dbEp = parseInt(masterMatch[1], 10);
          ownedEpisodes.add(dbEp - 1); // GN (db 0) → pricing -1, ep#0 (db 1) → 0, …
        }
        // Character assets land directly as UUIDs in codex_media_assets
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          characterAssetIds.add(id);
        }
      }
    } catch (e) {
      console.error('[codex/owned] SKU expansion failed', e);
    }

    for (const ent of entitlements) {
      const assetId = ent.assetId;
      if (!assetId) continue;

      // Legacy direct-entitlement formats (e.g. `episode-3-still`) — keep
      // working alongside the SKU expansion above. PricingEp convention.
      const epMatch = assetId.match(/episode-(-?\d+)/i) || assetId.match(/^ep(\d+)/i);
      if (epMatch) {
        ownedEpisodes.add(parseInt(epMatch[1], 10));
      }
      
      // For character entitlements, get the actual character_poster asset
      if (assetId.includes('char') || assetId.includes('character')) {
        console.log(`[API] Processing character entitlement: ${assetId}`);
        
        // Query for character_poster that matches this entitlement's asset ID
        const { data: asset, error } = await supabase
          .from('codex_media_assets')
          .select('id, title')
          .eq('asset_kind', 'character_poster')
          .eq('status', 'active')
          .ilike('title', `%${assetId}%`) // Match the full asset ID in title
          .limit(1)
          .single();
        
        if (error) {
          console.log(`[API] Query error for ${assetId}:`, error);
        }
        
        if (asset) {
          console.log(`[API] Found character asset: ${asset.id} (${asset.title})`);
          characterAssetIds.add(asset.id);
        } else {
          console.log(`[API] No character asset found for: ${assetId}`);
          // Try a broader search - just look for any character_poster
          const { data: allAssets } = await supabase
            .from('codex_media_assets')
            .select('id, title')
            .eq('asset_kind', 'character_poster')
            .eq('status', 'active')
            .limit(5);
          console.log(`[API] Available character posters:`, allAssets?.map(a => ({id: a.id, title: a.title})));
        }
      }
    }
    
    // Return as array of issue objects
    const issues = Array.from(ownedEpisodes).map(episodeNumber => ({
      episodeNumber,
      owned: true,
    }));
    
    const characters = Array.from(characterAssetIds).map(characterId => ({
      characterId,
      owned: true,
    }));
    
    console.log('[API] Owned characters:', characters);
    
    return NextResponse.json({
      personaId,
      issues,
      characters,
      episodeCount: issues.length,
      characterCount: characters.length,
    });
  } catch (error) {
    console.error('[API] Error fetching owned issues:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
