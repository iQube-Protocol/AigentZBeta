/**
 * Reward Service - Phase 1 KNYT Rewards
 * 
 * Handles task-based KNYT rewards with reputation multipliers.
 * All rewards flow through the DVN/x402 ledger.
 * 
 * Hero Task Families:
 * - Bring a Knight: Referral rewards
 * - Knight of Attention: Engagement rewards (episode completion, streaks)
 * - Herald of the Order: Social sharing rewards
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/** Reward task types */
export enum RewardTaskType {
  // Referrals - Bring a Knight
  BringAKnightQualifiedReferral = 'BringAKnightQualifiedReferral',
  
  // Engagement - Knight of Attention
  KnightOfAttentionEpisodeComplete = 'KnightOfAttentionEpisodeComplete',
  KnightOfAttentionWeeklyStreak = 'KnightOfAttentionWeeklyStreak',
  KnightOfAttentionStreakBonus = 'KnightOfAttentionStreakBonus',
  
  // Social - Herald of the Order
  HeraldCuriosityClicks = 'HeraldCuriosityClicks',
  HeraldAudienceSignups = 'HeraldAudienceSignups',
  HeraldConversionPayingUser = 'HeraldConversionPayingUser',
  
  // Special
  FoundingOrderAirdrop = 'FoundingOrderAirdrop',
}

/** Order tier (investor cohorts) */
export type OrderTier = 'NONE' | 'KETA' | 'KEJI' | 'FIRST' | 'ZERO' | 'SAT';

/** Reputation tier (derived from order tier) */
export type ReputationTier = 'R-' | 'R0_KETA' | 'R1_KEJI' | 'R2_FIRST' | 'R3_ZERO' | 'R4_SAT';

/** Grant reward request */
export interface GrantRewardRequest {
  personaId: string;
  taskType: RewardTaskType;
  sourceEventId?: string;
  metadata?: Record<string, any>;
  /** Override base amount (for special cases like airdrops) */
  customBaseAmount?: number;
  /** Skip caps check (for airdrops) */
  skipCaps?: boolean;
}

/** Grant reward result */
export interface GrantRewardResult {
  success: boolean;
  rewardGrantId?: string;
  baseAmount: number;
  finalAmount: number;
  repMultiplier: number;
  error?: string;
}

/** Reward grant record */
export interface RewardGrant {
  id: string;
  personaId: string;
  taskType: RewardTaskType;
  amountKnyt: number;
  baseAmountKnyt: number;
  repMultiplier: number;
  sourceEventId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Base reward amounts per task type (in KNYT) */
export const BASE_REWARD_AMOUNTS: Record<RewardTaskType, number> = {
  // Bring a Knight
  [RewardTaskType.BringAKnightQualifiedReferral]: 2.0, // Referrer gets 2, new user gets 1 (via metadata)
  
  // Knight of Attention
  [RewardTaskType.KnightOfAttentionEpisodeComplete]: 0.5,
  [RewardTaskType.KnightOfAttentionWeeklyStreak]: 0.5,
  [RewardTaskType.KnightOfAttentionStreakBonus]: 2.0, // 4-week streak bonus
  
  // Herald of the Order
  [RewardTaskType.HeraldCuriosityClicks]: 0.25,      // 10 unique clicks / 7 days
  [RewardTaskType.HeraldAudienceSignups]: 1.0,       // 3 signups / 30 days
  [RewardTaskType.HeraldConversionPayingUser]: 2.0,  // 1 paying user / 30 days
  
  // Special
  [RewardTaskType.FoundingOrderAirdrop]: 0, // Variable, set via customBaseAmount
};

/** Reputation multipliers by tier */
export const REPUTATION_MULTIPLIERS: Record<ReputationTier, number> = {
  'R4_SAT': 1.40,    // SatKNYT
  'R3_ZERO': 1.30,   // Zero KNYT
  'R2_FIRST': 1.20,  // First KNYT
  'R1_KEJI': 1.10,   // Keji KNYT
  'R0_KETA': 1.05,   // Keta KNYT
  'R-': 1.00,        // Non-investor
};

/** Map order tier to reputation tier */
export const ORDER_TO_REP_TIER: Record<OrderTier, ReputationTier> = {
  'SAT': 'R4_SAT',
  'ZERO': 'R3_ZERO',
  'FIRST': 'R2_FIRST',
  'KEJI': 'R1_KEJI',
  'KETA': 'R0_KETA',
  'NONE': 'R-',
};

/** Reward caps per task type (per period) */
export const REWARD_CAPS: Record<RewardTaskType, { maxPerPeriod: number; periodDays: number } | null> = {
  [RewardTaskType.BringAKnightQualifiedReferral]: null, // No cap
  [RewardTaskType.KnightOfAttentionEpisodeComplete]: { maxPerPeriod: 10, periodDays: 7 }, // 10 per week
  [RewardTaskType.KnightOfAttentionWeeklyStreak]: { maxPerPeriod: 1, periodDays: 7 }, // 1 per week
  [RewardTaskType.KnightOfAttentionStreakBonus]: { maxPerPeriod: 1, periodDays: 28 }, // 1 per 4 weeks
  [RewardTaskType.HeraldCuriosityClicks]: { maxPerPeriod: 1, periodDays: 7 }, // 1 per week
  [RewardTaskType.HeraldAudienceSignups]: { maxPerPeriod: 4, periodDays: 30 }, // 4 per month
  [RewardTaskType.HeraldConversionPayingUser]: { maxPerPeriod: 5, periodDays: 30 }, // 5 per month
  [RewardTaskType.FoundingOrderAirdrop]: null, // No cap (one-time)
};

// =============================================================================
// REWARD SERVICE CLASS
// =============================================================================

export class RewardService {
  private supabase;
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * Grant a reward for completing a task
   */
  async grantRewardForTask(req: GrantRewardRequest): Promise<GrantRewardResult> {
    const { personaId, taskType, sourceEventId, metadata, customBaseAmount, skipCaps } = req;
    
    try {
      // 1. Get base amount
      const baseAmount = customBaseAmount ?? BASE_REWARD_AMOUNTS[taskType];
      if (baseAmount <= 0 && !customBaseAmount) {
        return { success: false, baseAmount: 0, finalAmount: 0, repMultiplier: 1, error: 'Invalid base amount' };
      }
      
      // 2. Fetch persona and get reputation multiplier
      const isMissingColumn = (error?: { message?: string }) =>
        !!error?.message && error.message.includes('column') && error.message.includes('does not exist');
      const isMissingTable = (error?: { message?: string }) =>
        !!error?.message && error.message.includes('relation') && error.message.includes('does not exist');

      const fetchPersona = async (table: string) => {
        let result = await this.supabase
          .from(table)
          .select('id, reputation_tier, order_tier, reputation_bucket')
          .eq('id', personaId)
          .maybeSingle();

        if (result.error && isMissingColumn(result.error)) {
          result = await this.supabase
            .from(table)
            .select('id, reputation_bucket')
            .eq('id', personaId)
            .maybeSingle();
        }

        if (result.error && isMissingColumn(result.error)) {
          result = await this.supabase
            .from(table)
            .select('id')
            .eq('id', personaId)
            .maybeSingle();
        }

        if (result.error && isMissingTable(result.error)) {
          return null;
        }

        return result;
      };

      const personaResult = await fetchPersona('personas');
      let persona = personaResult?.data || null;
      let personaError = personaResult?.error || null;

      if (!persona) {
        const altResult = await fetchPersona('persona');
        persona = altResult?.data || null;
        if (!personaError) {
          personaError = altResult?.error || null;
        }
      }

      if (!persona) {
        return { success: false, baseAmount, finalAmount: 0, repMultiplier: 1, error: 'Persona not found' };
      }
      
      const repTier = (persona.reputation_tier as ReputationTier) || 'R-';
      const repMultiplier = REPUTATION_MULTIPLIERS[repTier] || 1.0;
      
      // 3. Check caps (unless skipped)
      if (!skipCaps) {
        const capCheck = await this.checkRewardCap(personaId, taskType);
        if (!capCheck.allowed) {
          return { 
            success: false, 
            baseAmount, 
            finalAmount: 0, 
            repMultiplier, 
            error: `Reward cap reached: ${capCheck.reason}` 
          };
        }
      }
      
      // 4. Calculate final amount
      const finalAmount = Math.round(baseAmount * repMultiplier * 10000) / 10000;
      
      // 5. Insert reward grant record
      const { data: grant, error: grantError } = await this.supabase
        .from('reward_grants')
        .insert({
          persona_id: personaId,
          task_type: taskType,
          amount_knyt: finalAmount,
          base_amount_knyt: baseAmount,
          rep_multiplier: repMultiplier,
          source_event_id: sourceEventId,
          metadata: metadata || {},
        })
        .select()
        .single();
      
      if (grantError) {
        console.error('[RewardService] Failed to insert reward grant:', grantError);
        return { success: false, baseAmount, finalAmount, repMultiplier, error: 'Failed to record reward' };
      }
      
      // 6. Credit KNYT via wallet_transactions
      const { error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert({
          persona_id: personaId,
          asset: 'KNYT',
          amount: finalAmount,
          direction: 'credit',
          source: 'reward_task',
          reference_type: 'reward_grant',
          reference_id: grant.id,
          metadata: { taskType, sourceEventId, repMultiplier },
        });
      
      if (txError) {
        console.error('[RewardService] Failed to insert wallet transaction:', txError);
        // Don't fail - grant is recorded, balance update can be retried
      }
      
      // 7. Update wallet_balances
      await this.updateWalletBalance(personaId, finalAmount);
      
      // 8. Emit reputation event
      await this.emitReputationEvent(personaId, 'reward_earned', {
        taskType,
        amount: finalAmount,
        rewardGrantId: grant.id,
      });
      
      return {
        success: true,
        rewardGrantId: grant.id,
        baseAmount,
        finalAmount,
        repMultiplier,
      };
    } catch (err) {
      console.error('[RewardService] Error granting reward:', err);
      return { 
        success: false, 
        baseAmount: customBaseAmount ?? BASE_REWARD_AMOUNTS[taskType], 
        finalAmount: 0, 
        repMultiplier: 1, 
        error: (err as Error).message 
      };
    }
  }
  
  /**
   * Check if persona has hit reward cap for task type
   */
  async checkRewardCap(personaId: string, taskType: RewardTaskType): Promise<{ allowed: boolean; reason?: string }> {
    const cap = REWARD_CAPS[taskType];
    if (!cap) {
      return { allowed: true };
    }
    
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - cap.periodDays);
    
    const { count, error } = await this.supabase
      .from('reward_grants')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('task_type', taskType)
      .gte('created_at', periodStart.toISOString());
    
    if (error) {
      console.error('[RewardService] Error checking cap:', error);
      return { allowed: true }; // Allow on error (fail open)
    }
    
    if ((count || 0) >= cap.maxPerPeriod) {
      return { 
        allowed: false, 
        reason: `Max ${cap.maxPerPeriod} rewards per ${cap.periodDays} days` 
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Update wallet balance (upsert)
   * Uses the correct schema: balance column with asset_code='KNYT'
   */
  private async updateWalletBalance(personaId: string, amountDelta: number): Promise<void> {
    // Try to update existing balance
    const { data: existing } = await this.supabase
      .from('wallet_balances')
      .select('id, balance')
      .eq('persona_id', personaId)
      .eq('asset_code', 'KNYT')
      .single();
    
    if (existing) {
      const currentBalance = parseFloat(existing.balance) || 0;
      await this.supabase
        .from('wallet_balances')
        .update({ 
          balance: (currentBalance + amountDelta).toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('wallet_balances')
        .insert({
          persona_id: personaId,
          asset_code: 'KNYT',
          balance: amountDelta.toString(),
        });
    }
  }
  
  /**
   * Emit a reputation event for ReputationHub
   */
  private async emitReputationEvent(
    personaId: string, 
    eventType: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    await this.supabase
      .from('reputation_events')
      .insert({
        persona_id: personaId,
        event_type: eventType,
        event_source: 'reward_service',
        metadata,
      });
  }
  
  /**
   * Get recent rewards for a persona
   */
  async getRecentRewards(personaId: string, limit = 20): Promise<RewardGrant[]> {
    const { data, error } = await this.supabase
      .from('reward_grants')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[RewardService] Error fetching rewards:', error);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      personaId: row.persona_id,
      taskType: row.task_type as RewardTaskType,
      amountKnyt: row.amount_knyt,
      baseAmountKnyt: row.base_amount_knyt,
      repMultiplier: row.rep_multiplier,
      sourceEventId: row.source_event_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }
  
  /**
   * Get total rewards earned by persona
   */
  async getTotalRewardsEarned(personaId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('reward_grants')
      .select('amount_knyt')
      .eq('persona_id', personaId);
    
    if (error) {
      console.error('[RewardService] Error fetching total rewards:', error);
      return 0;
    }
    
    return (data || []).reduce((sum, row) => sum + (row.amount_knyt || 0), 0);
  }
  
  /**
   * Get reputation multiplier for a persona
   */
  async getReputationMultiplier(personaId: string): Promise<{ tier: ReputationTier; multiplier: number }> {
    const { data: persona } = await this.supabase
      .from('personas')
      .select('reputation_tier')
      .eq('id', personaId)
      .single();
    
    const tier = (persona?.reputation_tier as ReputationTier) || 'R-';
    return {
      tier,
      multiplier: REPUTATION_MULTIPLIERS[tier] || 1.0,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let rewardServiceInstance: RewardService | null = null;

export function getRewardService(): RewardService {
  if (!rewardServiceInstance) {
    rewardServiceInstance = new RewardService();
  }
  return rewardServiceInstance;
}

export default RewardService;
