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

  it('city buckets below the threshold are folded into the Other bucket, not returned raw', () => {
    const rows = [
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownA' })),
      ...Array.from({ length: 2 }, () => row({ 'Local-City': 'TinyTownB' })),
      ...Array.from({ length: 1 }, () => row({ 'Local-City': 'TinyTownC' })),
    ];
    const result = computeInvestorAggregate(rows);
    expect(result.geographyDistribution['TinyTownA']).toBeUndefined();
    expect(result.geographyDistribution['TinyTownB']).toBeUndefined();
    expect(result.geographyDistribution['TinyTownC']).toBeUndefined();
    expect(result.geographyDistribution[OTHER_BUCKET]).toBe(4); // 1 + 2 + 1
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

describe('computeInvestorAggregate — counts and distributions are correct', () => {
  it('participationStatus counts activated vs inactive from platform_activated_at', () => {
    const result = computeInvestorAggregate([
      row({ platform_activated_at: '2026-07-01T00:00:00Z' }),
      row({ platform_activated_at: null }),
      row({ platform_activated_at: null }),
    ]);
    expect(result.participationStatus).toEqual({ activated: 1, inactive: 2 });
    expect(result.totalInvestors).toBe(3);
  });

  it('countsByCohort / relationship state / investment band bucket correctly, with an unassigned bucket for nulls', () => {
    const result = computeInvestorAggregate([
      row({ campaign_cohort: 'wave-1', campaign_state: 'sent', investment_amount_band: '10k-50k' }),
      row({ campaign_cohort: 'wave-1', campaign_state: 'responded', investment_amount_band: null }),
      row({ campaign_cohort: null, campaign_state: 'sent', investment_amount_band: '10k-50k' }),
    ]);
    expect(result.countsByCohort).toEqual({ 'wave-1': 2, unassigned: 1 });
    expect(result.countsByRelationshipState).toEqual({ sent: 2, responded: 1 });
    expect(result.investmentBandDistribution).toEqual({ '10k-50k': 2, unassigned: 1 });
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
