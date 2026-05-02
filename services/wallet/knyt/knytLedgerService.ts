/**
 * KNYT Ledger Service
 *
 * Core service for DVN KNYT (x402 ledger) operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  KnytTransaction,
  KnytTxSource,
  KnytBalance,
  KnytLedgerResult,
  KnytBalanceResult,
  KnytDvnEvent,
} from './types';
import { enqueueDvnEvent } from './knytDvnBatcher';

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

/**
 * Resolve a persona identifier to the canonical `wallet_balances.persona_id`
 * format (UUID). FIO-handle-style IDs (contains '@') are looked up in the
 * personas table; all other formats are returned as-is.
 */
async function resolvePersonaId(personaId: string, supabase: SupabaseClient): Promise<string> {
  if (!personaId.includes('@')) return personaId;
  const { data } = await supabase
    .from('personas')
    .select('id')
    .eq('fio_handle', personaId)
    .single();
  return data?.id ?? personaId; // fallback to original if not found in personas table
}

/** Get current DVN KNYT balance for a persona */
export async function getKnytBalance(personaId: string): Promise<KnytBalanceResult> {
  try {
    const supabase = getSupabaseClient();
    const canonicalId = await resolvePersonaId(personaId, supabase);
    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('persona_id', canonicalId)
      .eq('asset_code', 'KNYT')
      .single();

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      balance: {
        personaId,
        dvnKnyt: data?.balance ? parseFloat(data.balance) : 0,
        updatedAt: data?.updated_at || new Date().toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Credit KNYT to a persona's balance */
export async function creditKnyt(
  personaId: string,
  amount: number,
  source: KnytTxSource,
  metadata?: Record<string, any>
): Promise<KnytLedgerResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const supabase = getSupabaseClient();
  const canonicalId = await resolvePersonaId(personaId, supabase);
  const now = new Date().toISOString();
  const txId = `knyt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const currentResult = await getKnytBalance(personaId);
  const currentBalance = currentResult.balance?.dvnKnyt || 0;
  const newBalance = currentBalance + amount;

  await supabase.from('wallet_balances').upsert({
    persona_id: canonicalId, asset_code: 'KNYT',
    balance: newBalance.toString(), updated_at: now,
  }, { onConflict: 'persona_id,asset_code' });

  await supabase.from('wallet_transactions').insert({
    id: txId, persona_id: canonicalId, asset_code: 'KNYT',
    amount: amount.toString(), direction: 'credit', source,
    metadata, created_at: now,
  });

  await enqueueDvnEvent({ personaId: canonicalId, amount, direction: 'credit', source, txId, timestamp: Date.now() });

  console.log(`[KNYT] Credited ${amount} to ${personaId} (canonical: ${canonicalId}). Balance: ${newBalance}`);
  return { success: true, newBalance, transaction: { id: txId, personaId, amount, direction: 'credit', source, createdAt: now } };
}

/** Debit KNYT from a persona's balance (fails if insufficient) */
export async function debitKnyt(
  personaId: string,
  amount: number,
  source: KnytTxSource,
  metadata?: Record<string, any>
): Promise<KnytLedgerResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const supabase = getSupabaseClient();
  const canonicalId = await resolvePersonaId(personaId, supabase);

  const currentResult = await getKnytBalance(personaId);
  const currentBalance = currentResult.balance?.dvnKnyt || 0;
  if (currentBalance < amount) {
    return { success: false, error: `Insufficient KNYT. Need: ${amount}, Have: ${currentBalance}` };
  }

  const now = new Date().toISOString();
  const txId = `knyt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newBalance = currentBalance - amount;

  await supabase.from('wallet_balances').upsert({
    persona_id: canonicalId, asset_code: 'KNYT',
    balance: newBalance.toString(), updated_at: now,
  }, { onConflict: 'persona_id,asset_code' });

  await supabase.from('wallet_transactions').insert({
    id: txId, persona_id: canonicalId, asset_code: 'KNYT',
    amount: amount.toString(), direction: 'debit', source,
    metadata, created_at: now,
  });

  await enqueueDvnEvent({ personaId: canonicalId, amount, direction: 'debit', source, txId, timestamp: Date.now(), assetId: metadata?.assetId });

  console.log(`[KNYT] Debited ${amount} from ${personaId} (canonical: ${canonicalId}). Balance: ${newBalance}`);
  return { success: true, newBalance, transaction: { id: txId, personaId, amount, direction: 'debit', source, createdAt: now } };
}

