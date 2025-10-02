import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET(req: NextRequest) {
  try {
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;

    // If canister not configured, still return ok with local-only info
    if (!DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'DVN canister ID not configured',
        evmTx: '—',
        icpReceipt: '—',
        lockStatus: 'Unknown',
        unlockHeight: '—',
        pendingMessages: 0,
        at: new Date().toISOString(),
      });
    }

    let pendingMessages: any[] = [];
    let evmTx = '—';
    let icpReceipt = '—';
    let lockStatus = 'Unlocked';
    let unlockHeight = '—';

    // Try live canister first; on any failure, fall back to local-only view
    try {
      const dvn = await getActor<any>(DVN_ID, dvnIdl);
      pendingMessages = await dvn.get_pending_messages().catch(() => []);
      try { await dvn.get_ready_messages(); } catch {}
    } catch {
      // IC not reachable
      const totalPending = 0;
      unlockHeight = 'No pending messages';
      return NextResponse.json({
        ok: true,
        evmTx,
        icpReceipt,
        lockStatus,
        unlockHeight,
        pendingMessages: totalPending,
        canisterId: DVN_ID,
        at: new Date().toISOString(),
      });
    }

    const totalPending = Array.isArray(pendingMessages) ? pendingMessages.length : 0;

    if (totalPending === 0) {
      unlockHeight = 'No pending messages';
    } else {
      unlockHeight = `${totalPending} pending`;
    }

    // Derive latest tx / receipt from canister messages when present
    if (Array.isArray(pendingMessages) && pendingMessages.length > 0) {
      const latest = pendingMessages[pendingMessages.length - 1];
      try {
        const payloadField = latest?.payload;
        const byteArray: number[] = Array.isArray(payloadField)
          ? payloadField
          : payloadField && typeof payloadField === 'object'
            ? Object.values(payloadField).map((v: any) => Number(v))
            : [];
        if (byteArray.length) {
          const json = new TextDecoder().decode(Uint8Array.from(byteArray));
          const parsed = JSON.parse(json);
          if (parsed?.txHash && typeof parsed.txHash === 'string') evmTx = parsed.txHash;
          if (parsed?.receiptId && typeof parsed.receiptId === 'string') icpReceipt = parsed.receiptId;
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      evmTx,
      icpReceipt,
      lockStatus,
      unlockHeight,
      pendingMessages: totalPending,
      canisterId: DVN_ID,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    // Never 500: return structured error state
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unexpected error',
      evmTx: '—',
      icpReceipt: '—',
      lockStatus: 'Error',
      unlockHeight: '—',
      pendingMessages: 0,
      at: new Date().toISOString(),
    });
  }
}
