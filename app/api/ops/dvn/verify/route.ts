import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(req: NextRequest) {
  try {
    const { messageId, chainId, rpcUrl, txHash } = await req.json();
    if (!messageId || typeof messageId !== 'string') return NextResponse.json({ ok: false, error: 'messageId is required' }, { status: 400 });
    if (!chainId || typeof chainId !== 'number') return NextResponse.json({ ok: false, error: 'chainId is required' }, { status: 400 });

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);
    const res = await dvn.verify_layerzero_message(chainId, messageId, rpcUrl ?? '');
    
    if ('Ok' in res) {
      console.log(`LayerZero verification successful for messageId: ${messageId}`);
      return NextResponse.json({ ok: true, result: res.Ok, at: new Date().toISOString() });
    }
    
    return NextResponse.json({ ok: false, error: res.Err || 'verify_layerzero_message failed' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to verify LayerZero message' }, { status: 500 });
  }
}
