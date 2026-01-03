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
  },
};

export function getCampaignDefinition(campaignId: string): CampaignDefinition | null {
  return CAMPAIGN_REGISTRY[campaignId] || null;
}
