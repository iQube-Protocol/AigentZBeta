/**
 * CRM Rewards API
 * 
 * GET /api/crm/rewards - List rewards
 * POST /api/crm/rewards - Propose rewards for top contributors
 * PATCH /api/crm/rewards - Update reward status (approve, pay, cancel)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { TenantId, TokenType, RewardStatus } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const personaId = searchParams.get('personaId') || undefined;
    const status = searchParams.get('status') as RewardStatus | undefined;
    const tokenType = searchParams.get('tokenType') as TokenType | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const rewards = await crmService.listRewards(tenantId, {
      personaId,
      status,
      tokenType,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: rewards,
      pagination: {
        limit,
        offset,
        count: rewards.length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      periodStart,
      periodEnd,
      budget,
      topN,
    } = body;

    if (!tenantId || !periodStart || !periodEnd || !budget) {
      return NextResponse.json(
        { error: 'tenantId, periodStart, periodEnd, and budget are required' },
        { status: 400 }
      );
    }

    // Validate budget has at least one token type
    const hasValidBudget = Object.values(budget).some((v: any) => v > 0);
    if (!hasValidBudget) {
      return NextResponse.json(
        { error: 'budget must have at least one token type with amount > 0' },
        { status: 400 }
      );
    }

    const result = await crmService.proposeRewards({
      tenantId,
      periodStart,
      periodEnd,
      budget,
      topN,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to propose rewards' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      rewardId,
      status,
      txHash,
      chainId,
      notes,
    } = body;

    if (!tenantId || !rewardId) {
      return NextResponse.json(
        { error: 'tenantId and rewardId are required' },
        { status: 400 }
      );
    }

    const reward = await crmService.updateReward(tenantId, rewardId, {
      status,
      txHash,
      chainId,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: reward,
    });
  } catch (error: any) {
    console.error('[CRM API] PATCH /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update reward' },
      { status: 500 }
    );
  }
}
