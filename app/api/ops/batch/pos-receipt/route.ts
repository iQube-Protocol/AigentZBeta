import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

/**
 * PoS Batch Receipt System (Tier 3 Batching)
 * 
 * Issues batch receipts from Proof-of-State canister for server-side batches
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BatchReceiptRequest {
  batchId: string;
  merkleRoot: string;
  dvnMessageId?: string;
}

// POST /api/ops/batch/pos-receipt - Issue batch receipt from PoS
export async function POST(request: NextRequest) {
  try {
    const body: BatchReceiptRequest = await request.json();
    const { batchId, merkleRoot, dvnMessageId } = body;

    if (!batchId || !merkleRoot) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: batchId, merkleRoot' },
        { status: 400 }
      );
    }

    // Get PoS canister ID
    const POS_ID = process.env.PROOF_OF_STATE_CANISTER_ID || 
                  process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;

    if (!POS_ID) {
      return NextResponse.json(
        { ok: false, error: 'PROOF_OF_STATE_CANISTER_ID not configured' },
        { status: 500 }
      );
    }

    // Connect to PoS canister
    const pos = await getActor<any>(POS_ID, posIdl);

    // Issue receipt for the batch
    let receiptId;
    try {
      // Create data hash for the batch
      const batchData = {
        batch_id: batchId,
        merkle_root: merkleRoot,
        dvn_message_id: dvnMessageId,
        timestamp: Date.now(),
        source: 'tier3_server_batch',
      };
      
      const dataHash = `batch_${Buffer.from(JSON.stringify(batchData)).toString('base64')}`;
      receiptId = await pos.issue_receipt(dataHash);
      
      console.log('PoS batch receipt issued:', receiptId);
    } catch (error: any) {
      console.error('PoS receipt issuance failed:', error);
      return NextResponse.json(
        { ok: false, error: `PoS receipt failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Update batch record with receipt
    const { error: updateError } = await supabase
      .from('merkle_batches')
      .update({ 
        pos_receipt_id: receiptId,
        receipt_issued_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    if (updateError) {
      console.error('Failed to update batch with receipt:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update batch with receipt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      batchId,
      receiptId,
      merkleRoot,
      dvnMessageId,
      issuedAt: new Date().toISOString(),
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('PoS batch receipt error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/batch/pos-receipt - Get batch receipt status
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

    // If we have a receipt ID, get receipt details from PoS
    let receiptDetails = null;
    if (data.pos_receipt_id) {
      try {
        const POS_ID = process.env.PROOF_OF_STATE_CANISTER_ID || 
                      process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
        if (!POS_ID) {
          throw new Error('Proof of State canister ID not configured');
        }
        const pos = await getActor<any>(POS_ID, posIdl);
        receiptDetails = await pos.get_receipt(data.pos_receipt_id);
      } catch (error) {
        console.error('Failed to fetch receipt details:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      batch: data,
      receiptDetails,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('PoS batch receipt status error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
