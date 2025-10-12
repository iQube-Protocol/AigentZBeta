import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function POST(req: NextRequest) {
  try {
    const { dataHash, source = 'unknown' } = await req.json();
    
    if (!dataHash || typeof dataHash !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'dataHash is required and must be a string' 
      }, { status: 400 });
    }

    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    if (!POS_ID) {
      return NextResponse.json({ 
        ok: false, 
        error: 'PROOF_OF_STATE_CANISTER_ID not configured' 
      }, { status: 400 });
    }

    // Probe ICP reachability (avoid ECONNREFUSED in staging/prod when local replica is down)
    const icHost = process.env.ICP_HOST || (process.env.DFX_NETWORK === 'local' ? 'http://127.0.0.1:4943' : undefined);
    if (icHost) {
      try {
        const probe = await fetch(`${icHost}/api/v2/status`, { method: 'GET', cache: 'no-store' });
        if (!probe.ok) throw new Error('IC status not OK');
      } catch {
        // Graceful fallback so UI can continue to show pending state
        return NextResponse.json({ ok: true, receiptId: null, fallback: true, pending: true, at: new Date().toISOString() });
      }
    }

    console.log(`Creating PoS receipt for ${source}: ${dataHash}`);
    // Initialize actor with resilience: if actor init fails, fallback gracefully
    let pos: any;
    try {
      pos = await getActor<any>(POS_ID, posIdl);
    } catch {
      return NextResponse.json({ ok: true, receiptId: null, fallback: true, pending: true, at: new Date().toISOString() });
    }
    const receiptId = await pos.issue_receipt(dataHash);
    
    console.log(`PoS receipt created: ${receiptId}`);
    
    return NextResponse.json({
      ok: true,
      receiptId,
      dataHash,
      source,
      canisterId: POS_ID,
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('PoS issue_receipt API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to create PoS receipt',
      canisterDown: error.message?.includes('canister_not_found') || error.message?.includes('Timeout')
    }, { status: 500 });
  }
}

