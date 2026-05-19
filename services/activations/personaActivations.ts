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
  if (!admin) return new Map();
  try {
    const { data, error } = await admin
      .from('persona_activations')
      .select('*')
      .eq('persona_id', personaId);
    if (error || !Array.isArray(data)) return new Map();
    const map = new Map<string, PersonaActivationRow>();
    for (const r of data as PersonaActivationRow[]) map.set(r.activation_id, r);
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Auto-grant the catalog's auto-grant entries when the persona has no row
 * yet. Best-effort — if the DB write fails the caller still gets a usable
 * surface (status="active") so the UI doesn't degrade.
 */
async function ensureAutoGrants(
  personaId: string,
  existing: Map<string, PersonaActivationRow>,
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  const ids = listAutoGrantActivationIds();
  const rowsToInsert = ids
    .filter((id) => !existing.has(id))
    .map((id) => ({
      persona_id: personaId,
      activation_id: id,
      status: 'active' as const,
      granted_via: 'auto' as const,
    }));
  if (rowsToInsert.length === 0) return;
  try {
    const { data } = await admin
      .from('persona_activations')
      .upsert(rowsToInsert, { onConflict: 'persona_id,activation_id', ignoreDuplicates: true })
      .select('*');
    if (Array.isArray(data)) {
      for (const r of data as PersonaActivationRow[]) {
        existing.set(r.activation_id, r);
      }
    }
  } catch {
    // Synthesise an in-memory active row so the surface renders consistently.
    for (const id of ids) {
      if (!existing.has(id)) {
        existing.set(id, {
          persona_id: personaId,
          activation_id: id,
          status: 'active',
          granted_via: 'auto',
          cohort_id: null,
          inviter_persona_id: null,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          updated_at: new Date().toISOString(),
        });
      }
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

async function upsertRow(
  personaId: string,
  activationId: string,
  fields: Partial<Omit<PersonaActivationRow, 'persona_id' | 'activation_id'>>,
): Promise<PersonaActivationRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from('persona_activations')
      .upsert(
        { persona_id: personaId, activation_id: activationId, ...fields, updated_at: new Date().toISOString() },
        { onConflict: 'persona_id,activation_id' },
      )
      .select('*')
      .maybeSingle();
    return (data as PersonaActivationRow) ?? null;
  } catch {
    return null;
  }
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
