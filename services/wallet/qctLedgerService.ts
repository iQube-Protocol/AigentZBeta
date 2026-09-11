import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 'BCENT' credits an off-chain simulated BitCent (B¢) balance — there is no
 * live Bitcoin Rune to settle against yet (R-10 blocked; see
 * codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md).
 * It uses the same `QriptoDenomination` naming as
 * services/qriptocent/settlement/types.ts so the two stay in lockstep —
 * 'QCT' here is this ledger's pre-existing name for Base Q¢ ('BASE_QC').
 */
export type WalletAssetCode = 'KNYT' | 'QCT' | 'USDC' | 'BCENT';
export type WalletTxDirection = 'credit' | 'debit';

export interface WalletBalance {
  personaId: string;
  assetCode: WalletAssetCode;
  balance: number;
  updatedAt: string;
}

export interface WalletLedgerResult {
  success: boolean;
  newBalance?: number;
  error?: string;
  txId?: string;
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function makeTxId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function getWalletAssetBalance(personaId: string, assetCode: WalletAssetCode): Promise<WalletLedgerResult & { balance?: WalletBalance }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('persona_id', personaId)
      .eq('asset_code', assetCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      balance: {
        personaId,
        assetCode,
        balance: data?.balance ? parseFloat(data.balance) : 0,
        updatedAt: data?.updated_at || new Date().toISOString(),
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to fetch balance' };
  }
}

export async function creditWalletAsset(
  personaId: string,
  assetCode: WalletAssetCode,
  amount: number,
  source: string,
  metadata?: Record<string, any>
): Promise<WalletLedgerResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const txId = makeTxId(assetCode.toLowerCase());

  const currentResult = await getWalletAssetBalance(personaId, assetCode);
  const current = currentResult.balance?.balance || 0;
  const newBalance = round8(current + amount);

  await supabase.from('wallet_balances').upsert(
    {
      persona_id: personaId,
      asset_code: assetCode,
      balance: newBalance.toString(),
      updated_at: now,
    },
    { onConflict: 'persona_id,asset_code' }
  );

  await supabase.from('wallet_transactions').insert({
    id: txId,
    persona_id: personaId,
    asset_code: assetCode,
    amount: round8(amount).toString(),
    direction: 'credit',
    source,
    metadata,
    created_at: now,
  });

  return { success: true, newBalance, txId };
}

export interface ConvertWalletAssetResult {
  success: boolean;
  error?: string;
  /** Set only on 'INSUFFICIENT_FUNDS' — lets callers return 400 rather than 500. */
  insufficientFunds?: boolean;
  debitTxId?: string;
  creditTxId?: string;
  priorSourceBalance?: number;
  resultingSourceBalance?: number;
  priorDestinationBalance?: number;
  resultingDestinationBalance?: number;
}

/**
 * Canonical, ATOMIC two-asset conversion (2026-09-01, CTP Slice C
 * prerequisite — Part B). Binds the single Postgres function
 * `convert_wallet_asset` (supabase/migrations/20260930150000_wallet_atomic_convert.sql)
 * — lock both balance rows in a fixed order, validate sufficiency under
 * lock, debit, credit, insert BOTH wallet_transactions rows, and return the
 * committed resulting balances, all inside ONE database transaction. Any
 * failure anywhere aborts the whole thing; there is no compensating-
 * transaction/rollback logic here or anywhere else — the database performs
 * the rollback.
 *
 * Replaces the previous debitWalletAsset -> creditWalletAsset composition
 * for any NEW caller. `debitWalletAsset`/`creditWalletAsset` above are
 * PRESERVED, unmodified, for their existing non-conversion callers (e.g. a
 * single-asset credit with no paired debit) — this function is additive,
 * not a replacement for every use of the ledger.
 */
export async function convertWalletAsset(input: {
  personaId: string;
  sourceAsset: WalletAssetCode;
  destinationAsset: WalletAssetCode;
  sourceAmount: number;
  destinationAmount: number;
  source: string;
  metadata?: Record<string, any>;
}): Promise<ConvertWalletAssetResult> {
  const { personaId, sourceAsset, destinationAsset, sourceAmount, destinationAmount, source, metadata } = input;
  if (sourceAmount <= 0 || destinationAmount <= 0) {
    return { success: false, error: 'Amounts must be positive' };
  }

  const supabase = getSupabaseClient();
  const debitTxId = makeTxId(sourceAsset.toLowerCase());
  const creditTxId = makeTxId(destinationAsset.toLowerCase());

  const { data, error } = await supabase.rpc('convert_wallet_asset', {
    p_persona_id: personaId,
    p_source_asset: sourceAsset,
    p_destination_asset: destinationAsset,
    p_source_amount: round8(sourceAmount),
    p_destination_amount: round8(destinationAmount),
    p_source: source,
    p_metadata: metadata ?? null,
    p_debit_tx_id: debitTxId,
    p_credit_tx_id: creditTxId,
  });

  if (error) {
    const message = error.message || 'Conversion failed';
    if (message.includes('INSUFFICIENT_FUNDS')) {
      return { success: false, error: message, insufficientFunds: true };
    }
    return { success: false, error: message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { success: false, error: 'convert_wallet_asset returned no result row' };
  }

  return {
    success: true,
    debitTxId: row.debit_tx_id,
    creditTxId: row.credit_tx_id,
    priorSourceBalance: parseFloat(row.prior_source_balance),
    resultingSourceBalance: parseFloat(row.resulting_source_balance),
    priorDestinationBalance: parseFloat(row.prior_destination_balance),
    resultingDestinationBalance: parseFloat(row.resulting_destination_balance),
  };
}

export async function debitWalletAsset(
  personaId: string,
  assetCode: WalletAssetCode,
  amount: number,
  source: string,
  metadata?: Record<string, any>
): Promise<WalletLedgerResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const currentResult = await getWalletAssetBalance(personaId, assetCode);
  const current = currentResult.balance?.balance || 0;
  if (current < amount) {
    return { success: false, error: `Insufficient ${assetCode}. Need: ${amount}, Have: ${current}` };
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const txId = makeTxId(assetCode.toLowerCase());
  const newBalance = round8(current - amount);

  await supabase.from('wallet_balances').upsert(
    {
      persona_id: personaId,
      asset_code: assetCode,
      balance: newBalance.toString(),
      updated_at: now,
    },
    { onConflict: 'persona_id,asset_code' }
  );

  await supabase.from('wallet_transactions').insert({
    id: txId,
    persona_id: personaId,
    asset_code: assetCode,
    amount: round8(amount).toString(),
    direction: 'debit',
    source,
    metadata,
    created_at: now,
  });

  return { success: true, newBalance, txId };
}
