/**
 * KNYTS Bridge campaign activation — centralized config (Gate A).
 *
 * `KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md` §3.1 requires the
 * Kickstarter preview URL to be centralized in one place rather than
 * hard-coded in multiple components, and to reuse the real campaign URL if
 * one already exists rather than a placeholder. It already exists —
 * `services/campaign/ksRewards.ts::KS_BASE_URL` is the live metaKnyt
 * Kickstarter project. This module builds the generic (non-investor-reward)
 * follow/preview link from that same constant, and centralizes the initial
 * campaign reward matrix (spec §7 / `KNYT_BRIDGE_STANDING_REPUTATION_REWARDS_ACTIVATION_SPEC.md`
 * §6) as configurable values — not immutable constitutional ones.
 */

import { KS_BASE_URL } from '@/services/campaign/ksRewards';

/** Reuses the existing campaign identifier — do not redefine elsewhere. */
export { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

/**
 * The generic public "Follow the Kickstarter" URL. Shares the same
 * `ref` tag as the rest of the KNYT Wheel tracking links
 * (`knytTrackingService.ts`) so Bridge-originated traffic attributes to the
 * same Kickstarter referral bucket as email/social traffic, without the
 * investor-only `secret_reward_token` mechanic in `ksRewards.ts`.
 */
export function getKnytsBridgeKickstarterUrl(): string {
  const configured = process.env.KICKSTARTER_CAMPAIGN_URL;
  const url = new URL(configured || KS_BASE_URL);
  if (!url.searchParams.has('ref')) url.searchParams.set('ref', '9pbmus');
  return url.toString();
}

/** Evidence action-type vocabulary — spec §5. */
export type KnytsBridgeCampaignActionType =
  | 'campaign_preregistered'
  | 'kickstarter_preview_clicked'
  | 'kickstarter_follow_confirmed'
  | 'bridge_shared'
  | 'qualified_campaign_visit'
  | 'crossing_story_published'
  | 'crossing_story_liked'
  | 'crossing_story_engagement_threshold_reached'
  | 'campaign_referral_converted';

export interface KnytsBridgeRewardRule {
  knytcoin: number;
  reputationDelta: number;
  /** Contribution-value-score credited to Standing when the leg is eligible. */
  standingCvs: number;
  standingEligible: boolean;
  guardrail: string;
}

/**
 * Initial campaign economics (spec §7 / activation-spec §6). Deliberately
 * NOT constitutional values — adjust here, never by rewriting attribution
 * logic in the projector.
 */
export const KNYTS_BRIDGE_REWARD_MATRIX: Record<KnytsBridgeCampaignActionType, KnytsBridgeRewardRule> = {
  campaign_preregistered: {
    knytcoin: 0.10,
    reputationDelta: 1,
    standingCvs: 0.5,
    standingEligible: true,
    guardrail: 'once per campaign/person',
  },
  kickstarter_preview_clicked: {
    knytcoin: 0,
    reputationDelta: 0.25,
    standingCvs: 0,
    standingEligible: false,
    guardrail: 'signal only; click is not follow',
  },
  kickstarter_follow_confirmed: {
    knytcoin: 0.25,
    reputationDelta: 2,
    standingCvs: 1,
    standingEligible: true,
    guardrail: 'once per campaign/person; requires external-confirmed evidence grade',
  },
  bridge_shared: {
    knytcoin: 0.10,
    reputationDelta: 1,
    standingCvs: 0.5,
    standingEligible: false,
    guardrail: 'max 1 per channel/day; no Standing on share alone',
  },
  qualified_campaign_visit: {
    knytcoin: 0.15,
    reputationDelta: 1,
    standingCvs: 0.5,
    standingEligible: true,
    guardrail: 'recipient dedupe + anti-self-referral',
  },
  crossing_story_published: {
    knytcoin: 0.50,
    reputationDelta: 4,
    standingCvs: 2,
    standingEligible: true,
    guardrail: 'first qualifying story; later stories policy-capped',
  },
  crossing_story_liked: {
    knytcoin: 0.05,
    reputationDelta: 0.25,
    standingCvs: 0,
    standingEligible: false,
    guardrail: 'max 5 rewarded likes/day; no self-like; unique actor per story',
  },
  crossing_story_engagement_threshold_reached: {
    knytcoin: 0.25,
    reputationDelta: 2,
    standingCvs: 1,
    standingEligible: true,
    guardrail: 'paid once per story, on the 5th unique qualified like',
  },
  campaign_referral_converted: {
    knytcoin: 0.50,
    reputationDelta: 3,
    standingCvs: 2,
    standingEligible: true,
    guardrail: 'one reward per distinct referred person; requires confirmed conversion',
  },
};

/** RQH/CRM reputation category — spec §8.2. */
export const KNYTS_BRIDGE_REPUTATION_CATEGORY = 'knyt_campaign_participation';
