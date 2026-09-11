/**
 * QubeTalk Communications Membrane — communications events (§16).
 *
 * QubeTalk EMITS events for the reward/Standing layer to consume; it never
 * computes a reward, Standing accrual, QriptoCENT, or $KNYT amount itself
 * (P14/N13) — this file has no such logic and never will. Insert-only,
 * best-effort (a logging failure must never break the underlying
 * conversational/publishing act it's reporting on) — same discipline as
 * peerChannel.ts's writePeerReceipt for consequential receipts, except
 * events are NOT receipts: they are lightweight, un-anchored, and exist
 * purely for downstream reward-policy consumption.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkEventType } from '@/types/qubetalk';

export async function emitQubeTalkEvent(
  eventType: QubeTalkEventType,
  subjectRef: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return;
    await admin.from('qubetalk_events').insert({ event_type: eventType, subject_ref: subjectRef, payload });
  } catch (err) {
    console.warn('[QubeTalk] event emit failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}
