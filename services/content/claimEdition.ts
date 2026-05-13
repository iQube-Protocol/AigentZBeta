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
