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
          pos.get_batches().catch(() => []),
          pos.get_pending_count().catch(() => 0n),
        ]);
        // Derive last anchor id from latest batch
        if (Array.isArray(batches) && batches.length > 0) {
          const latest = batches[batches.length - 1];
          const lastAnchorId = latest?.root ?? undefined;
          const txidOpt = latest?.btc_anchor_txid as [] | [string];
          let txid = Array.isArray(txidOpt) && txidOpt.length === 1 ? txidOpt[0] : undefined;

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
            txid: undefined,
            pending: Number(pendingCount ?? 0n),
            at: new Date().toISOString(),
            details: 'no batches',
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
