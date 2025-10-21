export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function GET(req: NextRequest) {
  try {
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    
    if (!DVN_ID || !POS_ID) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Canister IDs not configured' 
      }, { status: 500 });
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);
    const pos = await getActor<any>(POS_ID, posIdl);

    // Get DVN pending messages
    const dvnPending = await dvn.get_pending_messages().catch(() => []);
    
    // Get PoS pending receipts
    const posPending = await pos.get_pending_count().catch(() => 0);

    // Filter A2A-related DVN messages
    const a2aMessages = dvnPending.filter((msg: any) => {
      try {
        const payload = new TextDecoder().decode(new Uint8Array(msg.payload || []));
        return payload.includes('A2A_') || payload.includes('MONITOR');
      } catch {
        return false;
      }
    });

    // Get recent batches to see processed A2A transactions
    const recentBatches = await pos.get_batches().catch(() => []);
    const a2aBatches = recentBatches.filter((batch: any) => {
      return batch.receipts?.some((receipt: any) => 
        receipt.source?.includes('A2A_') || false
      );
    }).slice(0, 5); // Last 5 A2A batches

    return NextResponse.json({
      ok: true,
      a2aStatus: {
        pendingDVN: Number(a2aMessages.length),
        pendingPoS: Number(posPending),
        recentA2AMessages: a2aMessages.slice(0, 10).map((msg: any) => ({
          messageId: String(msg.message_id || 'unknown'),
          sourceChain: Number(msg.source_chain || 0),
          timestamp: Number(msg.timestamp || Date.now()),
          payload: (() => {
            try {
              return new TextDecoder().decode(new Uint8Array(msg.payload || []));
            } catch {
              return 'binary_data';
            }
          })()
        })),
        recentA2ABatches: a2aBatches.map((batch: any) => ({
          batchId: String(batch.id || 'unknown'),
          receiptCount: Number(batch.receipts?.length || 0),
          timestamp: Number(batch.timestamp || Date.now()),
          a2aReceipts: Number(batch.receipts?.filter((r: any) => r.source?.includes('A2A_')).length || 0)
        }))
      },
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('A2A status error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to get A2A status'
    }, { status: 500 });
  }
}
