/**
 * KNYT Claim Service — deferred minting support
 *
 * Creates claim records in the x402 `claims` table for KNYT rewards/purchases
 * when KNYT_MINTING_MODE=deferred. The claim is redeemed later by the persona
 * to credit their DVN KNYT balance via /api/x402/claims/redeem.
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
 * Returns true when the platform is configured for deferred KNYT minting.
 * Set KNYT_MINTING_MODE=deferred in env to enable; defaults to immediate.
 */
export function isKnytDeferred(): boolean {
  return (process.env.KNYT_MINTING_MODE || "immediate").toLowerCase() === "deferred";
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

  const claimId = `knyt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const expiry = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

  const { error } = await supabase.from("claims").insert({
    claim_id: claimId,
    asset: "knyt",
    amount: amountKnyt,
    from_chain: "knyt-ledger",
    to_chain: "knyt-ledger",
    to_did: personaId,
    expiry,
    // Provisional root — the DVN batcher will update this on its next flush
    dvn_root: `pending_${Date.now()}`,
    status: "open",
    // Extra context stored as metadata where the table supports it
    ...(metadata ? { metadata: JSON.stringify({ source, ...metadata }) } : {}),
  });

  if (error) return { success: false, error: error.message };
  return { success: true, claimId };
}
