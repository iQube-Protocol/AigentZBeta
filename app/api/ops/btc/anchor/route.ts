import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function POST() {
  try {
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    if (!POS_ID) return NextResponse.json({ ok: false, error: 'PROOF_OF_STATE_CANISTER_ID not configured' }, { status: 400 });

    const pos = getActor<any>(POS_ID, posIdl);

    // Check what methods are available on the canister
    const methods = Object.getOwnPropertyNames(pos).filter(name => typeof pos[name] === 'function');
    console.log('Available methods on proof_of_state:', methods);

    // Try calling the methods directly even if not in IDL (they might exist)
    try {
      console.log('Attempting to call issue_receipt directly...');
      const receiptResult = await pos.issue_receipt(`manual_test_${Date.now()}`);
      console.log('Direct issue_receipt result:', receiptResult);
      
      return NextResponse.json({ 
        ok: true, 
        result: 'Receipt created successfully (method exists but not in IDL)', 
        receiptResult,
        at: new Date().toISOString() 
      });
    } catch (directError: any) {
      console.log('Direct method call failed:', directError.message);
      
      // Return diagnostic info
      return NextResponse.json({ 
        ok: false, 
        error: 'Anchor functionality not yet implemented', 
        availableMethods: methods,
        canisterId: POS_ID,
        directCallError: directError.message,
        note: 'The proof_of_state canister IDL may need updating to include anchor methods',
        at: new Date().toISOString() 
      }, { status: 501 });
    }
  } catch (e: any) {
    console.error('Anchor endpoint error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create anchor' }, { status: 500 });
  }
}
