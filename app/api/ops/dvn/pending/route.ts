import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET() {
  try {
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
