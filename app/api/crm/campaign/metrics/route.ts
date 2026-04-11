/**
 * GET /api/crm/campaign/metrics
 *
 * Returns the 11 KNYT Wheel dashboard metrics from nakamoto_knyt_personas.
 *
 * All counts are derived from campaign_state, campaign_cohort, and KS timestamp
 * columns added by migration 20260411000000_nakamoto_knyt_campaign_fields.sql.
 *
 * Metrics:
 *   total_sends           — rows where last_campaign_sent_at IS NOT NULL
 *   opens                 — placeholder (requires Make.com webhook write-back)
 *   clicks                — campaign_state IN ('clicked', 'backed')
 *   ks_visits             — kickstarter_clicked_at IS NOT NULL
 *   ks_backed             — kickstarter_backed_at IS NOT NULL
 *   top_shelf_conversions — cohort='top_shelf' AND state='backed'
 *   zero_knyt_conversions — cohort='zero_knyt' AND state='backed'
 *   slots_remaining       — KNYT_WHEEL_TOTAL_SLOTS env - ks_backed
 *   reactivated           — cohort='reactivation' AND crm_personas link exists
 *   shares_count          — placeholder (0) until social tracking exists
 *   runtime_followups     — placeholder (0) until runtime event tracking
 */

import { NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

const TOTAL_SLOTS = parseInt(process.env.KNYT_WHEEL_TOTAL_SLOTS ?? '500', 10);

export async function GET() {
  const client = getCrmClient();

  // Single query: fetch all campaign-state rows (only read campaign columns, not *)
  const { data, error } = await client
    .from('nakamoto_knyt_personas')
    .select(
      'id, campaign_cohort, campaign_state, last_campaign_sent_at, kickstarter_clicked_at, kickstarter_backed_at'
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

  for (const row of rows) {
    if (row.last_campaign_sent_at) totalSends++;
    const state = (row.campaign_state ?? '') as string;
    if (state === 'clicked' || state === 'backed') clicks++;
    if (row.kickstarter_clicked_at) ksVisits++;
    if (row.kickstarter_backed_at) ksBacked++;
    if (row.campaign_cohort === 'top_shelf' && state === 'backed') topShelfConversions++;
    if (row.campaign_cohort === 'zero_knyt' && state === 'backed') zeroKnytConversions++;
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
      opens: 0,                    // Phase 1: requires Make.com write-back webhook
      clicks,
      ks_visits: ksVisits,
      ks_backed: ksBacked,
      top_shelf_conversions: topShelfConversions,
      zero_knyt_conversions: zeroKnytConversions,
      slots_remaining: Math.max(0, TOTAL_SLOTS - ksBacked),
      reactivated,
      shares_count: 0,             // Phase 2: social tracking
      runtime_followups: 0,        // Phase 2: runtime event tracking
    },
    total_slots: TOTAL_SLOTS,
    as_of: new Date().toISOString(),
  });
}
