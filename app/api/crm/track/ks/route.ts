/**
 * GET /api/crm/track/ks
 *
 * Kickstarter click tracking endpoint.
 * 1. Writes kickstarter_clicked_at to nakamoto_knyt_personas (first click only).
 * 2. Advances campaign_state to 'clicked' if it was 'sent' or 'opened'.
 * 3. Fires server-side GA4 Measurement Protocol event (if GA4_MEASUREMENT_ID + GA4_API_SECRET set).
 * 4. Fires server-side Meta Conversions API event (if META_PIXEL_ID + META_CONVERSIONS_API_TOKEN set).
 * 5. Redirects to the live Kickstarter campaign URL with ?ref=9pbmus + UTM params.
 *
 * Query params:
 *   uid           string  nakamoto_knyt_personas.id  (required for CRM tracking)
 *   utm_source    string  forwarded to KS URL (default: knyt_wheel)
 *   utm_medium    string  forwarded to KS URL (default: email)
 *   utm_campaign  string  forwarded to KS URL (default: knyt_wheel_launch)
 *   utm_content   string  forwarded to KS URL (use cohort name: top_shelf, zero_knyt, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { logClick } from '@/services/campaign/knytTrackingService';

export const dynamic = 'force-dynamic';

const KS_REF_TAG     = '9pbmus';
const CLICK_ADVANCE_STATES = new Set(['sent', 'opened']);

// ── Build redirect URL ────────────────────────────────────────────────────────

function buildKsUrl(searchParams: URLSearchParams): string {
  const ksBase = (
    process.env.KICKSTARTER_CAMPAIGN_URL ??
    process.env.NEXT_PUBLIC_KS_URL ??
    'https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats'
  );

  const ks = new URL(ksBase);

  // Always include Kickstarter's custom referral tag
  ks.searchParams.set('ref', KS_REF_TAG);

  // Forward UTM params, applying sensible defaults
  ks.searchParams.set('utm_source',   searchParams.get('utm_source')   ?? 'knyt_wheel');
  ks.searchParams.set('utm_medium',   searchParams.get('utm_medium')   ?? 'email');
  ks.searchParams.set('utm_campaign', searchParams.get('utm_campaign') ?? 'knyt_wheel_launch');

  const utmContent = searchParams.get('utm_content');
  if (utmContent) ks.searchParams.set('utm_content', utmContent);

  const utmTerm = searchParams.get('utm_term');
  if (utmTerm) ks.searchParams.set('utm_term', utmTerm);

  return ks.toString();
}

// ── GA4 Measurement Protocol ──────────────────────────────────────────────────

async function fireGa4Event(uid: string | null, utmSource: string, utmMedium: string) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret     = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: uid ?? 'anonymous',
          events: [{
            name: 'ks_link_click',
            params: {
              campaign:    'knyt_wheel_launch',
              source:      utmSource,
              medium:      utmMedium,
              investor_id: uid ?? '',
            },
          }],
        }),
      }
    );
  } catch (err) {
    console.error('[track/ks] GA4 event failed:', err);
  }
}

// ── Meta Conversions API ──────────────────────────────────────────────────────

async function fireMetaEvent(
  uid: string | null,
  email: string | null,
  clientIp: string,
  userAgent: string,
  redirectUrl: string,
) {
  const pixelId     = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken) return;

  const userData: Record<string, string> = { client_ip_address: clientIp, client_user_agent: userAgent };
  if (email) userData['em'] = email; // Meta will hash it server-side if raw

  try {
    await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name:       'ViewContent',
          event_time:       Math.floor(Date.now() / 1000),
          event_source_url: redirectUrl,
          action_source:    'website',
          user_data:        userData,
          custom_data: {
            campaign:    'knyt_wheel_launch',
            investor_id: uid ?? '',
          },
        }],
      }),
    });
  } catch (err) {
    console.error('[track/ks] Meta Conversions API event failed:', err);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid')?.trim() ?? null;

  const redirectUrl = buildKsUrl(searchParams);

  const utmSource = searchParams.get('utm_source') ?? 'knyt_wheel';
  const utmMedium = searchParams.get('utm_medium') ?? 'email';
  const clientIp  = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';

  const utmContent  = searchParams.get('utm_content') ?? null;
  const utmCampaign = searchParams.get('utm_campaign') ?? 'knyt_wheel_launch';
  const utmTerm     = searchParams.get('utm_term') ?? null;
  const linkTag     = searchParams.get('tag') ?? null;

  // Fire tracking events in parallel — none block the redirect
  const trackingJobs: Promise<void>[] = [
    fireGa4Event(uid, utmSource, utmMedium),
    fireMetaEvent(uid, null, clientIp, userAgent, redirectUrl),
    // Internal telemetry — append-only click event log
    logClick({
      linkTag,
      investorId:   uid,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      ipAddress:    clientIp || null,
      userAgent:    userAgent || null,
      resolvedKsUrl: redirectUrl,
    }) as unknown as Promise<void>,
  ];

  if (uid) {
    // CRM write + email lookup for Meta enrichment
    const crmJob = (async () => {
      try {
        const client = getCrmClient();

        const { data: current } = await client
          .from('nakamoto_knyt_personas')
          .select('kickstarter_clicked_at, campaign_state, Email')
          .eq('id', uid)
          .maybeSingle();

        if (!current) return;

        const updatePayload: Record<string, unknown> = {};
        if (!current.kickstarter_clicked_at) {
          updatePayload.kickstarter_clicked_at = new Date().toISOString();
        }
        const currentState = (current.campaign_state ?? '') as string;
        if (CLICK_ADVANCE_STATES.has(currentState)) {
          updatePayload.campaign_state = 'clicked';
        }
        if (Object.keys(updatePayload).length > 0) {
          await client.from('nakamoto_knyt_personas').update(updatePayload).eq('id', uid);
        }

        // Re-fire Meta event with email for better matching
        const email = (current as Record<string, unknown>)['Email'] as string | null;
        if (email) {
          await fireMetaEvent(uid, email, clientIp, userAgent, redirectUrl);
        }
      } catch (err) {
        console.error('[track/ks] DB update failed:', err);
      }
    })();
    trackingJobs.push(crmJob);
  }

  // Fire and forget — don't await tracking
  Promise.allSettled(trackingJobs).catch(() => {});

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
