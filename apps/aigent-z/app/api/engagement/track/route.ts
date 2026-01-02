import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { distributeKnightOfAttentionReward } from '@/services/rewardsService';

export async function POST(request: NextRequest) {
  try {
    const { personaId, eventType, contentId, contentType, durationSeconds, metadata } = await request.json();
    
    if (!personaId || !eventType) {
      return NextResponse.json({ success: false, error: 'personaId and eventType required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calculate streak if applicable
    let streakCount = 0;
    if (eventType === 'content_complete' || eventType === 'streak_day') {
      const { data: recentEvents } = await supabase
        .from('engagement_events')
        .select('created_at')
        .eq('persona_id', personaId)
        .eq('event_type', 'streak_day')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (recentEvents) {
        // Count consecutive days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let currentDate = new Date(today);
        
        for (const event of recentEvents) {
          const eventDate = new Date(event.created_at);
          eventDate.setHours(0, 0, 0, 0);
          
          if (eventDate.getTime() === currentDate.getTime()) {
            streakCount++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    // Create engagement event
    const { data: event, error: eventError } = await supabase
      .from('engagement_events')
      .insert({
        persona_id: personaId,
        event_type: eventType,
        content_id: contentId,
        content_type: contentType,
        duration_seconds: durationSeconds,
        streak_count: streakCount,
        reward_amount: 0,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating engagement event:', eventError);
      return NextResponse.json({ success: false, error: eventError.message }, { status: 500 });
    }

    // Check if reward should be distributed
    let rewardDistributed = false;
    let rewardAmount = 0;

    // Knight of Attention reward logic
    if (eventType === 'content_complete') {
      // Reward for completing content
      const result = await distributeKnightOfAttentionReward(personaId, 'content_complete', streakCount);
      rewardDistributed = result.success;
      rewardAmount = result.reward?.amount || 0;
    } else if (eventType === 'streak_day' && streakCount > 0 && streakCount % 7 === 0) {
      // Weekly streak bonus
      const result = await distributeKnightOfAttentionReward(personaId, 'weekly_streak', streakCount);
      rewardDistributed = result.success;
      rewardAmount = result.reward?.amount || 0;
    }

    // Update event with reward amount if distributed
    if (rewardDistributed && rewardAmount > 0) {
      await supabase
        .from('engagement_events')
        .update({ reward_amount: rewardAmount })
        .eq('id', event.id);
    }

    return NextResponse.json({ 
      success: true, 
      eventId: event.id,
      streakCount,
      rewardDistributed,
      rewardAmount
    });
  } catch (error) {
    console.error('Engagement tracking error:', error);
    return NextResponse.json({ success: false, error: 'Tracking failed' }, { status: 500 });
  }
}

// GET endpoint to fetch engagement stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');
  
  if (!personaId) {
    return NextResponse.json({ success: false, error: 'personaId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get current streak
  const { data: streakEvents } = await supabase
    .from('engagement_events')
    .select('created_at')
    .eq('persona_id', personaId)
    .eq('event_type', 'streak_day')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  let currentStreak = 0;
  if (streakEvents && streakEvents.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    for (const event of streakEvents) {
      const eventDate = new Date(event.created_at);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate.getTime() === checkDate.getTime()) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Get total rewards earned
  const { data: rewards } = await supabase
    .from('engagement_events')
    .select('reward_amount')
    .eq('persona_id', personaId)
    .gt('reward_amount', 0);

  const totalRewards = rewards?.reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0;

  // Get content completion count
  const { count: completions } = await supabase
    .from('engagement_events')
    .select('id', { count: 'exact', head: true })
    .eq('persona_id', personaId)
    .eq('event_type', 'content_complete');

  return NextResponse.json({
    success: true,
    stats: {
      currentStreak,
      totalRewards,
      contentCompletions: completions || 0
    }
  });
}
