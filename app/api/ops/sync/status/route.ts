import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET(req: NextRequest) {
  try {
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    
    // Read local DVN pending cookie
    const cookieRaw = req.cookies.get('dvn_local_pending')?.value || '[]';
    let localPending: string[] = [];
    try { localPending = JSON.parse(cookieRaw); } catch { localPending = []; }
    if (!Array.isArray(localPending)) localPending = [];

    if (!POS_ID || !DVN_ID) {
      // Graceful output using only local cookie
      const dvnCount = localPending.length;
      return NextResponse.json({
        ok: false,
        error: 'Canister IDs not configured',
        syncStatus: 'error',
        severity: 'critical',
        isSynchronized: false,
        isLegitimate: false,
        drift: dvnCount,
        canisters: {
          proofOfState: { id: POS_ID || '—', pendingCount: 0 },
          dvn: { id: DVN_ID || '—', pendingCount: dvnCount },
        },
        recommendations: ['Configure canister IDs in env'],
        at: new Date().toISOString(),
      });
    }

    // Get actors for both canisters
    let pos: any | null = null;
    let dvn: any | null = null;
    try {
      [pos, dvn] = await Promise.all([
        getActor<any>(POS_ID, posIdl),
        getActor<any>(DVN_ID, dvnIdl)
      ]);
    } catch {}

    // Get pending counts from both canisters
    let posPendingCount: bigint = BigInt(0);
    let dvnPendingMessages: any[] = [];
    if (pos) {
      try { posPendingCount = await pos.get_pending_count(); } catch { posPendingCount = BigInt(0); }
    }
    if (dvn) {
      try { dvnPendingMessages = await dvn.get_pending_messages(); } catch { dvnPendingMessages = []; }
    }

    const posCount = Number(posPendingCount);
    const canisterPending = Array.isArray(dvnPendingMessages) ? dvnPendingMessages.length : 0;
    const seen = new Set<string>();
    if (Array.isArray(dvnPendingMessages)) {
      for (const m of dvnPendingMessages) {
        if (m?.id && typeof m.id === 'string') seen.add(m.id);
      }
    }
    let dvnCount = canisterPending;
    for (const id of localPending) {
      if (typeof id === 'string' && !seen.has(id)) dvnCount += 1;
    }
    const isSynchronized = posCount === dvnCount;
    const drift = Math.abs(posCount - dvnCount);

    // Determine sync status and severity
    let syncStatus: string;
    let severity: 'info' | 'warning' | 'critical';
    let isLegitimate = false;
    
    if (isSynchronized) {
      syncStatus = 'synced';
      severity = 'info';
    } else {
      // Check if this is legitimate lifecycle drift
      // DVN messages persist longer than receipts (which get batched)
      if (dvnCount > posCount && drift <= 5) {
        syncStatus = 'lifecycle-drift';
        severity = 'info';
        isLegitimate = true;
      } else if (drift <= 2) {
        syncStatus = 'minor-drift';
        severity = 'warning';
      } else {
        syncStatus = 'out-of-sync';
        severity = 'critical';
      }
    }

    return NextResponse.json({
      ok: true,
      syncStatus,
      severity,
      isSynchronized,
      isLegitimate,
      drift,
      canisters: {
        proofOfState: {
          id: POS_ID,
          pendingCount: posCount
        },
        dvn: {
          id: DVN_ID,
          pendingCount: dvnCount
        }
      },
      recommendations: getSyncRecommendations(syncStatus, drift),
      at: new Date().toISOString()
    });

  } catch (error: any) {
    // Never 500: provide minimal structured error response
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unexpected error',
      syncStatus: 'error',
      severity: 'critical',
      isSynchronized: false,
      isLegitimate: false,
      drift: 0,
      canisters: {
        proofOfState: { id: process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID || '—', pendingCount: 0 },
        dvn: { id: process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID || '—', pendingCount: 0 },
      },
      recommendations: ['Investigate API connectivity'],
      at: new Date().toISOString(),
    });
  }
}

function getSyncRecommendations(syncStatus: string, drift: number): string[] {
  switch (syncStatus) {
    case 'synced':
      return ['System is synchronized', 'No action required'];
    case 'lifecycle-drift':
      return [
        `Legitimate lifecycle drift (${drift} items)`,
        'DVN messages persist after receipts are batched',
        'This is expected behavior',
        'No action required'
      ];
    case 'minor-drift':
      return [
        `Minor drift detected (${drift} items)`,
        'Monitor for auto-recovery',
        'Consider manual sync if persists'
      ];
    case 'out-of-sync':
      return [
        `Critical drift detected (${drift} items)`,
        'Immediate attention required',
        'Use sync repair endpoint',
        'Check inter-canister call logs'
      ];
    default:
      return ['Unknown sync status', 'Manual investigation required'];
  }
}
