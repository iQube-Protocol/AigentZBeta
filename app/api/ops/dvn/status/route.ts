import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET() {
  try {
    // Get DVN canister ID from environment
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    
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

    // Get DVN actor and fetch live data
    const dvn = getActor<any>(DVN_ID, dvnIdl);
    
    // Fetch DVN status data
    const [pendingMessages] = await Promise.all([
      dvn.get_pending_messages().catch(() => [])
    ]);
    // Optional connectivity probe (safe no-op)
    try { await dvn.get_ready_messages(); } catch {}

    // Get latest message if available
    let evmTx = '—';
    let icpReceipt = '—';
    let lockStatus = 'Unlocked';
    let unlockHeight = '—';

    if (Array.isArray(pendingMessages) && pendingMessages.length > 0) {
      const latestMessage = pendingMessages[pendingMessages.length - 1];
      if (latestMessage?.evm_tx_hash) evmTx = latestMessage.evm_tx_hash;
      if (latestMessage?.icp_receipt) icpReceipt = latestMessage.icp_receipt;
      lockStatus = latestMessage.status === 'locked' ? 'Locked' : 'Unlocked';
      if (latestMessage?.unlock_height) unlockHeight = String(latestMessage.unlock_height);
    } else {
      // No messages - keep neutral placeholders
      evmTx = '—';
      icpReceipt = '—';
      unlockHeight = '—';
    }

    return NextResponse.json({
      ok: true,
      evmTx,
      icpReceipt,
      lockStatus,
      unlockHeight,
      pendingMessages: pendingMessages.length,
      canisterId: DVN_ID,
      // attestations omitted from status; available via /api/ops/dvn/tx?id=...
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('DVN API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      evmTx: '—',
      icpReceipt: '—',
      lockStatus: 'Error',
      unlockHeight: '—',
      at: new Date().toISOString()
    });
  }
}
