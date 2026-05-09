/**
 * GET  /api/wallet/knyt/treasury-admin  — recent deposits ($KNYT EVM, USDC, Base Q¢) + summary
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

async function queryDeposits(supabase: ReturnType<typeof createClient>, source: string) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, persona_id, amount, created_at, metadata')
    .eq('source', source)
    .eq('direction', 'credit')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Multi-source query for fiat-funded KNYT issuance. Combines paypal_purchase
 * (live), qc_purchase (stub), and usdc_purchase (stub) into one chronological
 * list. Recovered credits (metadata.recovered = true) are included since the
 * operator wants the treasury card to reflect the full liability picture, not
 * just fresh sales.
 */
async function queryKnytIssued(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, persona_id, amount, created_at, metadata, source')
    .in('source', ['paypal_purchase', 'qc_purchase', 'usdc_purchase'])
    .eq('direction', 'credit')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function readMetaNumber(meta: unknown, key: string): number {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const v = (meta as Record<string, unknown>)[key];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const [deposits, usdcDeposits, qcDeposits, qcBalResult, knytIssued] = await Promise.all([
      queryDeposits(supabase, 'evm_deposit'),
      queryDeposits(supabase, 'usdc_deposit'),
      queryDeposits(supabase, 'qc_deposit'),
      supabase.from('qc_balances').select('balance').eq('currency', 'base_qc'),
      queryKnytIssued(supabase),
    ]);

    const total = deposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const totalUsdc = usdcDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const totalQc = qcDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const qcDvnTotal = (qcBalResult.data ?? []).reduce(
      (sum, r) => sum + parseFloat((r as { balance?: string }).balance ?? '0'), 0
    );

    // PayPal-only fiat inflow: sum of metadata.fiatAmount (or finalPriceUsd as
    // a fallback for older rows). qc_purchase / usdc_purchase are stubs that
    // didn't actually move USD, so they don't count toward the fiat card.
    const paypalRows = knytIssued.filter((r) => (r as { source: string }).source === 'paypal_purchase');
    const totalFiatPaypalUsd = paypalRows.reduce(
      (sum, r) => sum + (readMetaNumber((r as { metadata: unknown }).metadata, 'fiatAmount') || readMetaNumber((r as { metadata: unknown }).metadata, 'finalPriceUsd')),
      0,
    );

    // KNYT issued via any of the three off-chain sources. This is the
    // platform's liability — DVN KNYT we owe to user wallets.
    const totalKnytIssued = knytIssued.reduce((sum, r) => sum + parseFloat((r as { amount: string }).amount), 0);

    return NextResponse.json({
      deposits,
      totalDeposited: total.toFixed(4),
      count: deposits.length,
      usdcDeposits,
      totalUsdcDeposited: totalUsdc.toFixed(4),
      usdcCount: usdcDeposits.length,
      qcDeposits,
      totalQcDeposited: totalQc.toFixed(4),
      qcCount: qcDeposits.length,
      qcDvnTotal: qcDvnTotal.toFixed(2),

      // Fiat-funded sales + KNYT issuance liability
      knytIssued,
      totalKnytIssued: totalKnytIssued.toFixed(4),
      knytIssuedCount: knytIssued.length,
      totalFiatPaypalUsd: totalFiatPaypalUsd.toFixed(2),
      fiatPaypalCount: paypalRows.length,
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

  if (personaId) {
    const { creditKnyt } = await import('@/services/wallet/knyt/knytLedgerService');
    await creditKnyt(personaId, amountKnyt, 'airdrop', {
      evm_tx_hash: result.txHash,
      airdrop_to: toAddress,
    });
  }

  return NextResponse.json({ success: true, txHash: result.txHash });
}
