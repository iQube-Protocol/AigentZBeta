/**
 * spineActivations — Aigent Me Phase 4.b (toggle model)
 *
 * One canonical row per (persona, activation_tab qube) in
 * `content_qube_editions` with `rarity='activation'`. Writes go through a
 * single atomic UPSERT / UPDATE in `setActivationState` — no append-only
 * common-rarity dance, no SELECT-then-write race window. The partial
 * unique index `idx_cq_edition_activation_unique` enforces the one-row
 * invariant in Postgres.
 *
 *   activate(...)   → setActivationState(persona, qube, true)
 *   revoke(...)     → setActivationState(persona, qube, false)
 *   adminGrant(...) → setActivationState(target, qube, true)
 *
 * Reads filter strictly on rarity='activation' so there's no overlap with
 * the comic-edition pool. DVN transfer receipt is emitted on activate for
 * audit-trail symmetry with the spine; burn receipt for revoke can be
 * added when the schema confirms `released_at` is the canonical signal.
 *
 * Privacy: persona_id is T0 — never serialised. Exported shapes carry
 * only the activation id, label, gate, status, and timestamps.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  emitContentQubeTransferReceipt,
} from '@/services/access/contentQubeReceiptEmitter';
import {
  ACTIVATION_CATALOG,
  type ActivationCatalogEntry,
  type ActivationGate,
} from '@/data/activation-catalog';

/**
 * Activations use a dedicated rarity sentinel — 'activation' — that's
 * isolated from the comic-edition pool ('common', 'rare', 'epic', etc.).
 * The DB has a partial unique index on (persona_id, content_qube_id)
 * WHERE rarity='activation' so UPSERT lands deterministically on the
 * single canonical row per (persona, activation_tab qube). See
 * supabase/migrations/20260524020000_activation_toggle_unique_index.sql.
 */
const ACTIVATION_RARITY = 'activation';

// ─────────────────────────────────────────────────────────────────────────
// Public shapes — T1-safe.
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
  /** Per-persona state — null when no edition exists. */
  status: ActivationStatus | null;
  grantedVia: ActivationGrantedVia | null;
  grantedAt: string | null;
  revokedAt: string | null;
  /** True when the caller is eligible to self-activate. */
  canSelfActivate: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — catalog ↔ ContentQube id resolution.
// ─────────────────────────────────────────────────────────────────────────

interface ActivationQubeRow {
  qube_id: string;
  activation_id: string;
  source_cartridge: string;
  label: string;
  long_description: string;
  gating_kind: 'free' | 'owned' | 'subscription' | 'sku_required' | null;
  required_sku: string[] | null;
  price_qc: number | null;
}

async function readActivationQubes(): Promise<Map<string, ActivationQubeRow>> {
  const admin = getSupabaseServer();
  if (!admin) return new Map();
  try {
    const { data, error } = await admin
      .from('activation_tab_qubes')
      .select('*');
    if (error || !Array.isArray(data)) {
      if (error) console.warn('[spineActivations.readActivationQubes] read failed:', error.message);
      return new Map();
    }
    const map = new Map<string, ActivationQubeRow>();
    for (const row of data as ActivationQubeRow[]) {
      map.set(row.activation_id, row);
    }
    return map;
  } catch (err) {
    console.warn('[spineActivations.readActivationQubes] threw:', err instanceof Error ? err.message : err);
    return new Map();
  }
}

interface EditionRow {
  id: string;
  content_qube_id: string;
  persona_id: string | null;
  issued_at: string | null;
  released_at: string | null;
}

async function readPersonaEditions(
  personaId: string,
  qubeIds: string[],
): Promise<Map<string, EditionRow>> {
  const admin = getSupabaseServer();
  if (!admin || qubeIds.length === 0) return new Map();
  try {
    // Filter on rarity='activation' — the partial unique index guarantees
    // at most one row per (persona, qube). No tiebreaker needed.
    const { data, error } = await admin
      .from('content_qube_editions')
      .select('id, content_qube_id, persona_id, issued_at, released_at')
      .eq('persona_id', personaId)
      .eq('rarity', ACTIVATION_RARITY)
      .in('content_qube_id', qubeIds);
    if (error || !Array.isArray(data)) {
      if (error) console.warn('[spineActivations.readPersonaEditions] read failed:', error.message);
      return new Map();
    }
    const map = new Map<string, EditionRow>();
    for (const r of data as EditionRow[]) map.set(r.content_qube_id, r);
    return map;
  } catch (err) {
    console.warn('[spineActivations.readPersonaEditions] threw:', err instanceof Error ? err.message : err);
    return new Map();
  }
}

function catalogEntryFor(activationId: string): ActivationCatalogEntry | null {
  return ACTIVATION_CATALOG.find((e) => e.id === activationId) ?? null;
}

function rowToSurface(
  entry: ActivationCatalogEntry,
  edition: EditionRow | undefined,
  qube: ActivationQubeRow | undefined,
  isAdmin: boolean,
): ActivationSurface {
  const gateFromPolicy: ActivationGate =
    qube?.gating_kind === 'free' ? 'open' : 'gated';
  const gate: ActivationGate = entry.gate ?? gateFromPolicy;
  const canSelfActivate = gate === 'open' || isAdmin || !!edition;

  // The world's simplest truth table:
  //   row present, released_at NULL    → active
  //   row present, released_at NOT NULL → revoked
  //   no row                            → null  (never activated)
  // That's it. No magic, no auto-grant, no virtual states.
  const status: ActivationStatus | null =
    edition && !edition.released_at ? 'active'
    : edition && edition.released_at ? 'revoked'
    : null;

  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    longDescription: entry.longDescription,
    gate,
    tabSlug: entry.tabSlug,
    sourceCartridge: entry.sourceCartridge,
    icon: entry.icon,
    color: entry.color,
    status,
    grantedVia: edition ? 'self' : null,
    grantedAt: edition?.issued_at ?? null,
    revokedAt: edition?.released_at ?? null,
    canSelfActivate,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Auto-grant — runs on every list; idempotent (claim returns alreadyOwned).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the next edition_number for a qube. content_qube_editions has a
 * UNIQUE (content_qube_id, edition_number) constraint left over from the
 * comic-edition pool, so we still need a unique number per qube even
 * though for activations the persona+qube uniqueness comes from the
 * partial index. We grab MAX+1 across ALL rarities so we never collide
 * with KNYT purchase commons on the same qube id.
 */
async function nextEditionNumberFor(qubeId: string): Promise<number> {
  const admin = getSupabaseServer();
  if (!admin) return 1;
  const { data } = await admin
    .from('content_qube_editions')
    .select('edition_number')
    .eq('content_qube_id', qubeId)
    .order('edition_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { edition_number?: number } | null;
  return (row?.edition_number ?? 0) + 1;
}

/**
 * The single-call toggle. Writes the activation row deterministically:
 *
 *   active=true  → UPSERT (persona, qube, rarity='activation', released_at=null, issued_at=now)
 *   active=false → UPDATE released_at=now WHERE (persona, qube, rarity='activation')
 *
 * Bypasses claimEditionForPurchase/releaseEdition entirely — those were
 * built for comic-edition pools (append-only commons, canonical claims),
 * and forcing them through the activation toggle caused the bouncing.
 *
 * On UPSERT we let Postgres' ON CONFLICT clause find the existing row
 * via the partial unique index `idx_cq_edition_activation_unique`. No
 * SELECT-then-write dance, no .maybeSingle() trust issues.
 */
async function setActivationState(
  personaId: string,
  qubeId: string,
  active: boolean,
): Promise<{ ok: true; row: EditionRow } | { ok: false; reason: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'supabase_unavailable' };

  const now = new Date().toISOString();
  const personaPrefix = personaId.slice(0, 8) + '…';

  if (active) {
    // UPSERT — ON CONFLICT (persona_id, content_qube_id) WHERE rarity='activation'
    // clears released_at + bumps issued_at on an existing row, or inserts
    // a fresh row if none exists. Atomic.
    const editionNumber = await nextEditionNumberFor(qubeId);
    const { data, error } = await admin
      .from('content_qube_editions')
      .upsert(
        {
          persona_id: personaId,
          content_qube_id: qubeId,
          rarity: ACTIVATION_RARITY,
          edition_number: editionNumber,
          issued_at: now,
          released_at: null,
        },
        { onConflict: 'persona_id,content_qube_id' },
      )
      .select('id, content_qube_id, persona_id, issued_at, released_at')
      .maybeSingle();
    if (error) {
      console.warn(`[spineActivations.setActivationState] upsert error persona=${personaPrefix} qube=${qubeId}: ${error.message}`);
      return { ok: false, reason: error.message };
    }
    if (!data) {
      return { ok: false, reason: 'upsert returned no row (PostgREST schema cache may be stale — NOTIFY pgrst, \'reload schema\')' };
    }
    return { ok: true, row: data as EditionRow };
  }

  // Deactivate — UPDATE on the unique key. Sets released_at=now whether
  // the row was previously active or already released (idempotent).
  const { data, error } = await admin
    .from('content_qube_editions')
    .update({ released_at: now })
    .eq('persona_id', personaId)
    .eq('content_qube_id', qubeId)
    .eq('rarity', ACTIVATION_RARITY)
    .select('id, content_qube_id, persona_id, issued_at, released_at');
  if (error) {
    console.warn(`[spineActivations.setActivationState] update error persona=${personaPrefix} qube=${qubeId}: ${error.message}`);
    return { ok: false, reason: error.message };
  }
  if (!Array.isArray(data) || data.length === 0) {
    // No row to release means the persona never activated. Insert a row
    // already-released so subsequent reads honour the user's intent.
    const editionNumber = await nextEditionNumberFor(qubeId);
    const { data: inserted, error: insertErr } = await admin
      .from('content_qube_editions')
      .insert({
        persona_id: personaId,
        content_qube_id: qubeId,
        rarity: ACTIVATION_RARITY,
        edition_number: editionNumber,
        issued_at: now,
        released_at: now,
      })
      .select('id, content_qube_id, persona_id, issued_at, released_at')
      .maybeSingle();
    if (insertErr) {
      console.warn(`[spineActivations.setActivationState] revoke-insert error persona=${personaPrefix} qube=${qubeId}: ${insertErr.message}`);
      return { ok: false, reason: insertErr.message };
    }
    if (!inserted) {
      return { ok: false, reason: 'revoke-insert returned no row' };
    }
    return { ok: true, row: inserted as EditionRow };
  }
  return { ok: true, row: (data[0] as EditionRow) };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API.
// ─────────────────────────────────────────────────────────────────────────

export async function listActivations(
  personaId: string,
  options?: { isAdmin?: boolean },
): Promise<ActivationSurface[]> {
  // Reads NEVER write. Auto-grant is gone. One row per (persona, qube)
  // is guaranteed by the partial unique index → no tiebreaker needed.
  const qubeIndex = await readActivationQubes();
  const heldEditions = await readPersonaEditions(
    personaId,
    Array.from(qubeIndex.values()).map((q) => q.qube_id),
  );

  return ACTIVATION_CATALOG.map((entry) => {
    const qube = qubeIndex.get(entry.id);
    const edition = qube ? heldEditions.get(qube.qube_id) : undefined;
    return rowToSurface(entry, edition, qube, options?.isAdmin ?? false);
  });
}

export async function getActiveActivationIds(personaId: string): Promise<Set<string>> {
  const surfaces = await listActivations(personaId);
  const active = new Set<string>();
  for (const s of surfaces) {
    if (s.status === 'active') active.add(s.id);
  }
  return active;
}

export async function activate(
  personaId: string,
  activationId: string,
  options: { isAdmin?: boolean },
): Promise<{ ok: true; activationId: string } | { ok: false; reason: string }> {
  const entry = catalogEntryFor(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  if (entry.gate === 'gated' && !options.isAdmin) {
    return { ok: false, reason: 'gated — use request-access instead' };
  }
  const qubeIndex = await readActivationQubes();
  const qube = qubeIndex.get(activationId);
  if (!qube) return { ok: false, reason: 'content_qube-missing — migration not applied?' };

  const result = await setActivationState(personaId, qube.qube_id, true);
  if (!result.ok) return { ok: false, reason: result.reason };

  // Fire-and-forget DVN transfer receipt for audit trail.
  void emitContentQubeTransferReceipt({
    contentQubeId: qube.qube_id,
    editionId: result.row.id,
    editionNumber: 0, // not meaningful for activation rarity
    rarity: 'common' as never, // receipt schema requires this; activation rarity is internal
    aliasCommitment: null,
  });

  return { ok: true, activationId };
}

export async function requestAccess(
  personaId: string,
  activationId: string,
): Promise<{ ok: true; activationId: string } | { ok: false; reason: string }> {
  // Pending state for gated activations isn't yet represented in the spine
  // (no claim row until granted). For now, a request is a no-op that the
  // future cohort/invite/payment layer will fulfil. Return ok so the UI can
  // show "Request submitted" without persisting parallel state.
  const entry = catalogEntryFor(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  if (entry.gate !== 'gated') return { ok: false, reason: 'activation is open — activate directly' };
  // TODO Phase 4.c — persist the request as a content_qube_dvn_receipt
  // with receipt_kind='access' so admin grants can resolve it.
  void personaId;
  return { ok: true, activationId };
}

export async function revoke(
  personaId: string,
  activationId: string,
): Promise<{ ok: true; activationId: string } | { ok: false; reason: string }> {
  const entry = catalogEntryFor(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  const qubeIndex = await readActivationQubes();
  const qube = qubeIndex.get(activationId);
  if (!qube) return { ok: false, reason: 'content_qube-missing' };

  const result = await setActivationState(personaId, qube.qube_id, false);
  if (!result.ok) return { ok: false, reason: result.reason };

  return { ok: true, activationId };
}

export async function adminGrant(
  targetPersonaId: string,
  activationId: string,
  options?: { cohortId?: string; inviterPersonaId?: string },
): Promise<{ ok: true; activationId: string } | { ok: false; reason: string }> {
  void options; // cohort/invite metadata not yet persisted to the spine
  const entry = catalogEntryFor(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  const qubeIndex = await readActivationQubes();
  const qube = qubeIndex.get(activationId);
  if (!qube) return { ok: false, reason: 'content_qube-missing' };

  const result = await setActivationState(targetPersonaId, qube.qube_id, true);
  if (!result.ok) return { ok: false, reason: result.reason };

  return { ok: true, activationId };
}
