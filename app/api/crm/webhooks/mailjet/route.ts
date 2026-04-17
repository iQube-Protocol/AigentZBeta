/**
 * POST /api/crm/webhooks/mailjet
 *
 * Mailjet Event API webhook — receives batched open/click/bounce/unsub
 * events and advances campaign_state on nakamoto_knyt_personas, then
 * triggers the signal steering engine.
 *
 * Also updates ks_backers_staging.engagement_status / suppression_status
 * for KS Prospect contacts who are not in nakamoto_knyt_personas.
 *
 * Attribution uses the `CustomID` field embedded by the Mailjet adapter:
 *   format: "<investor_id>|<sequence_id>"          — nakamoto_knyt_personas
 *   format: "stg_<staging_id>|<email_number>"      — ks_backers_staging
 * When CustomID is absent, falls back to email → both tables.
 *
 * Auth: shared secret as a query param (Mailjet's supported method):
 *   ?secret=<MAILJET_WEBHOOK_SECRET>
 * Set the same secret in Amplify and in your Mailjet Event API URL.
 *
 * Configure in Mailjet:
 *   Account → Event Tracking (Triggers) → Add endpoint
 *   URL: https://dev-beta.aigentz.me/api/crm/webhooks/mailjet?secret=<MAILJET_WEBHOOK_SECRET>
 *   Events: open, click, bounce, spam, unsub
 *
 * Mailjet event types handled:
 *   open    → opened    (from unsent / sent)
 *   click   → clicked   (from unsent / sent / opened)
 *   bounce  → suppressed in staging; log only in personas
 *   blocked → log only
 *   spam    → opted_out / suppressed
 *   unsub   → opted_out / suppressed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { steerSignal, type SteeringEvent } from '@/services/campaign/signalSteering';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MjEvent {
  event:      string;   // open | click | bounce | spam | unsub | blocked | sent
  email:      string;
  time:       number;
  CustomID?:  string;   // "<investor_id>|<sequence_id>" — set by mailjetAdapter
  MessageID?: number;
  url?:       string;   // present on click events
  error_code?: string;
  source?:    string;
}

// ── State machine ─────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['backed', 'opted_out']);

const EVENT_RULE: Record<string, { to: string; fromAllowed: Set<string> } | null> = {
  // open and click only advance state if we already sent to this investor
  // (i.e. state is 'sent' or higher). Allowing 'unsent' would pick up opens
  // from unrelated Mailjet campaigns sent outside our system.
  open:    { to: 'opened',    fromAllowed: new Set(['sent']) },
  click:   { to: 'clicked',   fromAllowed: new Set(['sent', 'opened']) },
  spam:    { to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  unsub:   { to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  bounce:  null,  // log only
  blocked: null,  // log only
};

const MJ_TO_STEERING: Record<string, SteeringEvent> = {
  open:    'opened',
  click:   'clicked',
  spam:    'opted_out',
  unsub:   'opted_out',
  bounce:  'bounced',
  blocked: 'bounced',
};

// ── ID resolution ─────────────────────────────────────────────────────────────

type CustomIdKind = 'investor' | 'staging' | 'unknown';

function parseCustomId(customId: string | undefined): {
  kind: CustomIdKind;
  id: string | null;
  sequenceId: string | null;
} {
  if (!customId) return { kind: 'unknown', id: null, sequenceId: null };
  const parts = customId.split('|');
  if (parts[0]?.startsWith('stg_')) {
    return { kind: 'staging', id: parts[0].slice(4) || null, sequenceId: parts[1] || null };
  }
  return { kind: 'investor', id: parts[0] || null, sequenceId: parts[1] || null };
}

async function resolveInvestorId(
  ev: MjEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<{ investorId: string | null; sequenceId: string | null }> {
  const parsed = parseCustomId(ev.CustomID);
  // CustomID explicitly targets an investor record
  if (parsed.kind === 'investor' && parsed.id) {
    return { investorId: parsed.id, sequenceId: parsed.sequenceId };
  }
  // CustomID targets staging — skip investor resolution
  if (parsed.kind === 'staging') {
    return { investorId: null, sequenceId: parsed.sequenceId };
  }
  // No CustomID — fall back to email lookup in personas
  if (!ev.email) return { investorId: null, sequenceId: null };
  const { data } = await client
    .from('nakamoto_knyt_personas')
    .select('id')
    .ilike('"Email"', ev.email)
    .maybeSingle();
  return { investorId: data?.id ?? null, sequenceId: null };
}

// ── Staging engagement tracking ───────────────────────────────────────────────

// Engagement transitions applied to ks_backers_staging
const STAGING_ENGAGEMENT: Record<string, string> = {
  open:    'opened',
  click:   'clicked',
  bounce:  'bounced',
  spam:    'opted_out',
  unsub:   'opted_out',
};

const STAGING_SUPPRESS = new Set(['bounce', 'spam', 'unsub']);

async function updateStagingById(
  id: string,
  eventType: string,
  client: ReturnType<typeof getCrmClient>
): Promise<void> {
  const newEngagement = STAGING_ENGAGEMENT[eventType];
  if (!newEngagement) return;

  const patch: Record<string, unknown> = {
    engagement_status: newEngagement,
    last_event_at: new Date().toISOString(),
  };
  if (STAGING_SUPPRESS.has(eventType)) patch.suppression_status = 'suppressed';

  await client.from('ks_backers_staging').update(patch).eq('id', id);
}

async function updateStagingByEmail(
  email: string,
  eventType: string,
  client: ReturnType<typeof getCrmClient>
): Promise<boolean> {
  const newEngagement = STAGING_ENGAGEMENT[eventType];
  if (!newEngagement) return false;

  const { data } = await client
    .from('ks_backers_staging')
    .select('id, suppression_status')
    .eq('normalized_email', email.toLowerCase())
    .eq('suppression_status', 'active')
    .maybeSingle();

  if (!data) return false;

  const patch: Record<string, unknown> = {
    engagement_status: newEngagement,
    last_event_at: new Date().toISOString(),
  };
  if (STAGING_SUPPRESS.has(eventType)) patch.suppression_status = 'suppressed';

  await client.from('ks_backers_staging').update(patch).eq('id', data.id);
  return true;
}

// ── Event processor ───────────────────────────────────────────────────────────

async function processEvent(
  ev: MjEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<'advanced' | 'skipped' | 'error'> {
  const rule = EVENT_RULE[ev.event];
  if (rule === undefined) return 'skipped';

  // ── Staging fast path: CustomID = "stg_<id>|<email_number>" ──────────────
  const parsed = parseCustomId(ev.CustomID);
  if (parsed.kind === 'staging' && parsed.id) {
    await updateStagingById(parsed.id, ev.event, client);
    console.info(`[webhooks/mailjet] staging ${parsed.id}: ${ev.event}`);
    return 'advanced';
  }

  // ── Log-only events (bounce, blocked) for investor path ──────────────────
  if (rule === null) {
    // Still suppress in staging if we can resolve by email
    if (ev.email && STAGING_SUPPRESS.has(ev.event)) {
      await updateStagingByEmail(ev.email, ev.event, client);
    }
    console.info(`[webhooks/mailjet] ${ev.event} for ${ev.email} — no persona state change`);
    return 'skipped';
  }

  // ── Investor path ─────────────────────────────────────────────────────────
  const { investorId, sequenceId } = await resolveInvestorId(ev, client);

  if (!investorId) {
    // Not a known investor — try staging by email as fallback
    if (ev.email) {
      const updated = await updateStagingByEmail(ev.email, ev.event, client);
      if (updated) {
        console.info(`[webhooks/mailjet] staging fallback: ${ev.event} for ${ev.email}`);
        return 'advanced';
      }
    }
    console.warn(`[webhooks/mailjet] could not resolve record for ${ev.email}`);
    return 'skipped';
  }

  // Fetch current persona state
  const { data: current, error: fetchErr } = await client
    .from('nakamoto_knyt_personas')
    .select('campaign_state')
    .eq('id', investorId)
    .maybeSingle();

  if (fetchErr || !current) return 'skipped';

  const currentState = (current.campaign_state ?? 'unsent') as string;
  if (TERMINAL_STATES.has(currentState))   return 'skipped';
  if (!rule.fromAllowed.has(currentState)) return 'skipped';

  const updatePayload: Record<string, unknown> = { campaign_state: rule.to };
  if (sequenceId) updatePayload.last_campaign_sequence = sequenceId;

  const { error: updateErr } = await client
    .from('nakamoto_knyt_personas')
    .update(updatePayload)
    .eq('id', investorId);

  if (updateErr) {
    console.error(`[webhooks/mailjet] update error for ${investorId}:`, updateErr.message);
    return 'error';
  }

  console.info(
    `[webhooks/mailjet] ${investorId}: ${currentState} → ${rule.to} (${ev.event})` +
    (sequenceId ? ` seq=${sequenceId}` : '')
  );

  const steeringEvent = MJ_TO_STEERING[ev.event];
  if (steeringEvent) {
    void steerSignal(investorId, steeringEvent, sequenceId ?? undefined).catch(
      (err) => console.warn('[webhooks/mailjet] steerSignal failed:', err?.message ?? err)
    );
  }

  return 'advanced';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth — shared secret in query param
  const secret = process.env.MAILJET_WEBHOOK_SECRET;
  if (secret) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[webhooks/mailjet] MAILJET_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let events: MjEvent[];
  try {
    const body = await request.json();
    // Mailjet sends either a single event object or an array
    events = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (events.length === 0) {
    return NextResponse.json({ processed: 0, advanced: 0, skipped: 0 });
  }

  const client = getCrmClient();
  let advanced = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const ev of events) {
    if (!ev.event) { skipped++; continue; }
    const result = await processEvent(ev, client);
    if (result === 'advanced')     advanced++;
    else if (result === 'skipped') skipped++;
    else errors.push(`Error processing ${ev.event} for ${ev.email}`);
  }

  return NextResponse.json({
    processed: events.length,
    advanced,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
