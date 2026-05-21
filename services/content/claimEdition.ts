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
 * Release every edition this persona holds on the given ContentQube. For
 * common-rarity editions (activation_tab + streaming-access), this DELETEs
 * the row(s) and emits a 'burn' DVN receipt per deletion.
 *
 * Idempotent — releasing twice is a no-op the second time (released: 0).
 */
export async function releaseEdition(
  input: ReleaseEditionInput,
): Promise<ReleaseEditionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { ok: false, error: 'supabase_unavailable' };
  }

  const { contentQubeId, personaId, aliasCommitment, reason } = input;

  // 1. Find the persona's editions on this qube. Common rarity only (canonical
  //    release is out-of-scope until an explicit operator flow needs it).
  const { data: held, error: selErr } = await supabase
    .from('content_qube_editions')
    .select('id, edition_number, rarity')
    .eq('content_qube_id', contentQubeId)
    .eq('persona_id', personaId)
    .eq('rarity', 'common');

  if (selErr) {
    return { ok: false, error: `select failed: ${selErr.message}` };
  }
  if (!Array.isArray(held) || held.length === 0) {
    return { ok: true, released: 0 };
  }

  // 2. Delete each held edition + emit a burn receipt.
  let releasedCount = 0;
  for (const row of held) {
    const editionId = (row as { id: string }).id;
    const editionNumber = (row as { edition_number: number }).edition_number;
    const rarity = (row as { rarity: ContentQubeRarity }).rarity;

    const { error: delErr } = await supabase
      .from('content_qube_editions')
      .delete()
      .eq('id', editionId);

    if (delErr) {
      console.warn(`[releaseEdition] delete failed qube=${contentQubeId} edition=${editionId} msg=${delErr.message}`);
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
