/**
 * GET /api/crm/track/ks
 *
 * Kickstarter click tracking endpoint.
 * 1. Writes kickstarter_clicked_at to nakamoto_knyt_personas (first click only).
 * 2. Advances campaign_state to 'clicked' if it was 'sent' or 'opened'.
 * 3. Redirects to the live Kickstarter campaign URL (KICKSTARTER_CAMPAIGN_URL env).
 *
 * Query params:
 *   uid           string  nakamoto_knyt_personas.id  (required)
 *   utm_source    string  forwarded to KS URL
 *   utm_medium    string  forwarded to KS URL
 *   utm_campaign  string  forwarded to KS URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

const CLICK_ADVANCE_STATES = new Set(['sent', 'opened']);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid')?.trim();

  const ksBase = process.env.KICKSTARTER_CAMPAIGN_URL ?? process.env.NEXT_PUBLIC_KS_URL ?? '';
  if (!ksBase) {
    // No KS URL configured — still track but redirect to a safe fallback
    console.warn('[track/ks] KICKSTARTER_CAMPAIGN_URL not set');
  }

  // Build redirect URL, forwarding UTM params
  const utmParams = new URLSearchParams();
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
    const v = searchParams.get(k);
    if (v) utmParams.set(k, v);
  });
  const redirectUrl = ksBase
    ? `${ksBase}${utmParams.toString() ? `?${utmParams}` : ''}`
    : '/';

  if (uid) {
    // Fire-and-forget — don't block the redirect on DB latency
    setImmediate(async () => {
      try {
        const client = getCrmClient();

        // Fetch current state first (avoid overwriting a later-state)
        const { data: current } = await client
          .from('nakamoto_knyt_personas')
          .select('kickstarter_clicked_at, campaign_state')
          .eq('id', uid)
          .maybeSingle();

        if (!current) return; // row not found

        const updatePayload: Record<string, unknown> = {};

        // Only write first click
        if (!current.kickstarter_clicked_at) {
          updatePayload.kickstarter_clicked_at = new Date().toISOString();
        }

        // Advance state if not already past 'clicked'
        const currentState = (current.campaign_state ?? '') as string;
        if (CLICK_ADVANCE_STATES.has(currentState)) {
          updatePayload.campaign_state = 'clicked';
        }

        if (Object.keys(updatePayload).length > 0) {
          await client
            .from('nakamoto_knyt_personas')
            .update(updatePayload)
            .eq('id', uid);
        }
      } catch (err) {
        console.error('[track/ks] DB update failed:', err);
      }
    });
  }

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
