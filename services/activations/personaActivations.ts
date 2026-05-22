/**
 * personaActivations service — Aigent Me Phase 4 · Activations.
 *
 * Central read/write surface for the per-persona activation rows. The
 * activation *catalog* lives in `data/activation-catalog.ts`; this file
 * is the persistence layer + status decisions.
 *
 * Privacy:
 *   - personaId is T0 — never serialised. All exported shapes carry only
 *     `activationId`, `status`, gate, timestamps.
 *   - All callers must come through `getActivePersona(request)`.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  ACTIVATION_CATALOG,
  getActivationEntry,
  listAutoGrantActivationIds,
  type ActivationCatalogEntry,
  type ActivationGate,
} from '@/data/activation-catalog';

// ─────────────────────────────────────────────────────────────────────────
// Public types — T1-safe.
// ─────────────────────────────────────────────────────────────────────────

export type ActivationStatus = 'active' | 'pending' | 'revoked';
export type ActivationGrantedVia = 'self' | 'invite' | 'cohort' | 'payment' | 'admin' | 'auto';

export interface ActivationSurface {
  id: string;
  label: string;
  description: string;
  longDescription: string;
  gate: ActivationGate;
  tabSlug: string;
  sourceCartridge: ActivationCatalogEntry['sourceCartridge'];
  icon?: string;
  color?: string;
  /** Per-persona state — null when no row exists yet. */
  status: ActivationStatus | null;
  grantedVia: ActivationGrantedVia | null;
  grantedAt: string | null;
  revokedAt: string | null;
  /** True when the caller is eligible to self-activate (open, or admin on a gated row). */
  canSelfActivate: boolean;
}

interface PersonaActivationRow {
  persona_id: string;
  activation_id: string;
  status: ActivationStatus;
  granted_via: ActivationGrantedVia;
  cohort_id: string | null;
  inviter_persona_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Reads.
// ─────────────────────────────────────────────────────────────────────────

async function readRows(personaId: string): Promise<Map<string, PersonaActivationRow>> {
  const admin = getSupabaseServer();
  if (!admin) {
    console.warn('[personaActivations.readRows] supabase admin client unavailable');
    return new Map();
  }
  try {
    const { data, error } = await admin
      .from('persona_activations')
      .select('*')
      .eq('persona_id', personaId);
    if (error) {
      console.warn(`[personaActivations.readRows] read failed for persona=${personaId.slice(0, 8)}…:`, error.message);
      return new Map();
    }
    if (!Array.isArray(data)) return new Map();
    const map = new Map<string, PersonaActivationRow>();
    for (const r of data as PersonaActivationRow[]) map.set(r.activation_id, r);
    return map;
  } catch (err) {
    console.warn(`[personaActivations.readRows] threw for persona=${personaId.slice(0, 8)}…:`, err instanceof Error ? err.message : err);
    return new Map();
  }
}

/**
 * Auto-grant the catalog's auto-grant entries when the persona has no row
 * yet. Best-effort — if the DB write fails the caller still gets a usable
 * surface (status="active") so the UI doesn't degrade.
 */
/**
 * Auto-grant the catalog's `autoGrant: true` entries — but ONLY when no
 * row already exists for the persona. A pre-existing row (active OR
 * revoked) is always respected; the user's deactivation choice wins.
 *
 * Plain INSERT, no upsert with ignoreDuplicates — that flag's exact
 * Supabase semantics turned out unreliable when chained with rapid
 * deactivate / re-activate cycles. We've already pre-filtered against
 * `existing`, so a unique-constraint violation here is a transient race
 * we can safely swallow.
 */
async function ensureAutoGrants(
  personaId: string,
  existing: Map<string, PersonaActivationRow>,
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  const ids = listAutoGrantActivationIds();
  const missingIds = ids.filter((id) => !existing.has(id));
  if (missingIds.length === 0) return;
  for (const id of missingIds) {
    try {
      const { data, error } = await admin
        .from('persona_activations')
        .insert({
          persona_id: personaId,
          activation_id: id,
          status: 'active',
          granted_via: 'auto',
        })
        .select('*')
        .maybeSingle();
      if (data) {
        existing.set(id, data as PersonaActivationRow);
      } else if (error && !/duplicate key|unique constraint/i.test(error.message)) {
        console.warn(`[personaActivations.ensureAutoGrants] insert ${id} failed:`, error.message);
      }
    } catch (err) {
      console.warn(
        `[personaActivations.ensureAutoGrants] insert ${id} threw:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

function rowToSurface(
  entry: ActivationCatalogEntry,
  row: PersonaActivationRow | undefined,
  isAdmin: boolean,
): ActivationSurface {
  const canSelfActivate =
    entry.gate === 'open' || isAdmin || row?.status === 'active';
  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    longDescription: entry.longDescription,
    gate: entry.gate,
    tabSlug: entry.tabSlug,
    sourceCartridge: entry.sourceCartridge,
    icon: entry.icon,
    color: entry.color,
    status: row?.status ?? null,
    grantedVia: row?.granted_via ?? null,
    grantedAt: row?.granted_at ?? null,
    revokedAt: row?.revoked_at ?? null,
    canSelfActivate,
  };
}

/**
 * List the full activation catalog with this persona's status overlaid.
 * Auto-grants any catalog entries marked `autoGrant: true`.
 */
export async function listActivations(
  personaId: string,
  options?: { isAdmin?: boolean },
): Promise<ActivationSurface[]> {
  const existing = await readRows(personaId);
  await ensureAutoGrants(personaId, existing);
  return ACTIVATION_CATALOG.map((entry) =>
    rowToSurface(entry, existing.get(entry.id), options?.isAdmin ?? false),
  );
}

/**
 * Returns the set of activation ids the persona has `status='active'` for.
 * Used by CodexPanelDynamic to gate tab visibility.
 */
export async function getActiveActivationIds(
  personaId: string,
): Promise<Set<string>> {
  const existing = await readRows(personaId);
  await ensureAutoGrants(personaId, existing);
  const active = new Set<string>();
  for (const [id, row] of existing.entries()) {
    if (row.status === 'active') active.add(id);
  }
  return active;
}

// ─────────────────────────────────────────────────────────────────────────
// Writes.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Robust update-or-insert: an explicit UPDATE first, falling back to
 * INSERT when no row exists.
 *
 * Why not Supabase `.upsert(..., { onConflict })`?
 *   - PostgREST's upsert with partial fields silently overwrites un-listed
 *     columns to their DEFAULTs in the EXCLUDED clause — that flipped
 *     `granted_via` from 'auto' to 'self' on every revoke and produced
 *     intermittent state-loss when consecutive writes raced.
 *   - This two-step (UPDATE → fallback INSERT) keeps existing metadata
 *     intact (granted_via, granted_at, cohort_id, inviter_persona_id)
 *     and only touches the fields the caller explicitly supplied.
 */
async function upsertRow(
  personaId: string,
  activationId: string,
  fields: Partial<Omit<PersonaActivationRow, 'persona_id' | 'activation_id'>>,
): Promise<PersonaActivationRow | null> {
  const admin = getSupabaseServer();
  if (!admin) {
    console.warn('[personaActivations.upsertRow] supabase admin unavailable');
    return null;
  }

  const personaPrefix = personaId.slice(0, 8) + '…';
  const updateFields = { ...fields, updated_at: new Date().toISOString() };

  // Step 1 — explicit existence check. Removes every ambiguity about
  // whether UPDATE matched nothing because the row was absent vs because
  // RLS filtered it out vs because of a Supabase quirk.
  const { data: existing, error: readErr } = await admin
    .from('persona_activations')
    .select('*')
    .eq('persona_id', personaId)
    .eq('activation_id', activationId)
    .maybeSingle();

  if (readErr) {
    console.warn(`[personaActivations.upsertRow] PRE-READ error persona=${personaPrefix} activation=${activationId}:`, readErr.message);
    return null;
  }

  if (existing) {
    // Step 2a — explicit UPDATE on the known row.
    const { data: updated, error: updateErr } = await admin
      .from('persona_activations')
      .update(updateFields)
      .eq('persona_id', personaId)
      .eq('activation_id', activationId)
      .select('*');
    if (updateErr) {
      console.warn(`[personaActivations.upsertRow] UPDATE error persona=${personaPrefix} activation=${activationId}:`, updateErr.message);
      return null;
    }
    const row = Array.isArray(updated) && updated.length > 0 ? (updated[0] as PersonaActivationRow) : null;
    if (!row) {
      console.warn(`[personaActivations.upsertRow] UPDATE returned no rows persona=${personaPrefix} activation=${activationId} — RLS may be filtering SELECT-after-update.`);
    }
    return row;
  }

  // Step 2b — INSERT the new row.
  const insertRow = {
    persona_id: personaId,
    activation_id: activationId,
    status: fields.status ?? 'active',
    granted_via: fields.granted_via ?? 'self',
    cohort_id: fields.cohort_id ?? null,
    inviter_persona_id: fields.inviter_persona_id ?? null,
    revoked_at: fields.revoked_at ?? null,
  };
  const { data: inserted, error: insertErr } = await admin
    .from('persona_activations')
    .insert(insertRow)
    .select('*');
  if (insertErr) {
    // Tolerate a parallel-writer race (UNIQUE violation) by retrying as UPDATE.
    if (/duplicate key|unique constraint/i.test(insertErr.message)) {
      const { data: refetched } = await admin
        .from('persona_activations')
        .update(updateFields)
        .eq('persona_id', personaId)
        .eq('activation_id', activationId)
        .select('*');
      if (Array.isArray(refetched) && refetched.length > 0) {
        return refetched[0] as PersonaActivationRow;
      }
    }
    console.warn(`[personaActivations.upsertRow] INSERT error persona=${personaPrefix} activation=${activationId}:`, insertErr.message);
    return null;
  }
  return Array.isArray(inserted) && inserted.length > 0 ? (inserted[0] as PersonaActivationRow) : null;
}

export async function activate(
  personaId: string,
  activationId: string,
  options: { isAdmin?: boolean },
): Promise<{ ok: true; row: PersonaActivationRow } | { ok: false; reason: string }> {
  const entry = getActivationEntry(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  if (entry.gate === 'gated' && !options.isAdmin) {
    return { ok: false, reason: 'gated — use request-access instead' };
  }
  const row = await upsertRow(personaId, activationId, {
    status: 'active',
    granted_via: options.isAdmin && entry.gate === 'gated' ? 'admin' : 'self',
    revoked_at: null,
  });
  if (!row) return { ok: false, reason: 'persistence-failed' };
  return { ok: true, row };
}

export async function requestAccess(
  personaId: string,
  activationId: string,
): Promise<{ ok: true; row: PersonaActivationRow } | { ok: false; reason: string }> {
  const entry = getActivationEntry(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  if (entry.gate !== 'gated') return { ok: false, reason: 'activation is open — activate directly' };
  const row = await upsertRow(personaId, activationId, {
    status: 'pending',
    granted_via: 'self',
    revoked_at: null,
  });
  if (!row) return { ok: false, reason: 'persistence-failed' };
  return { ok: true, row };
}

export async function revoke(
  personaId: string,
  activationId: string,
): Promise<{ ok: true; row: PersonaActivationRow } | { ok: false; reason: string }> {
  const entry = getActivationEntry(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  const row = await upsertRow(personaId, activationId, {
    status: 'revoked',
    revoked_at: new Date().toISOString(),
  });
  if (!row) return { ok: false, reason: 'persistence-failed' };
  return { ok: true, row };
}

/**
 * Admin-grants a gated activation to another persona. The granting
 * admin's persona is not stored on the row — `granted_via='admin'` is
 * the signal. Cohort grant is the same operation with a cohort_id set.
 */
export async function adminGrant(
  targetPersonaId: string,
  activationId: string,
  options?: { cohortId?: string; inviterPersonaId?: string },
): Promise<{ ok: true; row: PersonaActivationRow } | { ok: false; reason: string }> {
  const entry = getActivationEntry(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  const row = await upsertRow(targetPersonaId, activationId, {
    status: 'active',
    granted_via: options?.cohortId ? 'cohort' : 'admin',
    cohort_id: options?.cohortId ?? null,
    inviter_persona_id: options?.inviterPersonaId ?? null,
    revoked_at: null,
  });
  if (!row) return { ok: false, reason: 'persistence-failed' };
  return { ok: true, row };
}
