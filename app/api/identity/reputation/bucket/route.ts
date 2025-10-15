import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { rqhIDL } from '@/services/ops/idl/rqh';

export async function GET(req: NextRequest) {
  try {
    const partitionId = req.nextUrl.searchParams.get('partitionId');
    if (!partitionId) return NextResponse.json({ ok: false, error: 'partitionId required' }, { status: 400 });

    const canisterId = process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'RQH canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, rqhIDL);
    const pid = Buffer.from(partitionId, 'hex');
    const proof = await actor.present_bucket(pid);

    return NextResponse.json({ ok: true, data: { bucket: Number(proof.bucket), ts: Number(proof.ts), sig: Buffer.from(proof.sig).toString('hex') } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch bucket' }, { status: 500 });
  }
}
