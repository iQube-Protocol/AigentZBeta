import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { recordServerCall } from '@/services/devCommandCenter/requestTelemetry';

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

export async function GET() {
  const t0 = Date.now();
  try {
    if (IS_BUILD) {
      return NextResponse.json({
        ok: false,
        error: 'DVN check skipped during build',
        messages: [],
        count: 0
      });
    }

    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    
    if (!DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'DVN canister ID not configured'
      }, { status: 400 });
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);
    const pendingMessages = await dvn.get_pending_messages();
    
    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = Array.isArray(pendingMessages) 
      ? pendingMessages.map((msg: any) => {
          return JSON.parse(JSON.stringify(msg, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
        })
      : [];
    
    recordServerCall({ method: 'GET', path: '/api/ops/dvn/pending', status: 200, ms: Date.now() - t0 });
    return NextResponse.json({
      ok: true,
      messages: serializedMessages,
      count: serializedMessages.length,
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('DVN pending messages API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch pending DVN messages',
      messages: [],
      count: 0
    }, { status: 500 });
  }
}
