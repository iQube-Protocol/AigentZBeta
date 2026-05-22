/**
 * Q¢ payment-intent helper — builds the x402-style envelope returned in
 * 402 responses when a persona's DVN Q¢ balance is insufficient for a
 * community-content remix. Mirrors `/api/a2a/facilitator/pay-intent`
 * shape so the existing facilitator verify endpoint can validate the
 * on-chain settlement without any new RPC plumbing.
 *
 * Production-grade switch to mainnet: flip the three env vars
 *   QCT_CHAIN_ID
 *   QCT_TOKEN_ADDRESS
 *   TREASURY_ADDRESS
 * and the same code path serves Base mainnet payments.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

/** Default to QCT on Base Sepolia. */
const DEFAULT_TOKEN_ADDRESS = '0x4C4f1aD931589449962bB675bcb8e95672349d09';
const DEFAULT_CHAIN_ID = 84532;
const DEFAULT_TREASURY = '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5f'; // MoneyPenny

const DEADLINE_SECONDS = 15 * 60;

export interface QcPaymentIntent {
  intentId: string;
  asset: 'QCT';
  chainId: number;
  tokenAddress: string;
  payTo: string;
  /** Amount in token base units (18 decimals); 1 Q¢ = 1e18 base units. */
  amount: string;
  /** Same amount expressed in user-facing Q¢ cents (integer). */
  amountQc: number;
  currency: 'QCT';
  deadline: number;
}

function tokenAddress(): string {
  return process.env.QCT_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;
}

function chainId(): number {
  const raw = process.env.QCT_CHAIN_ID;
  const n = raw ? Number(raw) : DEFAULT_CHAIN_ID;
  return Number.isFinite(n) ? n : DEFAULT_CHAIN_ID;
}

function treasuryAddress(): string {
  return process.env.TREASURY_ADDRESS || DEFAULT_TREASURY;
}

function qcToBaseUnits(qc: number): string {
  // QCT is 18 decimals; 1 Q¢ corresponds to 1 token unit (matches the
  // /api/a2a/facilitator/pay-intent encoding where 0.8 Q¢ = 8e17).
  return (BigInt(Math.max(0, Math.floor(qc))) * 10n ** 18n).toString();
}

/**
 * Build and persist a pending Q¢ settlement intent for a remix. Records
 * a row in qc_transactions with type='settlement_pending' so the settle
 * endpoint can later look up the intent and verify the matching on-chain
 * transfer.
 */
export async function createQcPaymentIntent(
  supabase: SupabaseClient,
  personaId: string,
  qcAmount: number,
  reason: string,
  referenceId: string,
): Promise<QcPaymentIntent> {
  const intentId = `qc-intent-${Date.now()}-${randomBytes(6).toString('hex')}`;
  const intent: QcPaymentIntent = {
    intentId,
    asset: 'QCT',
    chainId: chainId(),
    tokenAddress: tokenAddress(),
    payTo: treasuryAddress(),
    amount: qcToBaseUnits(qcAmount),
    amountQc: qcAmount,
    currency: 'QCT',
    deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
  };

  // Persist as a pending row so the /settle endpoint can recover the
  // expected amount + payTo + tokenAddress + chainId without trusting
  // any client-supplied values. amount stored as the user-facing Q¢
  // count (matches the qc_transactions.amount convention elsewhere).
  await supabase.from('qc_transactions').insert({
    persona_id: personaId,
    amount: -qcAmount,
    currency: 'base_qc',
    type: 'settlement_pending',
    reference_id: referenceId,
    reason,
    tx_id: intentId,
    created_at: new Date().toISOString(),
  });

  return intent;
}

/** Load a previously-issued intent for verification. */
export async function loadQcPaymentIntent(
  supabase: SupabaseClient,
  intentId: string,
): Promise<{
  personaId: string;
  amountQc: number;
  reason: string;
  referenceId: string;
} | null> {
  const { data } = await supabase
    .from('qc_transactions')
    .select('persona_id, amount, reason, reference_id, type')
    .eq('tx_id', intentId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    persona_id: string;
    amount: number;
    reason: string;
    reference_id: string;
    type: string;
  };
  if (row.type !== 'settlement_pending') return null;
  return {
    personaId: row.persona_id,
    amountQc: Math.abs(row.amount),
    reason: row.reason,
    referenceId: row.reference_id,
  };
}

/** Mark an intent as settled so it can't be replayed. */
export async function markQcPaymentIntentSettled(
  supabase: SupabaseClient,
  intentId: string,
  txHash: string,
): Promise<void> {
  await supabase
    .from('qc_transactions')
    .update({
      type: 'settlement_complete',
      tx_id: `${intentId}::${txHash}`,
    })
    .eq('tx_id', intentId);
}

export function qcEnvVars() {
  return {
    chainId: chainId(),
    tokenAddress: tokenAddress(),
    treasury: treasuryAddress(),
  };
}
