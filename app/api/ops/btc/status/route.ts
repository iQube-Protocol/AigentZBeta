import { NextResponse } from 'next/server';
import { getTestnetStatus, getAnchorStatus } from '@/services/ops/btcService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

export async function GET() {
  try {
    const testnet = await getTestnetStatus();

    // Start with placeholder anchor values then enrich via Proof-of-State
    let anchor = await getAnchorStatus().catch(() => null as any);

    try {
      const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
      if (POS_ID) {
        const pos = getActor<any>(POS_ID, posIdl);
        const [batches, pendingCount] = await Promise.all([
          pos.get_batches(),
          pos.get_pending_count(),
        ]);
        // Derive last anchor id from latest batch
        if (Array.isArray(batches) && batches.length > 0) {
          const latest = batches[batches.length - 1];
          const lastAnchorId = latest?.root ?? undefined;
          const txidOpt = latest?.btc_anchor_txid as [] | [string];
          let txid = Array.isArray(txidOpt) && txidOpt.length === 1 ? txidOpt[0] : undefined;
          
          // Demo: Add mock txid if none exists (remove this in production)
          if (!txid && process.env.NODE_ENV === 'development') {
            txid = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
          }
          
          anchor = {
            ok: true,
            lastAnchorId,
            txid,
            pending: Number(pendingCount ?? 0n),
            at: new Date().toISOString(),
            details: `batches:${batches.length}`,
          };
        } else {
          anchor = {
            ok: true,
            lastAnchorId: undefined,
            pending: Number(pendingCount ?? 0n),
            at: new Date().toISOString(),
            details: 'no batches',
          };
        }
      }
    } catch {}

    // If we have a txid and a testnet endpoint, enrich with explorer data
    try {
      const endpoint = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET;
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
        } else if (process.env.NODE_ENV === 'development') {
          // Demo: Mock blockchain data for development
          anchor = {
            ...anchor,
            confirmations: 6,
            blockHeight: 2847392,
            status: 'confirmed',
          };
        }
      }
    } catch {}

    return NextResponse.json({ ok: testnet.ok && (!!anchor ? anchor.ok : true), testnet, anchor, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load BTC status' }, { status: 500 });
  }
}
