/**
 * POST /api/crm/webhooks/sendgrid
 *
 * SendGrid Event Webhook — receives batched open/click/bounce/unsubscribe
 * events and advances campaign_state on nakamoto_knyt_personas, then
 * triggers the signal steering engine exactly as the Marketa write-back does.
 *
 * Because the SendGrid adapter embeds `investor_id` and `sequence_id` as
 * custom_args in every personalization, each event arrives with those fields
 * pre-attached — no email → investor lookup needed in the common case.
 * Falls back to email lookup when custom_args are absent (e.g. test events).
 *
 * Auth: SENDGRID_WEBHOOK_SECRET (set in Amplify + SendGrid dashboard).
 * SendGrid sends the secret as a query param: ?secret=<value>
 * Leave unset in dev to skip auth (webhook logs a warning).
 *
 * Configure in SendGrid:
 *   Dashboard → Settings → Mail Settings → Event Webhook
 *   URL: https://dev-beta.aigentz.me/api/crm/webhooks/sendgrid?secret=<SENDGRID_WEBHOOK_SECRET>
 *   Events to enable: Open, Click, Bounce, Unsubscribe, Spam Report
 *
 * State machine (same rules as /api/crm/webhooks/marketa):
 *   open        → opened    (from unsent / sent)
 *   click       → clicked   (from unsent / sent / opened)
 *   unsubscribe → opted_out
 *   spamreport  → opted_out
 *   bounce      → no state change (logged, steering skipped)
 *   backed / opted_out → terminal, never changed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { steerSignal, type SteeringEvent } from '@/services/campaign/signalSteering';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

type SgEventType =
  | 'open' | 'click' | 'bounce' | 'unsubscribe' | 'spamreport'
  | 'delivered' | 'deferred' | 'dropped' | 'group_unsubscribe' | 'group_resubscribe';

interface SgEvent {
  event:      SgEventType;
  email:      string;
  timestamp:  number;
  // custom_args embedded by sendgridAdapter
  investor_id?: string;
  sequence_id?: string;
  // standard fields
  sg_message_id?: string;
  url?:           string;
  useragent?:     string;
  ip?:            string;
  reason?:        string;
}

// ── State machine ─────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['backed', 'opted_out']);

const EVENT_RULE: Record<string, { to: string; fromAllowed: Set<string> } | null> = {
  open:             { to: 'opened',   fromAllowed: new Set(['unsent', 'sent']) },
  click:            { to: 'clicked',  fromAllowed: new Set(['unsent', 'sent', 'opened']) },
  unsubscribe:      { to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  group_unsubscribe:{ to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  spamreport:       { to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  bounce:           null, // log only
};

const SG_TO_STEERING: Partial<Record<SgEventType, SteeringEvent>> = {
  open:              'opened',
  click:             'clicked',
  unsubscribe:       'opted_out',
  group_unsubscribe: 'opted_out',
  spamreport:        'opted_out',
  bounce:            'bounced',
};

// ── Investor ID resolution ────────────────────────────────────────────────────

async function resolveInvestorId(
  ev: SgEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<string | null> {
  // Fast path: custom_args already carry the ID
  if (ev.investor_id) return ev.investor_id;

  // Fallback: resolve via email
  if (!ev.email) return null;
  const { data } = await client
    .from('nakamoto_knyt_personas')
    .select('id')
    .ilike('"Email"', ev.email)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Event processor ───────────────────────────────────────────────────────────

async function processEvent(
  ev: SgEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<'advanced' | 'skipped' | 'error'> {
  const rule = EVENT_RULE[ev.event];

  // Events we don't act on (delivered, deferred, etc.)
  if (rule === undefined) return 'skipped';

  // Bounce — log only, no state change
  if (rule === null) {
    console.info(`[webhooks/sendgrid] bounce for ${ev.email} — no state change`);
    return 'skipped';
  }

  const investorId = await resolveInvestorId(ev, client);
  if (!investorId) {
    console.warn(`[webhooks/sendgrid] could not resolve investor for email ${ev.email}`);
    return 'skipped';
  }

  // Fetch current state
  const { data: current, error: fetchErr } = await client
    .from('nakamoto_knyt_personas')
    .select('campaign_state')
    .eq('id', investorId)
    .maybeSingle();

  if (fetchErr || !current) return 'skipped';

  const currentState = (current.campaign_state ?? 'unsent') as string;
  if (TERMINAL_STATES.has(currentState)) return 'skipped';
  if (!rule.fromAllowed.has(currentState)) return 'skipped';

  const updatePayload: Record<string, unknown> = { campaign_state: rule.to };
  if (ev.sequence_id) updatePayload.last_campaign_sequence = ev.sequence_id;

  const { error: updateErr } = await client
    .from('nakamoto_knyt_personas')
    .update(updatePayload)
    .eq('id', investorId);

  if (updateErr) {
    console.error(`[webhooks/sendgrid] update error for ${investorId}:`, updateErr.message);
    return 'error';
  }

  console.info(`[webhooks/sendgrid] ${investorId}: ${currentState} → ${rule.to} (${ev.event})`);

  // Steer signal — fire-and-forget
  const steeringEvent = SG_TO_STEERING[ev.event];
  if (steeringEvent) {
    void steerSignal(investorId, steeringEvent, ev.sequence_id).catch(
      (err) => console.warn('[webhooks/sendgrid] steerSignal failed:', err?.message ?? err)
    );
  }

  return 'advanced';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth — shared secret in query param (SendGrid's supported auth method)
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (secret) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[webhooks/sendgrid] SENDGRID_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let events: SgEvent[];
  try {
    events = await request.json();
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Expected a JSON array of events' }, { status: 400 });
    }
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
    if (result === 'advanced')  advanced++;
    else if (result === 'skipped') skipped++;
    else errors.push(`Error processing event for ${ev.email}`);
  }

  return NextResponse.json({
    processed: events.length,
    advanced,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
