/**
 * Custodial settlement — the canonical/atomic Q¢ payment path for personas
 * that already have server-held keys in `agent_keys` (FIO-handle personas,
 * KNYT personas, etc).
 *
 * Architecture distinction:
 *   • Custodial (this file)           — server signs from agent_keys PK,
 *                                       no user signature, identical UX
 *                                       to A2A transfers. KEEP DVN IN THE
 *                                       LOOP — every settlement credits
 *                                       the DVN ledger first.
 *   • External wallet (x402 / qcPaymentIntent.ts) — user signs via
 *                                       MetaMask/Coinbase. Fallback for
 *                                       personas with no custodial row.
 *
 * Mode framework (see 2026-05-22 backlog brief):
 *   - atomic     — settle Mainnet → DVN → debit per tx (this file)
 *   - deferred   — debit DVN, batch-reconcile to Mainnet later
 *   - remote     — payment granted from a remote custody source (cohort
 *                  treasury, sponsor wallet, etc) — Phase 2
 *
 * This file handles the atomic mode. The other two land in follow-ons.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { qcEnvVars } from './qcPaymentIntent';

export interface CustodialSettlementResult {
  ok: boolean;
  txHash?: string;
  amountQc?: number;
  /** Why settlement was not attempted / failed — drives fallback choice. */
  reason?: 'no_custodial' | 'insufficient_custodial' | 'error';
  error?: string;
}

function assetKeyForChain(chainId: number): string {
  switch (chainId) {
    case 84532: return 'BASE_QCENT';
    case 421614: return 'ARB_QCENT';
    case 11155111: return 'ETH_QCENT';
    case 11155420: return 'OP_QCENT';
    case 80002: return 'POLY_QCENT';
    default: return 'BASE_QCENT';
  }
}

/**
 * Attempt to settle `amountQc` Q¢ atomically by transferring the equivalent
 * QCT from the persona's custodial wallet (agent_keys.evm_address) to the
 * MoneyPenny treasury, then crediting DVN by the same amount.
 *
 * Returns ok=true with the on-chain txHash on success. On `no_custodial`
 * or `insufficient_custodial` the caller should fall back to the x402
 * external-wallet flow. On `error` the caller should surface a 500.
 */
export async function attemptCustodialSettlement(
  supabase: SupabaseClient,
  personaId: string,
  amountQc: number,
  reason: string,
  referenceId: string,
): Promise<CustodialSettlementResult> {
  if (amountQc <= 0) return { ok: true, amountQc: 0 };

  const { chainId, tokenAddress, treasury } = qcEnvVars();
  const amountBaseUnits = (BigInt(amountQc) * 10n ** 18n).toString();
  const asset = assetKeyForChain(chainId);

  // Call the existing A2A signer endpoint — it already handles
  // agent_keys lookup (by agent_id / fio_handle / persona_id UUID /
  // evm_address), decrypts the PK, builds ethers.Wallet, checks balance,
  // and executes the transfer with DVN/PoS receipt issuance. Reusing it
  // means we get one canonical settlement path for both A2A and
  // community-content debits.
  const signerOrigin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let transferRes: Response;
  try {
    transferRes = await fetch(`${signerOrigin}/api/a2a/signer/transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: personaId,
        chainId,
        tokenAddress,
        to: treasury,
        amount: amountBaseUnits,
        asset,
      }),
      cache: 'no-store',
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      error: err instanceof Error ? err.message : 'signer fetch failed',
    };
  }

  const body = (await transferRes.json().catch(() => ({}))) as {
    ok?: boolean;
    txHash?: string;
    status?: number;
    error?: string;
    note?: string;
  };

  if (!transferRes.ok) {
    // Distinguish the two fall-back signals from genuine errors:
    //   404                          → persona has no agent_keys row
    //   400 with "Insufficient"      → custodial wallet is empty/short
    //   anything else                → system error, do not fall back
    if (transferRes.status === 404) return { ok: false, reason: 'no_custodial' };
    if (
      transferRes.status === 400 &&
      typeof body.error === 'string' &&
      /insufficient/i.test(body.error)
    ) {
      return { ok: false, reason: 'insufficient_custodial' };
    }
    return {
      ok: false,
      reason: 'error',
      error: body.error || `signer returned ${transferRes.status}`,
    };
  }

  const txHash = body.txHash;
  if (!txHash) {
    return { ok: false, reason: 'error', error: 'signer returned no txHash' };
  }

  // Record the settlement audit row BEFORE updating qc_balances so the
  // ledger trail is intact even if the balance update fails. tx_id
  // composes settlement-id::on-chain-hash so operators can grep either.
  const settleId = `custodial-settle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await supabase.from('qc_transactions').insert({
    persona_id: personaId,
    amount: amountQc,
    currency: 'base_qc',
    type: 'custodial_settlement',
    reference_id: referenceId,
    reason,
    tx_id: `${settleId}::${txHash}`,
    created_at: new Date().toISOString(),
  });

  // Credit DVN by the settled amount. Mirrors creditQc's upsert shape
  // but inline so we keep the settlement + credit in one place for
  // audit clarity. DVN balance is the canonical Q¢ ledger; on-chain
  // settlement just brings the user's balance up to par.
  const { data: rows } = await supabase
    .from('qc_balances')
    .select('id, balance')
    .eq('persona_id', personaId)
    .eq('currency', 'base_qc')
    .limit(1);

  const existing = (rows ?? [])[0] as { id: string; balance: number } | undefined;
  if (existing) {
    await supabase
      .from('qc_balances')
      .update({
        balance: Number(existing.balance) + amountQc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('qc_balances').insert({
      persona_id: personaId,
      currency: 'base_qc',
      balance: amountQc,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { ok: true, txHash, amountQc };
}
