/**
 * GET  /api/wallet/knyt/treasury-admin  — recent EVM deposits + summary
 * POST /api/wallet/knyt/treasury-admin  — admin airdrop (mintKnyt)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mintKnyt } from '@/services/wallet/knyt/evmKnytService';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: deposits, error } = await supabase
      .from('wallet_transactions')
      .select('id, persona_id, amount, created_at, metadata')
      .eq('source', 'evm_deposit')
      .eq('direction', 'credit')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const total = (deposits ?? []).reduce((sum, d) => sum + parseFloat(d.amount), 0);

    return NextResponse.json({
      deposits: deposits ?? [],
      totalDeposited: total.toFixed(4),
      count: deposits?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { toAddress?: string; amountKnyt?: number; personaId?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { toAddress, amountKnyt, personaId } = body;
  if (!toAddress || !amountKnyt || amountKnyt <= 0) {
    return NextResponse.json({ error: 'toAddress and positive amountKnyt required' }, { status: 400 });
  }

  const result = await mintKnyt(toAddress, amountKnyt);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // If a personaId is provided, also credit the DVN ledger
  if (personaId) {
    const { creditKnyt } = await import('@/services/wallet/knyt/knytLedgerService');
    await creditKnyt(personaId, amountKnyt, 'airdrop', {
      evm_tx_hash: result.txHash,
      airdrop_to: toAddress,
    });
  }

  return NextResponse.json({ success: true, txHash: result.txHash });
}
