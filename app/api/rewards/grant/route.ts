/**
 * API Route: Grant Reward
 * POST /api/rewards/grant
 * 
 * Grants a KNYT reward for completing a task.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRewardService, RewardTaskType } from '@/services/rewards/rewardService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, taskType, sourceEventId, metadata, customBaseAmount, skipCaps, mintingMode } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    if (!taskType || !Object.values(RewardTaskType).includes(taskType)) {
      return NextResponse.json({
        error: 'Invalid taskType',
        validTypes: Object.values(RewardTaskType),
      }, { status: 400 });
    }

    if (mintingMode && !['immediate', 'deferred', 'canonical', 'remote'].includes(mintingMode)) {
      return NextResponse.json({
        error: 'Invalid mintingMode',
        validModes: ['immediate', 'deferred', 'canonical', 'remote'],
      }, { status: 400 });
    }

    const rewardService = getRewardService();
    const result = await rewardService.grantRewardForTask({
      personaId,
      taskType,
      sourceEventId,
      metadata,
      customBaseAmount,
      skipCaps,
      mintingMode,
    });
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      rewardGrantId: result.rewardGrantId,
      baseAmount: result.baseAmount,
      finalAmount: result.finalAmount,
      repMultiplier: result.repMultiplier,
    });
  } catch (error) {
    console.error('[API] Error granting reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
