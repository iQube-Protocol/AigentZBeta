/**
 * KNYT Purchase API
 * 
 * POST /api/codex/knyt-purchase
 * 
 * Processes KNYT token purchases for codex assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, assetId, assetKind, characterName } = body;

    if (!personaId || !assetId || !assetKind) {
      return NextResponse.json(
        { error: 'Missing required fields: personaId, assetId, assetKind' },
        { status: 400 }
      );
    }

    // Get pricing
    const CARD_PRICE_STILL = 2;  // 2 KNYT for character card (still)
    const CARD_PRICE_MOTION = 4; // 4 KNYT for character card (motion)
    const price = assetKind === 'character_poster' ? CARD_PRICE_STILL : CARD_PRICE_MOTION;

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from('knyt_purchases')
      .select('*')
      .eq('persona_id', personaId)
      .eq('asset_id', assetId)
      .eq('status', 'completed')
      .single();

    if (existingPurchase) {
      return NextResponse.json(
        { error: 'Asset already purchased' },
        { status: 409 }
      );
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('knyt_purchases')
      .insert({
        persona_id: personaId,
        asset_id: assetId,
        asset_kind: assetKind,
        character_name: characterName,
        knyt_amount: price,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (purchaseError) {
      throw purchaseError;
    }

    // TODO: Process KNYT payment (deduct from balance)
    // For now, mark as completed
    const { error: updateError } = await supabase
      .from('knyt_purchases')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', purchase.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      purchase: {
        ...purchase,
        status: 'completed',
        completed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing KNYT purchase:', error);
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    );
  }
}
