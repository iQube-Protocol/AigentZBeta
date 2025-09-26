import { NextResponse } from 'next/server';
import { getTestnetStatus, getAnchorStatus } from '@/services/ops/btcService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET() {
  try {
    const testnet = await getTestnetStatus();
    console.log('BTC testnet status:', testnet);

    // Start with placeholder anchor values then enrich via Proof-of-State
    let anchor = await getAnchorStatus().catch(() => null as any);

    try {
      const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
      if (POS_ID) {
        const pos = await getActor<any>(POS_ID, posIdl);
        // Get batches from proof-of-state, but get pending count from DVN (they should be synchronized)
        const batches = await pos.get_batches().catch(() => []);
        
        // Get pending count from both canisters to verify synchronization
        let dvnPendingCount = BigInt(0);
        let posPendingCount = BigInt(0);
        
        try {
          posPendingCount = await pos.get_pending_count().catch(() => BigInt(0));
        } catch (e) {
          console.warn('Failed to get pending count from proof-of-state canister:', e);
        }
        
        try {
          const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
          if (DVN_ID) {
            const dvn = await getActor<any>(DVN_ID, dvnIdl);
            const pendingMessages = await dvn.get_pending_messages().catch(() => []);
            dvnPendingCount = BigInt(Array.isArray(pendingMessages) ? pendingMessages.length : 0);
          }
        } catch (e) {
          console.warn('Failed to get pending count from DVN canister:', e);
        }
        
        // Use proof-of-state count as the source of truth for batch operations
        const pendingCount = posPendingCount;
        const isSynchronized = dvnPendingCount === posPendingCount;
        // Derive last anchor id from latest batch
        if (Array.isArray(batches) && batches.length > 0) {
          const latest = batches[batches.length - 1];
          const lastAnchorId = latest?.root ?? undefined;
          // Handle both Candid optional formats: [] | [string] or null | string
          const txidRaw = latest?.btc_anchor_txid;
          let txid: string | undefined;
          if (Array.isArray(txidRaw) && txidRaw.length === 1) {
            txid = txidRaw[0];
          } else if (typeof txidRaw === 'string') {
            txid = txidRaw;
          } else {
            txid = undefined;
          }

          anchor = {
            ok: true,
            lastAnchorId,
            txid,
            pending: Number(pendingCount ?? BigInt(0)),
            at: new Date().toISOString(),
            details: `batches:${batches.length}`,
            syncStatus: isSynchronized ? 'synced' : 'out-of-sync',
            dvnPending: Number(dvnPendingCount),
            posPending: Number(posPendingCount),
          };
        } else {
          anchor = {
            ok: true,
            lastAnchorId: undefined,
            txid: undefined,
            pending: Number(pendingCount ?? BigInt(0)),
            at: new Date().toISOString(),
            details: 'no batches',
            syncStatus: isSynchronized ? 'synced' : 'out-of-sync',
            dvnPending: Number(dvnPendingCount),
            posPending: Number(posPendingCount),
          };
        }
      }
    } catch (e: any) {
      console.error('Proof-of-state canister error:', e);
      // Fallback when canister is unreachable
      anchor = {
        ok: false,
        lastAnchorId: undefined,
        txid: undefined,
        pending: 0,
        at: new Date().toISOString(),
        details: 'canister unreachable',
      };
    }

    // If we have a txid and a testnet endpoint, enrich with explorer data
    try {
      const endpoint = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET;
      // Heuristic: if we don't have txid but we do have a lastAnchorId, try probing explorer with it
      if (!anchor?.txid && anchor?.lastAnchorId && endpoint) {
        try {
          const base = endpoint.replace(/\/$/, '');
          const probe = await fetch(`${base}/tx/${anchor.lastAnchorId}`, { cache: 'no-store' });
          if (probe.ok) {
            anchor = { ...anchor, txid: anchor.lastAnchorId };
          }
        } catch {}
      }

      if (anchor?.txid && endpoint) {
        const base = endpoint.replace(/\/$/, '');
        const txRes = await fetch(`${base}/tx/${anchor.txid}`, { cache: 'no-store' });
        if (txRes.ok) {
          const txJson: any = await txRes.json();
          const confirmed = !!txJson?.status?.confirmed;
          const blockHeight = txJson?.status?.block_height ?? null;
          let confirmations: number | undefined = undefined;
          if (confirmed && typeof blockHeight === 'number') {
            const tipRes = await fetch(`${base}/blocks/tip/height`, { cache: 'no-store' });
            if (tipRes.ok) {
              const tipHeight = Number(await tipRes.text());
              if (Number.isFinite(tipHeight)) {
                confirmations = Math.max(0, tipHeight - blockHeight + 1);
              }
            }
          }
          anchor = {
            ...anchor,
            confirmations,
            blockHeight: typeof blockHeight === 'number' ? blockHeight : undefined,
            status: confirmed ? 'confirmed' : 'pending',
          };
        }
      }
    } catch {}

    return NextResponse.json({ ok: testnet.ok && (!!anchor ? anchor.ok : true), testnet, anchor, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load BTC status' }, { status: 500 });
  }
}
