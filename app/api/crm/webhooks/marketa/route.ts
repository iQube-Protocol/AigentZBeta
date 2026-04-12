/**
 * POST /api/crm/webhooks/marketa
 *
 * Make.com write-back webhook — receives open/click/bounce/unsubscribe
 * events and advances campaign_state on nakamoto_knyt_personas.
 *
 * Auth: Bearer token matching MARKETA_WEBHOOK_SECRET env var.
 * Configure this URL in your Make.com scenario's HTTP module response step.
 *
 * State machine (only advances, never downgrades):
 *   unsent / sent  + opened      → opened
 *   unsent / sent / opened + clicked → clicked
 *   any            + unsubscribed → opted_out
 *   any            + bounced      → state unchanged (logged only)
 *   backed / opted_out            → terminal, never changed
 *
 * Body — single event:
 *   {
 *     event:       'opened' | 'clicked' | 'bounced' | 'unsubscribed',
 *     investor_id: string,    // nakamoto_knyt_personas.id
 *     sequence_id?: string,   // which sequence triggered this
 *     channel?:    string,    // email | sms | telegram | …
 *     timestamp?:  string,    // ISO — defaults to now()
 *   }
 *
 * Body — batch (Make.com iterator output):
 *   { events: Array<above> }
 *
 * Returns:
 *   { processed: number, advanced: number, skipped: number, errors: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { steerSignal, type SteeringEvent } from '@/services/campaign/signalSteering';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

type MarketaEvent = 'opened' | 'clicked' | 'bounced' | 'unsubscribed';

interface WriteBackEvent {
  event: MarketaEvent;
  investor_id: string;
  sequence_id?: string;
  channel?: string;
  timestamp?: string;
}

// ── State machine ─────────────────────────────────────────────────────────────

// Terminal states that can never be overwritten
const TERMINAL_STATES = new Set(['backed', 'opted_out']);

// Which states each event is allowed to advance FROM
const CAN_ADVANCE_TO: Record<MarketaEvent, { to: string; fromAllowed: Set<string> } | null> = {
  opened:       { to: 'opened',    fromAllowed: new Set(['unsent', 'sent']) },
  clicked:      { to: 'clicked',   fromAllowed: new Set(['unsent', 'sent', 'opened']) },
  unsubscribed: { to: 'opted_out', fromAllowed: new Set(['unsent', 'sent', 'opened', 'clicked']) },
  bounced:      null,  // no state change — logged only
};

// ── Handler ───────────────────────────────────────────────────────────────────

async function processEvent(
  ev: WriteBackEvent,
  client: ReturnType<typeof getCrmClient>
): Promise<'advanced' | 'skipped' | 'error'> {
  const { event, investor_id, sequence_id, timestamp } = ev;

  const rule = CAN_ADVANCE_TO[event];
  if (!rule) {
    // bounced — log only
    console.info(`[webhooks/marketa] bounced event for ${investor_id} — no state change`);
    return 'skipped';
  }

  // Fetch current state
  const { data: current, error: fetchErr } = await client
    .from('nakamoto_knyt_personas')
    .select('campaign_state, last_campaign_sequence')
    .eq('id', investor_id)
    .maybeSingle();

  if (fetchErr) {
    console.error(`[webhooks/marketa] fetch error for ${investor_id}:`, fetchErr.message);
    return 'error';
  }
  if (!current) {
    console.warn(`[webhooks/marketa] investor not found: ${investor_id}`);
    return 'skipped';
  }

  const currentState = (current.campaign_state ?? 'unsent') as string;

  // Never overwrite terminal states
  if (TERMINAL_STATES.has(currentState)) return 'skipped';

  // Only advance if current state is in the allowed set
  if (!rule.fromAllowed.has(currentState)) return 'skipped';

  const updatePayload: Record<string, unknown> = {
    campaign_state: rule.to,
  };
  if (sequence_id) {
    updatePayload.last_campaign_sequence = sequence_id;
  }

  const { error: updateErr } = await client
    .from('nakamoto_knyt_personas')
    .update(updatePayload)
    .eq('id', investor_id);

  if (updateErr) {
    console.error(`[webhooks/marketa] update error for ${investor_id}:`, updateErr.message);
    return 'error';
  }

  console.info(
    `[webhooks/marketa] ${investor_id}: ${currentState} → ${rule.to}` +
    (sequence_id ? ` (${sequence_id})` : '') +
    (timestamp ? ` at ${timestamp}` : '')
  );

  // Steer signal asynchronously — updates offer_fit, message_angle, follow-up queue.
  // Map Marketa event names to SteeringEvent (unsubscribed → opted_out).
  const steeringEventMap: Record<MarketaEvent, SteeringEvent> = {
    opened:       'opened',
    clicked:      'clicked',
    unsubscribed: 'opted_out',
    bounced:      'bounced',
  };
  void steerSignal(investor_id, steeringEventMap[event], sequence_id).catch(
    (err) => console.warn('[webhooks/marketa] steerSignal failed (non-blocking):', err?.message ?? err)
  );

  return 'advanced';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const secret = process.env.MARKETA_WEBHOOK_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[webhooks/marketa] MARKETA_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Normalise to array — accept both single event and batch
  let events: WriteBackEvent[];
  if (
    body &&
    typeof body === 'object' &&
    'events' in (body as object) &&
    Array.isArray((body as Record<string, unknown>).events)
  ) {
    events = (body as { events: WriteBackEvent[] }).events;
  } else if (
    body &&
    typeof body === 'object' &&
    'event' in (body as object) &&
    'investor_id' in (body as object)
  ) {
    events = [body as WriteBackEvent];
  } else {
    return NextResponse.json(
      { error: 'Body must be a single event object or { events: [...] }' },
      { status: 400 }
    );
  }

  if (events.length === 0) {
    return NextResponse.json({ processed: 0, advanced: 0, skipped: 0, errors: [] });
  }

  const client = getCrmClient();
  let advanced = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process sequentially — state reads must reflect prior writes in this batch
  for (const ev of events) {
    if (!ev.investor_id || !ev.event) {
      errors.push(`Invalid event entry: ${JSON.stringify(ev)}`);
      continue;
    }
    const result = await processEvent(ev, client);
    if (result === 'advanced') advanced++;
    else if (result === 'skipped') skipped++;
    else errors.push(`Error processing investor ${ev.investor_id}`);
  }

  return NextResponse.json({
    processed: events.length,
    advanced,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
