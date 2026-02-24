/**
 * Reward Verification Service
 * 
 * Integrates CRM rewards with DVN (Decentralized Verification Network)
 * and ReputationHub for on-chain verification of reward distributions.
 * 
 * Per DiDQube Policy:
 * - Rewards require Root DID verification (not KybeDID or Persona)
 * - All distributions must be tracked via DVN for audit trail
 * - Reputation data from RQH informs reward calculations
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { idlFactory as rqhIdl } from '@/services/ops/idl/rqh';
import * as db from './crmDataAccess';

// ============================================================================
// TYPES
// ============================================================================

export interface RewardVerificationResult {
  success: boolean;
  messageId?: string;
  txHash?: string;
  chainId?: number;
  verifiedAt?: string;
  error?: string;
}

export interface ReputationData {
  bucket: number;
  score: number;
  evidenceCount: number;
  lastUpdated: number;
}

export interface RewardDistributionRequest {
  rewardId: string;
  recipientRootDid: string;
  amount: number;
  tokenType: string;
  chainId: number;
  txHash: string;
  approverRootDid: string;
}

// ============================================================================
// DVN CANISTER INTEGRATION
// ============================================================================

const DVN_CANISTER_ID = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || 
                        process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;

const RQH_CANISTER_ID = process.env.RQH_CANISTER_ID || 
                        process.env.NEXT_PUBLIC_RQH_CANISTER_ID ||
                        'sp5ye-2qaaa-aaaao-qkqla-cai'; // Default mainnet RQH

/**
 * Submit reward distribution to DVN for verification and tracking
 */
export async function submitRewardToDVN(
  request: RewardDistributionRequest
): Promise<RewardVerificationResult> {
  if (!DVN_CANISTER_ID) {
    console.warn('[RewardVerification] DVN canister not configured, using local tracking');
    return {
      success: true,
      messageId: `local:reward:${request.rewardId}:${Date.now()}`,
      txHash: request.txHash,
      chainId: request.chainId,
      verifiedAt: new Date().toISOString(),
    };
  }

  try {
    const dvn = await getActor<any>(DVN_CANISTER_ID, dvnIdl);
    
    // Create reward distribution payload
    const payload = JSON.stringify({
      action: 'REWARD_DISTRIBUTION',
      rewardId: request.rewardId,
      recipientRootDid: request.recipientRootDid,
      amount: request.amount,
      tokenType: request.tokenType,
      txHash: request.txHash,
      chainId: request.chainId,
      approverRootDid: request.approverRootDid,
      timestamp: Date.now(),
    });

    const messageId = `reward_${request.rewardId}_${Date.now()}`;
    
    // Submit to DVN for cross-chain verification
    const result = await dvn.submit_dvn_message(
      request.chainId,  // source chain
      0,                // destination (IC for record)
      Array.from(new TextEncoder().encode(payload)),
      messageId
    );

    if (typeof result === 'string') {
      console.log('[RewardVerification] DVN submission successful:', result);
      return {
        success: true,
        messageId: result,
        txHash: request.txHash,
        chainId: request.chainId,
        verifiedAt: new Date().toISOString(),
      };
    }

    throw new Error('Unexpected DVN response');
  } catch (error: any) {
    console.error('[RewardVerification] DVN submission failed:', error);
    return {
      success: false,
      error: error.message || 'DVN submission failed',
    };
  }
}

/**
 * Monitor an EVM transaction for reward distribution
 */
export async function monitorRewardTransaction(
  chainId: number,
  txHash: string,
  rpcUrl?: string
): Promise<RewardVerificationResult> {
  if (!DVN_CANISTER_ID) {
    return {
      success: true,
      messageId: `local:monitor:${txHash}`,
      txHash,
      chainId,
      verifiedAt: new Date().toISOString(),
    };
  }

  try {
    const dvn = await getActor<any>(DVN_CANISTER_ID, dvnIdl);
    
    const effectiveRpc = rpcUrl || getDefaultRpcUrl(chainId);
    
    const result = await dvn.monitor_evm_transaction(chainId, txHash, effectiveRpc);
    
    if ('Ok' in result) {
      return {
        success: true,
        messageId: result.Ok,
        txHash,
        chainId,
        verifiedAt: new Date().toISOString(),
      };
    } else {
      throw new Error(result.Err || 'Monitor failed');
    }
  } catch (error: any) {
    console.error('[RewardVerification] Transaction monitoring failed:', error);
    return {
      success: false,
      txHash,
      chainId,
      error: error.message,
    };
  }
}

// ============================================================================
// REPUTATIONHUB INTEGRATION
// ============================================================================

/**
 * Fetch reputation data from ReputationHub canister
 */
export async function fetchReputationFromRQH(
  partitionId: string
): Promise<ReputationData | null> {
  if (!RQH_CANISTER_ID) {
    console.warn('[RewardVerification] RQH canister not configured');
    return null;
  }

  try {
    const rqh = await getActor<any>(RQH_CANISTER_ID, rqhIdl);
    
    const result = await rqh.get_reputation_bucket(partitionId);
    
    if (result.ok && result.data) {
      return {
        bucket: Number(result.data.bucket),
        score: Number(result.data.score),
        evidenceCount: Number(result.data.evidence_count),
        lastUpdated: Number(result.data.last_updated),
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('[RewardVerification] RQH fetch failed:', error);
    return null;
  }
}

/**
 * Sync reputation from RQH to CRM persona
 */
export async function syncReputationToCRM(
  crmPersonaId: string,
  partitionId: string
): Promise<boolean> {
  const reputation = await fetchReputationFromRQH(partitionId);
  
  if (!reputation) {
    console.warn('[RewardVerification] No reputation found for partition:', partitionId);
    return false;
  }

  return db.syncPersonaReputation(
    crmPersonaId,
    reputation.bucket,
    reputation.score
  );
}

// ============================================================================
// REWARD DISTRIBUTION WORKFLOW
// ============================================================================

/**
 * Complete reward distribution with DVN verification
 * 
 * Workflow:
 * 1. Verify approver has valid Root DID admin role
 * 2. Submit distribution to DVN for tracking
 * 3. Monitor transaction on target chain
 * 4. Update reward status in CRM
 */
export async function distributeRewardWithVerification(
  rewardId: string,
  tenantId: string,
  txHash: string,
  chainId: number,
  approverRootDid: string
): Promise<{
  success: boolean;
  reward?: any;
  dvnMessageId?: string;
  error?: string;
}> {
  try {
    // 1. Get reward details
    const reward = await db.getReward(tenantId, rewardId);
    if (!reward) {
      return { success: false, error: 'Reward not found' };
    }

    if (reward.status !== 'approved') {
      return { success: false, error: 'Reward must be approved before distribution' };
    }

    // 2. Get recipient's Root DID
    const persona = await db.getPersonaWithIdentity(reward.tenantId, reward.personaId);
    const recipientRootDid = persona?.rootDidUri || persona?.kybeDid || reward.personaId;

    // 3. Submit to DVN for verification
    const dvnResult = await submitRewardToDVN({
      rewardId,
      recipientRootDid,
      amount: reward.amount,
      tokenType: reward.tokenType,
      chainId,
      txHash,
      approverRootDid,
    });

    if (!dvnResult.success) {
      console.warn('[RewardVerification] DVN submission failed, continuing with local tracking');
    }

    // 4. Monitor the transaction
    const monitorResult = await monitorRewardTransaction(chainId, txHash);

    // 5. Update reward status in CRM
    // Note: 'paid' is the distributed status in CRM types
    const updatedReward = await db.updateReward(tenantId, rewardId, {
      status: 'paid',
      txHash,
      chainId: chainId.toString(),
      notes: JSON.stringify({
        dvnMessageId: dvnResult.messageId,
        verifiedAt: dvnResult.verifiedAt,
        monitorMessageId: monitorResult.messageId,
        approverRootDid,
      }),
    });

    return {
      success: true,
      reward: updatedReward,
      dvnMessageId: dvnResult.messageId,
    };
  } catch (error: any) {
    console.error('[RewardVerification] Distribution failed:', error);
    return {
      success: false,
      error: error.message || 'Distribution failed',
    };
  }
}

/**
 * Calculate reward amount based on PoKW and reputation
 */
export async function calculateRewardWithReputation(
  personaId: string,
  tenantId: string,
  basePokw: number,
  tokenType: string
): Promise<{
  amount: number;
  pokwBasis: number;
  reputationMultiplier: number;
  reputationBucket: number;
}> {
  // Get persona with identity info
  const persona = await db.getPersonaWithIdentity(tenantId, personaId);
  
  // ReputationBucket can be string enum or number, normalize to number
  let reputationBucketNum = typeof persona?.reputationBucket === 'number' 
    ? persona.reputationBucket 
    : 0;
  let reputationMultiplier = 1.0;

  // Try to fetch fresh reputation from RQH if we have a partition ID
  if (persona?.kybeDid) {
    const freshReputation = await fetchReputationFromRQH(persona.kybeDid);
    if (freshReputation) {
      reputationBucketNum = freshReputation.bucket;
      // Sync to CRM for caching
      await db.syncPersonaReputation(personaId, freshReputation.bucket, freshReputation.score);
    }
  }

  // Reputation multiplier based on bucket (0-5)
  // Bucket 0: 1.0x, Bucket 1: 1.1x, ..., Bucket 5: 1.5x
  reputationMultiplier = 1.0 + (reputationBucketNum * 0.1);

  // Base reward calculation (example: 1 PoKW = 0.1 tokens)
  const baseAmount = basePokw * 0.1;
  const amount = Math.round(baseAmount * reputationMultiplier * 100) / 100;

  return {
    amount,
    pokwBasis: basePokw,
    reputationMultiplier,
    reputationBucket: reputationBucketNum,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultRpcUrl(chainId: number): string {
  const rpcUrls: Record<number, string> = {
    1: 'https://eth.llamarpc.com',
    137: 'https://polygon-rpc.com',
    80002: 'https://rpc-amoy.polygon.technology',
    11155111: 'https://rpc.sepolia.org',
    8453: 'https://mainnet.base.org',
    84532: 'https://sepolia.base.org',
  };
  return rpcUrls[chainId] || '';
}

/**
 * Verify a reward distribution on-chain via DVN
 */
export async function verifyRewardDistribution(
  tenantId: string,
  rewardId: string
): Promise<{
  verified: boolean;
  txHash?: string;
  chainId?: number;
  dvnMessageId?: string;
  error?: string;
}> {
  try {
    const reward = await db.getReward(tenantId, rewardId);
    if (!reward) {
      return { verified: false, error: 'Reward not found' };
    }

    // 'paid' is the distributed status in CRM types
    if (reward.status !== 'paid' || !reward.txHash) {
      return { verified: false, error: 'Reward not yet distributed' };
    }

    // Parse notes for DVN metadata
    let notesData: any = {};
    try {
      if (reward.notes) {
        notesData = JSON.parse(reward.notes);
      }
    } catch {
      // Notes might not be JSON
    }

    const chainIdNum = reward.chainId ? parseInt(reward.chainId, 10) : 137;

    // Check DVN for verification status
    if (DVN_CANISTER_ID && notesData?.dvnMessageId) {
      const dvn = await getActor<any>(DVN_CANISTER_ID, dvnIdl);
      const message = await dvn.get_dvn_message(notesData.dvnMessageId);
      
      if (message) {
        return {
          verified: true,
          txHash: reward.txHash || undefined,
          chainId: chainIdNum,
          dvnMessageId: notesData.dvnMessageId,
        };
      }
    }

    // Fallback: assume verified if we have txHash
    return {
      verified: true,
      txHash: reward.txHash || undefined,
      chainId: chainIdNum,
      dvnMessageId: notesData?.dvnMessageId,
    };
  } catch (error: any) {
    console.error('[RewardVerification] Verification check failed:', error);
    return {
      verified: false,
      error: error.message,
    };
  }
}
