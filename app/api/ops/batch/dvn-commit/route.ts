import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

/**
 * DVN BatchCommit Integration (Tier 3 Batching)
 * 
 * Commits Merkle batches to DVN for cross-chain verification
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BatchCommitRequest {
  batchId: string;
  merkleRoot: string;
  transactionIds: string[];
}

// POST /api/ops/batch/dvn-commit - Commit batch to DVN
export async function POST(request: NextRequest) {
  try {
    const body: BatchCommitRequest = await request.json();
    const { batchId, merkleRoot, transactionIds } = body;

    if (!batchId || !merkleRoot || !transactionIds?.length) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: batchId, merkleRoot, transactionIds' },
        { status: 400 }
      );
    }

    // Get DVN canister ID
    const DVN_ID = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || 
                   process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;

    if (!DVN_ID) {
      return NextResponse.json(
        { ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' },
        { status: 500 }
      );
    }

    // Connect to DVN canister
    const dvn = await getActor<any>(DVN_ID, dvnIdl);

    // Prepare batch commit data
    const commitData = {
      batch_id: batchId,
      merkle_root: merkleRoot,
      transaction_count: transactionIds.length.toString(),
      transactions: transactionIds.map(id => ({
        id,
        timestamp: Date.now().toString(),
      })),
      metadata: {
        source: 'tier3_server_batch',
        created_at: new Date().toISOString(),
        version: '1.0',
      },
    };

    // Commit to DVN
    let dvnResult;
    try {
      // Check if DVN has batch_commit method, fallback to generic method
      if (typeof dvn.batch_commit === 'function') {
        dvnResult = await dvn.batch_commit(commitData);
      } else if (typeof dvn.commit_batch === 'function') {
        dvnResult = await dvn.commit_batch(commitData);
      } else {
        // Fallback: submit as individual transactions
        console.log('DVN batch_commit not available, using individual transaction submission');
        dvnResult = await Promise.all(
          transactionIds.map(id => dvn.submit_transaction({
            id,
            data: { batch_id: batchId, merkle_root: merkleRoot }
          }))
        );
      }
    } catch (error: any) {
      console.error('DVN commit failed:', error);
      return NextResponse.json(
        { ok: false, error: `DVN commit failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Update batch record as committed
    const { error: updateError } = await supabase
      .from('merkle_batches')
      .update({ 
        committed: true,
        committed_at: new Date().toISOString(),
        dvn_message_id: typeof dvnResult === 'string' ? dvnResult : dvnResult?.message_id,
      })
      .eq('id', batchId);

    if (updateError) {
      console.error('Failed to update batch status:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update batch status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      batchId,
      dvnResult,
      committedAt: new Date().toISOString(),
      transactionCount: transactionIds.length,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('DVN batch commit error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/batch/dvn-commit - Get commit status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { ok: false, error: 'batchId parameter required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('merkle_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      batch: data,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('DVN commit status error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
