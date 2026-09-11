/**
 * companion_captured_objects — persistence mapping layer.
 *
 * PRD-MMC-IMPL-003 Increment 2 (server-side ingest/list/assign routes). See:
 * codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-003-companion-phase4-capture-implementation-plan.md §2.
 *
 * This module ONLY translates between DB rows and `CapturedObjectRecord`
 * (`types/companionCapture.ts`). It contains no consent logic
 * (`assertCaptureRespectsGrants`, `services/companion/captureConsent.ts`,
 * Increment 1, remains the single choke point for that) and no destination
 * constructor logic (the assign route composes `createIntentQube`/
 * `createVentureQube` directly — this file only reads/writes the capture
 * row itself).
 *
 * Mirrors `app/api/companion/observer/_lib/store.ts`'s exact shape: a real
 * Supabase client call against `companion_captured_objects`
 * (`supabase/migrations/20260818000000_companion_captured_objects.sql`,
 * not yet applied by the operator — same "correct and ready the moment the
 * migration runs" precedent).
 *
 * T0 discipline: every read/write here is scoped by `persona_id` (T0,
 * server-internal only — never returned to a caller). The mapped
 * `CapturedObjectRecord` rows carry no persona identifier at all, per
 * `types/companionCapture.ts`'s own tier-law header.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CaptureAssignDestination,
  CaptureSourceKind,
  CapturedObject,
  CapturedObjectRecord,
  CapturedObjectStatus,
} from '@/types/companionCapture';

export const COMPANION_CAPTURED_OBJECTS_TABLE = 'companion_captured_objects';

interface CaptureRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  title: string | null;
  content_text: string;
  captured_at: string;
  status: string;
  assigned_destination: string | null;
  assigned_ref_id: string | null;
}

function rowToRecord(row: CaptureRow): CapturedObjectRecord {
  return {
    id: row.id,
    sourceKind: row.source_kind as CaptureSourceKind,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.title ? { title: row.title } : {}),
    contentText: row.content_text,
    capturedAt: row.captured_at,
    status: row.status as CapturedObjectStatus,
    ...(row.assigned_destination ? { assignedDestination: row.assigned_destination as CaptureAssignDestination } : {}),
    ...(row.assigned_ref_id ? { assignedRefId: row.assigned_ref_id } : {}),
  };
}

/**
 * Insert a new capture row, always `status: 'inbox'` (PRD-MMC-IMPL-003
 * §0.3's Workspace-as-universal-landing decision — there is no "create
 * directly assigned" path). Returns the T1-safe record or an error string.
 */
export async function insertCapturedObject(
  admin: SupabaseClient,
  personaId: string,
  capture: CapturedObject,
): Promise<{ record: CapturedObjectRecord | null; error: string | null }> {
  const { data, error } = await admin
    .from(COMPANION_CAPTURED_OBJECTS_TABLE)
    .insert({
      persona_id: personaId,
      source_kind: capture.sourceKind,
      source_url: capture.sourceUrl ?? null,
      title: capture.title ?? null,
      content_text: capture.contentText ?? '',
      captured_at: capture.capturedAt,
      status: 'inbox',
    })
    .select('id, source_kind, source_url, title, content_text, captured_at, status, assigned_destination, assigned_ref_id')
    .single();

  if (error || !data) return { record: null, error: error?.message ?? 'insert failed' };
  return { record: rowToRecord(data as CaptureRow), error: null };
}

/** List a persona's captures, newest first. Scoped by `persona_id` —
 *  never a raw, unscoped table read. */
export async function listCapturedObjects(
  admin: SupabaseClient,
  personaId: string,
): Promise<CapturedObjectRecord[]> {
  const { data, error } = await admin
    .from(COMPANION_CAPTURED_OBJECTS_TABLE)
    .select('id, source_kind, source_url, title, content_text, captured_at, status, assigned_destination, assigned_ref_id')
    .eq('persona_id', personaId)
    .order('captured_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return (data as CaptureRow[]).map(rowToRecord);
}

/** Load one capture row, scoped to the owning persona — returns null if it
 *  doesn't exist OR isn't owned by this persona (never distinguishes the
 *  two to the caller; both are "not found" from this persona's view). */
export async function getCapturedObjectForPersona(
  admin: SupabaseClient,
  personaId: string,
  captureId: string,
): Promise<CapturedObjectRecord | null> {
  const { data, error } = await admin
    .from(COMPANION_CAPTURED_OBJECTS_TABLE)
    .select('id, source_kind, source_url, title, content_text, captured_at, status, assigned_destination, assigned_ref_id')
    .eq('persona_id', personaId)
    .eq('id', captureId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToRecord(data as CaptureRow);
}

/** Mark a capture row assigned to a destination. Only transitions rows
 *  currently in `status: 'inbox'` (an already-assigned capture cannot be
 *  re-assigned by this function — the assign route decides how to handle
 *  that case, this layer just won't silently overwrite it). */
export async function markCapturedObjectAssigned(
  admin: SupabaseClient,
  personaId: string,
  captureId: string,
  destination: CaptureAssignDestination,
  refId: string,
): Promise<{ error: string | null }> {
  const { error, count } = await admin
    .from(COMPANION_CAPTURED_OBJECTS_TABLE)
    .update({ status: 'assigned', assigned_destination: destination, assigned_ref_id: refId })
    .eq('persona_id', personaId)
    .eq('id', captureId)
    .eq('status', 'inbox')
    .select('id', { count: 'exact' });

  if (error) return { error: error.message };
  if (!count) return { error: 'capture not found, not owned by this persona, or already assigned' };
  return { error: null };
}
