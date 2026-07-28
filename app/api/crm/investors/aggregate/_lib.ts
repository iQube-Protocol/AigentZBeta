/**
 * Pure aggregation logic for GET /api/crm/investors/aggregate, extracted from
 * the route handler so it can be exercised behaviourally in tests without a
 * live Supabase client — see tests/crm-investors-aggregate.test.ts.
 */

import { str, isRealInvestor } from '../_lib';

/** Minimum bucket size before a geography value is safe to surface on its own. */
export const GEOGRAPHY_K_THRESHOLD = 5;
export const OTHER_BUCKET = 'Other (suppressed < k)';
export const UNASSIGNED_BUCKET = 'unassigned';

// Only the columns needed to compute counts/distributions. Email is included
// solely because isRealInvestor()'s row-qualification predicate checks for
// its presence (a row with no name/investment signal but a real email still
// counts as a real investor) — the value itself is never read past that
// boolean check and never appears in the response.
export const AGGREGATE_SELECT = [
  '"First-Name"', '"Last-Name"', '"Email"',
  '"Total-Invested"', '"Metaiye-Shares-Owned"', '"OM-Tier-Status"', '"KNYT-ID"',
  '"KNYT-COYN-Owned"', 'csv_investment_status',
  '"Motion-Comics-Owned"', '"Paper-Comics-Owned"', '"Digital-Comics-Owned"',
  '"KNYT-Posters-Owned"', '"KNYT-Cards-Owned"', '"Characters-Owned"',
  'campaign_cohort', 'campaign_state', 'investment_amount_band',
  'platform_activated_at', '"Local-City"',
  'kickstarter_clicked_at', 'kickstarter_backed_at', 'last_campaign_sent_at',
  'platform_engagement_score',
].join(', ');

export interface InvestorAggregate {
  totalInvestors: number;
  countsByCohort: Record<string, number>;
  countsByRelationshipState: Record<string, number>;
  investmentBandDistribution: Record<string, number>;
  participationStatus: {
    activated: number;
    inactive: number;
  };
  geographyDistribution: Record<string, number>;
  completionEngagement: {
    csvInvestmentStatusDistribution: Record<string, number>;
    withKickstarterClicked: number;
    withKickstarterBacked: number;
    withCampaignSent: number;
    avgPlatformEngagementScore: number;
  };
  kAnonymityThreshold: number;
  generatedAt: string;
}

/** The exact top-level key set the route is allowed to return. Tests assert
 *  against this constant directly so the two can never drift apart. */
export const ALLOWED_TOP_LEVEL_KEYS = [
  'totalInvestors',
  'countsByCohort',
  'countsByRelationshipState',
  'investmentBandDistribution',
  'participationStatus',
  'geographyDistribution',
  'completionEngagement',
  'kAnonymityThreshold',
  'generatedAt',
] as const;

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function computeInvestorAggregate(rawInvestors: Record<string, unknown>[]): InvestorAggregate {
  const investorRows = rawInvestors.filter(isRealInvestor);
  const totalInvestors = investorRows.length;

  const countsByCohort: Record<string, number> = {};
  const countsByRelationshipState: Record<string, number> = {};
  const investmentBandDistribution: Record<string, number> = {};
  const csvInvestmentStatusDistribution: Record<string, number> = {};
  let activated = 0;
  let inactive = 0;
  let withKickstarterClicked = 0;
  let withKickstarterBacked = 0;
  let withCampaignSent = 0;
  let engagementScoreSum = 0;
  let engagementScoreCount = 0;

  // Raw geography tally — city string never leaves this function unless its
  // bucket clears the k-anonymity threshold below.
  const rawGeography: Record<string, number> = {};

  for (const inv of investorRows) {
    bump(countsByCohort, str(inv['campaign_cohort']) || UNASSIGNED_BUCKET);
    bump(countsByRelationshipState, str(inv['campaign_state']) || UNASSIGNED_BUCKET);
    bump(investmentBandDistribution, str(inv['investment_amount_band']) || UNASSIGNED_BUCKET);
    bump(csvInvestmentStatusDistribution, str(inv['csv_investment_status']) || UNASSIGNED_BUCKET);

    if (inv['platform_activated_at']) activated += 1;
    else inactive += 1;

    if (inv['kickstarter_clicked_at']) withKickstarterClicked += 1;
    if (inv['kickstarter_backed_at']) withKickstarterBacked += 1;
    if (inv['last_campaign_sent_at']) withCampaignSent += 1;

    const engagementScore = inv['platform_engagement_score'];
    if (typeof engagementScore === 'number') {
      engagementScoreSum += engagementScore;
      engagementScoreCount += 1;
    }

    const city = str(inv['Local-City']);
    bump(rawGeography, city || UNASSIGNED_BUCKET);
  }

  // Apply k-anonymity suppression: any city bucket below threshold folds
  // into a single "Other" bucket rather than being named individually.
  const geographyDistribution: Record<string, number> = {};
  let suppressedCount = 0;
  for (const [city, count] of Object.entries(rawGeography)) {
    if (city === UNASSIGNED_BUCKET || count >= GEOGRAPHY_K_THRESHOLD) {
      geographyDistribution[city] = count;
    } else {
      suppressedCount += count;
    }
  }
  if (suppressedCount > 0) {
    geographyDistribution[OTHER_BUCKET] = (geographyDistribution[OTHER_BUCKET] ?? 0) + suppressedCount;
  }

  return {
    totalInvestors,
    countsByCohort,
    countsByRelationshipState,
    investmentBandDistribution,
    participationStatus: {
      activated,
      inactive,
    },
    geographyDistribution,
    completionEngagement: {
      csvInvestmentStatusDistribution,
      withKickstarterClicked,
      withKickstarterBacked,
      withCampaignSent,
      avgPlatformEngagementScore: engagementScoreCount > 0
        ? Math.round((engagementScoreSum / engagementScoreCount) * 100) / 100
        : 0,
    },
    kAnonymityThreshold: GEOGRAPHY_K_THRESHOLD,
    generatedAt: new Date().toISOString(),
  };
}
