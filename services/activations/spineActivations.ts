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
import { getPersonaPlan, type PersonaPlan } from '@/services/billing/personaPlan';
import {
  emitContentQubeTransferReceipt,
} from '@/services/access/contentQubeReceiptEmitter';
import {
  ACTIVATION_CATALOG,
  type ActivationCatalogEntry,
  type ActivationGate,
} from '@/data/activation-catalog';

// Plan-gate map (which premium activations are paywalled + the tier that
// unlocks each) is shared with personaActivations via activationPlanGate so
// the rule never drifts between the two services.
import {
  ACTIVATION_PLAN_GATE,
  isPlanEntitled,
  resolveActivationPlanGate,
} from '@/services/activations/activationPlanGate';
import type { TierKey } from '@/services/billing/planCheckout';

async function planAllowsSelfActivate(personaId: string, activationId: string): Promise<boolean> {
  const gate = ACTIVATION_PLAN_GATE[activationId];
  if (!gate) return false;
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    return gate.entitled(await getPersonaPlan(admin, personaId));
  } catch {
    return false;
  }
}

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
  /**
   * True when this surface is blocked specifically by the persona's PLAN
   * (paywall) — not by admin-grant / invite / cohort. Drives the catalogue's
   * "Upgrade" affordance (vs "Request access").
   */
  planGated: boolean;
  /** Tier whose checkout unlocks this surface, when planGated. */
  requiredTier: TierKey | null;
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
  hasPendingRequest: boolean = false,
  planEntitled: boolean = false,
): ActivationSurface {
  const gateFromPolicy: ActivationGate =
    qube?.gating_kind === 'free' ? 'open' : 'gated';
  const gate: ActivationGate = entry.gate ?? gateFromPolicy;
  // Only a CURRENTLY-HELD edition (not a revoked one) makes a surface
  // self-available. A revoked edition left over from when a surface was 'open'
  // must NOT keep the surface self-activatable after it's been re-gated to a
  // plan — otherwise the catalogue shows "Activate" on a surface the server
  // will reject with "upgrade required", and the upgrade affordance never shows.
  const hasActiveEdition = !!edition && !edition.released_at;
  const alreadyAvailable = gate === 'open' || isAdmin || planEntitled || hasActiveEdition;
  const canSelfActivate = alreadyAvailable;
  // Plan-gate state: blocked specifically by the paywall (vs grant/invite/cohort).
  const planGate = resolveActivationPlanGate(entry.id, null, alreadyAvailable);

  // Truth table:
  //   row present, released_at NULL    → active
  //   row present, released_at NOT NULL → revoked
  //   no row, persona has pending req  → pending (gated, awaiting admin)
  //   no row, no pending req           → null  (never activated)
  // Edition state (granted) always wins over a pending request — if a
  // grant comes through while a request was queued, the surface
  // immediately reads as active.
  const status: ActivationStatus | null =
    edition && !edition.released_at ? 'active'
    : edition && edition.released_at ? 'revoked'
    : hasPendingRequest ? 'pending'
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
    planGated: planGate.planGated,
    requiredTier: planGate.requiredTier,
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

  // 1. Look up the existing activation row for (persona, qube).
  //    The partial unique index `idx_cq_edition_activation_unique`
  //    guarantees this returns at most one row.
  const { data: existing, error: readErr } = await admin
    .from('content_qube_editions')
    .select('id, content_qube_id, persona_id, issued_at, released_at')
    .eq('persona_id', personaId)
    .eq('content_qube_id', qubeId)
    .eq('rarity', ACTIVATION_RARITY)
    .maybeSingle();

  if (readErr) {
    console.warn(`[spineActivations.setActivationState] read error persona=${personaPrefix} qube=${qubeId}: ${readErr.message}`);
    return { ok: false, reason: readErr.message };
  }

  if (existing) {
    // Row exists — UPDATE.
    const patch = active
      ? { released_at: null, issued_at: now }
      : { released_at: now };
    const { data: updated, error: updErr } = await admin
      .from('content_qube_editions')
      .update(patch)
      .eq('id', (existing as { id: string }).id)
      .select('id, content_qube_id, persona_id, issued_at, released_at')
      .maybeSingle();
    if (updErr) {
      console.warn(`[spineActivations.setActivationState] update error persona=${personaPrefix} qube=${qubeId}: ${updErr.message}`);
      return { ok: false, reason: updErr.message };
    }
    if (!updated) {
      return { ok: false, reason: 'update returned no row (schema cache may be stale)' };
    }
    return { ok: true, row: updated as EditionRow };
  }

  // No row — INSERT. For activate, fresh active row. For deactivate,
  // insert already-released so subsequent reads honour the user's intent.
  const editionNumber = await nextEditionNumberFor(qubeId);
  const insertRow = {
    persona_id: personaId,
    content_qube_id: qubeId,
    rarity: ACTIVATION_RARITY,
    edition_number: editionNumber,
    issued_at: now,
    released_at: active ? null : now,
  };
  const { data: inserted, error: insertErr } = await admin
    .from('content_qube_editions')
    .insert(insertRow)
    .select('id, content_qube_id, persona_id, issued_at, released_at')
    .maybeSingle();
  if (insertErr) {
    // Race: a parallel writer inserted between our read and write.
    // Re-read and update.
    if (/duplicate key|unique constraint/i.test(insertErr.message)) {
      const { data: refreshed } = await admin
        .from('content_qube_editions')
        .select('id, content_qube_id, persona_id, issued_at, released_at')
        .eq('persona_id', personaId)
        .eq('content_qube_id', qubeId)
        .eq('rarity', ACTIVATION_RARITY)
        .maybeSingle();
      if (refreshed) {
        const patch = active
          ? { released_at: null, issued_at: now }
          : { released_at: now };
        const { data: updated2 } = await admin
          .from('content_qube_editions')
          .update(patch)
          .eq('id', (refreshed as { id: string }).id)
          .select('id, content_qube_id, persona_id, issued_at, released_at')
          .maybeSingle();
        if (updated2) return { ok: true, row: updated2 as EditionRow };
      }
    }
    console.warn(`[spineActivations.setActivationState] insert error persona=${personaPrefix} qube=${qubeId}: ${insertErr.message}`);
    return { ok: false, reason: insertErr.message };
  }
  if (!inserted) {
    return { ok: false, reason: 'insert returned no row' };
  }
  return { ok: true, row: inserted as EditionRow };
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
  // Read any pending requests this persona has filed so gated rows
  // show an amber "Pending" chip after the request lands and survives
  // a refresh. persona_activations is the parallel-state companion to
  // content_qube_editions for non-granted lifecycle states (pending).
  const pendingIds = await readPendingActivationIds(personaId);

  // Resolve the plan once so premium cartridges show as self-activatable for
  // entitled personas (the paywall affordance in the Activations tab).
  let plan: PersonaPlan | null = null;
  const planClient = getSupabaseServer();
  if (planClient) {
    try {
      plan = await getPersonaPlan(planClient, personaId);
    } catch {
      /* plan unavailable — premium gated as usual */
    }
  }

  return ACTIVATION_CATALOG.map((entry) => {
    const qube = qubeIndex.get(entry.id);
    const edition = qube ? heldEditions.get(qube.qube_id) : undefined;
    const planEntitled = isPlanEntitled(entry.id, plan);
    return rowToSurface(
      entry,
      edition,
      qube,
      options?.isAdmin ?? false,
      pendingIds.has(entry.id),
      planEntitled,
    );
  });
}

/**
 * Read the set of activation ids where this persona has a pending
 * (admin-awaited) request. Used to flip the surface status to
 * 'pending' so the UI shows amber instead of the default
 * "Request access" CTA.
 */
async function readPendingActivationIds(personaId: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!personaId) return out;
  try {
    const admin = getSupabaseServer();
    if (!admin) return out;
    const { data, error } = await admin
      .from('persona_activations')
      .select('activation_id, status')
      .eq('persona_id', personaId)
      .eq('status', 'pending');
    if (error || !data) return out;
    for (const row of data as Array<{ activation_id: string }>) {
      if (row?.activation_id) out.add(row.activation_id);
    }
  } catch {
    // Swallow — pending tracking is best-effort.
  }
  return out;
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
    // Plan-based eligibility (the paywall): premium cartridges may be
    // self-activated when the persona's plan grants them; else request access.
    if (!(await planAllowsSelfActivate(personaId, activationId))) {
      return { ok: false, reason: 'gated — upgrade required (or request access)' };
    }
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

/**
 * Map an activation id to the cartridge slug the admin_access_requests
 * table expects. Activations share most of their ids with cartridge
 * slugs, but the spelling diverges for KNYT (knyt → knyt-codex) and
 * Qriptopian (qriptopian → qripto). When no mapping exists, fall back
 * to the activation id itself — the admin reviewer can still resolve
 * it via the surfaced label.
 */
function activationIdToCartridgeSlug(entry: ActivationCatalogEntry): string {
  const cart = entry.sourceCartridge;
  if (cart === 'knyt') return 'knyt-codex';
  if (cart === 'qriptopian') return 'qripto';
  if (cart === 'mvl') return 'venture-lab';
  if (cart === 'marketa') return 'marketa';
  if (cart === 'metame') return 'metame';
  return entry.id;
}

export interface RequestAccessContext {
  authProfileId?: string | null;
  email?: string | null;
  displayLabel?: string | null;
}

export async function requestAccess(
  personaId: string,
  activationId: string,
  ctx: RequestAccessContext = {},
): Promise<{ ok: true; activationId: string } | { ok: false; reason: string }> {
  const entry = catalogEntryFor(activationId);
  if (!entry) return { ok: false, reason: 'unknown-activation' };
  if (entry.gate !== 'gated') return { ok: false, reason: 'activation is open — activate directly' };

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'supabase-unavailable' };

  // 1) Persist the pending state on persona_activations so the
  //    Activations tab can show an amber "Pending" chip on refresh.
  //    UNIQUE (persona_id, activation_id) means upsert is safe and
  //    idempotent — a second click while already pending stays pending.
  try {
    const { error: paErr } = await admin
      .from('persona_activations')
      .upsert(
        {
          persona_id: personaId,
          activation_id: activationId,
          status: 'pending',
          granted_via: 'self',
        },
        { onConflict: 'persona_id,activation_id' },
      );
    if (paErr) {
      console.warn('[requestAccess] persona_activations upsert error', paErr);
      // Continue — the admin_access_requests insert is still useful.
    }
  } catch (err) {
    console.warn('[requestAccess] persona_activations upsert exception', err);
  }

  // 2) Mirror into admin_access_requests so the metaMe Admin → Access
  //    Requests tab surfaces it. Carries caller email + display label
  //    from the route's identity context. Duplicate-pending requests
  //    are surfaced as ok (idempotent click).
  try {
    const cartridgeSlug = activationIdToCartridgeSlug(entry);
    const insertRow: Record<string, unknown> = {
      persona_id: personaId,
      auth_profile_id: ctx.authProfileId ?? null,
      requester_display_label: ctx.displayLabel ?? null,
      requester_email: ctx.email ?? null,
      requested_cartridge_slug: cartridgeSlug,
      request_type: 'cartridge_access',
      message: `Activation request — ${entry.label}`,
      status: 'pending',
    };
    let { error: arErr } = await admin
      .from('admin_access_requests')
      .insert(insertRow);
    // Migration 20260526020000 fallback — drop request_type when absent.
    if (arErr && (arErr.code === '42703' || /column .*request_type/i.test(arErr.message ?? ''))) {
      const { request_type, ...rowSansType } = insertRow;
      const retry = await admin.from('admin_access_requests').insert(rowSansType);
      arErr = retry.error;
    }
    // 23505 = unique-pending index trip → existing pending request,
    // perfectly fine to swallow (idempotent).
    if (arErr && arErr.code !== '23505') {
      console.warn('[requestAccess] admin_access_requests insert error', arErr);
    }
  } catch (err) {
    console.warn('[requestAccess] admin_access_requests insert exception', err);
  }

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
