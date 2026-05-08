/**
 * KNYT DVN Tx Verify API
 * GET /api/wallet/knyt/verify?txId=knyt_xxx
 *
 * Looks up a wallet_transactions row plus its DVN batch attribution (if any)
 * so the Verify tab can confirm an off-chain DVN transfer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const txId = request.nextUrl.searchParams.get('txId');
  if (!txId) {
    return NextResponse.json({ error: 'txId is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase unavailable' }, { status: 500 });
  }

  const { data: tx, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('id', txId)
    .single();

  if (error || !tx) {
    return NextResponse.json({
      status: 'not_found',
      error: error?.message || 'Transaction not found',
    }, { status: 404 });
  }

  return NextResponse.json({
    status: 'confirmed',
    chain: 'DVN/ICP',
    asset: tx.asset_code,
    amount: tx.amount,
    direction: tx.direction,
    source: tx.source,
    from: tx.persona_id,
    to: tx.metadata?.to || tx.metadata?.toIdentifier,
    timestamp: tx.created_at ? Math.floor(new Date(tx.created_at).getTime() / 1000) : undefined,
    dvnBatchId: tx.dvn_batch_id || null,
    dvnSubmittedAt: tx.dvn_submitted_at || null,
    metadata: tx.metadata || null,
  });
}
