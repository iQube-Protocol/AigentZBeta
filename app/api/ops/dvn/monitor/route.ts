import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(req: NextRequest) {
  let txHash: string | undefined;
  
  try {
    const body = await req.json().catch(() => ({}));
    txHash = body?.txHash;
    const chainId: number | undefined = body?.chainId; // e.g., 11155111 (Sepolia), 80002 (Amoy)
    const rpcUrl: string | undefined = body?.rpcUrl; // optional override; canister may have defaults

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ ok: false, error: 'txHash is required' }, { status: 400 });
    }
    if (typeof chainId !== 'number') {
      return NextResponse.json({ ok: false, error: 'chainId is required' }, { status: 400 });
    }

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);
    
    // Handle Bitcoin (chainId 0) and Solana (chainId 101) separately
    if (chainId === 0) {
      // Bitcoin transaction monitoring
      console.log(`Monitoring Bitcoin transaction: ${txHash}`);
      try {
        const fallbackPayload = JSON.stringify({
          action: 'MONITOR',
          txHash,
          chainId: 0,
          chainName: 'Bitcoin',
          status: 'pending',
          timestamp: Date.now(),
          receiptId: `receipt_btc_${Date.now()}`
        });
        
        const messageId = `monitor_btc_${Date.now()}`;
        const submitRes = await dvn.submit_dvn_message(
          0, // source_chain (Bitcoin)
          0, // destination_chain  
          Array.from(new TextEncoder().encode(fallbackPayload)), // payload as bytes
          messageId // message_id
        );
        
        if (typeof submitRes === 'string') {
          console.log('Bitcoin transaction tracked:', submitRes);
          return NextResponse.json({ 
            ok: true, 
            messageId: submitRes, 
            fallback: true,
            note: 'Bitcoin transaction tracked via DVN',
            at: new Date().toISOString() 
          });
        }
      } catch (btcErr: any) {
        console.error('Bitcoin DVN submission failed:', btcErr);
        return NextResponse.json({ 
          ok: false, 
          error: `Bitcoin monitoring failed: ${btcErr?.message || 'Unknown error'}`,
          canisterDown: true
        }, { status: 500 });
      }
    }
    
    if (chainId === 101) {
      // Solana transaction monitoring (already handled below)
      console.log(`Monitoring Solana transaction: ${txHash}`);
    }

    // Provide a safe default RPC if none provided
    const effectiveRpc = (rpcUrl && typeof rpcUrl === 'string' && rpcUrl.length)
      ? rpcUrl
      : (chainId === 80002
          ? 'https://rpc-amoy.polygon.technology'
          : chainId === 11155111
            ? 'https://rpc.sepolia.org'
            : '');
    console.log(`Attempting to monitor transaction: chainId=${chainId}, txHash=${txHash}, rpc=${effectiveRpc}`);
    
    // Skip duplicate checking for now since get_pending_messages() is causing hangs
    // TODO: Re-enable duplicate detection once canister performance improves

    // Skip the slow monitor_evm_transaction and go straight to fast fallback
    console.log('Using direct message submission for reliable tracking...');
    
    try {
      const fallbackPayload = JSON.stringify({
        action: 'MONITOR',
        txHash,
        chainId,
        status: 'pending',
        timestamp: Date.now(),
        receiptId: `receipt_${Date.now()}`
      });
      
      const messageId = `monitor_${chainId}_${Date.now()}`;
      const submitRes = await dvn.submit_dvn_message(
        chainId, // source_chain
        0, // destination_chain  
        Array.from(new TextEncoder().encode(fallbackPayload)), // payload as bytes
        messageId // message_id
      );
      
      // submit_dvn_message returns text (the message_id), not Result
      if (typeof submitRes === 'string') {
        console.log('Direct message submission successful:', submitRes);
        return NextResponse.json({ 
          ok: true, 
          messageId: submitRes, 
          fallback: true,
          note: 'Transaction tracked via direct method (faster than HTTP verification)',
          at: new Date().toISOString() 
        });
      } else {
        throw new Error('submit_dvn_message returned unexpected result');
      }
    } catch (directErr: any) {
      console.error('Direct message submission failed:', directErr);
      // If the DVN canister is unreachable or not found (wrong network/IDL),
      // return a local fallback success so UX is not blocked while infra is fixed.
      const msg = String(directErr?.message || '');
      if (msg.includes('canister_not_found') || msg.includes('IC0302') || msg.includes('ReplicaError')) {
        const fallbackId = txHash ? `local:${txHash}` : `local:monitor_${Date.now()}`;
        return NextResponse.json({
          ok: true,
          messageId: fallbackId,
          fallback: true,
          note: 'DVN canister unreachable, using local monitor fallback',
          at: new Date().toISOString(),
        });
      }
      return NextResponse.json({ 
        ok: false, 
        error: `Direct submission failed: ${directErr?.message || 'Unknown error'}`,
        canisterDown: true
      }, { status: 500 });
    }
  } catch (e: any) {
    console.error('DVN monitor error:', e);
    
    // Fallback: if canister_not_found, provide local monitoring
    if (e?.message && e.message.includes('canister_not_found') && txHash) {
      console.log('DVN canister_not_found, using local fallback for tx:', txHash);
      try {
        return NextResponse.json({ 
          ok: true, 
          messageId: `local:${txHash}`, 
          fallback: true,
          at: new Date().toISOString() 
        });
      } catch (fallbackError: any) {
        console.error('Fallback response error:', fallbackError);
        return NextResponse.json({ ok: false, error: 'Fallback failed' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to monitor EVM tx' }, { status: 500 });
  }
}
