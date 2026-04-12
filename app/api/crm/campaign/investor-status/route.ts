/**
 * GET /api/crm/campaign/investor-status?personaId=<uuid>
 *
 * Lightweight investor status lookup for the KNYT Wheel runtime lane.
 * Resolves a persona ID to a nakamoto_knyt_personas record using the
 * same identity strategies as /api/crm/personas/[id]/nakamoto (abbreviated
 * to the two fastest paths used in the runtime context).
 *
 * Returns:
 *   isInvestor        boolean  — true if found in nakamoto_knyt_personas
 *   investorId        string   — nakamoto_knyt_personas.id
 *   campaignState     string   — e.g. 'sent' | 'opened' | 'clicked' | 'backed'
 *   ksBacked          boolean  — kickstarter_backed_at IS NOT NULL
 *   ksClicked         boolean  — kickstarter_clicked_at IS NOT NULL
 *   campaignCohort    string   — e.g. 'top_shelf' | 'zero_knyt'
 *   investmentBand    string   — e.g. '5000+' | '2000-4999'
 *   ksTrackingUrl     string   — personalised /api/crm/track/ks URL (pre-built)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId')?.trim();

  if (!personaId) {
    return NextResponse.json({ isInvestor: false, reason: 'no_persona_id' });
  }

  const client = getCrmClient();

  // ── Identity resolution (fast paths only) ────────────────────────────────
  let email: string | null = null;

  // Strategy 1: crm_personas via identity_persona_id
  const { data: byIdentity } = await client
    .from('crm_personas')
    .select('email')
    .eq('identity_persona_id', personaId)
    .not('email', 'is', null)
    .maybeSingle();
  if (byIdentity?.email) email = byIdentity.email;

  // Strategy 2: crm_personas via direct id
  if (!email) {
    const { data: byId } = await client
      .from('crm_personas')
      .select('email')
      .eq('id', personaId)
      .not('email', 'is', null)
      .maybeSingle();
    if (byId?.email) email = byId.email;
  }

  // Strategy 3: personas.auth_profile_id → Supabase auth email
  if (!email) {
    const { data: persona } = await client
      .from('personas')
      .select('auth_profile_id')
      .eq('id', personaId)
      .maybeSingle();
    if (persona?.auth_profile_id) {
      try {
        const { data: authData } = await client.auth.admin.getUserById(
          String(persona.auth_profile_id)
        );
        if (authData?.user?.email) email = authData.user.email;
      } catch { /* auth admin unavailable */ }
    }
  }

  if (!email) {
    return NextResponse.json({ isInvestor: false, reason: 'no_email_resolved' });
  }

  // ── Nakamoto lookup ───────────────────────────────────────────────────────
  const { data: inv } = await client
    .from('nakamoto_knyt_personas')
    .select('id, campaign_state, campaign_cohort, investment_amount_band, kickstarter_clicked_at, kickstarter_backed_at')
    .ilike('Email', email)
    .maybeSingle();

  if (!inv) {
    return NextResponse.json({ isInvestor: false, reason: 'not_in_nakamoto' });
  }

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-beta.aigentz.me';
  const cohort   = (inv.campaign_cohort as string | null) ?? 'general';
  const ksUrl    = `${appUrl}/api/crm/track/ks?uid=${inv.id}&utm_source=knyt_wheel&utm_medium=runtime&utm_content=${encodeURIComponent(cohort)}`;

  return NextResponse.json({
    isInvestor:     true,
    investorId:     inv.id,
    campaignState:  inv.campaign_state  ?? null,
    ksBacked:       !!(inv.kickstarter_backed_at),
    ksClicked:      !!(inv.kickstarter_clicked_at),
    campaignCohort: inv.campaign_cohort ?? null,
    investmentBand: inv.investment_amount_band ?? null,
    ksTrackingUrl:  ksUrl,
  });
}
