import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';

/**
 * QCT Rekey API (Stage 1A - EVM-only demo scaffold)
 *
 * Flow (scaffold):
 * 1) Validate payload and build a metaQube-like fact
 * 2) Optionally simulate LayerZero message (feature flag)
 * 3) Issue a Proof-of-State receipt recording the rekey action (serves as canonical attestation)
 * 4) Return identifiers; real on-chain burn/mint can be wired once DVN agent keys are configured
 *
 * Env (optional now, required for real on-chain ops later):
 * - PROOF_OF_STATE_CANISTER_ID or NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID
 * - QCT_SIMULATE=true | false (default: true)
 * - Per-chain DVN agent keys (future): QCT_DVN_AGENT_PK_SEPOLIA, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { asset, from, to, amount, policyHash, identityState, nonce } = body || {};

    // Basic validation
    if (asset !== 'QCT') {
      return NextResponse.json({ ok: false, error: 'asset must be QCT' }, { status: 400 });
    }
    if (!from?.chain || !from?.owner || !to?.chain || !to?.owner) {
      return NextResponse.json({ ok: false, error: 'from/to { chain, owner } are required' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'string') {
      return NextResponse.json({ ok: false, error: 'amount (string in minor units, e.g., cents) is required' }, { status: 400 });
    }
    if (!nonce || typeof nonce !== 'string') {
      return NextResponse.json({ ok: false, error: 'nonce (uuid) is required for idempotency' }, { status: 400 });
    }

    const simulate = (process.env.QCT_SIMULATE ?? 'true').toLowerCase() !== 'false';

    // Build metaQube-like record for attestation
    const meta = {
      type: 'metaQube.tx.v1',
      asset: 'QCT',
      from,
      to,
      amount, // minor units (e.g., cents)
      policyHash: policyHash || null,
      identityState: identityState || 'semi-anonymous',
      anchorIntent: true,
      nonce,
      at: new Date().toISOString(),
    };

    // Simulate a LayerZero message id (replace with real LZ call later)
    const messageId = simulate ? `sim:${Buffer.from(`${nonce}:${from.chain}->${to.chain}`).toString('hex').slice(0, 24)}` : undefined;

    // Issue PoS receipt as canonical attestation of rekey intent/result
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string | undefined;
    let attestationId: string | undefined = undefined;

    if (POS_ID) {
      try {
        const pos = await getActor<any>(POS_ID, posIdl);
        // hash the meta content as data_hash (string) — use stable JSON
        const data_hash = await (async () => {
          const encoder = new TextEncoder();
          const json = JSON.stringify(meta);
          // use a quick hash (browser-like) if Node crypto not available in edge
          const buf = encoder.encode(json);
          let h = 0; for (let i = 0; i < buf.length; i++) { h = (h * 31 + buf[i]) | 0; }
          return `meta_${nonce}_${Math.abs(h)}`;
        })();
        attestationId = await pos.issue_receipt(data_hash);
      } catch (e: any) {
        // Keep the flow non-blocking; return without attestation if PoS unreachable
        attestationId = undefined;
      }
    }

    // Scaffold response (on-chain burn/mint to be wired when DVN agent and RPCs are configured)
    return NextResponse.json({
      ok: true,
      simulate,
      rekey: {
        asset: 'QCT',
        from,
        to,
        amount,
        nonce,
      },
      messageId,
      attestationId,
      at: new Date().toISOString(),
      notes: simulate
        ? 'Simulated LayerZero message. To enable real on-chain burn/mint, configure DVN agent keys and RPCs, then set QCT_SIMULATE=false.'
        : 'LayerZero path should be wired; mint/burn drivers pending DVN agent configuration.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'QCT rekey failed' }, { status: 500 });
  }
}
