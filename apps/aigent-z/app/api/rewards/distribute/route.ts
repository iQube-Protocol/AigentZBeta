import { NextRequest, NextResponse } from 'next/server';
import { distributeBringAKnightReward, distributeHeraldOfOrderReward, distributeKnightOfAttentionReward } from '@/services/rewards/rewardsService';

export async function POST(request: NextRequest) {
  try {
    const { rewardType, ...params } = await request.json();
    
    let result;
    
    switch (rewardType) {
      case 'bring_a_knight':
        result = await distributeBringAKnightReward(params.referrerId, params.refereeId);
        break;
      case 'herald_of_order':
        result = await distributeHeraldOfOrderReward(params.personaId, params.shareId, params.conversionType);
        break;
      case 'knight_of_attention':
        result = await distributeKnightOfAttentionReward(params.personaId, params.eventType, params.streakCount);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid reward type' }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Reward distribution error:', error);
    return NextResponse.json({ success: false, error: 'Distribution failed' }, { status: 500 });
  }
}
