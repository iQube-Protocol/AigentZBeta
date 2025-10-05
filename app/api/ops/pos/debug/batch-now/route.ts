import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function POST(_req: NextRequest) {
  try {
    const CANISTER_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'PROOF_OF_STATE_CANISTER_ID not configured' }, { status: 400 });

    const pos = await getActor<any>(CANISTER_ID, posIdl);
    try {
      const res = await pos.batch_now();
      return NextResponse.json({ ok: true, result: res, canisterId: CANISTER_ID, at: new Date().toISOString() });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || String(e), canisterId: CANISTER_ID }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
