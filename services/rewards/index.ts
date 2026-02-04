/**
 * Phase 1 Rewards System - Service Exports
 * 
 * KNYT Codex / KNYTMall - Tier 0 Remote Custody
 * 
 * Services:
 * - RewardService: Task-based KNYT rewards with reputation multipliers
 * - EntitlementService: Tier 0 perpetual access management
 * - PurchaseHandler: Purchase processing with entitlement grants
 * - EngagementService: Episode completion and streak tracking
 * - ReferralService: FIO-style handle referrals
 */

// Reward Service
export {
  RewardService,
  getRewardService,
  RewardTaskType,
  BASE_REWARD_AMOUNTS,
  REPUTATION_MULTIPLIERS,
  ORDER_TO_REP_TIER,
  REWARD_CAPS,
  type OrderTier,
  type ReputationTier,
  type GrantRewardRequest,
  type GrantRewardResult,
  type RewardGrant,
} from './rewardService';

// Entitlement Service
export {
  EntitlementService,
  getEntitlementService,
  type EntitlementTier,
  type EntitlementType,
  type UserEntitlement,
  type Product,
  type GrantEntitlementRequest,
  type GrantEntitlementResult,
  type CheckAccessResult,
} from './entitlementService';

// Purchase Handler
export {
  PurchaseHandler,
  getPurchaseHandler,
  type PurchaseRequest,
  type PurchaseResult,
  type Purchase,
} from './purchaseHandler';

// Engagement Service
export {
  EngagementService,
  getEngagementService,
  type EngagementEventType,
  type RecordEngagementRequest,
  type EngagementResult,
  type WeeklyStreakStatus,
} from './engagementService';

// Referral Service
export {
  ReferralService,
  getReferralService,
  type ProcessReferralRequest,
  type ProcessReferralResult,
  type ReferralStats,
} from './referralService';
