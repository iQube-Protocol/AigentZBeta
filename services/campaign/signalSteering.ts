/**
 * KNYT Wheel — Signal Steering Engine
 *
 * Called after every Make.com write-back event (open / click / unsubscribe).
 * Given an investor ID and the event type, this engine:
 *
 *   1. Derives an updated `offer_fit` and `message_angle` for the investor
 *      based on their current cohort + the engagement signal received.
 *   2. Writes those fields back to `nakamoto_knyt_personas`.
 *   3. Upserts the investor into `knyt_followup_queue` with a freshly
 *      computed urgency score and recommended next action.
 *      For terminal events (backed, opted_out) the queue entry is removed.
 *
 * Scoring weights (max 100):
 *   clicked        → base 60
 *   opened         → base 35
 *   bounced        → base  5  (log; no queue upsert)
 *   activated      → +15
 *   band 5000+     → +20
 *   band 2000–4999 → +12
 *   band 500–1999  → +6
 */

import { getCrmClient } from '@/services/crm/crmDataAccess';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SteeringEvent = 'opened' | 'clicked' | 'backed' | 'opted_out' | 'bounced';

export interface SteeringResult {
  investorId: string;
  updated: boolean;
  new_offer_fit: string | null;
  new_message_angle: string | null;
  new_priority_score: number;
  recommended_next_action: string;
  recommended_channel: string;
}

// ── Derivation helpers ────────────────────────────────────────────────────────

function deriveOfferFit(cohort: string | null, event: SteeringEvent): string | null {
  if (event === 'backed' || event === 'opted_out') return null;
  if (cohort === 'top_shelf')    return 'top_shelf';
  if (cohort === 'zero_knyt')    return 'zero_knyt';
  if (event === 'clicked')       return 'top_shelf'; // Upgrade signal
  return 'general';
}

function deriveMessageAngle(offerFit: string | null, event: SteeringEvent): string {
  if (event === 'clicked')         return 'equity';
  if (offerFit === 'top_shelf')    return 'equity';
  if (offerFit === 'zero_knyt')    return 'collectible';
  return 'community';
}

function computeUrgencyScore(
  event: SteeringEvent,
  isActivated: boolean,
  band: string | null
): number {
  const base: Record<SteeringEvent, number> = {
    clicked:   60,
    opened:    35,
    bounced:    5,
    backed:     0,
    opted_out:  0,
  };
  let score = base[event] ?? 0;
  if (isActivated)        score += 15;
  if (band === '5000+')   score += 20;
  else if (band === '2000-4999') score += 12;
  else if (band === '500-1999')  score +=  6;
  return Math.min(score, 100);
}

function recommendNextAction(event: SteeringEvent, offerFit: string | null): string {
  if (event === 'clicked')   return 'Personal follow-up within 24 h — high intent signal';
  if (event === 'opened')    return 'Send follow-up sequence with stronger CTA';
  if (event === 'bounced')   return 'Verify email validity and try alternate channel';
  return 'Monitor for next signal';
}

function recommendChannel(
  event: SteeringEvent,
  preferred: string | null,
  isActivated: boolean
): string {
  if (event === 'clicked' && isActivated) return 'in_app';
  return preferred ?? 'email';
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function steerSignal(
  investorId: string,
  event: SteeringEvent,
  sequenceId?: string
): Promise<SteeringResult> {
  const noop = (reason: string): SteeringResult => ({
    investorId,
    updated: false,
    new_offer_fit: null,
    new_message_angle: null,
    new_priority_score: 0,
    recommended_next_action: reason,
    recommended_channel: 'email',
  });

  const client = getCrmClient();

  // ── Fetch investor record ─────────────────────────────────────────────────
  const { data: inv } = await client
    .from('nakamoto_knyt_personas')
    .select('id, "Email", "First-Name", "Last-Name", campaign_cohort, campaign_state, investment_amount_band, preferred_channel_primary')
    .eq('id', investorId)
    .maybeSingle();

  if (!inv) return noop('Investor not found');

  const row         = inv as Record<string, unknown>;
  const cohort      = row['campaign_cohort']          as string | null;
  const band        = row['investment_amount_band']   as string | null;
  const email       = row['Email']                    as string | null;
  const firstName   = row['First-Name']               as string | null;
  const lastName    = row['Last-Name']                as string | null;
  const preferred   = row['preferred_channel_primary'] as string | null;
  const displayName = `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || investorId;

  // ── Derive activation (crm_personas fast check) ────────────────────────────
  let isActivated = false;
  if (email) {
    const { data: crmRow } = await client
      .from('crm_personas')
      .select('identity_persona_id')
      .ilike('email', email)
      .not('identity_persona_id', 'is', null)
      .maybeSingle();
    isActivated = !!crmRow;
  }

  // ── Compute steering fields ───────────────────────────────────────────────
  const offerFit      = deriveOfferFit(cohort, event);
  const messageAngle  = deriveMessageAngle(offerFit, event);
  const priorityScore = computeUrgencyScore(event, isActivated, band);
  const nextAction    = recommendNextAction(event, offerFit);
  const channel       = recommendChannel(event, preferred, isActivated);

  // ── Write back offer_fit + message_angle ──────────────────────────────────
  if (event !== 'backed' && event !== 'opted_out') {
    await client
      .from('nakamoto_knyt_personas')
      .update({ offer_fit: offerFit, message_angle: messageAngle })
      .eq('id', investorId);
  }

  // ── Update follow-up queue ────────────────────────────────────────────────
  const isTerminal = event === 'backed' || event === 'opted_out';

  if (isTerminal) {
    // Remove from queue — no further follow-up needed
    await client
      .from('knyt_followup_queue')
      .delete()
      .eq('entity_type', 'investor')
      .eq('investor_id', investorId);
  } else if (event !== 'bounced') {
    // Upsert queue entry with fresh score
    await client
      .from('knyt_followup_queue')
      .upsert(
        {
          entity_type:               'investor',
          investor_id:               investorId,
          display_name:              displayName,
          email:                     email ?? null,
          current_state:             row['campaign_state'] as string | null,
          priority_score:            priorityScore,
          recommended_channel:       channel,
          recommended_message_angle: messageAngle,
          recommended_next_action:   nextAction,
          queue_reason:              `${event} signal${sequenceId ? ` from ${sequenceId}` : ''}`,
          last_computed_at:          new Date().toISOString(),
        },
        { onConflict: 'entity_type,investor_id' }
      );
  }

  console.info(
    `[signalSteering] ${investorId} — ${event} → ` +
    `offer_fit=${offerFit ?? 'n/a'} angle=${messageAngle} score=${priorityScore}`
  );

  return {
    investorId,
    updated:               true,
    new_offer_fit:         offerFit,
    new_message_angle:     messageAngle,
    new_priority_score:    priorityScore,
    recommended_next_action: nextAction,
    recommended_channel:   channel,
  };
}
