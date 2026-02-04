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

/** Get current DVN KNYT balance for a persona */
export async function getKnytBalance(personaId: string): Promise<KnytBalanceResult> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('persona_id', personaId)
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
  const now = new Date().toISOString();
  const txId = `knyt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const currentResult = await getKnytBalance(personaId);
  const currentBalance = currentResult.balance?.dvnKnyt || 0;
  const newBalance = currentBalance + amount;
  
  await supabase.from('wallet_balances').upsert({
    persona_id: personaId, asset_code: 'KNYT',
    balance: newBalance.toString(), updated_at: now,
  }, { onConflict: 'persona_id,asset_code' });
  
  await supabase.from('wallet_transactions').insert({
    id: txId, persona_id: personaId, asset_code: 'KNYT',
    amount: amount.toString(), direction: 'credit', source,
    metadata, created_at: now,
  });
  
  await enqueueDvnEvent({ personaId, amount, direction: 'credit', source, txId, timestamp: Date.now() });
  
  console.log(`[KNYT] Credited ${amount} to ${personaId}. Balance: ${newBalance}`);
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
  
  const currentResult = await getKnytBalance(personaId);
  const currentBalance = currentResult.balance?.dvnKnyt || 0;
  if (currentBalance < amount) {
    return { success: false, error: `Insufficient KNYT. Need: ${amount}, Have: ${currentBalance}` };
  }
  
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const txId = `knyt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newBalance = currentBalance - amount;
  
  await supabase.from('wallet_balances').upsert({
    persona_id: personaId, asset_code: 'KNYT',
    balance: newBalance.toString(), updated_at: now,
  }, { onConflict: 'persona_id,asset_code' });
  
  await supabase.from('wallet_transactions').insert({
    id: txId, persona_id: personaId, asset_code: 'KNYT',
    amount: amount.toString(), direction: 'debit', source,
    metadata, created_at: now,
  });
  
  await enqueueDvnEvent({ personaId, amount, direction: 'debit', source, txId, timestamp: Date.now(), assetId: metadata?.assetId });
  
  console.log(`[KNYT] Debited ${amount} from ${personaId}. Balance: ${newBalance}`);
  return { success: true, newBalance, transaction: { id: txId, personaId, amount, direction: 'debit', source, createdAt: now } };
}
