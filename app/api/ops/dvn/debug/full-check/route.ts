import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

async function processOnce(dvn: any) {
  const results: any[] = [];
  let processed = 0;
  const pending = await dvn.get_pending_messages().catch(() => []);
  for (const message of pending) {
    try {
      const messageId = message.id;
      const validatorId = `validator_${Math.random().toString(36).slice(2)}`;
      const mockSignature = new TextEncoder().encode(`sig_${messageId}_${Date.now()}`);
      const res = await dvn.submit_attestation(messageId, validatorId, Array.from(mockSignature));
      results.push({ messageId, ok: !!(res?.Ok ?? res === 'Ok'), raw: res });
      processed++;
    } catch (e: any) {
      results.push({ messageId: message?.id, ok: false, error: e?.message || String(e) });
    }
  }
  return { processed, countBefore: pending?.length ?? 0, results };
}

export async function GET() {
  try {
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    const identStatus = {
      identityStatus: process.env.DFX_IDENTITY_PEM ? 'authenticated' : 'anonymous',
      identitySource: process.env.DFX_IDENTITY_PEM ? 'DFX_IDENTITY_PEM' : (process.env.DFX_IDENTITY_PEM_PATH ? 'DFX_IDENTITY_PEM_PATH' : 'none')
    };

    if (!DVN_ID) {
      return NextResponse.json({ ok: false, error: 'DVN canister ID not configured' }, { status: 400 });
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);

    // Status before
    const beforePending = await dvn.get_pending_messages().catch(() => []);
    const beforeReady = await dvn.get_ready_messages().catch(() => []);

    // First pass (adds first attestation)
    const pass1 = await processOnce(dvn);

    // Second pass (adds second attestation → quorum)
    const pass2 = await processOnce(dvn);

    // Status after
    const afterPending = await dvn.get_pending_messages().catch(() => []);
    const afterReady = await dvn.get_ready_messages().catch(() => []);

    const body = {
      ok: true,
      identity: identStatus,
      dvn: DVN_ID,
      before: { pending: beforePending.length, ready: beforeReady.length },
      pass1,
      pass2,
      after: { pending: afterPending.length, ready: afterReady.length },
      at: new Date().toISOString()
    };

    const res = NextResponse.json(body);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
