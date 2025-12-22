/**
 * Engagement Service - Phase 1 Knight of Attention
 * 
 * Tracks episode engagement and weekly streaks for KNYT rewards.
 * 
 * Rewards:
 * - Episode completion: 0.5 KNYT per completed scroll (still or motion)
 * - Weekly streak: 0.5 KNYT per week (threshold met)
 * - 4-week streak bonus: 2.0 KNYT per qualifying 4-week run
 */

import { createClient } from '@supabase/supabase-js';
import { getRewardService, RewardTaskType } from './rewardService';

// =============================================================================
// TYPES
// =============================================================================

/** Episode engagement event types */
export type EngagementEventType = 'started' | 'progress' | 'completed';

/** Record engagement request */
export interface RecordEngagementRequest {
  personaId: string;
  episodeId: string;
  eventType: EngagementEventType;
  progressPercent?: number;
  timeSpentSeconds?: number;
  metadata?: Record<string, any>;
}

/** Engagement result */
export interface EngagementResult {
  success: boolean;
  eventId?: string;
  rewardTriggered?: boolean;
  rewardAmount?: number;
  error?: string;
}

/** Weekly streak status */
export interface WeeklyStreakStatus {
  personaId: string;
  currentWeekStart: string;
  episodesCompletedThisWeek: number;
  streakQualified: boolean;
  consecutiveWeeks: number;
  nextBonusAt: number; // Weeks until 4-week bonus
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Minimum episodes per week to qualify for streak */
const WEEKLY_STREAK_THRESHOLD = 2;

/** Weeks needed for streak bonus */
const STREAK_BONUS_WEEKS = 4;

// =============================================================================
// ENGAGEMENT SERVICE CLASS
// =============================================================================

export class EngagementService {
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
   * Record an episode engagement event
   */
  async recordEngagement(req: RecordEngagementRequest): Promise<EngagementResult> {
    const { personaId, episodeId, eventType, progressPercent = 0, timeSpentSeconds = 0, metadata = {} } = req;
    
    try {
      // 1. Insert engagement event
      const { data: event, error: eventError } = await this.supabase
        .from('episode_engagement_events')
        .insert({
          persona_id: personaId,
          episode_id: episodeId,
          event_type: eventType,
          progress_percent: progressPercent,
          time_spent_seconds: timeSpentSeconds,
          metadata,
        })
        .select()
        .single();
      
      if (eventError) {
        console.error('[EngagementService] Failed to record event:', eventError);
        return { success: false, error: 'Failed to record engagement' };
      }
      
      // 2. If completed, check for rewards
      let rewardTriggered = false;
      let rewardAmount = 0;
      
      if (eventType === 'completed') {
        // Check if already rewarded for this episode
        const alreadyRewarded = await this.hasEpisodeReward(personaId, episodeId);
        
        if (!alreadyRewarded) {
          // Grant episode completion reward
          const rewardService = getRewardService();
          const result = await rewardService.grantRewardForTask({
            personaId,
            taskType: RewardTaskType.KnightOfAttentionEpisodeComplete,
            sourceEventId: episodeId,
            metadata: { episodeId, eventId: event.id },
          });
          
          if (result.success) {
            rewardTriggered = true;
            rewardAmount = result.finalAmount;
          }
          
          // Update weekly streak
          await this.updateWeeklyStreak(personaId);
        }
      }
      
      return {
        success: true,
        eventId: event.id,
        rewardTriggered,
        rewardAmount,
      };
    } catch (err) {
      console.error('[EngagementService] Error recording engagement:', err);
      return { success: false, error: (err as Error).message };
    }
  }
  
  /**
   * Check if persona already received reward for episode
   */
  private async hasEpisodeReward(personaId: string, episodeId: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('reward_grants')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('task_type', RewardTaskType.KnightOfAttentionEpisodeComplete)
      .eq('source_event_id', episodeId);
    
    return (count || 0) > 0;
  }
  
  /**
   * Update weekly streak for persona
   */
  private async updateWeeklyStreak(personaId: string): Promise<void> {
    const weekStart = this.getWeekStart(new Date());
    
    // Get or create weekly streak record
    const { data: existing } = await this.supabase
      .from('weekly_engagement_streaks')
      .select('*')
      .eq('persona_id', personaId)
      .eq('week_start', weekStart)
      .single();
    
    if (existing) {
      // Update existing
      const newCount = (existing.episodes_completed || 0) + 1;
      const nowQualified = newCount >= WEEKLY_STREAK_THRESHOLD;
      const wasQualified = existing.streak_qualified;
      
      await this.supabase
        .from('weekly_engagement_streaks')
        .update({
          episodes_completed: newCount,
          streak_qualified: nowQualified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      
      // If just qualified, check for streak reward
      if (nowQualified && !wasQualified && !existing.reward_granted) {
        await this.grantWeeklyStreakReward(personaId, weekStart, existing.id);
      }
    } else {
      // Create new
      const { data: newStreak } = await this.supabase
        .from('weekly_engagement_streaks')
        .insert({
          persona_id: personaId,
          week_start: weekStart,
          episodes_completed: 1,
          streak_qualified: 1 >= WEEKLY_STREAK_THRESHOLD,
        })
        .select()
        .single();
      
      // Check if immediately qualified (threshold = 1)
      if (newStreak && 1 >= WEEKLY_STREAK_THRESHOLD) {
        await this.grantWeeklyStreakReward(personaId, weekStart, newStreak.id);
      }
    }
  }
  
  /**
   * Grant weekly streak reward
   */
  private async grantWeeklyStreakReward(personaId: string, weekStart: string, streakId: string): Promise<void> {
    const rewardService = getRewardService();
    
    // Grant weekly streak reward
    const result = await rewardService.grantRewardForTask({
      personaId,
      taskType: RewardTaskType.KnightOfAttentionWeeklyStreak,
      sourceEventId: `streak:${weekStart}`,
      metadata: { weekStart, streakId },
    });
    
    if (result.success) {
      // Mark reward as granted
      await this.supabase
        .from('weekly_engagement_streaks')
        .update({ reward_granted: true })
        .eq('id', streakId);
      
      // Check for 4-week streak bonus
      await this.checkStreakBonus(personaId);
    }
  }
  
  /**
   * Check and grant 4-week streak bonus
   */
  private async checkStreakBonus(personaId: string): Promise<void> {
    // Get last 4 weeks of streaks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const { data: streaks } = await this.supabase
      .from('weekly_engagement_streaks')
      .select('*')
      .eq('persona_id', personaId)
      .eq('streak_qualified', true)
      .gte('week_start', fourWeeksAgo.toISOString().split('T')[0])
      .order('week_start', { ascending: false })
      .limit(4);
    
    if (!streaks || streaks.length < STREAK_BONUS_WEEKS) {
      return; // Not enough consecutive weeks
    }
    
    // Check if weeks are consecutive
    const weeks = streaks.map(s => new Date(s.week_start).getTime()).sort((a, b) => b - a);
    let consecutive = true;
    for (let i = 1; i < weeks.length; i++) {
      const diff = weeks[i - 1] - weeks[i];
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (Math.abs(diff - oneWeek) > 24 * 60 * 60 * 1000) { // Allow 1 day tolerance
        consecutive = false;
        break;
      }
    }
    
    if (!consecutive) return;
    
    // Check if bonus already granted for this period
    const bonusKey = `streak_bonus:${streaks[0].week_start}`;
    const { count } = await this.supabase
      .from('reward_grants')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('task_type', RewardTaskType.KnightOfAttentionStreakBonus)
      .eq('source_event_id', bonusKey);
    
    if ((count || 0) > 0) return; // Already granted
    
    // Grant bonus
    const rewardService = getRewardService();
    await rewardService.grantRewardForTask({
      personaId,
      taskType: RewardTaskType.KnightOfAttentionStreakBonus,
      sourceEventId: bonusKey,
      metadata: { 
        streakWeeks: STREAK_BONUS_WEEKS,
        weekEnding: streaks[0].week_start,
      },
    });
  }
  
  /**
   * Get Monday of the week for a date
   */
  private getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }
  
  /**
   * Get weekly streak status for persona
   */
  async getStreakStatus(personaId: string): Promise<WeeklyStreakStatus> {
    const currentWeekStart = this.getWeekStart(new Date());
    
    // Get current week
    const { data: currentWeek } = await this.supabase
      .from('weekly_engagement_streaks')
      .select('*')
      .eq('persona_id', personaId)
      .eq('week_start', currentWeekStart)
      .single();
    
    // Count consecutive qualified weeks
    const { data: recentStreaks } = await this.supabase
      .from('weekly_engagement_streaks')
      .select('*')
      .eq('persona_id', personaId)
      .eq('streak_qualified', true)
      .order('week_start', { ascending: false })
      .limit(8);
    
    let consecutiveWeeks = 0;
    if (recentStreaks) {
      const weeks = recentStreaks.map(s => new Date(s.week_start).getTime()).sort((a, b) => b - a);
      for (let i = 0; i < weeks.length; i++) {
        if (i === 0) {
          consecutiveWeeks = 1;
        } else {
          const diff = weeks[i - 1] - weeks[i];
          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          if (Math.abs(diff - oneWeek) <= 24 * 60 * 60 * 1000) {
            consecutiveWeeks++;
          } else {
            break;
          }
        }
      }
    }
    
    return {
      personaId,
      currentWeekStart,
      episodesCompletedThisWeek: currentWeek?.episodes_completed || 0,
      streakQualified: currentWeek?.streak_qualified || false,
      consecutiveWeeks,
      nextBonusAt: STREAK_BONUS_WEEKS - (consecutiveWeeks % STREAK_BONUS_WEEKS),
    };
  }
  
  /**
   * Get engagement history for persona
   */
  async getEngagementHistory(personaId: string, limit = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('episode_engagement_events')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[EngagementService] Error fetching history:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Get completed episodes for persona
   */
  async getCompletedEpisodes(personaId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('episode_engagement_events')
      .select('episode_id')
      .eq('persona_id', personaId)
      .eq('event_type', 'completed');
    
    if (error) {
      console.error('[EngagementService] Error fetching completed episodes:', error);
      return [];
    }
    
    return [...new Set((data || []).map(d => d.episode_id))];
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let engagementServiceInstance: EngagementService | null = null;

export function getEngagementService(): EngagementService {
  if (!engagementServiceInstance) {
    engagementServiceInstance = new EngagementService();
  }
  return engagementServiceInstance;
}

export default EngagementService;
