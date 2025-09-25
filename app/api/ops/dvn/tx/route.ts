import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idOrHash = searchParams.get('id') || searchParams.get('hash');
    if (!idOrHash) return NextResponse.json({ ok: false, error: 'id or hash is required' }, { status: 400 });

    // Handle local fallback
    if (idOrHash.startsWith('local:')) {
      try {
        const txHash = idOrHash.replace('local:', '');
        const rpcUrl = 'https://rpc-amoy.polygon.technology';
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 1
          })
        });
        
        if (!response.ok) {
          throw new Error(`RPC request failed: ${response.status}`);
        }
        
        const data = await response.json();
        const receipt = data.result;
        
        if (receipt) {
          const message = {
            id: `local:${txHash}`,
            source_chain: 80002,
            destination_chain: 1,
            nonce: parseInt(receipt.transactionIndex || '0', 16),
            sender: receipt.from,
            timestamp: Date.now(),
            status: receipt.status === '0x1' ? 'confirmed' : 'failed'
          };
          
          return NextResponse.json({ ok: true, message, attestations: [], fallback: true, at: new Date().toISOString() });
        } else {
          return NextResponse.json({ ok: true, message: null, attestations: [], fallback: true, pending: true, at: new Date().toISOString() });
        }
      } catch (localError: any) {
        console.error('Local fallback error:', localError);
        return NextResponse.json({ 
          ok: false, 
          error: `Local fallback failed: ${localError.message}`,
          fallback: true 
        }, { status: 500 });
      }
    }

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);

    // Try interpret as message id first
    const msgOpt = await dvn.get_dvn_message(idOrHash);
    const message = Array.isArray(msgOpt) ? (msgOpt.length ? msgOpt[0] : null) : (msgOpt?.Some ?? null);

    let attestations: any[] = [];
    if (message) {
      try {
        attestations = await dvn.get_message_attestations(message.id);
      } catch {}
    }

    // Convert BigInt fields to strings for JSON serialization
    if (message) {
      if (message.timestamp) message.timestamp = Number(message.timestamp);
      if (message.nonce) message.nonce = Number(message.nonce);
      if (message.source_chain) message.source_chain = Number(message.source_chain);
      if (message.destination_chain) message.destination_chain = Number(message.destination_chain);
    }
    
    // Convert attestation timestamps
    if (attestations && Array.isArray(attestations)) {
      attestations.forEach(att => {
        if (att.timestamp) att.timestamp = Number(att.timestamp);
      });
    }

    return NextResponse.json({ ok: true, message, attestations, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load DVN tx status' }, { status: 500 });
  }
}
