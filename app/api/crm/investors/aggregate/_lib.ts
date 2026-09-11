/**
 * Pure aggregation logic for GET /api/crm/investors/aggregate, extracted from
 * the route handler so it can be exercised behaviourally in tests without a
 * live Supabase client — see tests/crm-investors-aggregate.test.ts.
 *
 * K-ANONYMITY — DIFFERENCING/SUBTRACTION HARDENING (Aletheon review,
 * 2026-07-28). The original implementation applied k=5 suppression to the
 * geography field only, folding cities below threshold into a single
 * "Other" bucket. Two problems with that:
 *
 *   1. countsByCohort, countsByRelationshipState, investmentBandDistribution,
 *      and csvInvestmentStatusDistribution had NO suppression at all — any
 *      cohort/state/band/status with 1-4 members was shown as an exact raw
 *      count. That's the same small-cell disclosure the geography rule
 *      existed to prevent, just left open on every other categorical field.
 *   2. Even for geography, the merged "Other" bucket's OWN total could
 *      itself be a small cell: if only one city was below threshold, the
 *      "Other" bucket's count WAS that city's exact count, disclosed
 *      directly. And because `totalInvestors` is shown alongside every
 *      safe (>= k) bucket, `total - sum(safe buckets)` recovers that same
 *      exact value by subtraction even in the (unlikely) case Other's
 *      value itself were withheld — a classic small-cell differencing
 *      attack. For a single suppressed bucket, suppression was fully
 *      defeated either way.
 *
 * Fix: `suppressSmallCells()` below is applied uniformly to every
 * categorical breakdown this route returns. Any bucket under `threshold` is
 * pooled; if the pool itself reaches `threshold` it's shown under
 * `OTHER_BUCKET`/a field-scoped "Other" label (safe — it's now its own
 * k-anonymous cell); if the pool is still under `threshold` (1..k-1), it is
 * folded into the LARGEST already-safe bucket instead of being displayed on
 * its own — the safe bucket's displayed count is now indistinguishable from
 * "its true count" vs. "its true count plus an unknown 1..k-1 remainder", so
 * neither direct display nor `total - displayed` can isolate the pool's
 * exact value. If a field has NO safe bucket at all (every bucket, pooled
 * or not, is under threshold — only possible when that field's total row
 * count is itself under k), the field's breakdown is omitted entirely
 * (`{}`) rather than disclosing an exact small total under any label.
 * `totalInvestors` itself is never rounded or suppressed — it's the one
 * number this endpoint is meant to disclose exactly, and every categorical
 * field's own suppression logic (not touching the total) is what closes the
 * subtraction path, so nothing is lost by keeping it precise. This was a
 * deliberate choice between the two options the review raised (suppress the
 * total vs. safely merge buckets): merging preserves the one broadly useful
 * exact number (the estate-wide total) while still making every per-field
 * breakdown safe.
 *
 * See tests/crm-investors-aggregate.test.ts for the differencing-specific
 * canaries (a cross-tab city/cohort case, and a reconstructed
 * subtraction-sensitive case that was exploitable under the old logic).
 */

import { str, isRealInvestor } from '../_lib';

/** Minimum bucket size before a breakdown value is safe to surface on its own.
 *  Applied uniformly to every categorical field this route returns
 *  (geography, cohort, relationship state, investment band, csv status) —
 *  not just geography. */
export const GEOGRAPHY_K_THRESHOLD = 5;
export const OTHER_BUCKET = 'Other (suppressed < k)';
export const UNASSIGNED_BUCKET = 'unassigned';

/**
 * Folds every bucket below `threshold` into a single pool, then:
 *   - if the pool is empty, nothing changes;
 *   - if the pool itself reaches `threshold`, it's exposed under
 *     `otherLabel` (now its own safe, k-anonymous cell);
 *   - if the pool is non-empty but still under `threshold`, it is merged
 *     into the largest already-safe bucket instead of being shown on its
 *     own — this is what prevents both direct disclosure of a sub-k count
 *     AND recovery of that count via `total - sum(displayed buckets)`,
 *     since after merging there is no separate small line item and no
 *     leftover remainder to solve for;
 *   - if there is no safe bucket to merge into (the field's entire
 *     population is under `threshold`), the breakdown is omitted entirely.
 *
 * Every key in the returned map is guaranteed to have a value that is
 * either omitted or >= `threshold` — no exceptions, no exempt keys. (The
 * original geography-only implementation exempted the literal "unassigned"
 * bucket from suppression on the theory that a missing value isn't an
 * identifying real-world trait; that exemption is removed here because a
 * small *displayed number* is still a small-cell disclosure regardless of
 * what the label means once other fields are cross-referenced against it —
 * the fix in this pass is about the number, not the label.)
 */
export function suppressSmallCells(
  raw: Record<string, number>,
  threshold: number,
  otherLabel: string,
): Record<string, number> {
  const safe: Record<string, number> = {};
  let pool = 0;
  for (const [key, count] of Object.entries(raw)) {
    if (count >= threshold) {
      safe[key] = count;
    } else {
      pool += count;
    }
  }
  if (pool === 0) return safe;
  if (pool >= threshold) {
    safe[otherLabel] = (safe[otherLabel] ?? 0) + pool;
    return safe;
  }
  const safeKeys = Object.keys(safe);
  if (safeKeys.length > 0) {
    const largestKey = safeKeys.reduce((a, b) => (safe[a] >= safe[b] ? a : b));
    safe[largestKey] += pool;
    return safe;
  }
  // No bucket in this field reaches the threshold at all — omit the
  // breakdown rather than disclose an exact small total under any label.
  return {};
}

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

  // K-anonymity suppression applied uniformly to EVERY categorical
  // breakdown this route returns — not just geography. See the module
  // docblock above for why (small-cell disclosure was previously open on
  // cohort/relationshipState/investmentBand/csvStatus, and geography's own
  // "Other" bucket could itself be a small cell recoverable by
  // differencing).
  const geographyDistribution = suppressSmallCells(rawGeography, GEOGRAPHY_K_THRESHOLD, OTHER_BUCKET);
  const suppressedCountsByCohort = suppressSmallCells(countsByCohort, GEOGRAPHY_K_THRESHOLD, OTHER_BUCKET);
  const suppressedRelationshipState = suppressSmallCells(countsByRelationshipState, GEOGRAPHY_K_THRESHOLD, OTHER_BUCKET);
  const suppressedInvestmentBand = suppressSmallCells(investmentBandDistribution, GEOGRAPHY_K_THRESHOLD, OTHER_BUCKET);
  const suppressedCsvStatus = suppressSmallCells(csvInvestmentStatusDistribution, GEOGRAPHY_K_THRESHOLD, OTHER_BUCKET);

  // participationStatus is a fixed two-way partition (activated/inactive),
  // not an open-ended categorical field — both values are always disclosed
  // by design (there's no "Other" to fold a suppressed sibling into, so
  // there's no hidden remainder for `total - shown` to recover; the
  // differencing pattern doesn't apply the same way). It still has a
  // residual small-cell risk if one side is naturally tiny, so: when either
  // side is under threshold, both are controlled-rounded to the nearest
  // multiple of the threshold rather than shown exactly. This deliberately
  // breaks exact recoverability of the minority count at the cost of exact
  // precision on a field that's already a coarse yes/no split.
  const participationStatus = (activated < GEOGRAPHY_K_THRESHOLD || inactive < GEOGRAPHY_K_THRESHOLD)
    ? {
        activated: Math.round(activated / GEOGRAPHY_K_THRESHOLD) * GEOGRAPHY_K_THRESHOLD,
        inactive: Math.round(inactive / GEOGRAPHY_K_THRESHOLD) * GEOGRAPHY_K_THRESHOLD,
      }
    : { activated, inactive };

  return {
    totalInvestors,
    countsByCohort: suppressedCountsByCohort,
    countsByRelationshipState: suppressedRelationshipState,
    investmentBandDistribution: suppressedInvestmentBand,
    participationStatus,
    geographyDistribution,
    completionEngagement: {
      csvInvestmentStatusDistribution: suppressedCsvStatus,
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
