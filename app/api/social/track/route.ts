import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { distributeShareReward } from '@/services/rewards/rewardsService';
import { emitCampaignEvent } from '@/services/campaign/campaignService';
import { getCampaignDefinition } from '@/services/campaign/campaignRegistry';

const DEFAULT_SHARE_CAMPAIGN_ID = 'qriptopian-share';

export async function POST(request: NextRequest) {
  try {
    const { shareId, personaId, contentId, platform, eventType, action, campaignId } = await request.json();
    const resolvedEventType = eventType || action;
    const resolvedCampaignId = campaignId || DEFAULT_SHARE_CAMPAIGN_ID;
    const resolvedShareId = shareId || (personaId && contentId ? `auto_${personaId}_${contentId}` : null);
    
    if (!resolvedShareId || !resolvedEventType) {
      return NextResponse.json(
        { success: false, error: 'shareId (or personaId + contentId) and eventType are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create or update social share analytics
    if (resolvedEventType === 'create') {
      const { data, error } = await supabase
        .from('social_share_analytics')
        .insert({
          id: resolvedShareId,
          persona_id: personaId,
          content_id: contentId,
          platform: platform || 'unknown',
          share_url: request.headers.get('referer') || '',
          campaign_id: campaignId || null,
          clicks: 0,
          signups: 0,
          conversions: 0,
          reward_earned: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating share analytics:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, shareId: data.id });
    }

    // Track click, signup, or conversion
    const updateField = resolvedEventType === 'click' ? 'clicks' : 
                       resolvedEventType === 'signup' ? 'signups' : 
                       resolvedEventType === 'conversion' ? 'conversions' : null;

    if (!updateField) {
      return NextResponse.json({ success: false, error: 'Invalid eventType' }, { status: 400 });
    }

    // Increment counter
    let { data: share, error: updateError } = await supabase
      .from('social_share_analytics')
      .select('*')
      .eq('id', resolvedShareId)
      .single();

    if (updateError || !share) {
      if (!personaId) {
        return NextResponse.json({ success: false, error: 'Share not found' }, { status: 404 });
      }

      const { data: insertedShare, error: insertError } = await supabase
        .from('social_share_analytics')
        .insert({
          id: resolvedShareId,
          persona_id: personaId,
          content_id: contentId,
          platform: platform || 'unknown',
          share_url: request.headers.get('referer') || '',
          campaign_id: campaignId || null,
          clicks: 0,
          signups: 0,
          conversions: 0,
          reward_earned: 0
        })
        .select()
        .single();

      if (insertError || !insertedShare) {
        return NextResponse.json({ success: false, error: 'Share not found' }, { status: 404 });
      }

      share = insertedShare;
    }

    const newCount = (share[updateField] || 0) + 1;
    
    await supabase
      .from('social_share_analytics')
      .update({ 
        [updateField]: newCount,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', resolvedShareId);

    // A share row's own campaign_id (set at creation) takes precedence over
    // the campaignId on this event, so click/signup/conversion events against
    // an existing share stay attributed to the campaign it was created under.
    const effectiveCampaignId = share.campaign_id || resolvedCampaignId;
    const campaignDefinition = getCampaignDefinition(effectiveCampaignId);

    const campaignEventType = resolvedEventType === 'click'
      ? 'content_share_click'
      : resolvedEventType === 'signup'
        ? 'content_share_signup'
        : 'content_share_conversion';

    const ownerPersonaId = share.persona_id || personaId;
    if (ownerPersonaId) {
      await emitCampaignEvent({
        campaignId: effectiveCampaignId,
        eventType: campaignEventType,
        personaId: ownerPersonaId,
        contentId: share.content_id,
        source: 'social_track',
        metadata: {
          shareId: resolvedShareId,
          platform: share.platform || platform || null,
        },
      });
    }

    // Check if reward threshold met and distribute the campaign's share reward
    let rewardDistributed = false;
    const rewardConfig = campaignDefinition?.shareRewardConfig ?? {
      rewardType: 'herald_of_order',
      rewardAmount: 0.25,
      thresholds: { click: 10, signup: 3, conversion: 1 },
    };
    if (share.persona_id) {
      const shouldReward =
        (resolvedEventType === 'click' && rewardConfig.thresholds.click && newCount % rewardConfig.thresholds.click === 0) ||
        (resolvedEventType === 'signup' && rewardConfig.thresholds.signup && newCount % rewardConfig.thresholds.signup === 0) ||
        (resolvedEventType === 'conversion' && Boolean(rewardConfig.thresholds.conversion));

      if (shouldReward) {
        const result = await distributeShareReward(
          share.persona_id,
          resolvedShareId,
          resolvedEventType as 'click' | 'signup' | 'conversion',
          rewardConfig
        );
        rewardDistributed = result.success;
      }
    }

    return NextResponse.json({ 
      success: true, 
      shareId: resolvedShareId,
      [updateField]: newCount,
      rewardDistributed
    });
  } catch (error) {
    console.error('Social tracking error:', error);
    return NextResponse.json({ success: false, error: 'Tracking failed' }, { status: 500 });
  }
}

// Handle GET for click tracking via URL
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shareId = searchParams.get('s');
  const redirect = searchParams.get('r');
  
  if (shareId) {
    // Track click asynchronously
    fetch(request.url.replace('/track', '/track'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, eventType: 'click' })
    }).catch(console.error);
  }
  
  // Redirect to content
  if (redirect) {
    return NextResponse.redirect(redirect);
  }
  
  return NextResponse.json({ success: true });
}
