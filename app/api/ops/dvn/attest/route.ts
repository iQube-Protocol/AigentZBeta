import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(req: NextRequest) {
  try {
    const { messageId, validator, signatureHex } = await req.json();
    if (!messageId || typeof messageId !== 'string') return NextResponse.json({ ok: false, error: 'messageId is required' }, { status: 400 });
    if (!validator || typeof validator !== 'string') return NextResponse.json({ ok: false, error: 'validator is required' }, { status: 400 });
    if (!signatureHex || typeof signatureHex !== 'string') return NextResponse.json({ ok: false, error: 'signatureHex is required' }, { status: 400 });

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = getActor<any>(CANISTER_ID, dvnIdl);
    const sigBytes = Uint8Array.from(Buffer.from(signatureHex.replace(/^0x/, ''), 'hex'));
    const res = await dvn.submit_attestation(messageId, validator, Array.from(sigBytes));
    if ('Ok' in res) return NextResponse.json({ ok: true, result: res.Ok, at: new Date().toISOString() });
    return NextResponse.json({ ok: false, error: res.Err || 'submit_attestation failed' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to submit attestation' }, { status: 500 });
  }
}
