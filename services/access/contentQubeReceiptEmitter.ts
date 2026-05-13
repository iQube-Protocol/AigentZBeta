/**
 * ContentQube DVN receipt emitter — Phase 5 of the ContentQube integration.
 *
 * Writes content_qube_dvn_receipts rows when access decisions are made
 * against a content_qube. Complements the existing orchestration_events
 * emitter (services/access/receiptEmitter.ts) — that one captures every
 * access decision platform-wide; this one captures only the ContentQube-
 * scoped subset, indexed by content_qube_id for per-qube audit/anchor.
 *
 * Privacy contract — enforced by construction:
 *   - t2_alias_commitment (T2) is the ONLY persona handle written.
 *   - persona_id NEVER appears in this table (schema has no column).
 *   - The descriptor's assetId is included in the receipt_payload as a
 *     T2 public asset reference (same rule as receiptEmitter.ts).
 *
 * Phase 5 emits the row. Phase 5.1 will batch-anchor unanchored rows
 * to the ICP DVN canister and set icp_receipt_id.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { AccessAction, AccessDecision, ContentAccessDescriptor } from '@/types/access';
import type { ContentQubeDvnReceiptKind, ContentQubeRarity } from '@/types/contentQube';

interface EmitContentQubeReceiptInput {
  contentQubeId: string;
  descriptor: ContentAccessDescriptor;
  action: AccessAction;
  decision: AccessDecision;
}

function actionToReceiptKind(action: AccessAction): ContentQubeDvnReceiptKind {
  switch (action) {
    case 'mint':     return 'mint';
    case 'transfer': return 'transfer';
    default:         return 'access';
  }
}

/**
 * Write a content_qube_dvn_receipts row for an access decision.
 * Fire-and-forget tolerant — errors are logged but never thrown so the
 * decision path is never blocked by receipt-emit failures.
 *
 * Skips emission when the decision's receipt mode is 'none' (free A-state
 * reads don't anchor receipts, matching the existing receiptEmitter rule).
 */
export async function emitContentQubeReceipt(input: EmitContentQubeReceiptInput): Promise<void> {
  const { contentQubeId, descriptor, action, decision } = input;

  // Mirror the rule in evaluateAccess: free A/B reads carry receipt.mode='none'
  // and we don't anchor those — they would flood the table without value.
  if (decision.receipt.mode === 'none') return;

  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[emitContentQubeReceipt] Supabase unavailable; receipt dropped');
    return;
  }

  // Build a T1/T2-safe payload. T0 fields (personaId, authProfileId, rootDid)
  // are never included — only the asset reference, decision shape, and the
  // T2 alias commitment from decision.receipt.
  const receipt_payload: Record<string, unknown> = {
    cohort_id: decision.receipt.cohortId,
    receipt_mode: decision.receipt.mode,
    asset_id: descriptor.assetId,
    asset_state: descriptor.state,
    gating_kind: descriptor.gating.kind,
    action,
    allow: decision.allow,
    reason: decision.reason,
    delivery_mode: decision.deliveryMode,
  };

  const { error } = await supabase.from('content_qube_dvn_receipts').insert({
    content_qube_id: contentQubeId,
    receipt_kind: actionToReceiptKind(action),
    t2_alias_commitment: decision.receipt.aliasCommitment,
    receipt_payload,
  });

  if (error) {
    console.warn(
      `[emitContentQubeReceipt] insert failed qube=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Transfer receipt — Phase 9 (first-issuance / edition claim)
// ─────────────────────────────────────────────────────────────────────────

export interface EmitTransferReceiptInput {
  contentQubeId: string;
  editionId: string;
  editionNumber: number;
  rarity: ContentQubeRarity;
  /** Optional reference to the purchase row that triggered the transfer. */
  sourcePurchaseId?: string;
  /** T2 alias commitment — the ONLY persona handle written to the receipt. */
  aliasCommitment: string | null;
}

/**
 * Write a 'transfer' receipt for an edition claim / first issuance.
 * Fire-and-forget tolerant — never throws.
 */
export async function emitContentQubeTransferReceipt(input: EmitTransferReceiptInput): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[emitContentQubeTransferReceipt] Supabase unavailable; receipt dropped');
    return;
  }

  const { contentQubeId, editionId, editionNumber, rarity, sourcePurchaseId, aliasCommitment } = input;

  const receipt_payload: Record<string, unknown> = {
    edition_id:     editionId,
    edition_number: editionNumber,
    rarity,
  };
  if (sourcePurchaseId) receipt_payload.source_purchase_id = sourcePurchaseId;

  const { error } = await supabase.from('content_qube_dvn_receipts').insert({
    content_qube_id:     contentQubeId,
    receipt_kind:        'transfer' as ContentQubeDvnReceiptKind,
    t2_alias_commitment: aliasCommitment,
    receipt_payload,
  });

  if (error) {
    console.warn(
      `[emitContentQubeTransferReceipt] insert failed qube=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Mint receipt
// ─────────────────────────────────────────────────────────────────────────

export interface EmitMintReceiptInput {
  contentQubeId: string;
  /** UUID of the edition row (absent for master-qube mints). */
  editionId?: string;
  /** Hex uint256 token ID assigned on-chain. */
  tokenId: string;
  txHash: string;
  /** Rarity class (absent for master-qube mints). */
  rarity?: ContentQubeRarity;
  /** Chain identifier, e.g. 'base'. */
  chain: string;
  /** T2 alias commitment — the ONLY persona handle written to the receipt. */
  aliasCommitment: string | null;
  /** True when minting the ERC-721 master token rather than an edition. */
  masterMint?: boolean;
}

/**
 * Write a 'mint' receipt for a canonical TokenQube mint event.
 * Fire-and-forget tolerant — errors are logged but never thrown.
 */
export async function emitContentQubeMintReceipt(input: EmitMintReceiptInput): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[emitContentQubeMintReceipt] Supabase unavailable; receipt dropped');
    return;
  }

  const { contentQubeId, editionId, tokenId, txHash, rarity, chain, aliasCommitment, masterMint } = input;

  const receipt_payload: Record<string, unknown> = {
    token_id:    tokenId,
    tx_hash:     txHash,
    chain,
    master_mint: masterMint ?? false,
  };
  if (editionId) receipt_payload.edition_id = editionId;
  if (rarity)    receipt_payload.rarity      = rarity;

  const { error } = await supabase.from('content_qube_dvn_receipts').insert({
    content_qube_id:     contentQubeId,
    receipt_kind:        'mint' as ContentQubeDvnReceiptKind,
    t2_alias_commitment: aliasCommitment,
    receipt_payload,
  });

  if (error) {
    console.warn(
      `[emitContentQubeMintReceipt] insert failed qube=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
  }
}

/**
 * Emit a creation receipt — called once when a content_qube is canonized
 * (lifecycle transition into 'canonized'). T2 alias is optional here since
 * the creator may be system/admin rather than a specific persona.
 */
export async function emitContentQubeCreationReceipt(
  contentQubeId: string,
  payload: Record<string, unknown>,
  aliasCommitment?: string | null,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { error } = await supabase.from('content_qube_dvn_receipts').insert({
    content_qube_id: contentQubeId,
    receipt_kind: 'creation',
    t2_alias_commitment: aliasCommitment ?? null,
    receipt_payload: payload,
  });

  if (error) {
    console.warn(
      `[emitContentQubeCreationReceipt] insert failed qube=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
  }
}
