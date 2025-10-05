import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET(req: NextRequest) {
  try {
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    
    if (!POS_ID || !DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'Canister IDs not configured',
        syncStatus: 'error'
      }, { status: 400 });
    }

    // Get actors for both canisters
    const [pos, dvn] = await Promise.all([
      getActor<any>(POS_ID, posIdl),
      getActor<any>(DVN_ID, dvnIdl)
    ]);

    // Get pending counts from both canisters
    const [posPendingCount, dvnPendingMessages] = await Promise.all([
      pos.get_pending_count().catch(() => BigInt(0)),
      dvn.get_pending_messages().catch(() => [])
    ]);

    const posCount = Number(posPendingCount);
    let dvnCount = Array.isArray(dvnPendingMessages) ? dvnPendingMessages.length : 0;
    // Add locally tracked pending from cookie
    try {
      const cookie = req.headers.get('cookie') || '';
      const match = cookie.match(/(?:^|; )dvn_local_pending=([^;]+)/);
      if (match) {
        const arr = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(arr)) dvnCount += arr.length;
      }
    } catch {}
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
    console.error('Sync status API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      syncStatus: 'error',
      severity: 'critical'
    }, { status: 500 });
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
