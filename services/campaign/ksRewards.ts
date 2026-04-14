/**
 * services/campaign/ksRewards.ts
 *
 * Kickstarter investor-only reward tiers for the metaKnyt campaign.
 * Each reward has a secret_reward_token that unlocks the discounted price
 * in the Kickstarter checkout flow.
 *
 * selectPrimaryReward() maps a cohort + investment_amount_band to the most
 * appropriate reward tier for that investor. The result drives:
 *   - The personalised CTA link in outbound emails (via ks/route.ts tracker)
 *   - Template variables: reward_name, reward_price, reward_full_price, reward_savings
 */

const KS_BASE_URL =
  'https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats';

export interface KsReward {
  id: string;
  name: string;
  investorPrice: number;   // USD
  fullPrice: number | null; // null = price not publicly listed
  secretToken: string;     // KS secret_reward_token
}

export const KS_REWARDS: Record<string, KsReward> = {
  digital_agn: {
    id: 'digital_agn',
    name: 'AgentiQ Graphic Novel — Digital',
    investorPrice: 52,
    fullPrice: 78,
    secretToken: 'e220c607',
  },
  knyt_codex: {
    id: 'knyt_codex',
    name: 'KNYT Codex',
    investorPrice: 112,
    fullPrice: 168,
    secretToken: '0ea13701',
  },
  knyt_codex_addon: {
    id: 'knyt_codex_addon',
    name: 'KNYT Codex Add-on',
    investorPrice: 80,
    fullPrice: 120,
    secretToken: '7bb2bd5c',
  },
  paperback_agn: {
    id: 'paperback_agn',
    name: 'AgentiQ Graphic Novel — Paperback',
    investorPrice: 124,
    fullPrice: 186,
    secretToken: 'e6801bff',
  },
  hardcover_agn: {
    id: 'hardcover_agn',
    name: 'AgentiQ Graphic Novel — Hardcover',
    investorPrice: 140,
    fullPrice: 210,
    secretToken: '83166ce6',
  },
  top_shelf: {
    id: 'top_shelf',
    name: 'Top KNYT Shelf',
    investorPrice: 288,
    fullPrice: 388,
    secretToken: 'ea8665a0',
  },
  zero_knyt: {
    id: 'zero_knyt',
    name: 'Zero KNYT',
    investorPrice: 500,
    fullPrice: 1000,
    secretToken: '57b1db7b',
  },
  satoshi_collection: {
    id: 'satoshi_collection',
    name: 'Satoshi KNYT Collection',
    investorPrice: 2100,
    fullPrice: null, // investor-only exclusive, no public price
    secretToken: 'a9aa1bee',
  },
};

/**
 * Selects the single primary reward to feature for a given investor.
 * Cohort takes precedence over investment band for named campaign tiers.
 */
export function selectPrimaryReward(
  cohort: string | null,
  band: string | null,
): KsReward {
  // Cohort-driven selection (campaign-specific recommendations)
  if (cohort === 'top_shelf') return KS_REWARDS.top_shelf;
  if (cohort === 'zero_knyt') return KS_REWARDS.zero_knyt;

  // Band-driven fallback for reactivation / general cohorts
  switch (band) {
    case '5000+':
    case '2000-4999': return KS_REWARDS.satoshi_collection;
    case '1000-1999': return KS_REWARDS.zero_knyt;
    case '500-999':   return KS_REWARDS.top_shelf;
    case '100-499':   return KS_REWARDS.knyt_codex;
    case '<100':
    default:          return KS_REWARDS.digital_agn;
  }
}

/**
 * Builds the tracking URL for a specific reward tier.
 * Routes through /api/crm/track/ks so the click is logged before redirect.
 */
export function buildRewardTrackingUrl(
  appUrl: string,
  investorId: string,
  reward: KsReward,
  channel: string,
  cohort: string | null,
): string {
  return (
    `${appUrl}/api/crm/track/ks` +
    `?uid=${encodeURIComponent(investorId)}` +
    `&reward=${encodeURIComponent(reward.id)}` +
    `&utm_source=knyt_wheel` +
    `&utm_medium=${encodeURIComponent(channel)}` +
    `&utm_content=${encodeURIComponent(cohort ?? 'general')}`
  );
}

/**
 * Builds the direct Kickstarter URL for a reward (with secret token + ref tag).
 * Used by the /api/crm/track/ks redirect after logging the click.
 */
export function buildDirectKsUrl(reward: KsReward, utmParams?: Record<string, string>): string {
  const url = new URL(KS_BASE_URL);
  url.searchParams.set('secret_reward_token', reward.secretToken);
  url.searchParams.set('ref', '9pbmus');
  if (utmParams) {
    for (const [k, v] of Object.entries(utmParams)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Formatted savings string, e.g. "save $500" */
export function formatSavings(reward: KsReward): string {
  if (!reward.fullPrice) return '';
  return `save $${(reward.fullPrice - reward.investorPrice).toLocaleString()}`;
}
