import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { dbcIDL } from '@/services/ops/idl/dbc';

export async function POST(req: NextRequest) {
  try {
    const { flagId, evidencePtr } = await req.json();
    if (!flagId || !evidencePtr) {
      return NextResponse.json({ ok: false, error: 'flagId and evidencePtr required' }, { status: 400 });
    }

    const canisterId = process.env.DBC_CANISTER_ID || process.env.NEXT_PUBLIC_DBC_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'DBC canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, dbcIDL);
    const ticketId = await actor.submit_dispute(flagId, evidencePtr);

    return NextResponse.json({ ok: true, data: { ticketId } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to submit dispute' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const ticketId = req.nextUrl.searchParams.get('ticketId');
    if (!ticketId) {
      return NextResponse.json({ ok: false, error: 'ticketId required' }, { status: 400 });
    }

    const canisterId = process.env.DBC_CANISTER_ID || process.env.NEXT_PUBLIC_DBC_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'DBC canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, dbcIDL);
    const result = await actor.get_dispute_status(ticketId);

    if (result && result.length > 0) {
      return NextResponse.json({ ok: true, data: result[0] });
    }
    return NextResponse.json({ ok: false, error: 'Dispute not found' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to get dispute status' }, { status: 500 });
  }
}
