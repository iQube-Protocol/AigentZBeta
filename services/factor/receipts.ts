/**
 * recordFactorReceipt — the ONE place Factor/Aegis/MoneyPenny-admission code
 * writes a constitutional observer/audit receipt.
 *
 * Reuses `public.orchestration_events` (this worktree's existing generic,
 * RLS'd, receipt-eligible event ledger — see
 * supabase/migrations/20260402000000_experience_model_journey_state.sql)
 * rather than introducing a parallel `constitutional_activity_receipts`
 * table, per PRD §7 "Do not duplicate an existing source of truth" and
 * CLAUDE.md's "Extend, Don't Duplicate".
 *
 * Every metadata field here MUST already be T2-safe (a *_ref commitment,
 * never a raw persona_id) — callers pass already-derived refs
 * (services/factor/identityRefs.ts), this function does not derive them,
 * so a caller cannot accidentally rely on this function to "launder" a raw
 * id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { assertNotRawPersonaId } from './identityRefs';

export interface RecordFactorReceiptInput {
  eventType: string;
  caseId?: string;
  assessmentId?: string;
  actorPersonaRef: string;
  fromRole?: string;
  toRole?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function recordFactorReceipt(admin: SupabaseClient, input: RecordFactorReceiptInput): Promise<void> {
  assertNotRawPersonaId(input.actorPersonaRef, 'recordFactorReceipt.actorPersonaRef');

  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    actorPersonaRef: input.actorPersonaRef,
    caseId: input.caseId ?? null,
    assessmentId: input.assessmentId ?? null,
    domain: 'factor-aegis-0.1',
  };

  const { error } = await admin.from('orchestration_events').insert({
    event_id: randomUUID(),
    event_type: input.eventType,
    from_role: input.fromRole ?? 'factor',
    to_role: input.toRole ?? 'system',
    reason: input.reason ?? null,
    journey_stage: null,
    active_cartridge: 'moneypenny',
    receipt_eligible: true,
    metadata,
  });
  if (error) {
    // A receipt-write failure must never silently vanish (DVN Pipeline
    // Protection posture, applied here even though this worktree predates
    // the [DVN ESCALATION] prefix convention) — surface it to the caller
    // rather than swallowing it, so a failed constitutional receipt fails
    // the operation that tried to produce it.
    throw new Error(`recordFactorReceipt failed to write orchestration_events: ${error.message}`);
  }
}
