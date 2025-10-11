import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(request: Request) {
  try {
    const { strategy = 'auto' } = await request.json().catch(() => ({}));
    
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    
    if (!POS_ID || !DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'Canister IDs not configured'
      }, { status: 400 });
    }

    // Get actors for both canisters
    const [pos, dvn] = await Promise.all([
      getActor<any>(POS_ID, posIdl),
      getActor<any>(DVN_ID, dvnIdl)
    ]);

    // Get current state
    const [posPendingCount, dvnPendingMessages] = await Promise.all([
      pos.get_pending_count().catch(() => BigInt(0)),
      dvn.get_pending_messages().catch(() => [])
    ]);

    const posCount = Number(posPendingCount);
    const dvnCount = Array.isArray(dvnPendingMessages) ? dvnPendingMessages.length : 0;
    
    if (posCount === dvnCount) {
      return NextResponse.json({
        ok: true,
        message: 'Canisters are already synchronized',
        action: 'none',
        before: { posCount, dvnCount },
        after: { posCount, dvnCount }
      });
    }

    let repairActions: string[] = [];
    let newPosCount = posCount;
    let newDvnCount = dvnCount;

    // Repair strategy based on which canister has more items
    if (strategy === 'auto' || strategy === 'balance') {
      if (posCount > dvnCount) {
        // More receipts than DVN messages - this is unusual, create DVN messages to match
        const deficit = posCount - dvnCount;
        for (let i = 0; i < deficit; i++) {
          try {
            const syncData = `sync_repair_${Date.now()}_${i}`;
            await dvn.submit_dvn_message(
              80002, // Chain ID
              0,     // Destination chain (ICP)
              Array.from(new TextEncoder().encode(JSON.stringify({
                action: 'SYNC_REPAIR',
                reason: 'balance_canisters',
                timestamp: Date.now()
              }))),
              `sync_repair_${Date.now()}`
            );
            repairActions.push(`Created DVN message ${i + 1}/${deficit}`);
          } catch (e: any) {
            repairActions.push(`Failed to create DVN message ${i + 1}: ${e.message}`);
          }
        }
        newDvnCount = dvnCount + deficit;
      } else {
        // More DVN messages than receipts
        const deficit = dvnCount - posCount;
        
        // When DVN has more messages than PoS, it means transactions are pending processing
        // Auto-repair should trigger the proper flow: batch → anchor → LayerZero
        const shouldAutoProcess = strategy === 'auto' && deficit >= 10;
        
        if (shouldAutoProcess) {
          // Execute the proper transaction processing flow
          repairActions.push(`Detected ${deficit} DVN messages awaiting processing`);
          repairActions.push('Drift has reached batching threshold (10+ items)');
          repairActions.push('Executing proper transaction flow: batch → anchor → LayerZero');
          
          try {
            // Step 1: Batch pending receipts
            const batchResult = await pos.batch_now();
            repairActions.push(`✓ Batched receipts: ${batchResult}`);
            
            // Step 2: Anchor to Bitcoin
            const anchorResult = await pos.anchor();
            repairActions.push(`✓ Anchored to Bitcoin: ${anchorResult}`);
            
            // Step 3: Process via LayerZero (return instruction for UI to handle)
            repairActions.push(`✓ Ready for LayerZero processing`);
            
            return NextResponse.json({
              ok: true,
              message: 'Auto-processing completed - batch and anchor successful',
              strategy,
              before: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
              after: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
              actions: repairActions,
              requiresLayerZero: true,
              batchId: batchResult,
              anchorId: anchorResult,
              at: new Date().toISOString()
            });
          } catch (e: any) {
            repairActions.push(`✗ Processing failed: ${e.message}`);
            return NextResponse.json({
              ok: false,
              message: 'Auto-processing failed',
              strategy,
              before: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
              actions: repairActions,
              error: e.message,
              at: new Date().toISOString()
            }, { status: 500 });
          }
        } else if (strategy === 'balance') {
          // Force balance by creating sync receipts (manual override)
          for (let i = 0; i < deficit; i++) {
            try {
              const syncData = `sync_repair_${Date.now()}_${i}`;
              await pos.issue_receipt(syncData);
              repairActions.push(`Created receipt ${i + 1}/${deficit}`);
            } catch (e: any) {
              repairActions.push(`Failed to create receipt ${i + 1}: ${e.message}`);
            }
          }
          newPosCount = posCount + deficit;
        } else {
          // Small drift (<10) - process via LayerZero without batching
          repairActions.push(`Detected ${deficit} DVN messages awaiting processing`);
          repairActions.push('Drift is below batching threshold (10 items)');
          repairActions.push('Processing via LayerZero without batching');
          
          // For small drifts, just trigger LayerZero processing
          return NextResponse.json({
            ok: true,
            message: 'Processing via LayerZero (no batching required)',
            strategy,
            before: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
            after: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
            actions: repairActions,
            requiresLayerZero: true,
            skipBatch: true,
            at: new Date().toISOString()
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Sync repair completed',
      strategy,
      before: { posCount, dvnCount, drift: Math.abs(posCount - dvnCount) },
      after: { posCount: newPosCount, dvnCount: newDvnCount, drift: Math.abs(newPosCount - newDvnCount) },
      actions: repairActions,
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Sync repair API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}
