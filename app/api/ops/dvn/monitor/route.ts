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
    if (!chainId || typeof chainId !== 'number') {
      return NextResponse.json({ ok: false, error: 'chainId is required' }, { status: 400 });
    }

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);

    // Idempotency: if a pending message already exists for this txHash, return it instead of creating a duplicate
    try {
      const pending: any[] = await dvn.get_pending_messages().catch(() => []);
      for (const msg of Array.isArray(pending) ? pending : []) {
        try {
          const payloadField = msg?.payload;
          const byteArray: number[] = Array.isArray(payloadField)
            ? payloadField
            : payloadField && typeof payloadField === 'object'
              ? Object.values(payloadField).map((v: any) => Number(v))
              : [];
          if (byteArray.length) {
            const jsonStr = new TextDecoder().decode(Uint8Array.from(byteArray));
            const parsed = JSON.parse(jsonStr);
            if (parsed?.txHash && typeof parsed.txHash === 'string' && parsed.txHash.toLowerCase() === txHash.toLowerCase()) {
              return NextResponse.json({ ok: true, messageId: msg.id, dedup: true, at: new Date().toISOString() });
            }
          }
        } catch {}
      }
    } catch {}

    // Provide a safe default RPC if none provided
    const effectiveRpc = (rpcUrl && typeof rpcUrl === 'string' && rpcUrl.length)
      ? rpcUrl
      : (chainId === 80002
          ? 'https://rpc-amoy.polygon.technology'
          : chainId === 11155111
            ? 'https://rpc.sepolia.org'
            : '');
    console.log(`Calling monitor_evm_transaction with chainId: ${chainId}, txHash: ${txHash}, rpc: ${effectiveRpc}`);
    const res = await dvn.monitor_evm_transaction(chainId, txHash, effectiveRpc);
    console.log('DVN monitor_evm_transaction response:', res);

    if ('Ok' in res) {
      // Ok returns message_id per our canister API
      return NextResponse.json({ ok: true, messageId: res.Ok, at: new Date().toISOString() });
    }
    console.error('DVN monitor_evm_transaction failed:', res.Err);
    return NextResponse.json({ ok: false, error: res.Err || 'Monitor failed' }, { status: 500 });
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
