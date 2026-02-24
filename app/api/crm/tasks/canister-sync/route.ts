/**
 * Task Canister Sync API
 * 
 * POST /api/crm/tasks/canister-sync - Sync task completion to canisters
 * GET /api/crm/tasks/canister-sync - Get canister sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  completeTaskWithCanisterSync,
  getCanisterSyncStatus,
  getPendingProposals,
  approveRewardProposal,
  fetchAndSyncReputationFromRQH,
} from '@/services/crm/taskCanisterService';
import { completeTask, getPersonaReputation } from '@/services/crm/taskService';
import * as db from '@/services/crm/crmDataAccess';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const personaId = searchParams.get('personaId');
    const partitionId = searchParams.get('partitionId');

    // Get canister sync status
    if (action === 'status' || !action) {
      const status = await getCanisterSyncStatus();
      return NextResponse.json({ status });
    }

    // Get pending proposals from RewardHub
    if (action === 'pending-proposals') {
      const result = await getPendingProposals();
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
      return NextResponse.json({ proposals: result.proposals });
    }

    // Fetch and sync reputation from RQH
    if (action === 'sync-reputation') {
      if (!personaId || !partitionId) {
        return NextResponse.json(
          { error: 'personaId and partitionId are required' },
          { status: 400 }
        );
      }

      const reputation = await fetchAndSyncReputationFromRQH(personaId, partitionId);
      return NextResponse.json({ reputation });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API] GET /api/crm/tasks/canister-sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get canister status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      // For complete-with-sync
      tenantId,
      contributionId,
      finalScore,
      qualityScore,
      trustScore,
      scoringBreakdown,
      reviewerPersonaId,
      proposerRootDid,
      recipientRootDid,
      recipientKybeDid,
      // For approve-proposal
      proposalId,
      approverRootDid,
      approved,
      comment,
    } = body;

    // Complete task and sync to canisters
    if (action === 'complete-with-sync') {
      if (!tenantId || !contributionId || finalScore === undefined) {
        return NextResponse.json(
          { error: 'tenantId, contributionId, and finalScore are required' },
          { status: 400 }
        );
      }

      if (!proposerRootDid || !recipientRootDid) {
        return NextResponse.json(
          { error: 'proposerRootDid and recipientRootDid are required for canister sync' },
          { status: 400 }
        );
      }

      // First, complete the task in CRM
      const completeResult = await completeTask({
        tenantId,
        contributionId,
        finalScore,
        qualityScore,
        trustScore,
        scoringBreakdown,
        reviewerPersonaId,
      });

      // Then sync to canisters
      const canisterResult = await completeTaskWithCanisterSync(
        completeResult,
        proposerRootDid,
        recipientRootDid,
        recipientKybeDid
      );

      return NextResponse.json({
        contribution: completeResult.contribution,
        task: completeResult.task,
        rewards: completeResult.rewards,
        reputationEvent: completeResult.reputationEvent,
        reputationDeltas: completeResult.reputationDeltas,
        cvs: completeResult.cvs,
        canisterSync: {
          success: canisterResult.success,
          rewardHubResults: canisterResult.rewardHubResults,
          rqhResult: canisterResult.rqhResult,
          errors: canisterResult.errors,
        },
        message: canisterResult.success
          ? 'Task completed and synced to canisters'
          : `Task completed but canister sync had errors: ${canisterResult.errors.join(', ')}`,
      });
    }

    // Approve a reward proposal in RewardHub
    if (action === 'approve-proposal') {
      if (!proposalId || !approverRootDid || approved === undefined) {
        return NextResponse.json(
          { error: 'proposalId, approverRootDid, and approved are required' },
          { status: 400 }
        );
      }

      const result = await approveRewardProposal({
        proposalId,
        approverRootDid,
        approved,
        comment,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        approvalId: result.approvalId,
        proposalStatus: result.proposalStatus,
        message: approved ? 'Proposal approved' : 'Proposal rejected',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: complete-with-sync, approve-proposal' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/tasks/canister-sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process canister sync' },
      { status: 500 }
    );
  }
}
