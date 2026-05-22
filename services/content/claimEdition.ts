/**
 * claimEdition — Phase 9 ContentQube edition claim service.
 *
 * When a payment-gated content_qube is purchased (or when a free/promotional
 * grant is issued) this service either claims the next unissued canonical
 * edition or appends a new common-rarity row.
 *
 * Two paths:
 *
 *   Canonical (legendary | epic | rare | secret_black_rare):
 *     Pre-seeded by migration 20260513040000. Claim = UPDATE the
 *     lowest-edition_number unissued row matching the rarity, setting
 *     persona_id + issued_at. Atomic via WHERE persona_id IS NULL guard
 *     (returns 0 rows if another claimer raced us — we retry once).
 *
 *   Common (streaming-access):
 *     Not pre-seeded. INSERT a new row at MAX(edition_number) + 1 for
 *     the qube. Sequence continues past 1860 (1861, 1862, …). Retries
 *     once on unique-constraint conflict (parallel insert race).
 *
 * Emits a content_qube_dvn_receipts row with receipt_kind='transfer'
 * (first issuance). Phase 7B's mintCanonicalEdition can be invoked
 * post-claim by the caller — claim does NOT mint by itself.
 *
 * Privacy: persona_id is T0 — written ONLY to the DB row. The DVN receipt
 * carries the T2 aliasCommitment instead, never the persona_id.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { emitContentQubeTransferReceipt } from '@/services/access/contentQubeReceiptEmitter';
import { isCanonicalRarity, type ContentQubeRarity } from '@/types/contentQube';

const MAX_RETRIES = 2;

export interface ClaimEditionInput {
  contentQubeId: string;
  /** Persona claiming the edition. Server-internal (T0). */
  personaId: string;
  rarity: ContentQubeRarity;
  /** Optional reference to the purchase row that triggered the claim. */
  sourcePurchaseId?: string;
  /** T2 alias commitment for the DVN transfer receipt. */
  aliasCommitment?: string | null;
}

export interface ClaimEditionResult {
  ok: boolean;
  editionId?: string;
  editionNumber?: number;
  rarity?: ContentQubeRarity;
  /** True when this persona already holds an edition of this qube + rarity. */
  alreadyOwned?: boolean;
  /** Set when canonical supply is exhausted for the requested rarity. */
  soldOut?: boolean;
  error?: string;
}

/**
 * Claim or append an edition row for a persona.
 *
 * For canonical rarities the call is idempotent on (qube, rarity, persona) —
 * if the persona already owns a matching edition, returns alreadyOwned=true
 * without creating a duplicate. Commons are NOT deduped (each purchase is a
 * separate streaming-access grant).
 */
export async function claimEditionForPurchase(
  input: ClaimEditionInput,
): Promise<ClaimEditionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { ok: false, error: 'supabase_unavailable' };
  }

  const { contentQubeId, personaId, rarity, sourcePurchaseId, aliasCommitment } = input;

  if (isCanonicalRarity(rarity)) {
    return claimCanonical(contentQubeId, personaId, rarity, sourcePurchaseId, aliasCommitment);
  }
  return appendCommon(contentQubeId, personaId, sourcePurchaseId, aliasCommitment);
}

// ─── Canonical claim ───────────────────────────────────────────────────────────

async function claimCanonical(
  contentQubeId: string,
  personaId: string,
  rarity: ContentQubeRarity,
  sourcePurchaseId: string | undefined,
  aliasCommitment: string | null | undefined,
): Promise<ClaimEditionResult> {
  const supabase = getSupabaseServer()!;

  // Idempotency: if this persona already owns a matching edition, return it.
  {
    const { data: existing } = await supabase
      .from('content_qube_editions')
      .select('id, edition_number')
      .eq('content_qube_id', contentQubeId)
      .eq('rarity', rarity)
      .eq('persona_id', personaId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        editionId: existing.id as string,
        editionNumber: existing.edition_number as number,
        rarity,
        alreadyOwned: true,
      };
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Find the next unissued edition for this qube + rarity.
    const { data: candidate, error: selErr } = await supabase
      .from('content_qube_editions')
      .select('id, edition_number')
      .eq('content_qube_id', contentQubeId)
      .eq('rarity', rarity)
      .is('persona_id', null)
      .order('edition_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (selErr) {
      return { ok: false, error: `select failed: ${selErr.message}` };
    }
    if (!candidate) {
      return { ok: true, soldOut: true };
    }

    // Atomic claim — only succeeds if persona_id is still null.
    const { data: claimed, error: updErr } = await supabase
      .from('content_qube_editions')
      .update({ persona_id: personaId, issued_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .is('persona_id', null)
      .select('id, edition_number, rarity')
      .maybeSingle();

    if (updErr) {
      return { ok: false, error: `update failed: ${updErr.message}` };
    }

    if (claimed) {
      await emitContentQubeTransferReceipt({
        contentQubeId,
        editionId: claimed.id as string,
        editionNumber: claimed.edition_number as number,
        rarity,
        sourcePurchaseId,
        aliasCommitment: aliasCommitment ?? null,
      });
      return {
        ok: true,
        editionId: claimed.id as string,
        editionNumber: claimed.edition_number as number,
        rarity,
      };
    }
    // Race lost — another claimer took this row. Retry with a fresh select.
  }

  return { ok: false, error: 'claim_contention' };
}

// ─── Common append ─────────────────────────────────────────────────────────────

async function appendCommon(
  contentQubeId: string,
  personaId: string,
  sourcePurchaseId: string | undefined,
  aliasCommitment: string | null | undefined,
): Promise<ClaimEditionResult> {
  const supabase = getSupabaseServer()!;

  // Re-activate path — if this persona has any common edition on this qube,
  // toggle it on. Prefer the ACTIVE row over a released row (in case
  // multiple rows exist from historical inserts); among same-status rows
  // pick the latest by edition_number. This guards against past pollution
  // where one (persona, qube) ended up with multiple rows.
  {
    const { data: priorRows, error: priorErr } = await supabase
      .from('content_qube_editions')
      .select('id, edition_number, released_at')
      .eq('content_qube_id', contentQubeId)
      .eq('persona_id', personaId)
      .eq('rarity', 'common')
      .order('edition_number', { ascending: false });
    if (priorErr) {
      console.warn(`[appendCommon] reactivate-lookup failed qube=${contentQubeId}: ${priorErr.message}`);
    }
    const priorList = Array.isArray(priorRows) ? priorRows : [];
    const prior = priorList.find((r) => (r as { released_at: string | null }).released_at === null)
               ?? priorList[0]
               ?? null;
    if (prior) {
      const priorRow = prior as { id: string; edition_number: number; released_at: string | null };
      if (priorRow.released_at === null) {
        // Already active — idempotent return.
        return {
          ok: true,
          editionId: priorRow.id,
          editionNumber: priorRow.edition_number,
          rarity: 'common',
          alreadyOwned: true,
        };
      }
      // Re-activate by clearing released_at + bumping issued_at.
      const { data: reactivated, error: reErr } = await supabase
        .from('content_qube_editions')
        .update({ released_at: null, issued_at: new Date().toISOString() })
        .eq('id', priorRow.id)
        .select('id, edition_number')
        .maybeSingle();
      if (reErr || !reactivated) {
        return { ok: false, error: `reactivate failed: ${reErr?.message ?? 'no row'}` };
      }
      const reRow = reactivated as { id: string; edition_number: number };
      await emitContentQubeTransferReceipt({
        contentQubeId,
        editionId: reRow.id,
        editionNumber: reRow.edition_number,
        rarity: 'common',
        sourcePurchaseId,
        aliasCommitment: aliasCommitment ?? null,
      });
      return {
        ok: true,
        editionId: reRow.id,
        editionNumber: reRow.edition_number,
        rarity: 'common',
      };
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Lookup current MAX(edition_number) across ALL rarities for this qube,
    // because commons share the global edition_number sequence (canonical
    // pool is 1..1860, commons start at 1861 and increment indefinitely).
    const { data: maxRow, error: maxErr } = await supabase
      .from('content_qube_editions')
      .select('edition_number')
      .eq('content_qube_id', contentQubeId)
      .order('edition_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) {
      return { ok: false, error: `max-select failed: ${maxErr.message}` };
    }

    const nextEditionNumber = (maxRow?.edition_number ?? 0) + 1;

    const { data: inserted, error: insErr } = await supabase
      .from('content_qube_editions')
      .insert({
        content_qube_id: contentQubeId,
        edition_number: nextEditionNumber,
        rarity: 'common',
        persona_id: personaId,
        issued_at: new Date().toISOString(),
      })
      .select('id, edition_number')
      .single();

    if (!insErr && inserted) {
      await emitContentQubeTransferReceipt({
        contentQubeId,
        editionId: inserted.id as string,
        editionNumber: inserted.edition_number as number,
        rarity: 'common',
        sourcePurchaseId,
        aliasCommitment: aliasCommitment ?? null,
      });
      return {
        ok: true,
        editionId: inserted.id as string,
        editionNumber: inserted.edition_number as number,
        rarity: 'common',
      };
    }

    // Unique-constraint violation = parallel insert won the race. Retry.
    const code = (insErr as { code?: string } | null)?.code;
    if (code !== '23505') {
      return { ok: false, error: `insert failed: ${insErr?.message ?? 'unknown'}` };
    }
  }

  return { ok: false, error: 'common_insert_contention' };
}

// ─── Release (= burn) ─────────────────────────────────────────────────────────
//
// Inverse of claim. Currently supports common-rarity editions (which are the
// only kind used by activation_tab ContentQubes). For commons we DELETE the
// row since each common edition is a fresh append on claim — there's no
// pool to return it to. A 'burn' DVN receipt is emitted regardless so the
// burn is recorded in the canonical audit trail.
//
// Canonical-rarity release is intentionally NOT implemented here yet —
// when needed (e.g. an admin reclaiming a canonical edition), this is the
// place to add the persona_id=NULL "return-to-pool" branch.

export interface ReleaseEditionInput {
  contentQubeId: string;
  /** Persona whose edition is being released. Server-internal (T0). */
  personaId: string;
  /** T2 alias commitment for the DVN burn receipt. */
  aliasCommitment?: string | null;
  /** Free-text reason ('deactivate', 'admin-revoke', etc.). Persisted in the receipt payload. */
  reason?: string;
}

export interface ReleaseEditionResult {
  ok: boolean;
  /** Number of edition rows released. 0 when the persona didn't hold one. */
  released?: number;
  error?: string;
}

/**
 * Release every edition this persona holds on the given ContentQube.
 *
 * Soft-release: SETs `released_at = now()` on the held common-rarity row(s)
 * and emits a 'burn' DVN receipt per row. The row is NOT deleted —
 * keeping it lets `claimEditionForPurchase` recognise a re-activation as
 * an idempotent UPDATE (clear released_at) instead of appending a new
 * edition, AND lets auto-grant logic distinguish "persona never claimed"
 * (no row at all) from "persona claimed then released" (row with
 * released_at set). Critical for ActivationTab surfaces where auto-grant
 * defaults would otherwise resurrect deactivated tabs on the next read.
 *
 * Idempotent — releasing an already-released edition is a no-op.
 */
export async function releaseEdition(
  input: ReleaseEditionInput,
): Promise<ReleaseEditionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { ok: false, error: 'supabase_unavailable' };
  }

  const { contentQubeId, personaId, aliasCommitment, reason } = input;

  // 1. Find this persona's ACTIVE editions (released_at IS NULL).
  const { data: held, error: selErr } = await supabase
    .from('content_qube_editions')
    .select('id, edition_number, rarity')
    .eq('content_qube_id', contentQubeId)
    .eq('persona_id', personaId)
    .eq('rarity', 'common')
    .is('released_at', null);

  if (selErr) {
    return { ok: false, error: `select failed: ${selErr.message}` };
  }
  if (!Array.isArray(held) || held.length === 0) {
    return { ok: true, released: 0 };
  }

  // 2. Soft-release each held edition + emit a burn receipt.
  const releasedAt = new Date().toISOString();
  let releasedCount = 0;
  const failures: string[] = [];
  for (const row of held) {
    const editionId = (row as { id: string }).id;
    const editionNumber = (row as { edition_number: number }).edition_number;
    const rarity = (row as { rarity: ContentQubeRarity }).rarity;

    const { data: updated, error: updErr } = await supabase
      .from('content_qube_editions')
      .update({ released_at: releasedAt })
      .eq('id', editionId)
      .is('released_at', null)
      .select('id, released_at');

    if (updErr) {
      // Do NOT silently continue — propagate up. The most common failure
      // here is PostgREST's schema cache being stale after the released_at
      // ALTER TABLE; if we swallow that, deactivations look like they
      // worked but rows stay active and the UI bounces back on next read.
      const msg = `update failed qube=${contentQubeId} edition=${editionId}: ${updErr.message}`;
      console.warn(`[releaseEdition] ${msg}`);
      failures.push(msg);
      continue;
    }
    if (!Array.isArray(updated) || updated.length === 0) {
      const msg = `update matched no rows qube=${contentQubeId} edition=${editionId} — column may be missing from PostgREST schema cache (run: NOTIFY pgrst, 'reload schema')`;
      console.warn(`[releaseEdition] ${msg}`);
      failures.push(msg);
      continue;
    }

    releasedCount++;
    await emitEditionBurnReceipt({
      contentQubeId,
      editionId,
      editionNumber,
      rarity,
      aliasCommitment: aliasCommitment ?? null,
      reason: reason ?? null,
    });
  }

  if (failures.length > 0 && releasedCount === 0) {
    return { ok: false, error: failures.join(' | ') };
  }

  return { ok: true, released: releasedCount };
}

interface EmitBurnReceiptInput {
  contentQubeId: string;
  editionId: string;
  editionNumber: number;
  rarity: ContentQubeRarity;
  aliasCommitment: string | null;
  reason: string | null;
}

/**
 * Write a 'burn' DVN receipt — the inverse of emitContentQubeTransferReceipt.
 * Fire-and-forget tolerant; never throws.
 */
async function emitEditionBurnReceipt(input: EmitBurnReceiptInput): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[emitEditionBurnReceipt] Supabase unavailable; receipt dropped');
    return;
  }
  const { contentQubeId, editionId, editionNumber, rarity, aliasCommitment, reason } = input;
  const receipt_payload: Record<string, unknown> = {
    edition_id: editionId,
    edition_number: editionNumber,
    rarity,
  };
  if (reason) receipt_payload.reason = reason;

  const { error } = await supabase.from('content_qube_dvn_receipts').insert({
    content_qube_id: contentQubeId,
    receipt_kind: 'burn',
    t2_alias_commitment: aliasCommitment,
    receipt_payload,
  });

  if (error) {
    console.warn(
      `[emitEditionBurnReceipt] insert failed qube=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
  }
}
