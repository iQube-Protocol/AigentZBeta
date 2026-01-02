import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { distributeHeraldOfOrderReward } from '@/services/rewardsService';

export async function POST(request: NextRequest) {
  try {
    const { shareId, personaId, contentId, platform, eventType } = await request.json();
    
    if (!shareId || !eventType) {
      return NextResponse.json({ success: false, error: 'shareId and eventType required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create or update social share analytics
    if (eventType === 'create') {
      const { data, error } = await supabase
        .from('social_share_analytics')
        .insert({
          id: shareId,
          persona_id: personaId,
          content_id: contentId,
          platform,
          share_url: request.headers.get('referer') || '',
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
    const updateField = eventType === 'click' ? 'clicks' : 
                       eventType === 'signup' ? 'signups' : 
                       eventType === 'conversion' ? 'conversions' : null;

    if (!updateField) {
      return NextResponse.json({ success: false, error: 'Invalid eventType' }, { status: 400 });
    }

    // Increment counter
    const { data: share, error: updateError } = await supabase
      .from('social_share_analytics')
      .select('*')
      .eq('id', shareId)
      .single();

    if (updateError || !share) {
      return NextResponse.json({ success: false, error: 'Share not found' }, { status: 404 });
    }

    const newCount = (share[updateField] || 0) + 1;
    
    await supabase
      .from('social_share_analytics')
      .update({ 
        [updateField]: newCount,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', shareId);

    // Check if reward threshold met and distribute Herald of Order reward
    let rewardDistributed = false;
    if (share.persona_id) {
      // Herald of Order reward thresholds
      const shouldReward = 
        (eventType === 'click' && newCount % 10 === 0) ||  // Every 10 clicks
        (eventType === 'signup' && newCount % 3 === 0) ||   // Every 3 signups
        (eventType === 'conversion');                        // Every conversion

      if (shouldReward) {
        const result = await distributeHeraldOfOrderReward(
          share.persona_id,
          shareId,
          eventType as 'click' | 'signup' | 'conversion'
        );
        rewardDistributed = result.success;
      }
    }

    return NextResponse.json({ 
      success: true, 
      shareId,
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
