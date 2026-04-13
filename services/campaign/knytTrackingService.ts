/**
 * services/campaign/knytTrackingService.ts
 *
 * KNYT Wheel Campaign Tracking Agent — core service layer.
 *
 * Responsibilities:
 *   1. logClick()          — write one row to knyt_tracking_click_events
 *   2. generateLinkPack()  — create / refresh registry entries for a config
 *   3. getHealth()         — instrumentation health snapshot
 *   4. computeFollowupQueue() — score investors + partners, write to queue
 *   5. getLinkRegistry()   — paginated registry read with live stats
 *   6. getFollowupQueue()  — read ranked queue
 *
 * All DB access uses the service-role client (server-side only).
 * All public functions are async and never throw — they return typed result
 * objects so callers can handle errors without try/catch.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Supabase client (server-side, service role) ───────────────────────────────

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackingLinkEntry {
  id: string;
  campaign_slug: string;
  tag_name: string;
  channel: string;
  owner_type: string;
  owner_key: string | null;
  owner_name: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  kickstarter_ref_tag: string;
  is_active: boolean;
  notes: string | null;
  click_count: number;
  redirect_url: string;  // computed field added by getLinkRegistry()
  created_at: string;
  updated_at: string;
}

export interface ClickEventInput {
  linkTag?: string | null;
  investorId?: string | null;
  partnerSlug?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resolvedKsUrl?: string | null;
}

export interface HealthStatus {
  redirect_endpoint_ok: boolean;
  ga4_configured: boolean;
  meta_configured: boolean;
  ks_url_configured: boolean;
  webhook_configured: boolean;
  // Mailjet email adapter vars
  mailjet_api_key: boolean;
  mailjet_secret_key: boolean;
  mailjet_from_email: boolean;
  mailjet_template_top_shelf: boolean;
  mailjet_template_zero_knyt: boolean;
  mailjet_template_reactivation: boolean;
  mailjet_bcc_email: boolean;
  active_link_count: number;
  clicks_today: number;
  clicks_all_time: number;
  last_click_at: string | null;
}

export interface FollowupEntry {
  entity_type: 'investor' | 'partner';
  investor_id: string | null;
  partner_id: string | null;
  display_name: string;
  email: string | null;
  current_state: string | null;
  priority_score: number;
  recommended_channel: string | null;
  recommended_message_angle: string | null;
  recommended_next_action: string | null;
  queue_reason: string | null;
  last_computed_at: string;
}

export interface GenerateLinkPackConfig {
  campaignSlug?: string;
  appUrl?: string;
}

// ── 1. Log a click event ──────────────────────────────────────────────────────

export async function logClick(input: ClickEventInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = getClient();

    // Write telemetry row
    const { error: insertErr } = await db.from('knyt_tracking_click_events').insert({
      link_tag:        input.linkTag     ?? null,
      investor_id:     input.investorId  ?? null,
      partner_slug:    input.partnerSlug ?? null,
      utm_source:      input.utmSource   ?? null,
      utm_medium:      input.utmMedium   ?? null,
      utm_campaign:    input.utmCampaign ?? null,
      utm_content:     input.utmContent  ?? null,
      utm_term:        input.utmTerm     ?? null,
      ip_address:      input.ipAddress   ?? null,
      user_agent:      input.userAgent   ?? null,
      resolved_ks_url: input.resolvedKsUrl ?? null,
    });

    if (insertErr) {
      console.error('[knytTracking] logClick insert error:', insertErr.message);
      return { ok: false, error: insertErr.message };
    }

    // Increment denormalized counter on registry row (best-effort — non-blocking)
    if (input.linkTag) {
      db.rpc('increment_knyt_link_click_count', { p_tag_name: input.linkTag }).then().catch(() => {});
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[knytTracking] logClick unexpected error:', msg);
    return { ok: false, error: msg };
  }
}

// ── 2. Generate / refresh link registry entries ───────────────────────────────

export async function generateLinkPack(config: GenerateLinkPackConfig = {}): Promise<{
  ok: boolean;
  upserted: number;
  tags: string[];
  error?: string;
}> {
  const {
    campaignSlug = 'metaknyt-kickstarter-2026',
    appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-beta.aigentz.me',
  } = config;

  const COHORT_LINKS = [
    { tag_name: 'email_top_shelf',    channel: 'email',         owner_type: 'cohort', owner_key: 'top_shelf',    owner_name: 'Top Shelf Investors',  utm_medium: 'email',        utm_content: 'top_shelf' },
    { tag_name: 'email_zero_knyt',    channel: 'email',         owner_type: 'cohort', owner_key: 'zero_knyt',    owner_name: 'Zero KNYT Investors',  utm_medium: 'email',        utm_content: 'zero_knyt' },
    { tag_name: 'email_reactivation', channel: 'email',         owner_type: 'cohort', owner_key: 'reactivation', owner_name: 'Reactivation Cohort',  utm_medium: 'email',        utm_content: 'reactivation' },
    { tag_name: 'email_general',      channel: 'email',         owner_type: 'cohort', owner_key: 'cold',         owner_name: 'General List',         utm_medium: 'email',        utm_content: 'general' },
  ];

  const PARTNER_LINKS = [
    { slug: 'autonomys',           name: 'Autonomys' },
    { slug: 'fio_protocol',        name: 'Fio Protocol' },
    { slug: 'chaingpt',            name: 'ChainGPT' },
    { slug: 'lamina1',             name: 'Lamina1' },
    { slug: 'layerzero',           name: 'LayerZero' },
    { slug: 'project_liberty',     name: 'Project Liberty' },
    { slug: 'cryptomondays',       name: 'CryptoMondays / DAIA' },
    { slug: 'pal_capital',         name: 'PAL Capital' },
    { slug: 'distro',              name: 'Distro' },
    { slug: 'near',                name: 'NEAR' },
    { slug: 'polygon',             name: 'Polygon' },
    { slug: 'secret_network',      name: 'Secret Network' },
    { slug: 'decentralized_media', name: 'Decentralized Media' },
    { slug: 'horizen',             name: 'Horizen' },
    { slug: 'bitcoin_harlem',      name: 'Bitcoin Harlem' },
    { slug: 'pubkey',              name: 'PubKey' },
    { slug: 'qbit',                name: 'Qbit' },
    { slug: 'ethereum_foundation', name: 'Ethereum Foundation' },
  ].map((p) => ({
    tag_name:   `partner_${p.slug}`,
    channel:    'partner_email',
    owner_type: 'partner',
    owner_key:  p.slug,
    owner_name: p.name,
    utm_medium:  'partner_email',
    utm_content: `partner_${p.slug}`,
  }));

  const SURFACE_LINKS = [
    { tag_name: 'social_x',        channel: 'social_x',       owner_type: 'initiative', owner_key: 'social',   owner_name: 'X / Twitter Post', utm_medium: 'social',   utm_content: 'social_x' },
    { tag_name: 'social_linkedin',  channel: 'social',         owner_type: 'initiative', owner_key: 'social',   owner_name: 'LinkedIn Post',    utm_medium: 'social',   utm_content: 'social_linkedin' },
    { tag_name: 'runtime_cta',      channel: 'runtime',        owner_type: 'initiative', owner_key: 'runtime',  owner_name: 'Runtime CTA',      utm_medium: 'runtime',  utm_content: 'runtime' },
    { tag_name: 'codex_cta',        channel: 'knyt_cartridge', owner_type: 'initiative', owner_key: 'codex',    owner_name: 'Codex CTA',        utm_medium: 'codex',    utm_content: 'codex' },
    { tag_name: 'direct_outreach',  channel: 'direct',         owner_type: 'initiative', owner_key: 'direct',   owner_name: 'Direct Outreach',  utm_medium: 'direct',   utm_content: 'direct' },
    { tag_name: 'tasks_rewards',    channel: 'tasks_rewards',  owner_type: 'initiative', owner_key: 'tasks',    owner_name: 'Tasks & Rewards',  utm_medium: 'tasks',    utm_content: 'tasks_rewards' },
  ];

  const allLinks = [...COHORT_LINKS, ...PARTNER_LINKS, ...SURFACE_LINKS].map((l) => ({
    ...l,
    campaign_slug:        campaignSlug,
    utm_source:           'knyt_wheel',
    utm_campaign:         'knyt_wheel_launch',
    kickstarter_ref_tag:  '9pbmus',
    is_active:            true,
    updated_at:           new Date().toISOString(),
  }));

  try {
    const db = getClient();
    const { error } = await db
      .from('knyt_tracking_link_registry')
      .upsert(allLinks, { onConflict: 'tag_name', ignoreDuplicates: false });

    if (error) {
      return { ok: false, upserted: 0, tags: [], error: error.message };
    }

    return { ok: true, upserted: allLinks.length, tags: allLinks.map((l) => l.tag_name) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, upserted: 0, tags: [], error: msg };
  }
}

// ── 3. Health check ───────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthStatus> {
  const db = getClient();

  // Active link count + click stats
  const [linksResult, clicksResult, todayResult] = await Promise.all([
    db.from('knyt_tracking_link_registry').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('knyt_tracking_click_events').select('clicked_at').order('clicked_at', { ascending: false }).limit(1),
    db.from('knyt_tracking_click_events').select('id', { count: 'exact', head: true })
      .gte('clicked_at', new Date(Date.now() - 86_400_000).toISOString()),
  ]);

  // All-time count (separate query)
  const { count: allTime } = await db
    .from('knyt_tracking_click_events')
    .select('id', { count: 'exact', head: true });

  const lastClick = (clicksResult.data ?? [])[0]?.clicked_at ?? null;

  return {
    redirect_endpoint_ok: true,  // if this service is running, endpoint is up
    ga4_configured:       !!(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET),
    meta_configured:      !!(process.env.META_PIXEL_ID && process.env.META_CONVERSIONS_API_TOKEN),
    ks_url_configured:    !!(process.env.KICKSTARTER_CAMPAIGN_URL),
    webhook_configured:   !!(process.env.KNYT_WHEEL_WEBHOOK_URL),
    // Mailjet — reports presence only, never values
    mailjet_api_key:              !!(process.env.MAILJET_API_KEY),
    mailjet_secret_key:           !!(process.env.MAILJET_SECRET_KEY),
    mailjet_from_email:           !!(process.env.MAILJET_FROM_EMAIL),
    mailjet_template_top_shelf:   !!(process.env.MAILJET_TEMPLATE_TOP_SHELF),
    mailjet_template_zero_knyt:   !!(process.env.MAILJET_TEMPLATE_ZERO_KNYT),
    mailjet_template_reactivation:!!(process.env.MAILJET_TEMPLATE_REACTIVATION),
    mailjet_bcc_email:            !!(process.env.MAILJET_BCC_EMAIL),
    active_link_count:    linksResult.count ?? 0,
    clicks_today:         todayResult.count ?? 0,
    clicks_all_time:      allTime ?? 0,
    last_click_at:        lastClick,
  };
}

// ── 4. Compute follow-up queue ────────────────────────────────────────────────

/**
 * Scores investors and partners and writes the ranked follow-up queue.
 * Call this after each Make.com write-back batch or on a schedule.
 *
 * Investor score inputs:
 *   +40  investment_amount_band = '5000+'
 *   +25  investment_amount_band = '2000-4999'
 *   +15  investment_amount_band = '500-1999'
 *   +30  campaign_state = 'clicked'
 *   +20  campaign_state = 'opened'
 *   +10  campaign_state = 'sent'
 *   +20  is activated (linked persona)
 *   -50  campaign_state = 'backed' (remove from queue)
 *   -100 campaign_state = 'opted_out' (remove from queue)
 *
 * Partner score inputs (from partner_outreach table):
 *   +50  outreach_status = 'responded'
 *   +40  outreach_status = 'contacted'
 *   +30  outreach_status = 'pending'
 *   -100 outreach_status = 'declined'
 */
export async function computeFollowupQueue(): Promise<{ ok: boolean; written: number; error?: string }> {
  const db = getClient();

  try {
    // ── Investors ─────────────────────────────────────────────────────────────
    const { data: investors, error: invErr } = await db
      .from('nakamoto_knyt_personas')
      .select('id, "First-Name", "Last-Name", "Email", campaign_state, campaign_cohort, investment_amount_band, is_activated_knyt, preferred_channel_primary')
      .not('campaign_state', 'in', '("backed","opted_out")')
      .not('campaign_state', 'is', null);

    if (invErr) throw new Error(`Investor fetch: ${invErr.message}`);

    const investorRows = (investors ?? []).map((inv) => {
      const row = inv as Record<string, unknown>;
      const state  = (row['campaign_state'] as string | null) ?? '';
      const band   = (row['investment_amount_band'] as string | null) ?? '';
      const active = !!(row['is_activated_knyt'] as boolean | null);

      let score = 0;
      // Investment size
      if (band === '5000+')    score += 40;
      else if (band === '2000-4999') score += 25;
      else if (band === '500-1999')  score += 15;
      // Engagement signal
      if (state === 'clicked') score += 30;
      else if (state === 'opened') score += 20;
      else if (state === 'sent')   score += 10;
      // Activation
      if (active) score += 20;

      const cohort = (row['campaign_cohort'] as string | null) ?? '';
      let angle = 'general';
      if (cohort === 'top_shelf')    angle = 'equity';
      else if (cohort === 'zero_knyt')    angle = 'collectible';
      else if (cohort === 'reactivation') angle = 'community';

      const firstName = (row['First-Name'] as string | null) ?? '';
      const lastName  = (row['Last-Name']  as string | null) ?? '';

      return {
        entity_type:               'investor' as const,
        investor_id:               row['id'] as string,
        partner_id:                null,
        display_name:              `${firstName} ${lastName}`.trim() || (row['Email'] as string | null) || 'Unknown',
        email:                     (row['Email'] as string | null) ?? null,
        current_state:             state || null,
        priority_score:            score,
        recommended_channel:       (row['preferred_channel_primary'] as string | null) || 'email',
        recommended_message_angle: angle,
        recommended_next_action:   score >= 50 ? 'direct_outreach' : score >= 30 ? 'follow_up_email' : 'nurture_sequence',
        queue_reason:              `band=${band}, state=${state}`,
        last_computed_at:          new Date().toISOString(),
      };
    });

    // ── Partners ──────────────────────────────────────────────────────────────
    const { data: partners, error: partErr } = await db
      .from('partner_outreach')
      .select('id, partner_name, contact_email, outreach_status, outreach_channel, notes')
      .not('outreach_status', 'eq', 'declined');

    if (partErr) throw new Error(`Partner fetch: ${partErr.message}`);

    const partnerRows = (partners ?? []).map((p) => {
      const status = (p.outreach_status as string | null) ?? 'pending';
      let score = 0;
      if (status === 'responded') score += 50;
      else if (status === 'contacted') score += 40;
      else if (status === 'pending')   score += 30;
      else if (status === 'committed') score += 10;  // already committed — lower urgency

      return {
        entity_type:               'partner' as const,
        investor_id:               null,
        partner_id:                p.id as string,
        display_name:              p.partner_name as string,
        email:                     (p.contact_email as string | null) ?? null,
        current_state:             status,
        priority_score:            score,
        recommended_channel:       (p.outreach_channel as string | null) || 'email',
        recommended_message_angle: 'ecosystem',
        recommended_next_action:   status === 'responded' ? 'schedule_call' : status === 'contacted' ? 'follow_up' : 'initial_outreach',
        queue_reason:              `outreach_status=${status}`,
        last_computed_at:          new Date().toISOString(),
      };
    });

    const allRows = [...investorRows, ...partnerRows];
    if (allRows.length === 0) return { ok: true, written: 0 };

    // Upsert all at once
    const { error: upsertErr } = await db
      .from('knyt_followup_queue')
      .upsert(allRows, { onConflict: 'entity_type,investor_id' });

    if (upsertErr) throw new Error(`Upsert: ${upsertErr.message}`);

    return { ok: true, written: allRows.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[knytTracking] computeFollowupQueue error:', msg);
    return { ok: false, written: 0, error: msg };
  }
}

// ── 5. Get link registry ──────────────────────────────────────────────────────

export async function getLinkRegistry(options: {
  ownerType?: string;
  channel?: string;
  activeOnly?: boolean;
} = {}): Promise<TrackingLinkEntry[]> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-beta.aigentz.me';
  const db = getClient();

  let query = db.from('knyt_tracking_link_registry').select('*');
  if (options.activeOnly !== false) query = query.eq('is_active', true);
  if (options.ownerType) query = query.eq('owner_type', options.ownerType);
  if (options.channel)   query = query.eq('channel', options.channel);

  const { data, error } = await query.order('owner_type').order('tag_name');

  if (error) {
    console.error('[knytTracking] getLinkRegistry error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    redirect_url: `${appUrl}/api/crm/track/ks?tag=${row.tag_name}&utm_source=${row.utm_source}&utm_medium=${row.utm_medium}&utm_content=${row.utm_content ?? row.tag_name}`,
  })) as TrackingLinkEntry[];
}

// ── 6. Get follow-up queue ────────────────────────────────────────────────────

export async function getFollowupQueue(options: {
  entityType?: 'investor' | 'partner';
  limit?: number;
} = {}): Promise<FollowupEntry[]> {
  const db = getClient();

  let query = db
    .from('knyt_followup_queue')
    .select('*')
    .order('priority_score', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.entityType) query = query.eq('entity_type', options.entityType);

  const { data, error } = await query;

  if (error) {
    console.error('[knytTracking] getFollowupQueue error:', error.message);
    return [];
  }

  return (data ?? []) as FollowupEntry[];
}
