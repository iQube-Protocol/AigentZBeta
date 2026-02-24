/**
 * DVN Events API
 * 
 * GET /api/dvn/events?agentId=guest&limit=10
 * 
 * Returns DVN events for an agent from wallet_transactions table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch wallet transactions for the persona
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('persona_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DVN Events] Supabase error:', error);
      return NextResponse.json({
        success: true,
        events: [],
        agentId,
        limit,
      });
    }

    // Map transactions to event format
    const events = (transactions || []).map((tx: any) => ({
      id: tx.id,
      timestamp: new Date(tx.created_at).getTime(),
      type: tx.direction === 'credit' ? 'receive' : 'send',
      status: tx.dvn_submitted_at ? 'confirmed' : 'pending',
      amount: parseFloat(tx.amount),
      asset: tx.asset_code,
      source: tx.source,
      metadata: tx.metadata,
      dvnBatchId: tx.dvn_batch_id,
    }));

    return NextResponse.json({
      success: true,
      events,
      agentId,
      limit,
    });

  } catch (error) {
    console.error('[DVN Events] Error:', error);
    return NextResponse.json({
      success: true,
      events: [],
      error: error instanceof Error ? error.message : 'Failed to fetch',
    });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
