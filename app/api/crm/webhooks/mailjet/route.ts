/**
 * POST /api/crm/webhooks/mailjet
 *
 * Mailjet Event API webhook — receives batched open/click/bounce/unsub
 * events and advances campaign_state on nakamoto_knyt_personas, then
 * triggers the signal steering engine.
 *
 * Attribution uses the `CustomID` field embedded by the Mailjet adapter:
 *   format: "<investor_id>|<sequence_id>"
 * When CustomID is absent, falls back to email → nakamoto lookup.
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
 *   bounce  → log only
 *   blocked → log only
 *   spam    → opted_out
 *   unsub   → opted_out
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

// ── Investor ID resolution ────────────────────────────────────────────────────

function parseCustomId(customId: string | undefined): { investorId: string | null; sequenceId: string | null } {
  if (!customId) return { investorId: null, sequenceId: null };
  const parts = customId.split('|');
  return {
    investorId: parts[0] || null,
    sequenceId: parts[1] || null,
  };
}

async function resolveInvestorId(
  ev: MjEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<{ investorId: string | null; sequenceId: string | null }> {
  // Fast path: CustomID carries investor_id|sequence_id
  const parsed = parseCustomId(ev.CustomID);
  if (parsed.investorId) return parsed;

  // Fallback: resolve via email
  if (!ev.email) return { investorId: null, sequenceId: null };
  const { data } = await client
    .from('nakamoto_knyt_personas')
    .select('id')
    .ilike('"Email"', ev.email)
    .maybeSingle();
  return { investorId: data?.id ?? null, sequenceId: null };
}

// ── Event processor ───────────────────────────────────────────────────────────

async function processEvent(
  ev: MjEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<'advanced' | 'skipped' | 'error'> {
  const rule = EVENT_RULE[ev.event];

  // Unknown or no-op event types
  if (rule === undefined) return 'skipped';

  // Log-only events (bounce, blocked)
  if (rule === null) {
    console.info(`[webhooks/mailjet] ${ev.event} for ${ev.email} — no state change`);
    return 'skipped';
  }

  const { investorId, sequenceId } = await resolveInvestorId(ev, client);
  if (!investorId) {
    console.warn(`[webhooks/mailjet] could not resolve investor for ${ev.email}`);
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
  if (TERMINAL_STATES.has(currentState))      return 'skipped';
  if (!rule.fromAllowed.has(currentState))     return 'skipped';

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

  // Steer signal — fire-and-forget
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
