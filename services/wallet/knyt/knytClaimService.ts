/**
 * KNYT Claim Service — deferred minting support
 *
 * Creates claim records in the x402 `claims` table for KNYT rewards/purchases
 * when the caller explicitly requests deferred minting mode. The claim is
 * redeemed later by the persona to credit their DVN KNYT balance via
 * /api/x402/claims/redeem.
 */

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

/** Claim TTL: 90 days */
const CLAIM_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface KnytClaimResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

/**
 * Inserts a deferred KNYT claim into the claims table.
 * The claim's dvn_root is provisional until the next DVN batcher flush assigns a real batch ID.
 */
export async function createKnytClaim(
  personaId: string,
  amountKnyt: number,
  source: string,
  metadata?: Record<string, unknown>
): Promise<KnytClaimResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { success: false, error: "Supabase unavailable" };

  // claim_id format mirrors the canonical x402 router shape (0x + 64 hex
  // chars) so the x402/claims/redeem path's primary-then-legacy column
  // lookup hits the new schema cleanly. The earlier `knyt_<ts>` form
  // surfaced as "Invalid payload" when downstream consumers ran it
  // through z.string()-with-pattern validators.
  const randHex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  const claimId = `0x${randHex}`;
  const expiry = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

  // Insert with the rich shape first; on column-not-found errors retry
  // with the minimal columns that every claims schema variant supports.
  // Returning the actual DB error string instead of swallowing it makes
  // operator debugging tractable when a new column is added upstream.
  const richRow = {
    claim_id: claimId,
    asset: "knyt",
    amount: String(amountKnyt),
    from_chain: "knyt-ledger",
    to_chain: "knyt-ledger",
    to_did: personaId,
    expiry,
    dvn_root: `pending_${Date.now()}`,
    status: "open",
    ...(metadata ? { metadata: JSON.stringify({ source, ...metadata }) } : {}),
  };

  let { error } = await supabase.from("claims").insert(richRow);

  if (error && /column .* does not exist/i.test(error.message)) {
    const minimalRow = {
      claim_id: claimId,
      asset: "knyt",
      amount: String(amountKnyt),
      to_did: personaId,
      status: "open",
    };
    const retry = await supabase.from("claims").insert(minimalRow);
    error = retry.error as typeof error;
  }

  if (error) {
    return {
      success: false,
      error: `KNYT claim insert failed: ${error.message}`,
    };
  }
  return { success: true, claimId };
}
