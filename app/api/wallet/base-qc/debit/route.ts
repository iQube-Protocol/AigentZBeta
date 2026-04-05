/**
 * Base Q¢ Debit API
 * POST /api/wallet/base-qc/debit
 *
 * Debits a Q¢ amount from a persona's off-chain qc_balances (DVN custody).
 * Used when a user pays for content using their DVN Q¢ balance rather than
 * sending an on-chain EVM transaction.
 *
 * Body: { personaId, amount, contentId, reason? }
 * Returns: { ok, newBalance, txId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      personaId?: string;
      amount?: number;
      contentId?: string;
      reason?: string;
    };

    const { personaId, amount, contentId, reason } = body;

    if (!personaId || !amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'personaId and a positive amount are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch current balance rows
    const { data: rows, error: fetchError } = await supabase
      .from('qc_balances')
      .select('id, balance')
      .eq('persona_id', personaId)
      .eq('currency', 'base_qc')
      .order('balance', { ascending: false });

    if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });

    const total = (rows || []).reduce((sum, r) => sum + Number(r.balance), 0);

    if (total < amount) {
      return NextResponse.json(
        { ok: false, error: `Insufficient DVN Q¢ balance. Have ${total}, need ${amount}.` },
        { status: 402 }
      );
    }

    // Deduct from rows largest-first (greedy)
    let remaining = amount;
    const updates: { id: string; newBalance: number }[] = [];
    for (const row of rows || []) {
      if (remaining <= 0) break;
      const bal = Number(row.balance);
      const deduct = Math.min(bal, remaining);
      updates.push({ id: row.id, newBalance: bal - deduct });
      remaining -= deduct;
    }

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('qc_balances')
        .update({ balance: u.newBalance, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    // Record the transaction as a DVN receipt
    const txId = `dvn-qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('qc_transactions').insert({
      persona_id: personaId,
      amount: -amount,
      currency: 'base_qc',
      type: 'debit',
      reference_id: contentId || null,
      reason: reason || 'content_purchase',
      tx_id: txId,
      created_at: new Date().toISOString(),
    }).select().maybeSingle(); // Non-fatal if table doesn't exist yet

    return NextResponse.json({
      ok: true,
      txId,
      debitedAmount: amount,
      newBalance: total - amount,
      currency: 'base_qc',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
