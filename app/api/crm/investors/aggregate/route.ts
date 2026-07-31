/**
 * GET /api/crm/investors/aggregate
 *
 * Estate-wide admin aggregate over the investor base. Operator ruling
 * (2026-07-28, in response to the row-level PII exposure incident fixed the
 * same day in app/api/crm/investors/route.ts):
 *
 *   "An estate-wide admin aggregate should default to counts and
 *   distributions, not unrestricted row-level PII. ... Row-level access
 *   should be separately permissioned and purpose-bound. Email, exact city,
 *   KNYT-ID, internal persona identifiers and similar fields should not be
 *   returned simply because someone can access the aggregate dashboard."
 *
 * This route returns ONLY counts and distributions:
 *   - countsByCohort               (campaign_cohort)
 *   - countsByRelationshipState    (campaign_state)
 *   - investmentBandDistribution   (investment_amount_band)
 *   - participationStatus          (activated vs inactive, from platform_activated_at)
 *   - geographyDistribution        (Local-City, k-anonymity suppressed — see below)
 *   - completionEngagement         (csv investment status, Kickstarter/campaign
 *                                    touch counts, average platform engagement score)
 *
 * It MUST NEVER return: email, exact city (below the k-anonymity threshold),
 * KNYT-ID, first/last name, or any internal/public persona identifier. This
 * is the constraint tests/crm-investors-aggregate.test.ts checks hardest —
 * an aggregate route that "helpfully" joins in an identifying field defeats
 * the entire point of building it separately from the row-level
 * GET /api/crm/investors. The response shape is an exact allowed-key set,
 * not "at least these fields" — computeInvestorAggregate() is the single
 * place that shape is produced, and the test imports it directly.
 *
 * Geography k-anonymity: any Local-City bucket with fewer than
 * GEOGRAPHY_K_THRESHOLD (5) investors is folded into an "Other" bucket
 * instead of being returned as its own row. k=5 is a conservative, widely
 * used small-cell-suppression floor (comparable to the thresholds common in
 * public-health and census small-area reporting) — a city bucket of 1-4
 * people combined with any other field on this dashboard (e.g. investment
 * band) would often re-identify a specific individual. Raise, don't lower,
 * this number if the admin surface ever needs finer geography.
 *
 * Row-level, purpose-bound investor access (per the operator's ruling that
 * "row-level access should be separately permissioned and purpose-bound") is
 * explicitly OUT OF SCOPE for this route — that is a distinct future
 * increment requiring its own decision about what "purpose" means and how
 * it's authorized. Do not extend this route with row-level output to serve
 * a future feature; build that as its own gated route when that decision is
 * made.
 *
 * Auth: requireAdminPersona (spine-resolved, same gate as
 * GET /api/crm/investors — see app/api/_lib/requireAdmin.ts). Reused, not
 * forked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { computeInvestorAggregate, AGGREGATE_SELECT } from './_lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await requireAdminPersona(request))) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 },
    );
  }

  const client = getCrmClient();

  // Same full-pagination pattern as GET /api/crm/investors — PostgREST caps
  // at 1000 rows/page by default and we need the whole table to aggregate.
  const PAGE_SIZE = 1000;
  let rawInvestors: Record<string, unknown>[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await client
      .from('nakamoto_knyt_personas')
      .select(AGGREGATE_SELECT)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    rawInvestors = rawInvestors.concat(data as unknown as Record<string, unknown>[]);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return NextResponse.json(computeInvestorAggregate(rawInvestors));
}
