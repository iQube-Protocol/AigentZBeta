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

    /*
     * ── THE `balance` STRATEGY IS REMOVED (operator ruling, 2026-08-08) ─────
     *
     * It "repaired" drift by FABRICATING whichever side had fewer entries:
     * `pos.issue_receipt('sync_repair_...')` when PoS was short, or a
     * `SYNC_REPAIR` DVN message when DVN was. Those PoS receipts are not
     * inert — they enter the genuine Merkle-batch → Bitcoin-anchor path and
     * are anchored for real.
     *
     * Measured live, 2026-08-08: of 624 receipts across the PoS canister's
     * 161 batches, 263 were `sync_*`, 143 `test_*` and 55 `anchor*` — 74% of
     * everything ever committed to Bitcoin by this system was synthetic, and
     * `sync_*` alone was the single largest population. Not one activity
     * receipt was present, because the constitutional pipeline never called
     * `issue_receipt` at all until the dual-leg repair in the same change.
     *
     * So this loop was writing filler into the Bitcoin provenance stream to
     * make a metric agree — and the metric it satisfied was itself meaningless
     * (see the drift note in ../status/route.ts: two unrelated populations).
     *
     * Historical `sync_*` anchors stay where they are: Bitcoin history is
     * immutable and nothing here rewrites it. They are classified as synthetic
     * diagnostic artifacts, never constitutional provenance.
     *
     * `strategy: 'balance'` is now REFUSED rather than silently ignored — a
     * caller asking for it is asking for fabrication, and must be told the
     * capability is gone rather than believing it ran.
     */
    if (strategy === 'balance') {
      return NextResponse.json(
        {
          ok: false,
          refusalCode: 'BALANCE_STRATEGY_REMOVED',
          error:
            'The `balance` repair strategy has been removed. It equalised the PoS and DVN counters by ' +
            'issuing synthetic `sync_repair_*` receipts into the real Bitcoin anchor path, which wrote ' +
            'filler into the constitutional provenance stream to satisfy a metric that compares two ' +
            'unrelated populations. Genuine reconciliation is per-commitment, not per-count.',
          before: { posCount, dvnCount },
          at: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Repair strategy based on which canister has more items
    if (strategy === 'auto') {
      if (posCount > dvnCount) {
        /*
         * PoS ahead of DVN. Previously this fabricated SYNC_REPAIR DVN
         * messages to close the gap; that is the same fabrication as the
         * `balance` branch above and is equally removed. Reported, not
         * "repaired" — with no shared commitment there is nothing here to
         * legitimately reconcile.
         */
        repairActions.push(
          `PoS pending (${posCount}) exceeds DVN pending (${dvnCount}) by ${posCount - dvnCount}. ` +
            'No synthetic DVN messages were created: fabricating one side to match the other is not ' +
            'reconciliation. Real drift is a shared commitment present on one leg and absent on the other.',
        );
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
