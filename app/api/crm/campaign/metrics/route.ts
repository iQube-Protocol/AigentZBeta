/**
 * GET /api/crm/campaign/metrics
 *
 * Returns the 12 KNYT Wheel dashboard metrics from nakamoto_knyt_personas.
 *
 * All counts are derived from campaign_state, campaign_cohort, KS timestamp
 * columns (migration 20260411000000_nakamoto_knyt_campaign_fields.sql) and
 * the platform activation columns (migration 20260413000000_activated_investor_tracking.sql).
 *
 * Metrics:
 *   total_sends           — rows where last_campaign_sent_at IS NOT NULL
 *   opens                 — campaign_state IN ('opened', 'clicked', 'backed')
 *   clicks                — campaign_state IN ('clicked', 'backed')
 *   ks_visits             — kickstarter_clicked_at IS NOT NULL
 *   ks_backed             — kickstarter_backed_at IS NOT NULL
 *   top_shelf_conversions — cohort='top_shelf' AND state='backed'
 *   zero_knyt_conversions — cohort='zero_knyt' AND state='backed'
 *   slots_remaining       — KNYT_WHEEL_TOTAL_SLOTS env - ks_backed
 *   activated_investors   — platform_activated_at IS NOT NULL AND Total-Invested > 0
 *   reactivated           — cohort='reactivation' AND crm_personas link exists
 *   shares_count          — placeholder (0) until social tracking exists
 *   runtime_followups     — placeholder (0) until runtime event tracking
 *
 * Drill-down:
 *   GET ?drilldown=<metric_key>
 *   Returns { rows: [{ id, name, email, cohort, state }] } for the matching rows.
 *   Supported keys: total_sends | opens | clicks | ks_visits | ks_backed |
 *                   top_shelf_conversions | zero_knyt_conversions | reactivated
 */

import { NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

const TOTAL_SLOTS = parseInt(process.env.KNYT_WHEEL_TOTAL_SLOTS ?? '500', 10);

// ── Drill-down row type ────────────────────────────────────────────────────────

interface DrillRow {
  id: string;
  name: string;
  email: string;
  cohort: string | null;
  state: string | null;
}

// ── Drill-down handler ────────────────────────────────────────────────────────

async function handleDrilldown(metric: string): Promise<NextResponse> {
  const client = getCrmClient();

  // Base select with name/email columns
  const base = client
    .from('nakamoto_knyt_personas')
    .select('id, "Email", "First-Name", "Last-Name", campaign_cohort, campaign_state');

  let query: ReturnType<typeof client.from> | ReturnType<typeof base.not>;

  switch (metric) {
    case 'total_sends':
      query = base.not('last_campaign_sent_at', 'is', null);
      break;
    case 'opens':
      query = base.in('campaign_state', ['opened', 'clicked', 'backed']);
      break;
    case 'clicks':
      query = base.in('campaign_state', ['clicked', 'backed']);
      break;
    case 'ks_visits':
      query = base.not('kickstarter_clicked_at', 'is', null);
      break;
    case 'ks_backed':
      query = base.not('kickstarter_backed_at', 'is', null);
      break;
    case 'top_shelf_conversions':
      query = base.eq('campaign_cohort', 'top_shelf').eq('campaign_state', 'backed');
      break;
    case 'zero_knyt_conversions':
      query = base.eq('campaign_cohort', 'zero_knyt').eq('campaign_state', 'backed');
      break;
    case 'activated_investors':
      query = base.not('platform_activated_at', 'is', null).gt('"Total-Invested"', 0);
      break;
    case 'reactivated':
      query = base.eq('campaign_cohort', 'reactivation');
      break;
    default:
      return NextResponse.json({ error: `Unknown drilldown metric: ${metric}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (query as any).limit(500);

  if (error) {
    console.error('[campaign/metrics/drilldown] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: DrillRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const first = (r['First-Name'] as string | null) ?? '';
    const last  = (r['Last-Name']  as string | null) ?? '';
    const email = (r['Email'] as string | null) ?? '';
    return {
      id:     r['id'] as string,
      name:   `${first} ${last}`.trim() || email,
      email,
      cohort: (r['campaign_cohort'] as string | null) ?? null,
      state:  (r['campaign_state']  as string | null) ?? null,
    };
  });

  return NextResponse.json({ metric, rows });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const drilldown = searchParams.get('drilldown');

  if (drilldown) return handleDrilldown(drilldown);

  const client = getCrmClient();

  // Single query: fetch all campaign-state rows (only read campaign columns, not *)
  const { data, error } = await client
    .from('nakamoto_knyt_personas')
    .select(
      'id, campaign_cohort, campaign_state, last_campaign_sent_at, kickstarter_clicked_at, kickstarter_backed_at, platform_activated_at, "Total-Invested"'
    );

  if (error) {
    console.error('[campaign/metrics] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  let totalSends = 0;
  let clicks = 0;
  let ksVisits = 0;
  let ksBacked = 0;
  let topShelfConversions = 0;
  let zeroKnytConversions = 0;
  let activatedInvestors = 0;

  let opens = 0;

  for (const row of rows) {
    if (row.last_campaign_sent_at) totalSends++;
    const state = (row.campaign_state ?? '') as string;
    if (state === 'opened' || state === 'clicked' || state === 'backed') opens++;
    if (state === 'clicked' || state === 'backed') clicks++;
    if (row.kickstarter_clicked_at) ksVisits++;
    if (row.kickstarter_backed_at) ksBacked++;
    if (row.campaign_cohort === 'top_shelf' && state === 'backed') topShelfConversions++;
    if (row.campaign_cohort === 'zero_knyt' && state === 'backed') zeroKnytConversions++;
    if (row.platform_activated_at && parseFloat(row['Total-Invested'] ?? '0') > 0) activatedInvestors++;
  }

  // Reactivation: cohort=reactivation AND has a crm_personas identity link
  // Pull crm_personas emails that are activated (have identity_persona_id)
  const reactivationRows = rows.filter((r) => r.campaign_cohort === 'reactivation');
  let reactivated = 0;

  if (reactivationRows.length > 0) {
    // We need to cross-reference nakamoto emails with crm_personas — do it in a separate
    // targeted query rather than fetching all of nakamoto again.
    const { data: nakRows } = await client
      .from('nakamoto_knyt_personas')
      .select('id, Email')
      .in('id', reactivationRows.map((r) => r.id));

    const emails = (nakRows ?? [])
      .map((r: Record<string, unknown>) => (typeof r.Email === 'string' ? r.Email.toLowerCase() : ''))
      .filter(Boolean);

    if (emails.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < emails.length; i += CHUNK) {
        const { data: crmRows } = await client
          .from('crm_personas')
          .select('email, identity_persona_id')
          .in('email', emails.slice(i, i + CHUNK))
          .not('identity_persona_id', 'is', null);
        reactivated += (crmRows ?? []).length;
      }
    }
  }

  return NextResponse.json({
    metrics: {
      total_sends: totalSends,
      opens,
      clicks,
      ks_visits: ksVisits,
      ks_backed: ksBacked,
      top_shelf_conversions: topShelfConversions,
      zero_knyt_conversions: zeroKnytConversions,
      slots_remaining: Math.max(0, TOTAL_SLOTS - ksBacked),
      activated_investors: activatedInvestors,
      reactivated,
      shares_count: 0,             // Phase 2: social tracking
      runtime_followups: 0,        // Phase 2: runtime event tracking
    },
    total_slots: TOTAL_SLOTS,
    as_of: new Date().toISOString(),
  });
}
