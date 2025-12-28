/**
 * API Route: Get Owned Codex Issues
 * GET /api/codex/owned?personaId=xxx
 * 
 * Returns all codex issues owned by a persona based on their entitlements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ 
        error: 'personaId is required' 
      }, { status: 400, headers: corsHeaders });
    }
    
    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(personaId);
    
    // Extract episode numbers from entitlements
    const ownedEpisodes = new Set<number>();
    
    // Get actual character asset IDs from codex_media_assets
    const characterAssetIds = new Set<string>();
    
    for (const ent of entitlements) {
      const assetId = ent.assetId;
      if (!assetId) continue;
      
      // Extract episode number from asset ID
      const epMatch = assetId.match(/ep(\d+)/i);
      if (epMatch) {
        ownedEpisodes.add(parseInt(epMatch[1], 10));
      }
      
      // For character entitlements, get the actual character_poster asset
      if (assetId.includes('char') || assetId.includes('character')) {
        console.log(`[API] Processing character entitlement: ${assetId}`);
        
        // Query for character_poster that matches this entitlement's asset ID
        const { data: asset } = await supabase
          .from('codex_media_assets')
          .select('id, title')
          .eq('asset_kind', 'character_poster')
          .eq('status', 'active')
          .ilike('title', `%${assetId}%`) // Match the full asset ID in title
          .limit(1)
          .single();
        
        if (asset) {
          console.log(`[API] Found character asset: ${asset.id} (${asset.title})`);
          characterAssetIds.add(asset.id);
        } else {
          console.log(`[API] No character asset found for: ${assetId}`);
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
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[API] Error fetching owned issues:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
