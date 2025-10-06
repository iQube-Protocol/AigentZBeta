import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET(req: NextRequest) {
  try {
    // Get DVN canister ID from environment
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    const MOCK_MODE = process.env.DVN_MOCK_MODE === 'true' || process.env.NEXT_PUBLIC_DVN_MOCK_MODE === 'true';
    
    if (!DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'DVN canister ID not configured',
        evmTx: '—',
        icpReceipt: '—',
        lockStatus: 'Unknown',
        unlockHeight: '—',
        at: new Date().toISOString()
      });
    }

    // Mock mode - return simulated data
    if (MOCK_MODE) {
      return NextResponse.json({
        ok: true,
        evmTx: '0x1234567890abcdef1234567890abcdef12345678',
        icpReceipt: 'mock-receipt-id-12345',
        lockStatus: 'Locked',
        unlockHeight: '1 pending (mock)',
        pendingMessages: 1,
        canisterId: DVN_ID,
        mockMode: true,
        note: 'DVN canister deployment pending - using mock data',
        at: new Date().toISOString()
      });
    }

    // Get DVN actor and fetch live data
    const dvn = await getActor<any>(DVN_ID, dvnIdl);
    
    // Fetch DVN status data
    const [pendingMessages] = await Promise.all([
      dvn.get_pending_messages().catch(() => [])
    ]);
    // Optional connectivity probe (safe no-op)
    try { await dvn.get_ready_messages(); } catch {}

    // Get latest message if available and decode payload JSON we created during mint
    let evmTx = '—';
    let icpReceipt = '—';
    let lockStatus = 'Unlocked';
    let unlockHeight = '—';

    // Use pending messages count directly from canister (no cookies)
    const totalPending = Array.isArray(pendingMessages) ? pendingMessages.length : 0;
    if (totalPending === 0) {
      unlockHeight = 'No pending messages';
    } else {
      unlockHeight = `${totalPending} pending`;
    }

    if (Array.isArray(pendingMessages) && pendingMessages.length > 0) {
      const latestMessage: any = pendingMessages[pendingMessages.length - 1];
      // Attempt to parse payload bytes as JSON
      try {
        const payloadField = latestMessage?.payload;
        // payload can be an object like {"0":123,"1":34,...} or a number[]
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

    {
      const res = NextResponse.json({
        ok: true,
        evmTx,
        icpReceipt,
        lockStatus,
        unlockHeight,
        pendingMessages: Array.isArray(pendingMessages) ? pendingMessages.length : 0,
        canisterId: DVN_ID,
        // attestations omitted from status; available via /api/ops/dvn/tx?id=...
        at: new Date().toISOString()
      });
      res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
      return res;
    }

  } catch (error: any) {
    console.error('DVN API error:', error);
    {
      const res = NextResponse.json({
        ok: false,
        error: error.message,
        evmTx: '—',
        icpReceipt: '—',
        lockStatus: 'Error',
        unlockHeight: '—',
        at: new Date().toISOString()
      });
      res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
      return res;
    }
  }
}
