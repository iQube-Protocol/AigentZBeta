import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type WalletAssetCode = 'KNYT' | 'QCT' | 'USDC';
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
