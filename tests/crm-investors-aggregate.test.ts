/**
 * GET /api/crm/investors/aggregate — the estate-wide admin aggregate.
 *
 * Operator ruling (2026-07-28): "An estate-wide admin aggregate should
 * default to counts and distributions, not unrestricted row-level PII...
 * Email, exact city, KNYT-ID, internal persona identifiers and similar
 * fields should not be returned simply because someone can access the
 * aggregate dashboard."
 *
 * This suite asserts the response contains ONLY the allowed aggregate
 * fields (an EXACT key set, not "at least these fields" — see
 * ALLOWED_TOP_LEVEL_KEYS, which the route module and this test both import
 * from the same source so they cannot drift apart), that no PII value
 * fabricated into the input ever appears in the output, that the route is
 * admin-gated the same way the sibling PII routes are, and that geography
 * buckets below the k-anonymity threshold are suppressed rather than
 * returned raw.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { stripComments } from './_lib/sourceAuthority';
import {
  computeInvestorAggregate,
  suppressSmallCells,
  ALLOWED_TOP_LEVEL_KEYS,
  GEOGRAPHY_K_THRESHOLD,
  OTHER_BUCKET,
} from '@/app/api/crm/investors/aggregate/_lib';

const FORBIDDEN_VALUES = [
  'ada@example.com',            // email
  'sova@example.com',
  'KNYT-XYZ-001',                // KNYT-ID
  'Lovelace',                    // last name
  '11111111-2222-3333-4444-555555555555', // a fake auth-profile / persona id
];

function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    'First-Name': 'Ada',
    'Last-Name': 'Lovelace',
    Email: 'ada@example.com',
    'KNYT-ID': 'KNYT-XYZ-001',
    campaign_cohort: 'wave-1',
    campaign_state: 'sent',
    investment_amount_band: '10k-50k',
    csv_investment_status: 'committed',
    platform_activated_at: '2026-07-01T00:00:00Z',
    'Local-City': 'Nowhereville',
    kickstarter_clicked_at: null,
    kickstarter_backed_at: null,
    last_campaign_sent_at: '2026-06-01T00:00:00Z',
    platform_engagement_score: 10,
    ...overrides,
  };
}

describe('computeInvestorAggregate — allowed-key set', () => {
  it('the top-level response has EXACTLY the allowed keys, no more, no fewer', () => {
    const result = computeInvestorAggregate([row({})]);
    expect(Object.keys(result).sort()).toEqual([...ALLOWED_TOP_LEVEL_KEYS].sort());
  });

  it('a fabricated row full of PII never surfaces any of its identifying values', () => {
    const result = computeInvestorAggregate([
      row({
        Email: 'sova@example.com',
        'KNYT-ID': 'KNYT-XYZ-001',
        'Last-Name': 'Lovelace',
        platform_auth_profile_id: '11111111-2222-3333-4444-555555555555',
      }),
    ]);
    const serialised = JSON.stringify(result);
    for (const forbidden of FORBIDDEN_VALUES) {
      expect(serialised, `aggregate leaked "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('no PII-shaped field names appear anywhere in the response, at any nesting depth', () => {
    const result = computeInvestorAggregate([row({})]);
    const serialised = JSON.stringify(result);
    for (const forbiddenKey of ['"email"', '"Email"', '"knytId"', '"KNYT-ID"', '"firstName"', '"lastName"', '"personaId"', '"platform_auth_profile_id"', '"city"']) {
      expect(serialised, `aggregate response contains forbidden key ${forbiddenKey}`).not.toContain(forbiddenKey);
    }
  });
});

describe('computeInvestorAggregate — geography k-anonymity suppression', () => {
  it('a city bucket at or above the threshold is returned by name', () => {
    const rows = Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ 'Local-City': 'BigCity' }));
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution['BigCity']).toBe(GEOGRAPHY_K_THRESHOLD);
  });

  it('city buckets below the threshold never appear by name', () => {
    const rows = [
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownA' })),
      ...Array.from({ length: 2 }, () => row({ 'Local-City': 'TinyTownB' })),
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownC' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution['TinyTownA']).toBeUndefined();
    expect(result.geographyDistribution['TinyTownB']).toBeUndefined();
    expect(result.geographyDistribution['TinyTownC']).toBeUndefined();
  });

  it('when NO city bucket clears the threshold, the whole breakdown is omitted rather than disclosing an exact small pooled total', () => {
    // 1 + 2 + 1 = 4, under k=5, and there is no safe bucket anywhere in this
    // field to fold the remainder into. Exposing `Other: 4` here (the old
    // behaviour) directly discloses a sub-k count — the exact bug this test
    // now guards against. The safe outcome is an empty breakdown: the 4
    // rows are still counted in totalInvestors, just not attributable to
    // any named or "Other" geography bucket.
    const rows = [
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownA' })),
      ...Array.from({ length: 2 }, () => row({ 'Local-City': 'TinyTownB' })),
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownC' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution).toEqual({});
    expect(result.totalInvestors).toBe(4);
  });

  it('a mixed population suppresses only the small buckets', () => {
    const rows = [
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ 'Local-City': 'BigCity' })),
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD - 1 }, () => row({ 'Local-City': 'AlmostBigCity' })),
      row({ 'Local-City': 'SoloTown' }),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution['BigCity']).toBe(GEOGRAPHY_K_THRESHOLD);
    expect(result.geographyDistribution['AlmostBigCity']).toBeUndefined();
    expect(result.geographyDistribution['SoloTown']).toBeUndefined();
    expect(result.geographyDistribution[OTHER_BUCKET]).toBe(GEOGRAPHY_K_THRESHOLD); // (k-1) + 1
  });

  it('the chosen threshold is exposed in the response so consumers can label it', () => {
    const result = computeInvestorAggregate([row({})]);
    expect(result.kAnonymityThreshold).toBe(GEOGRAPHY_K_THRESHOLD);
    expect(GEOGRAPHY_K_THRESHOLD).toBeGreaterThanOrEqual(5); // documented floor — do not silently lower
  });
});

describe('suppressSmallCells — the shared differencing-safe suppression primitive', () => {
  it('folds a sub-threshold pool into the largest safe bucket instead of exposing it as its own line', () => {
    const raw = { BigCity: 20, TinyTownA: 1, TinyTownB: 2, TinyTownC: 1 }; // pool = 4, under k=5
    const result = suppressSmallCells(raw, 5, OTHER_BUCKET);
    expect(result).toEqual({ BigCity: 24 }); // 20 + pooled 4, no separate "Other" line
    expect(Object.keys(result)).not.toContain(OTHER_BUCKET);
  });

  it('omits the breakdown entirely when no bucket anywhere clears the threshold', () => {
    const raw = { TinyTownA: 1, TinyTownB: 2 }; // pool = 3, under k=5, no safe bucket to fold into
    expect(suppressSmallCells(raw, 5, OTHER_BUCKET)).toEqual({});
  });

  it('a pool that itself reaches the threshold is shown under the Other label (now its own safe cell)', () => {
    const raw = { BigCity: 20, TinyTownA: 3, TinyTownB: 2 }; // pool = 5 = k, safe on its own
    expect(suppressSmallCells(raw, 5, OTHER_BUCKET)).toEqual({ BigCity: 20, [OTHER_BUCKET]: 5 });
  });
});

describe('computeInvestorAggregate — differencing/subtraction disclosure is prevented', () => {
  it('SUBTRACTION-SENSITIVE CASE: total minus the safe geography bucket no longer recovers the suppressed city\'s exact count', () => {
    // Reconstructs the exact scenario that was exploitable under the OLD
    // (pre-fix) suppression logic: one safe city (BigCity, 20) plus exactly
    // one below-threshold city (SmallTown, 3). Under the old logic,
    // geographyDistribution was { BigCity: 20, Other: 3 } — Other's value
    // WAS the suppressed city's exact true count, both directly (it's right
    // there in the response) and via total(23) - BigCity(20) = 3. Either
    // path fully defeats the suppression for a single small bucket.
    const rows = [
      ...Array.from({ length: 20 }, () => row({ 'Local-City': 'BigCity' })),
      ...Array.from({ length: 3 }, () => row({ 'Local-City': 'SmallTown' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.totalInvestors).toBe(23);

    // New behaviour: SmallTown's 3 rows are folded into BigCity. There is no
    // "Other" line to read, and no named bucket the true SmallTown count
    // could be isolated from — BigCity's displayed value (23) is now
    // indistinguishable from "23 true BigCity residents" vs. "20 true
    // BigCity residents + an unknown 1..4 remainder from elsewhere".
    expect(result.geographyDistribution).toEqual({ BigCity: 23 });
    expect(result.geographyDistribution[OTHER_BUCKET]).toBeUndefined();
    expect(result.geographyDistribution['SmallTown']).toBeUndefined();

    // The differencing check itself: total minus every displayed bucket is
    // now zero — there is no remainder left over to solve for.
    const sumOfDisplayed = Object.values(result.geographyDistribution).reduce((a, b) => a + b, 0);
    expect(result.totalInvestors - sumOfDisplayed).toBe(0);
  });

  it('CROSS-TAB CASE: the same small subgroup is suppressed independently in BOTH the geography and cohort breakdowns', () => {
    // 20 people are BigCity/wave-1 (safe in both dimensions). A separate,
    // SAME 3 people are SmallTown/wave-9 — a small cell in geography AND in
    // cohort simultaneously (the "city × cohort" cross-tab risk named in the
    // review). Neither breakdown may disclose that this group of exactly 3
    // exists, whether by name or by an exact pooled/Other count.
    const rows = [
      ...Array.from({ length: 20 }, () => row({ 'Local-City': 'BigCity', campaign_cohort: 'wave-1' })),
      ...Array.from({ length: 3 }, () => row({ 'Local-City': 'SmallTown', campaign_cohort: 'wave-9' })),
    ];
    const result = computeInvestorAggregate(rows);

    // Geography: SmallTown never named, folds into BigCity, no Other line.
    expect(result.geographyDistribution).toEqual({ BigCity: 23 });
    expect(result.geographyDistribution['SmallTown']).toBeUndefined();

    // Cohort: wave-9 never named, folds into wave-1, no Other line — same
    // guarantee, independently, on the other dimension.
    expect(result.countsByCohort).toEqual({ 'wave-1': 23 });
    expect(result.countsByCohort['wave-9']).toBeUndefined();
    expect(result.countsByCohort[OTHER_BUCKET]).toBeUndefined();

    // Neither breakdown's displayed total leaves a subtractable remainder.
    const geoSum = Object.values(result.geographyDistribution).reduce((a, b) => a + b, 0);
    const cohortSum = Object.values(result.countsByCohort).reduce((a, b) => a + b, 0);
    expect(result.totalInvestors - geoSum).toBe(0);
    expect(result.totalInvestors - cohortSum).toBe(0);
  });

  it('FILTERED CITY/COHORT CASE: a city that is safe alone still hides a cohort-scoped small cell within it', () => {
    // BigCity has 24 residents overall (safe on the geography dimension by
    // itself), but 3 of those 24 belong to a single rare cohort ("wave-9")
    // that would be a small cell if it were ever cross-tabbed by city. The
    // cohort breakdown (computed across the whole population, independent
    // of city) must still suppress wave-9 as its own dimension's small cell
    // — this is the "filtered city/cohort combination" the review asked for
    // a canary on.
    const rows = [
      ...Array.from({ length: 21 }, () => row({ 'Local-City': 'BigCity', campaign_cohort: 'wave-1' })),
      ...Array.from({ length: 3 }, () => row({ 'Local-City': 'BigCity', campaign_cohort: 'wave-9' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution).toEqual({ BigCity: 24 }); // city dimension was always safe here
    expect(result.countsByCohort).toEqual({ 'wave-1': 24 }); // wave-9's 3 folded in, never named
    expect(result.countsByCohort['wave-9']).toBeUndefined();
  });
});

describe('computeInvestorAggregate — counts and distributions are correct', () => {
  it('participationStatus counts activated vs inactive from platform_activated_at when both sides clear k-anonymity', () => {
    const rows = [
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ platform_activated_at: '2026-07-01T00:00:00Z' })),
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD + 2 }, () => row({ platform_activated_at: null })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.participationStatus).toEqual({ activated: GEOGRAPHY_K_THRESHOLD, inactive: GEOGRAPHY_K_THRESHOLD + 2 });
    expect(result.totalInvestors).toBe(GEOGRAPHY_K_THRESHOLD * 2 + 2);
  });

  it('participationStatus does not disclose an exact minority count when one side is a small cell', () => {
    // 1 activated out of 3 total is a small-cell disclosure on its own
    // (and, since both sides always sum to totalInvestors by construction,
    // showing either side exactly always discloses the other exactly too —
    // there's no "hidden" side to protect if one is shown raw). Both sides
    // are controlled-rounded to the nearest multiple of the threshold so
    // neither is disclosed as an exact small number.
    const result = computeInvestorAggregate([
      row({ platform_activated_at: '2026-07-01T00:00:00Z' }),
      row({ platform_activated_at: null }),
      row({ platform_activated_at: null }),
    ]);
    expect(result.participationStatus.activated).not.toBe(1);
    expect(result.participationStatus.activated % GEOGRAPHY_K_THRESHOLD).toBe(0);
    expect(result.participationStatus.inactive % GEOGRAPHY_K_THRESHOLD).toBe(0);
    expect(result.totalInvestors).toBe(3);
  });

  it('countsByCohort / relationship state / investment band bucket correctly when every bucket clears k-anonymity', () => {
    // Every named bucket here has >= GEOGRAPHY_K_THRESHOLD members so none of
    // them are suppression candidates — this test is purely about correct
    // bucketing arithmetic. Suppression behaviour has its own describe block
    // below (this row-count design intentionally mirrors it).
    const rows = [
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ campaign_cohort: 'wave-1', campaign_state: 'sent', investment_amount_band: '10k-50k' })),
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ campaign_cohort: 'wave-1', campaign_state: 'responded', investment_amount_band: null })),
      ...Array.from({ length: GEOGRAPHY_K_THRESHOLD }, () => row({ campaign_cohort: null, campaign_state: 'sent', investment_amount_band: '10k-50k' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.countsByCohort).toEqual({ 'wave-1': GEOGRAPHY_K_THRESHOLD * 2, unassigned: GEOGRAPHY_K_THRESHOLD });
    expect(result.countsByRelationshipState).toEqual({ sent: GEOGRAPHY_K_THRESHOLD * 2, responded: GEOGRAPHY_K_THRESHOLD });
    expect(result.investmentBandDistribution).toEqual({ '10k-50k': GEOGRAPHY_K_THRESHOLD * 2, unassigned: GEOGRAPHY_K_THRESHOLD });
  });

  it('completionEngagement tallies kickstarter/campaign touches and averages engagement score', () => {
    const result = computeInvestorAggregate([
      row({ kickstarter_clicked_at: '2026-01-01', kickstarter_backed_at: '2026-01-02', last_campaign_sent_at: '2026-01-01', platform_engagement_score: 10 }),
      row({ kickstarter_clicked_at: null, kickstarter_backed_at: null, last_campaign_sent_at: null, platform_engagement_score: 20 }),
    ]);
    expect(result.completionEngagement.withKickstarterClicked).toBe(1);
    expect(result.completionEngagement.withKickstarterBacked).toBe(1);
    expect(result.completionEngagement.withCampaignSent).toBe(1);
    expect(result.completionEngagement.avgPlatformEngagementScore).toBe(15);
  });

  it('non-investor rows (no name/email/investment signal) are excluded, same predicate as the row-level route', () => {
    const result = computeInvestorAggregate([
      row({}),
      { 'First-Name': '', 'Last-Name': '', Email: '' }, // system/test row — no signal
    ]);
    expect(result.totalInvestors).toBe(1);
  });
});

describe('GET /api/crm/investors/aggregate is admin-gated', () => {
  // Mirrors the assertion style in tests/crm-pii-route-auth.test.ts — this
  // route now also appears in that file's PII_ROUTES list; this block is a
  // second, independent check scoped to just this route so the aggregate
  // suite is self-contained and does not depend on the sibling file's list
  // staying in sync.
  const ROUTE = 'app/api/crm/investors/aggregate/route.ts';

  it('the GET handler calls requireAdminPersona and branches on the result', () => {
    const src = stripComments(readFileSync(ROUTE, 'utf-8'));
    expect(src).toMatch(/await\s+requireAdminPersona\(/);
    expect(src).toMatch(/if\s*\(!\(await\s+requireAdminPersona\(/);
  });

  it('does not use the localhost-bypassing requireAdmin stub', () => {
    const src = stripComments(readFileSync(ROUTE, 'utf-8'));
    expect(/requireAdmin\s*\(/.test(src)).toBe(false);
  });

  it('this route is registered in the shared PII_ROUTES canary list', () => {
    const src = readFileSync('tests/crm-pii-route-auth.test.ts', 'utf-8');
    expect(src).toContain(`'${ROUTE}'`);
  });
});
