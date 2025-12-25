/**
 * API Route: Get Owned Codex Issues
 * GET /api/codex/owned?personaId=xxx
 * 
 * Returns all codex issues owned by a persona based on their entitlements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';

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
    
    // Extract episode numbers and character IDs from entitlements
    // Asset IDs are in format like "mk_ep01", "mk_ep02_motion", "mk_char_aigent_z", etc.
    const ownedEpisodes = new Set<number>();
    const ownedCharacters = new Set<string>();
    
    entitlements.forEach(ent => {
      const assetId = ent.assetId;
      if (assetId) {
        // Extract episode number from asset ID
        const epMatch = assetId.match(/ep(\d+)/i);
        if (epMatch) {
          ownedEpisodes.add(parseInt(epMatch[1], 10));
        }
        
        // Extract character ID from asset ID (e.g., "mk_char_aigent_z" or "knyt_character_aigent_z")
        if (assetId.includes('char') || assetId.includes('character')) {
          ownedCharacters.add(assetId);
        }
      }
    });
    
    // Return as array of issue objects
    const issues = Array.from(ownedEpisodes).map(episodeNumber => ({
      episodeNumber,
      owned: true,
    }));
    
    const characters = Array.from(ownedCharacters).map(characterId => ({
      characterId,
      owned: true,
    }));
    
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
