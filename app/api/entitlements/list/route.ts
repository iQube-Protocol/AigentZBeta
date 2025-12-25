/**
 * API Route: List Entitlements
 * GET /api/entitlements/list?personaId=xxx
 * 
 * Gets all entitlements for a persona with enriched asset metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400, headers: corsHeaders });
    }
    
    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(personaId);
    
    // Enrich entitlements with asset metadata
    const enrichedEntitlements = await Promise.all(
      entitlements.map(async (ent) => {
        const assetId = ent.assetId;
        let assetMeta: any = {};
        
        // Try to find asset in codex_media_assets
        if (assetId) {
          // Check if it's a UUID (character card) or episode asset
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId);
          
          if (isUuid) {
            // Look up character card by ID
            const { data: asset } = await supabase
              .from('codex_media_assets')
              .select('id, title, asset_kind, episode_number, auto_drive_cid')
              .eq('id', assetId)
              .single();
            
            if (asset) {
              // Extract character name from asset title (e.g., "The Director (Analise Tokini) front" -> "The Director")
              let characterName = asset.title;
              // Remove "front" or "back" suffix
              characterName = characterName?.replace(/\s+(front|back)$/i, '').trim();
              // Extract name before parentheses if present
              const parenMatch = characterName?.match(/^([^(]+)/);
              if (parenMatch) {
                characterName = parenMatch[1].trim();
              }
              
              assetMeta = {
                title: asset.title,
                assetKind: asset.asset_kind,
                episodeNumber: asset.episode_number,
                autoDriveCid: asset.auto_drive_cid,
                characterName: characterName,
                coverType: 'CHARACTER',
              };
            }
          } else {
            // Episode asset (mk_ep01, mk_ep01_motion, etc.)
            const epMatch = assetId.match(/ep(\d+)/i);
            if (epMatch) {
              const epNum = parseInt(epMatch[1], 10);
              const isMotion = assetId.toLowerCase().includes('motion');
              
              // Get episode info from codex_media_assets
              const { data: epAssets } = await supabase
                .from('codex_media_assets')
                .select('id, title, asset_kind, rarity, auto_drive_cid')
                .eq('episode_number', epNum)
                .in('asset_kind', ['motion_master', 'print_rare', 'print_epic', 'print_legendary', 'cover_image'])
                .limit(5);
              
              // Determine cover type from available assets
              const printAsset = (epAssets || []).find(a => a.asset_kind?.startsWith('print_'));
              const coverType = printAsset 
                ? printAsset.asset_kind?.replace('print_', '').toUpperCase()
                : (isMotion ? 'MOTION' : 'RARE');
              
              const motionAsset = (epAssets || []).find(a => a.asset_kind === 'motion_master');
              
              assetMeta = {
                episodeNumber: epNum,
                coverType: isMotion ? 'MOTION' : coverType,
                autoDriveCid: motionAsset?.auto_drive_cid,
                isMotion,
              };
            }
          }
        }
        
        return {
          ...ent,
          assetMeta,
        };
      })
    );
    
    return NextResponse.json({
      personaId,
      entitlements: enrichedEntitlements,
      count: enrichedEntitlements.length,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[API] Error listing entitlements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
