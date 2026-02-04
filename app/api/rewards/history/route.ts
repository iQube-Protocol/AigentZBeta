/**
 * API Route: Reward History
 * GET /api/rewards/history?personaId=xxx&limit=20
 * 
 * Gets recent rewards for a persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRewardService } from '@/services/rewards/rewardService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    
    const rewardService = getRewardService();
    
    const [rewards, totalEarned, repInfo] = await Promise.all([
      rewardService.getRecentRewards(personaId, limit),
      rewardService.getTotalRewardsEarned(personaId),
      rewardService.getReputationMultiplier(personaId),
    ]);
    
    return NextResponse.json({
      personaId,
      rewards,
      totalEarned,
      reputationTier: repInfo.tier,
      reputationMultiplier: repInfo.multiplier,
    });
  } catch (error) {
    console.error('[API] Error fetching reward history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
