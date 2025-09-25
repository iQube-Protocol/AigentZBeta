import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function POST() {
  try {
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    if (!POS_ID) return NextResponse.json({ ok: false, error: 'PROOF_OF_STATE_CANISTER_ID not configured' }, { status: 400 });

    const pos = await getActor<any>(POS_ID, posIdl);
    const root = await pos.batch_now();

    return NextResponse.json({ ok: true, batchRoot: root, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to batch pending receipts' }, { status: 500 });
  }
}
