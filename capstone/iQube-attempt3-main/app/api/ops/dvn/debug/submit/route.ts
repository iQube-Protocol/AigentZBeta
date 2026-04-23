import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(req: NextRequest) {
  try {
    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    const MOCK_MODE = process.env.DVN_MOCK_MODE === 'true' || process.env.NEXT_PUBLIC_DVN_MOCK_MODE === 'true';
    
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const chainId: number = body?.chainId ?? 11155111; // default Sepolia
    const dstChain: number = body?.dstChain ?? 0;
    const messageId: string = body?.messageId ?? `debug_${chainId}_${Date.now()}`;
    const payloadObj = body?.payload ?? { ping: true, ts: Date.now(), note: 'debug submit' };
    const payloadBytes = Array.from(new TextEncoder().encode(JSON.stringify(payloadObj)));

    // Mock mode - return success without calling canister
    if (MOCK_MODE) {
      const mockMessageId = `mock_${chainId}_${Date.now()}`;
      return NextResponse.json({ 
        ok: true, 
        messageId: mockMessageId, 
        canisterId: CANISTER_ID, 
        at: new Date().toISOString(),
        mockMode: true,
        note: 'DVN canister deployment pending - using mock response'
      });
    }

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);

    try {
      const res = await dvn.submit_dvn_message(chainId, dstChain, payloadBytes, messageId);
      if (typeof res === 'string') {
        return NextResponse.json({ ok: true, messageId: res, canisterId: CANISTER_ID, at: new Date().toISOString() });
      }
      return NextResponse.json({ ok: false, error: 'Unexpected return type from submit_dvn_message', result: res }, { status: 500 });
    } catch (e: any) {
      const msg = e?.message || String(e);
      // Match common replica/canister errors
      const auth = msg.includes('reject') || msg.includes('not authorized') || msg.includes('caller') || msg.includes('IC0');
      return NextResponse.json({ ok: false, error: msg, authLikely: auth, canisterId: CANISTER_ID }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to submit debug message' }, { status: 500 });
  }
}
