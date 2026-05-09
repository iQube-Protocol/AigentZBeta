/**
 * Orchestration event emission service.
 * Emits structured events whenever orchestration roles switch.
 * Events are DVN receipt-eligible when receipt_eligible=true.
 *
 * Epic 1 — AGT-106
 */

import { createClient } from '@supabase/supabase-js';
import type { OrchestrationEvent } from '@/types/orchestration';

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!serviceKey && anonKey) {
    // Anon key + RLS = receipts dropped silently. Surface this once
    // per Lambda cold start so it shows up in CloudWatch.
    if (!loggedMissingServiceKey) {
      loggedMissingServiceKey = true;
      console.error(
        '[orchestrationEvents] SUPABASE_SERVICE_ROLE_KEY is missing — ' +
          'falling back to anon key. RLS will block receipt writes.',
      );
    }
  }
  const key = serviceKey || anonKey;
  return createClient(url, key, { auth: { persistSession: false } });
}
let loggedMissingServiceKey = false;

/**
 * Emit an orchestration event. Fire-and-forget — callers should void this.
 * Logs to orchestration_events table if available; silently succeeds otherwise.
 */
export async function emitOrchestrationEvent(event: OrchestrationEvent): Promise<void> {
  try {
    const db = getDb();
    // Phase 3.2 — pull T2 attribution out of metadata into top-level
    // columns so the receipt batcher can index on them without parsing
    // JSON. Falls back gracefully if the columns don't exist (column-
    // additive migration is idempotent and may not have run yet).
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const aliasCommitment = typeof meta.actor_alias_commitment === 'string'
      ? meta.actor_alias_commitment
      : null;
    const cohortId = typeof meta.cohort_id === 'string'
      ? meta.cohort_id
      : null;
    const receiptMode = typeof meta.receipt_mode === 'string'
      ? meta.receipt_mode
      : null;

    const { error } = await db.from('orchestration_events').insert({
      event_id: event.event_id,
      event_type: event.event_type,
      from_role: event.from_role,
      to_role: event.to_role,
      reason: event.reason,
      journey_stage: event.journey_stage,
      active_cartridge: event.active_cartridge,
      active_codex: event.active_codex,
      receipt_eligible: event.receipt_eligible,
      metadata: event.metadata,
      created_at: event.timestamp,
      actor_alias_commitment: aliasCommitment,
      cohort_id: cohortId,
      receipt_mode: receiptMode,
    });
    if (error) {
      // Surface the error — silent failures here mean receipts are
      // dropped silently, which violates the durability contract.
      console.error('[orchestrationEvents] insert failed', {
        event_id: event.event_id,
        event_type: event.event_type,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
  } catch (e) {
    console.error('[orchestrationEvents] threw', e);
  }
}

/**
 * Retrieve recent orchestration events for the debug view (AGT-104).
 */
export async function getRecentOrchestrationEvents(
  options: { limit?: number; journey_stage?: string } = {}
): Promise<OrchestrationEvent[]> {
  const db = getDb();
  let query = db
    .from('orchestration_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 20);

  if (options.journey_stage) {
    query = query.eq('journey_stage', options.journey_stage);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    event_id: String(row.event_id),
    timestamp: String(row.created_at),
    event_type: row.event_type,
    from_role: row.from_role,
    to_role: row.to_role,
    reason: String(row.reason ?? ''),
    journey_stage: row.journey_stage,
    active_cartridge: row.active_cartridge ?? null,
    active_codex: row.active_codex ?? null,
    receipt_eligible: Boolean(row.receipt_eligible),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }));
}
