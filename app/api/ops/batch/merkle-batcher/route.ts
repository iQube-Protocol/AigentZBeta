import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/**
 * Merkle Tree Batcher (Tier 3 Batching)
 * 
 * Creates Merkle roots from transaction logs for server-side batching
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  transactionId?: string;
}

interface MerkleBatch {
  id: string;
  root: string;
  transaction_ids: string[];
  created_at: string;
  committed: boolean;
  committed_at?: string;
}

// Simple Merkle tree implementation
function createMerkleRoot(transactionIds: string[]): { root: string; tree: MerkleNode } {
  if (transactionIds.length === 0) {
    throw new Error('Cannot create Merkle tree with no transactions');
  }

  // Create leaf nodes
  let nodes: MerkleNode[] = transactionIds.map(id => ({
    hash: createHash('sha256').update(id).digest('hex'),
    transactionId: id,
  }));

  const tree: MerkleNode[] = [...nodes];

  // Build tree upwards
  while (nodes.length > 1) {
    const nextLevel: MerkleNode[] = [];
    
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // Duplicate last node if odd number
      
      const combinedHash = createHash('sha256')
        .update(left.hash + right.hash)
        .digest('hex');
      
      const parentNode: MerkleNode = {
        hash: combinedHash,
        left,
        right,
      };
      
      nextLevel.push(parentNode);
    }
    
    nodes = nextLevel;
  }

  return {
    root: nodes[0].hash,
    tree: nodes[0],
  };
}

// POST /api/ops/batch/merkle-batcher - Create batch from pending transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize = 50, maxAge = 3600000 } = body; // Default 50 tx, 1 hour max age

    // Get unprocessed transactions
    const cutoffTime = new Date(Date.now() - maxAge).toISOString();
    
    const { data: transactions, error: fetchError } = await supabase
      .from('transaction_log')
      .select('id, created_at')
      .eq('processed', false)
      .lt('created_at', cutoffTime)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('Failed to fetch transactions:', fetchError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No pending transactions to batch',
        batchId: null,
        at: new Date().toISOString(),
      });
    }

    // Create Merkle root
    const transactionIds = transactions.map(tx => tx.id);
    const { root } = createMerkleRoot(transactionIds);

    // Create batch record
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: Partial<MerkleBatch> = {
      id: batchId,
      root,
      transaction_ids: transactionIds,
      created_at: new Date().toISOString(),
      committed: false,
    };

    const { error: batchError } = await supabase
      .from('merkle_batches')
      .insert([batch]);

    if (batchError) {
      console.error('Failed to create batch:', batchError);
      return NextResponse.json(
        { ok: false, error: 'Failed to create batch' },
        { status: 500 }
      );
    }

    // Mark transactions as batched
    const { error: updateError } = await supabase
      .from('transaction_log')
      .update({ 
        batch_id: batchId,
        batched_at: new Date().toISOString(),
      })
      .in('id', transactionIds);

    if (updateError) {
      console.error('Failed to update transactions:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      batchId,
      root,
      transactionCount: transactionIds.length,
      transactions: transactionIds,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Merkle batcher error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/batch/merkle-batcher - Get batches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const committed = searchParams.get('committed') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data, error } = await supabase
      .from('merkle_batches')
      .select('*')
      .eq('committed', committed)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch batches:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch batches' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      batches: data || [],
      count: data?.length || 0,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Merkle batcher fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
