import type { CampaignDefinition } from '@/types/campaign';

export const CAMPAIGN_REGISTRY: Record<string, CampaignDefinition> = {
  'bring-a-knight': {
    id: 'bring-a-knight',
    title: 'Bring a Knight',
    franchiseId: 'metaknyts',
    tenantId: 'qriptopian',
    group: 'rewarded',
    phases: [
      {
        id: 'share',
        label: 'Share your invite',
        eventTypes: ['referral_share_created'],
      },
      {
        id: 'signup',
        label: 'Friend signs up',
        eventTypes: ['referral_signup_completed'],
      },
      {
        id: 'first_purchase',
        label: 'First paid purchase',
        eventTypes: ['referral_first_purchase'],
      },
    ],
  },
  'qriptopian-share': {
    id: 'qriptopian-share',
    title: 'Herald of the Order',
    franchiseId: 'theqriptopian',
    tenantId: 'qriptopian',
    group: 'rewarded',
    phases: [
      {
        id: 'clicks',
        label: 'Audience clicks (10)',
        eventTypes: ['content_share_click'],
        counterKey: 'clicks',
        targetCount: 10,
      },
      {
        id: 'signups',
        label: 'Audience signups (3)',
        eventTypes: ['content_share_signup'],
        counterKey: 'signups',
        targetCount: 3,
      },
      {
        id: 'conversions',
        label: 'Conversions (1)',
        eventTypes: ['content_share_conversion'],
        counterKey: 'conversions',
        targetCount: 1,
      },
    ],
    shareRewardConfig: {
      rewardType: 'herald_of_order',
      rewardAmount: 0.25,
      thresholds: { click: 10, signup: 3, conversion: 1 },
    },
  },
  'knyts-bridge-crossing': {
    id: 'knyts-bridge-crossing',
    title: 'KNYTS Bridge — Crossing',
    franchiseId: 'metaknyts',
    tenantId: 'knyt',
    group: 'rewarded',
    phases: [
      {
        id: 'clicks',
        label: 'Audience clicks (10)',
        eventTypes: ['content_share_click'],
        counterKey: 'clicks',
        targetCount: 10,
      },
      {
        id: 'signups',
        label: 'Audience signups (3)',
        eventTypes: ['content_share_signup'],
        counterKey: 'signups',
        targetCount: 3,
      },
      {
        id: 'conversions',
        label: 'Conversions (1)',
        eventTypes: ['content_share_conversion'],
        counterKey: 'conversions',
        targetCount: 1,
      },
    ],
    shareRewardConfig: {
      rewardType: 'knyts_bridge_crossing',
      rewardAmount: 0.25,
      thresholds: { click: 10, signup: 3, conversion: 1 },
    },
  },
  'constitutional-internet-bridge': {
    id: 'constitutional-internet-bridge',
    title: 'The Constitutional Internet Bridge',
    franchiseId: 'polity-core',
    tenantId: 'polity',
    group: 'rewarded',
    phases: [
      {
        id: 'shares',
        label: 'Bridge shared and clicked (10)',
        eventTypes: ['content_share_click'],
        counterKey: 'clicks',
        targetCount: 10,
      },
      {
        id: 'crossings',
        label: 'Passport crossings from shares (3)',
        eventTypes: ['content_share_signup'],
        counterKey: 'signups',
        targetCount: 3,
      },
      {
        id: 'demand',
        label: 'Book/participation demand expressed (1)',
        eventTypes: ['book_interest', 'collaboration_interest', 'research_interest', 'partnership_interest'],
        counterKey: 'demand_signals',
        targetCount: 1,
      },
    ],
    // No shareRewardConfig — sharing the CI Bridge is tracked (clicks,
    // signups, demand signals) but is not KNYT-token-rewarded. Do not add
    // one without an explicit operator decision on CI Bridge tokenomics.
  },
};

export function getCampaignDefinition(campaignId: string): CampaignDefinition | null {
  return CAMPAIGN_REGISTRY[campaignId] || null;
}
