import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const eventType = body?.eventType;
    const contentId = body?.contentId;
    const personaId = body?.personaId;
    const issue = body?.issue;
    const source = body?.source || 'CODEX';

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ ok: false, error: 'eventType is required' }, { status: 400 });
    }
    if (!contentId || typeof contentId !== 'string') {
      return NextResponse.json({ ok: false, error: 'contentId is required' }, { status: 400 });
    }

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) {
      return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });
    }

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);

    const payload = JSON.stringify({
      action: 'RECEIPT',
      eventType,
      contentId,
      personaId: typeof personaId === 'string' ? personaId : null,
      issue: typeof issue === 'string' ? issue : null,
      source: typeof source === 'string' ? source : 'CODEX',
      timestamp: Date.now(),
    });

    const messageId = `receipt_${eventType}_${Date.now()}`;

    // For receipts we use source_chain=0, destination_chain=0; the canister stores the payload as bytes.
    const submitRes = await dvn.submit_dvn_message(
      0,
      0,
      Array.from(new TextEncoder().encode(payload)),
      messageId
    );

    if (typeof submitRes === 'string') {
      return NextResponse.json({ ok: true, messageId: submitRes, at: new Date().toISOString() });
    }

    return NextResponse.json({ ok: false, error: 'submit_dvn_message returned unexpected result' }, { status: 500 });
  } catch (e: any) {
    // Fail-open philosophy: client callers should treat non-200 as non-fatal.
    return NextResponse.json({ ok: false, error: e?.message || 'DVN receipt failed' }, { status: 500 });
  }
}
