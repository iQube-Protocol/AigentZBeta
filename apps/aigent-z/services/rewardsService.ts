import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RewardConfig {
  bring_a_knight: { referrer: number; referee: number };
  herald_of_order: { sharer: number };
  knight_of_attention: { user: number };
}

export const REWARD_AMOUNTS: RewardConfig = {
  bring_a_knight: { referrer: 2, referee: 1 },
  herald_of_order: { sharer: 0.25 },
  knight_of_attention: { user: 0.5 }
};

export async function distributeBringAKnightReward(referrerId: string, refereeId: string) {
  try {
    // Create reward ledger entries
    const rewards = [
      {
        persona_id: referrerId,
        reward_type: 'bring_a_knight',
        amount: REWARD_AMOUNTS.bring_a_knight.referrer,
        status: 'pending',
        metadata: { referee_id: refereeId }
      },
      {
        persona_id: refereeId,
        reward_type: 'signup_bonus',
        amount: REWARD_AMOUNTS.bring_a_knight.referee,
        status: 'pending',
        metadata: { referrer_id: referrerId, type: 'first_purchase_discount' }
      }
    ];

    const { data, error } = await supabase
      .from('rewards_ledger')
      .insert(rewards)
      .select();

    if (error) throw error;

    // Create referral event
    await supabase
      .from('referral_events')
      .insert({
        referrer_persona_id: referrerId,
        referee_persona_id: refereeId,
        event_type: 'first_purchase',
        reward_amount: REWARD_AMOUNTS.bring_a_knight.referrer
      });

    // TODO: Submit to DVN for actual KNYT distribution
    // This will be integrated with the DVN service
    
    return { success: true, rewards: data };
  } catch (error) {
    console.error('Error distributing Bring a Knight reward:', error);
    return { success: false, error };
  }
}

export async function distributeHeraldOfOrderReward(personaId: string, shareId: string, conversionType: 'click' | 'signup' | 'conversion') {
  try {
    const rewardAmount = REWARD_AMOUNTS.herald_of_order.sharer;
    
    const { data, error } = await supabase
      .from('rewards_ledger')
      .insert({
        persona_id: personaId,
        reward_type: 'herald_of_order',
        amount: rewardAmount,
        status: 'pending',
        metadata: { share_id: shareId, conversion_type: conversionType }
      })
      .select()
      .single();

    if (error) throw error;

    // Update social share analytics
    await supabase
      .from('social_share_analytics')
      .update({
        [`${conversionType}s`]: supabase.raw(`${conversionType}s + 1`),
        reward_earned: supabase.raw(`reward_earned + ${rewardAmount}`)
      })
      .eq('id', shareId);

    return { success: true, reward: data };
  } catch (error) {
    console.error('Error distributing Herald of Order reward:', error);
    return { success: false, error };
  }
}

export async function distributeKnightOfAttentionReward(personaId: string, eventType: string, streakCount: number = 0) {
  try {
    const rewardAmount = REWARD_AMOUNTS.knight_of_attention.user;
    
    const { data, error } = await supabase
      .from('rewards_ledger')
      .insert({
        persona_id: personaId,
        reward_type: 'knight_of_attention',
        amount: rewardAmount,
        status: 'pending',
        metadata: { event_type: eventType, streak_count: streakCount }
      })
      .select()
      .single();

    if (error) throw error;

    // Create engagement event
    await supabase
      .from('engagement_events')
      .insert({
        persona_id: personaId,
        event_type: eventType,
        streak_count: streakCount,
        reward_amount: rewardAmount
      });

    return { success: true, reward: data };
  } catch (error) {
    console.error('Error distributing Knight of Attention reward:', error);
    return { success: false, error };
  }
}

export async function getPersonaRewards(personaId: string) {
  try {
    const { data, error } = await supabase
      .from('rewards_ledger')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, rewards: data };
  } catch (error) {
    console.error('Error fetching persona rewards:', error);
    return { success: false, error };
  }
}
