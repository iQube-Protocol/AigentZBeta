import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-Side Transaction Log (Tier 3 Batching)
 * 
 * Implements append-only transaction logs for server-side batching
 * as part of the Three-Tier Batching System:
 * - Tier 1: Fast-track high-value → immediate DVN→PoS→BTC anchor
 * - Tier 2: DVN→PoS drift batching → when drift > 10, auto-batch
 * - Tier 3: Server-side batching → append-only logs → Merkle root → DVN BatchCommit → PoS anchor
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TransactionLogEntry {
  id: string;
  type: 'evm' | 'btc' | 'solana' | 'dvn';
  chain_id?: string;
  tx_hash: string;
  data: Record<string, any>;
  batch_id?: string;
  created_at: string;
  processed: boolean;
  batched_at?: string;
}

// POST /api/ops/batch/transaction-log - Add transaction to log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, chain_id, tx_hash, data } = body;

    if (!type || !tx_hash) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: type, tx_hash' },
        { status: 400 }
      );
    }

    const entry: Partial<TransactionLogEntry> = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      chain_id,
      tx_hash,
      data,
      processed: false,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('transaction_log')
      .insert([entry]);

    if (error) {
      console.error('Failed to log transaction:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to log transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction_id: entry.id,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Transaction log error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/batch/transaction-log - Get pending transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const processed = searchParams.get('processed') === 'true';

    const { data, error } = await supabase
      .from('transaction_log')
      .select('*')
      .eq('processed', processed)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch transaction log:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transactions: data || [],
      count: data?.length || 0,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Transaction log fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
