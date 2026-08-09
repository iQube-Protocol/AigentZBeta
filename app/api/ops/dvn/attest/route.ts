import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { requireOpsAuth } from '@/services/ops/opsAuth';

/**
 * Auth (Horizen Pilot Closure, Part B2, 2026-08-09): this route previously
 * had NO auth gate at all — any caller could submit an arbitrary
 * (messageId, validator, signatureHex) attestation. See
 * services/ops/opsAuth.ts for why this gets the dual CRON_TRIGGER_TOKEN /
 * admin-persona check rather than the cron-token-only convention: this is
 * the route the operator /ops console's manual attestation test form calls
 * directly (`onSubmitAttestation` in app/(shell)/ops/page.tsx).
 */
export async function POST(req: NextRequest) {
  const auth = await requireOpsAuth(req);
  if (!auth.ok) return auth.response!;

  try {
    const { messageId, validator, signatureHex } = await req.json();
    if (!messageId || typeof messageId !== 'string') return NextResponse.json({ ok: false, error: 'messageId is required' }, { status: 400 });
    if (!validator || typeof validator !== 'string') return NextResponse.json({ ok: false, error: 'validator is required' }, { status: 400 });
    if (!signatureHex || typeof signatureHex !== 'string') return NextResponse.json({ ok: false, error: 'signatureHex is required' }, { status: 400 });

    const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    if (!CANISTER_ID) return NextResponse.json({ ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }, { status: 400 });

    const dvn = await getActor<any>(CANISTER_ID, dvnIdl);
    const sigBytes = Uint8Array.from(Buffer.from(signatureHex.replace(/^0x/, ''), 'hex'));
    const res = await dvn.submit_attestation(messageId, validator, Array.from(sigBytes));
    if ('Ok' in res) return NextResponse.json({ ok: true, result: res.Ok, at: new Date().toISOString() });
    return NextResponse.json({ ok: false, error: res.Err || 'submit_attestation failed' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to submit attestation' }, { status: 500 });
  }
}
