/**
 * Mint Episode API
 * 
 * POST /api/mint/episode
 * 
 * Mints a digital Scroll for an episode:
 * 1. Verifies KNYT payment
 * 2. Selects random limited-edition cover
 * 3. Creates user_issue_qubes entry
 * 
 * Phase 1: Custodial only (custody_mode = 'custodial')
 * Phase 2: Will support canonical mints with self-custody
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';
import { selectRandomCoverForEpisode } from '../../../../server/services/coverSelectionService';

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}

export const runtime = 'nodejs';

interface MintRequest {
  episodeNumber: number;
  masterType?: 'episode_still' | 'episode_motion';
  // Phase 2: custodyMode?: 'custodial' | 'canonical';
}

interface MintResponse {
  issueId: string;
  episodeNumber: number;
  masterContentId: string;
  coverAsset: {
    id: string;
    title: string;
    variantName: string | null;
    rarityTier: string | null;
    editionSerial: number;
    editionMax: number | null;
  };
  custodyMode: 'custodial';
  status: 'active';
}

/**
 * Verify KNYT payment (stub for Phase 1)
 * TODO: Integrate with SmartWallet payment verification
 */
async function verifyKnytPayment(
  ownerId: string,
  episodeNumber: number,
  expectedPrice: number,
  clientProof?: any
): Promise<{ success: boolean; txId?: string; error?: string }> {
  // Phase 1: Stub implementation
  // In production, this would verify the SmartWallet transaction
  console.log(`[MintPayment] Verifying payment for ${ownerId}, Episode ${episodeNumber}, ${expectedPrice} KNYT`);
  
  // For testing, accept any proof or no proof
  // TODO: Implement real SmartWallet verification
  if (process.env.NODE_ENV === 'development' || process.env.SKIP_PAYMENT_VERIFICATION === 'true') {
    return { success: true, txId: `stub-tx-${Date.now()}` };
  }

  // Real verification would go here
  return { success: true, txId: clientProof?.txId };
}

export async function POST(req: NextRequest) {
  try {
    // Get user from auth (simplified - enhance with proper auth)
    const authHeader = req.headers.get('authorization');
    let ownerId: string;

    if (authHeader?.startsWith('Bearer ')) {
      // Extract user ID from token (simplified)
      // In production, decode JWT and get user ID
      ownerId = req.headers.get('x-user-id') || 'anonymous';
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: MintRequest = await req.json();
    const { episodeNumber, masterType = 'episode_still' } = body;

    if (!episodeNumber || episodeNumber < 1) {
      return NextResponse.json({
        error: 'Invalid episodeNumber',
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Check pricing and availability
    const { data: pricing, error: pricingError } = await supabase
      .from('digital_episode_pricing')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('is_active', true)
      .single();

    if (pricingError || !pricing) {
      return NextResponse.json({
        error: `Episode ${episodeNumber} is not available for minting`,
      }, { status: 404 });
    }

    // 2. Get the master content
    const masterId = `mk_ep${String(episodeNumber).padStart(2, '0')}_${masterType.replace('episode_', '')}`;
    
    const { data: master, error: masterError } = await supabase
      .from('master_content_qubes')
      .select('*')
      .eq('id', masterId)
      .eq('status', 'active')
      .single();

    if (masterError || !master) {
      return NextResponse.json({
        error: `Master content not found for Episode ${episodeNumber} (${masterType})`,
      }, { status: 404 });
    }

    // 3. Verify payment
    const paymentResult = await verifyKnytPayment(
      ownerId,
      episodeNumber,
      Number(pricing.price_knyt),
      body // Pass full body as proof for now
    );

    if (!paymentResult.success) {
      return NextResponse.json({
        error: paymentResult.error || 'Payment verification failed',
      }, { status: 402 });
    }

    // 4. Select random cover
    const coverResult = await selectRandomCoverForEpisode(episodeNumber, master.series);

    if (!coverResult) {
      return NextResponse.json({
        error: `No covers available for Episode ${episodeNumber}`,
      }, { status: 404 });
    }

    // 5. Create user_issue_qubes entry
    const { data: issue, error: issueError } = await supabase
      .from('user_issue_qubes')
      .insert({
        owner_id: ownerId,
        owner_type: 'persona', // or 'wallet', 'did' based on auth
        episode_number: episodeNumber,
        master_content_id: masterId,
        cover_variant_id: coverResult.assetId,
        edition_serial: coverResult.editionSerial,
        edition_total: coverResult.editionMax,
        price_paid_knyt: pricing.price_knyt,
        transaction_hash: paymentResult.txId,
        custody_mode: 'custodial', // Phase 1: always custodial
        status: 'active',
      })
      .select('id')
      .single();

    if (issueError) {
      console.error('[MintEpisode] Failed to create issue:', issueError);
      return NextResponse.json({
        error: 'Failed to create issue record',
      }, { status: 500 });
    }

    console.log(`[MintEpisode] Minted issue ${issue.id} for ${ownerId}: Episode ${episodeNumber}, Cover ${coverResult.title} #${coverResult.editionSerial}`);

    // 6. Return success response
    const response: MintResponse = {
      issueId: issue.id,
      episodeNumber,
      masterContentId: masterId,
      coverAsset: {
        id: coverResult.assetId,
        title: coverResult.title,
        variantName: coverResult.variantName,
        rarityTier: coverResult.rarityTier,
        editionSerial: coverResult.editionSerial,
        editionMax: coverResult.editionMax,
      },
      custodyMode: 'custodial',
      status: 'active',
    };

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('[MintEpisode] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Mint failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/mint/episode?episodeNumber=1
 * 
 * Get mint status and pricing for an episode
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeNumber = parseInt(searchParams.get('episodeNumber') || '0');

    if (!episodeNumber || episodeNumber < 1) {
      return NextResponse.json({
        error: 'Invalid episodeNumber',
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get pricing
    const { data: pricing } = await supabase
      .from('digital_episode_pricing')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('is_active', true)
      .single();

    // Get master content availability
    const { data: masters } = await supabase
      .from('master_content_qubes')
      .select('id, content_type, title')
      .eq('episode_number', episodeNumber)
      .eq('status', 'active');

    // Get cover availability
    const { data: covers } = await supabase
      .from('codex_media_assets')
      .select('id, title, variant_name, rarity_tier, edition_max, edition_minted')
      .eq('episode_number', episodeNumber)
      .in('asset_kind', ['cover_pdf', 'cover_image'])
      .eq('status', 'active')
      .or('edition_max.is.null,edition_minted.lt.edition_max');

    const hasStill = masters?.some(m => m.content_type === 'episode_still');
    const hasMotion = masters?.some(m => m.content_type === 'episode_motion');
    const availableCovers = covers?.length || 0;

    return NextResponse.json({
      episodeNumber,
      available: !!(pricing && hasStill && availableCovers > 0),
      pricing: pricing ? {
        priceKnyt: pricing.price_knyt,
        priceCanonicalKnyt: pricing.price_canonical_knyt,
        currency: pricing.currency,
      } : null,
      content: {
        hasStillMaster: hasStill,
        hasMotionMaster: hasMotion,
        availableCovers,
        coverVariants: covers?.map(c => ({
          id: c.id,
          title: c.title,
          variantName: c.variant_name,
          rarityTier: c.rarity_tier,
          remaining: c.edition_max ? c.edition_max - c.edition_minted : null,
        })) || [],
      },
    });

  } catch (error) {
    console.error('[MintEpisode] GET Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get mint info',
    }, { status: 500 });
  }
}
