/**
 * Task Canister Service
 * 
 * Integrates task completion with RewardHub and RQH canisters.
 * 
 * Flow:
 * 1. Task completion triggers reward creation in CRM
 * 2. Rewards are submitted to RewardHub canister for multi-sig approval
 * 3. Reputation updates are synced to RQH canister
 * 4. DVN tracks cross-chain distributions
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as rewardHubIdl, RewardHubService } from '@/services/ops/idl/reward_hub';
import { idlFactory as rqhIdl } from '@/services/ops/idl/rqh';
import { getCrmClient } from './crmDataAccess';
import * as db from './crmDataAccess';
import {
  CrmReward,
  CrmTaskTemplate,
  CrmPersonaReputation,
  CrmReputationEventNew,
} from '@/types/crm';

// ============================================================================
// CANISTER IDS
// ============================================================================

const REWARD_HUB_CANISTER_ID = process.env.REWARD_HUB_CANISTER_ID ||
                               process.env.NEXT_PUBLIC_REWARD_HUB_CANISTER_ID ||
                               'lvo2w-jqaaa-aaaas-qc2wa-cai';

const RQH_CANISTER_ID = process.env.RQH_CANISTER_ID ||
                        process.env.NEXT_PUBLIC_RQH_CANISTER_ID ||
                        'zdjf3-2qaaa-aaaas-qck4q-cai';

// ============================================================================
// TYPES
// ============================================================================

export interface SubmitToRewardHubInput {
  reward: CrmReward;
  task: CrmTaskTemplate;
  contributionId: string;
  proposerRootDid: string;
  recipientRootDid: string;
  reputationBucket?: number;
  reputationMultiplier?: number;
}

export interface SubmitToRewardHubResult {
  success: boolean;
  proposalId?: string;
  error?: string;
}

export interface SyncToRQHInput {
  personaId: string;
  partitionId: string;  // Usually kybeDid
  reputationEvent: CrmReputationEventNew;
  skillCategory?: string;
}

export interface SyncToRQHResult {
  success: boolean;
  bucketId?: string;
  error?: string;
}

export interface ApproveRewardInput {
  proposalId: string;
  approverRootDid: string;
  approved: boolean;
  comment?: string;
  signature?: Uint8Array;
}

export interface ApproveRewardResult {
  success: boolean;
  approvalId?: string;
  proposalStatus?: string;
  error?: string;
}

// ============================================================================
// REWARDHUB CANISTER INTEGRATION
// ============================================================================

/**
 * Submit a task-based reward to RewardHub canister for multi-sig approval
 */
export async function submitTaskRewardToRewardHub(
  input: SubmitToRewardHubInput
): Promise<SubmitToRewardHubResult> {
  const { reward, task, contributionId, proposerRootDid, recipientRootDid, reputationBucket, reputationMultiplier } = input;

  if (!REWARD_HUB_CANISTER_ID) {
    console.warn('[TaskCanister] RewardHub canister not configured, skipping on-chain submission');
    return {
      success: true,
      proposalId: `local:${reward.id}`,
    };
  }

  try {
    const rewardHub = await getActor<RewardHubService>(REWARD_HUB_CANISTER_ID, rewardHubIdl);

    // Convert dates to nanoseconds (IC timestamp format)
    const periodStart = BigInt(new Date(reward.periodStart).getTime() * 1_000_000);
    const periodEnd = BigInt(new Date(reward.periodEnd).getTime() * 1_000_000);

    // Build metadata
    const metadata = JSON.stringify({
      taskTemplateId: task.id,
      taskSlug: task.slug,
      taskTitle: task.title,
      taskCategory: task.category,
      contributionId,
      pillar: task.isKnowledgePillar ? 'knowledge' : 'compute',
      crmRewardId: reward.id,
    });

    // Create proposal request
    const request = {
      proposer_root_did: proposerRootDid,
      recipient_root_did: recipientRootDid,
      recipient_persona_id: reward.personaId,
      tenant_id: reward.tenantId,
      amount: BigInt(Math.round(reward.amount * 1_000_000)),  // Convert to micro-units
      token_type: reward.tokenType,
      pokw_basis: BigInt(Math.round(reward.pokwScoreUsed * 1000)),
      reputation_bucket: reputationBucket ?? 0,
      reputation_multiplier: reputationMultiplier ?? 1.0,
      period_start: periodStart,
      period_end: periodEnd,
      reason: `Task completion: ${task.title}`,
      metadata: [metadata],  // Optional field
    };

    console.log('[TaskCanister] Submitting reward proposal to RewardHub:', {
      proposalId: reward.id,
      amount: reward.amount,
      tokenType: reward.tokenType,
    });

    const result = await rewardHub.create_proposal(request);

    if (result.ok && result.data) {
      console.log('[TaskCanister] Reward proposal created:', result.data.id);
      
      // Update CRM reward with canister proposal ID
      await updateRewardWithCanisterData(reward.tenantId, reward.id, {
        canisterProposalId: result.data.id,
        canisterStatus: 'Proposed',
      });

      return {
        success: true,
        proposalId: result.data.id,
      };
    } else {
      throw new Error(result.error || 'Failed to create proposal');
    }
  } catch (error: any) {
    console.error('[TaskCanister] RewardHub submission failed:', error);
    return {
      success: false,
      error: error.message || 'RewardHub submission failed',
    };
  }
}

/**
 * Submit multiple rewards from a task completion to RewardHub
 */
export async function submitTaskRewardsToRewardHub(
  rewards: CrmReward[],
  task: CrmTaskTemplate,
  contributionId: string,
  proposerRootDid: string,
  recipientRootDid: string,
  reputationBucket?: number,
  reputationMultiplier?: number
): Promise<{
  success: boolean;
  results: SubmitToRewardHubResult[];
  errors: string[];
}> {
  const results: SubmitToRewardHubResult[] = [];
  const errors: string[] = [];

  for (const reward of rewards) {
    const result = await submitTaskRewardToRewardHub({
      reward,
      task,
      contributionId,
      proposerRootDid,
      recipientRootDid,
      reputationBucket,
      reputationMultiplier,
    });

    results.push(result);
    if (!result.success && result.error) {
      errors.push(`${reward.tokenType}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  };
}

/**
 * Approve a reward proposal in RewardHub canister
 */
export async function approveRewardProposal(
  input: ApproveRewardInput
): Promise<ApproveRewardResult> {
  const { proposalId, approverRootDid, approved, comment, signature } = input;

  if (!REWARD_HUB_CANISTER_ID) {
    console.warn('[TaskCanister] RewardHub canister not configured');
    return {
      success: true,
      approvalId: `local:approval:${proposalId}`,
      proposalStatus: approved ? 'Approved' : 'Rejected',
    };
  }

  try {
    const rewardHub = await getActor<RewardHubService>(REWARD_HUB_CANISTER_ID, rewardHubIdl);

    const request = {
      proposal_id: proposalId,
      approver_root_did: approverRootDid,
      approved,
      comment: comment ? [comment] : [],
      signature: signature ? Array.from(signature) : [],
    };

    const result = await rewardHub.approve_proposal(request);

    if (result.ok && result.data) {
      // Check if proposal is now fully approved
      const proposal = await rewardHub.get_proposal(proposalId);
      const proposalStatus = proposal.data?.status ? 
        Object.keys(proposal.data.status)[0] : 'Unknown';

      return {
        success: true,
        approvalId: result.data.id,
        proposalStatus,
      };
    } else {
      throw new Error(result.error || 'Failed to approve proposal');
    }
  } catch (error: any) {
    console.error('[TaskCanister] Approval failed:', error);
    return {
      success: false,
      error: error.message || 'Approval failed',
    };
  }
}

/**
 * Get pending proposals from RewardHub
 */
export async function getPendingProposals(): Promise<{
  success: boolean;
  proposals?: any[];
  error?: string;
}> {
  if (!REWARD_HUB_CANISTER_ID) {
    return { success: true, proposals: [] };
  }

  try {
    const rewardHub = await getActor<RewardHubService>(REWARD_HUB_CANISTER_ID, rewardHubIdl);
    const result = await rewardHub.get_proposals_by_status('Proposed');

    if (result.ok) {
      return {
        success: true,
        proposals: result.data || [],
      };
    } else {
      throw new Error(result.error || 'Failed to get proposals');
    }
  } catch (error: any) {
    console.error('[TaskCanister] Failed to get pending proposals:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// RQH CANISTER INTEGRATION
// ============================================================================

/**
 * Sync reputation update to RQH canister
 */
export async function syncReputationToRQH(
  input: SyncToRQHInput
): Promise<SyncToRQHResult> {
  const { personaId, partitionId, reputationEvent, skillCategory } = input;

  if (!RQH_CANISTER_ID) {
    console.warn('[TaskCanister] RQH canister not configured, skipping on-chain sync');
    return {
      success: true,
      bucketId: `local:${personaId}`,
    };
  }

  try {
    const rqh = await getActor<any>(RQH_CANISTER_ID, rqhIdl);

    // First, check if bucket exists for this partition
    const existingBucket = await rqh.get_reputation_bucket(partitionId);

    if (!existingBucket.ok || !existingBucket.data) {
      // Create new reputation bucket
      const createResult = await rqh.create_reputation_bucket({
        partition_id: partitionId,
        skill_category: skillCategory || 'general',
        initial_score: [reputationEvent.deltaOverall],  // Optional
      });

      if (!createResult.ok) {
        throw new Error(createResult.error || 'Failed to create reputation bucket');
      }

      console.log('[TaskCanister] Created new RQH bucket:', createResult.data?.id);
      
      // Update CRM with RQH bucket ID
      await updatePersonaRQHSync(personaId, createResult.data?.id, partitionId);

      return {
        success: true,
        bucketId: createResult.data?.id,
      };
    }

    // Add evidence to existing bucket
    const evidenceData = JSON.stringify({
      sourceType: reputationEvent.sourceType,
      sourceId: reputationEvent.sourceId,
      taskTemplateId: reputationEvent.taskTemplateId,
      cvs: reputationEvent.cvs,
      deltas: {
        technical: reputationEvent.deltaTechnical,
        creative: reputationEvent.deltaCreative,
        entrepreneurial: reputationEvent.deltaEntrepreneurial,
        dataArch: reputationEvent.deltaDataArch,
        community: reputationEvent.deltaCommunity,
        overall: reputationEvent.deltaOverall,
      },
      reason: reputationEvent.reason,
      timestamp: reputationEvent.createdAt,
    });

    const evidenceResult = await rqh.add_reputation_evidence({
      bucket_id: existingBucket.data.id,
      evidence_type: reputationEvent.sourceType,
      evidence_data: evidenceData,
      weight: reputationEvent.cvs || reputationEvent.deltaOverall,
    });

    if (!evidenceResult.ok) {
      throw new Error(evidenceResult.error || 'Failed to add evidence');
    }

    console.log('[TaskCanister] Added evidence to RQH bucket:', existingBucket.data.id);

    // Update CRM with sync timestamp
    await updatePersonaRQHSync(personaId, existingBucket.data.id, partitionId);

    return {
      success: true,
      bucketId: existingBucket.data.id,
    };
  } catch (error: any) {
    console.error('[TaskCanister] RQH sync failed:', error);
    return {
      success: false,
      error: error.message || 'RQH sync failed',
    };
  }
}

/**
 * Fetch reputation from RQH and update CRM
 */
export async function fetchAndSyncReputationFromRQH(
  personaId: string,
  partitionId: string
): Promise<CrmPersonaReputation | null> {
  if (!RQH_CANISTER_ID) {
    return null;
  }

  try {
    const rqh = await getActor<any>(RQH_CANISTER_ID, rqhIdl);
    const result = await rqh.get_reputation_bucket(partitionId);

    if (!result.ok || !result.data) {
      return null;
    }

    // Update CRM persona reputation with RQH data
    const client = getCrmClient();
    
    await client
      .from('crm_persona_reputation')
      .upsert({
        persona_id: personaId,
        rqh_bucket_id: result.data.id,
        rqh_partition_id: partitionId,
        rqh_synced_at: new Date().toISOString(),
        // Note: RQH has single score, we map to overall
        rep_overall: Number(result.data.score),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'persona_id',
      });

    // Return updated reputation
    const { data: reputation } = await client
      .from('crm_persona_reputation')
      .select('*')
      .eq('persona_id', personaId)
      .single();

    if (reputation) {
      return {
        personaId: reputation.persona_id,
        repTechnical: Number(reputation.rep_technical),
        repCreative: Number(reputation.rep_creative),
        repEntrepreneurial: Number(reputation.rep_entrepreneurial),
        repDataArch: Number(reputation.rep_data_arch),
        repCommunity: Number(reputation.rep_community),
        repOverall: Number(reputation.rep_overall),
        lifetimeCvs: Number(reputation.lifetime_cvs),
        totalTasksCompleted: reputation.total_tasks_completed,
        totalTasksClaimed: reputation.total_tasks_claimed,
        rqhBucketId: reputation.rqh_bucket_id,
        rqhPartitionId: reputation.rqh_partition_id,
        rqhSyncedAt: reputation.rqh_synced_at,
        repRolling12m: Number(reputation.rep_rolling_12m),
        updatedAt: reputation.updated_at,
      };
    }

    return null;
  } catch (error: any) {
    console.error('[TaskCanister] Failed to fetch/sync RQH reputation:', error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateRewardWithCanisterData(
  tenantId: string,
  rewardId: string,
  data: {
    canisterProposalId?: string;
    canisterStatus?: string;
  }
): Promise<void> {
  const client = getCrmClient();

  // Store canister data in notes field as JSON
  const { data: reward } = await client
    .from('crm_rewards')
    .select('notes')
    .eq('tenant_id', tenantId)
    .eq('id', rewardId)
    .single();

  let existingNotes: Record<string, unknown> = {};
  try {
    if (reward?.notes) {
      existingNotes = JSON.parse(reward.notes);
    }
  } catch {
    existingNotes = { originalNotes: reward?.notes };
  }

  const updatedNotes = JSON.stringify({
    ...existingNotes,
    rewardHub: {
      proposalId: data.canisterProposalId,
      status: data.canisterStatus,
      syncedAt: new Date().toISOString(),
    },
  });

  await client
    .from('crm_rewards')
    .update({ notes: updatedNotes })
    .eq('tenant_id', tenantId)
    .eq('id', rewardId);
}

async function updatePersonaRQHSync(
  personaId: string,
  bucketId: string,
  partitionId: string
): Promise<void> {
  const client = getCrmClient();

  await client
    .from('crm_persona_reputation')
    .upsert({
      persona_id: personaId,
      rqh_bucket_id: bucketId,
      rqh_partition_id: partitionId,
      rqh_synced_at: new Date().toISOString(),
    }, {
      onConflict: 'persona_id',
    });
}

// ============================================================================
// COMPLETE TASK WITH CANISTER SYNC
// ============================================================================

/**
 * Enhanced task completion that syncs to both RewardHub and RQH canisters
 */
export async function completeTaskWithCanisterSync(
  completeTaskResult: {
    contribution: any;
    task: CrmTaskTemplate;
    rewards: CrmReward[];
    reputationEvent: CrmReputationEventNew;
    reputationDeltas: any;
    cvs: number;
  },
  proposerRootDid: string,
  recipientRootDid: string,
  recipientKybeDid?: string
): Promise<{
  success: boolean;
  rewardHubResults?: SubmitToRewardHubResult[];
  rqhResult?: SyncToRQHResult;
  errors: string[];
}> {
  const errors: string[] = [];
  const { task, rewards, reputationEvent, contribution } = completeTaskResult;

  // 1. Submit rewards to RewardHub
  const rewardHubResult = await submitTaskRewardsToRewardHub(
    rewards,
    task,
    contribution.id,
    proposerRootDid,
    recipientRootDid,
    0,  // reputationBucket - could be fetched from RQH
    1.0  // reputationMultiplier
  );

  if (!rewardHubResult.success) {
    errors.push(...rewardHubResult.errors);
  }

  // 2. Sync reputation to RQH (if we have a partition ID)
  let rqhResult: SyncToRQHResult | undefined;
  if (recipientKybeDid) {
    rqhResult = await syncReputationToRQH({
      personaId: contribution.personaId,
      partitionId: recipientKybeDid,
      reputationEvent,
      skillCategory: task.category,
    });

    if (!rqhResult.success && rqhResult.error) {
      errors.push(`RQH: ${rqhResult.error}`);
    }
  }

  return {
    success: errors.length === 0,
    rewardHubResults: rewardHubResult.results,
    rqhResult,
    errors,
  };
}

// ============================================================================
// CANISTER STATUS
// ============================================================================

export interface CanisterSyncStatus {
  rewardHubConnected: boolean;
  rqhConnected: boolean;
  rewardHubConfig?: {
    requiredApprovals: number;
    uberAdmins: string[];
  };
  rqhStats?: {
    bucketCount: number;
    evidenceCount: number;
  };
}

/**
 * Check canister connectivity and get status
 */
export async function getCanisterSyncStatus(): Promise<CanisterSyncStatus> {
  const status: CanisterSyncStatus = {
    rewardHubConnected: false,
    rqhConnected: false,
  };

  // Check RewardHub
  if (REWARD_HUB_CANISTER_ID) {
    try {
      const rewardHub = await getActor<RewardHubService>(REWARD_HUB_CANISTER_ID, rewardHubIdl);
      const health = await rewardHub.health();
      if (health.toLowerCase().includes('healthy')) {
        status.rewardHubConnected = true;
        
        // Get config
        const config = await rewardHub.get_config();
        status.rewardHubConfig = {
          requiredApprovals: config[0],
          uberAdmins: config[1],
        };
      }
    } catch (error) {
      console.error('[TaskCanister] RewardHub health check failed:', error);
    }
  }

  // Check RQH
  if (RQH_CANISTER_ID) {
    try {
      const rqh = await getActor<any>(RQH_CANISTER_ID, rqhIdl);
      const health = await rqh.health();
      if (health.toLowerCase().includes('healthy')) {
        status.rqhConnected = true;
        
        // Parse stats from health string
        const bucketMatch = health.match(/Buckets: (\d+)/);
        const evidenceMatch = health.match(/Evidence: (\d+)/);
        if (bucketMatch || evidenceMatch) {
          status.rqhStats = {
            bucketCount: bucketMatch ? parseInt(bucketMatch[1], 10) : 0,
            evidenceCount: evidenceMatch ? parseInt(evidenceMatch[1], 10) : 0,
          };
        }
      }
    } catch (error) {
      console.error('[TaskCanister] RQH health check failed:', error);
    }
  }

  return status;
}
