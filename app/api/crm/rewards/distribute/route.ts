/**
 * Reward Distribution API
 * 
 * POST /api/crm/rewards/distribute
 * 
 * Distributes an approved reward with DVN verification.
 * Per DiDQube policy, requires Root DID for approver verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  distributeRewardWithVerification,
  verifyRewardDistribution,
} from '@/services/crm/rewardVerificationService';
import * as db from '@/services/crm/crmDataAccess';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rewardId,
      tenantId,
      txHash,
      chainId,
      approverRootDid,  // Root DID required per DiDQube policy
    } = body;

    // Validate required fields
    if (!rewardId) {
      return NextResponse.json(
        { error: 'rewardId is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!txHash) {
      return NextResponse.json(
        { error: 'txHash is required (the blockchain transaction hash)' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { error: 'chainId is required (e.g., 137 for Polygon, 1 for Ethereum)' },
        { status: 400 }
      );
    }

    if (!approverRootDid) {
      return NextResponse.json(
        { error: 'approverRootDid is required (Root DID of the admin distributing the reward)' },
        { status: 400 }
      );
    }

    // Normalize Root DID
    const normalizedApproverDid = approverRootDid.startsWith('did:') 
      ? approverRootDid 
      : `did:root:${approverRootDid}`;

    // Verify approver has admin access
    const approverRoles = await db.getAdminRolesByKybeDid(normalizedApproverDid);
    if (approverRoles.length === 0) {
      return NextResponse.json(
        { error: 'Approver does not have admin access' },
        { status: 403 }
      );
    }

    // Check approver has permission to distribute rewards
    const hasPermission = approverRoles.some(r => 
      r.permissions.write || r.permissions.manage_users || r.roleType === 'uber_admin'
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Approver does not have permission to distribute rewards' },
        { status: 403 }
      );
    }

    // Distribute with DVN verification
    const result = await distributeRewardWithVerification(
      rewardId,
      tenantId,
      txHash,
      chainId,
      normalizedApproverDid
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Distribution failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        reward: result.reward,
        dvnMessageId: result.dvnMessageId,
        txHash,
        chainId,
        distributedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Rewards API] Distribution error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to distribute reward' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/rewards/distribute?rewardId=xxx
 * 
 * Verify a reward distribution status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rewardId = searchParams.get('rewardId');
    const tenantId = searchParams.get('tenantId');

    if (!rewardId) {
      return NextResponse.json(
        { error: 'rewardId query parameter is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const result = await verifyRewardDistribution(tenantId, rewardId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Rewards API] Verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify distribution' },
      { status: 500 }
    );
  }
}
