/**
 * spineActivations — Aigent Me Phase 4.b
 *
 * Activation state resolved through the canonical ContentQube spine:
 *
 *   - Catalog of activations = `content_qubes` rows where `content_kind =
 *     'activation_tab'` (seeded by migration 20260524000000).
 *   - Per-persona activation state = `content_qube_editions` rows holding
 *     a common-rarity edition for that persona. Activate → claim; Revoke
 *     → release. All writes flow through `claimEditionForPurchase` and
 *     `releaseEdition` in services/content/claimEdition.ts so there is
 *     exactly ONE write path for persona ↔ content state.
 *   - Auto-grant (myCanvas, Order of Metayé) = on first read, automatically
 *     claim an edition for the persona if their access policy permits and
 *     they don't already hold one.
 *
 * This replaces services/activations/personaActivations.ts. The legacy
 * persona_activations table is left in place for one release as a backstop;
 * nothing in this file reads from it.
 *
 * Privacy: persona_id is T0 — never serialised. All exported shapes carry
 * only the activation_id, label, gate, status, and timestamps.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { claimEditionForPurchase, releaseEdition } from '@/services/content/claimEdition';
import {
  ACTIVATION_CATALOG,
  listAutoGrantActivationIds,
  type ActivationCatalogEntry,
  type ActivationGate,
} from '@/data/activation-catalog';

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
    const { data, error } = await admin
      .from('content_qube_editions')
      .select('id, content_qube_id, persona_id, issued_at, released_at')
      .eq('persona_id', personaId)
      .eq('rarity', 'common')
      .in('content_qube_id', qubeIds);
    if (error || !Array.isArray(data)) {
      if (error) console.warn('[spineActivations.readPersonaEditions] read failed:', error.message);
      return new Map();
    }
    // CRITICAL — when multiple rows exist for the same (persona, qube),
    // pick the canonical one: any ACTIVE row (released_at IS NULL) wins
    // over released rows; among same-status rows, the most-recently issued
    // wins. Without this preference order, Map.set order is determined by
    // PostgREST's row order — which is undefined — and we'd flip-flop
    // between showing the user's released row vs their active row on each
    // GET. Symptom: deactivate succeeds in DB but surface still shows old
    // released_at timestamp (or vice versa).
    const map = new Map<string, EditionRow>();
    for (const r of data as EditionRow[]) {
      const existing = map.get(r.content_qube_id);
      if (!existing) {
        map.set(r.content_qube_id, r);
        continue;
      }
      const existingActive = existing.released_at === null;
      const incomingActive = r.released_at === null;
      if (incomingActive && !existingActive) {
        map.set(r.content_qube_id, r);
        continue;
      }
      if (!incomingActive && existingActive) continue;
      // Both same status — keep the newer one by issued_at.
      const existingTs = existing.issued_at ? Date.parse(existing.issued_at) : 0;
      const incomingTs = r.issued_at ? Date.parse(r.issued_at) : 0;
      if (incomingTs > existingTs) map.set(r.content_qube_id, r);
    }
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
  // Active = edition row exists AND has not been released.
  const isReleased = !!edition?.released_at;
  const status: ActivationStatus | null =
    edition && !isReleased ? 'active'
    : edition && isReleased ? 'revoked'
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

async function ensureAutoGrants(
  personaId: string,
  qubeIndex: Map<string, ActivationQubeRow>,
  heldEditions: Map<string, EditionRow>,
): Promise<void> {
  const autoIds = listAutoGrantActivationIds();
  for (const activationId of autoIds) {
    const qube = qubeIndex.get(activationId);
    if (!qube) continue;
    // CRITICAL: skip auto-grant if the persona has EVER held an edition on
    // this qube — released_at being set means they explicitly deactivated
    // it. Re-claiming would resurrect deactivated tabs on every read, which
    // is the bug "deactivates then reactivates immediately."
    if (heldEditions.has(qube.qube_id)) continue;
    const result = await claimEditionForPurchase({
      contentQubeId: qube.qube_id,
      personaId,
      rarity: 'common',
      aliasCommitment: null,
    });
    if (!result.ok) {
      console.warn(`[spineActivations.ensureAutoGrants] auto-claim failed for ${activationId}: ${result.error}`);
      continue;
    }
    if (result.editionId) {
      heldEditions.set(qube.qube_id, {
        id: result.editionId,
        content_qube_id: qube.qube_id,
        persona_id: personaId,
        issued_at: new Date().toISOString(),
        released_at: null,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public API.
// ─────────────────────────────────────────────────────────────────────────

export async function listActivations(
  personaId: string,
  options?: { isAdmin?: boolean },
): Promise<ActivationSurface[]> {
  const qubeIndex = await readActivationQubes();
  const heldEditions = await readPersonaEditions(
    personaId,
    Array.from(qubeIndex.values()).map((q) => q.qube_id),
  );
  await ensureAutoGrants(personaId, qubeIndex, heldEditions);

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

  const result = await claimEditionForPurchase({
    contentQubeId: qube.qube_id,
    personaId,
    rarity: 'common',
    aliasCommitment: null,
  });
  if (!result.ok) {
    return { ok: false, reason: result.error ?? 'claim-failed' };
  }
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

  const result = await releaseEdition({
    contentQubeId: qube.qube_id,
    personaId,
    aliasCommitment: null,
    reason: 'persona-deactivation',
  });
  if (!result.ok) {
    return { ok: false, reason: result.error ?? 'release-failed' };
  }
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

  const result = await claimEditionForPurchase({
    contentQubeId: qube.qube_id,
    personaId: targetPersonaId,
    rarity: 'common',
    aliasCommitment: null,
  });
  if (!result.ok) {
    return { ok: false, reason: result.error ?? 'claim-failed' };
  }
  return { ok: true, activationId };
}
