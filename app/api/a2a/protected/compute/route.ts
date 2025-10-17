export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function accepts() {
  return [
    { assetKey: 'ETH_QCENT', chainId: 11155111 },
    { assetKey: 'ARB_QCENT', chainId: 421614 },
    { assetKey: 'BTC_QCENT' },
    { assetKey: 'SOL_QCENT' },
  ];
}

export async function GET(req: Request) {
  try {
    const proofHeader = req.headers.get('x-402-proof') || req.headers.get('X-402-Proof');
    if (!proofHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'payment required', accepts: accepts(), resourceId: 'svc:compute:quote' }),
        { status: 402, headers: { 'content-type': 'application/json' } }
      );
    }

    let proof: any = null;
    try { proof = JSON.parse(proofHeader); } catch {
      return new Response(JSON.stringify({ ok: false, error: 'invalid proof json' }), { status: 402 });
    }

    // Minimal verification: EVM receipt or PoS receipt
    if (proof?.type === 'evm.receipt.v1') {
      const { txHash, chainId, status } = proof;
      if (!txHash || !chainId) return new Response(JSON.stringify({ ok: false, error: 'invalid evm proof' }), { status: 402 });
      // Optional: live check status
      try {
        const { ethers } = await import('ethers');
        const rpc = (cid: number) => (cid === 11155111 ? process.env.NEXT_PUBLIC_RPC_SEPOLIA : cid === 421614 ? process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA : undefined);
        const url = rpc(Number(chainId));
        if (url) {
          const provider = new ethers.JsonRpcProvider(url);
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt || receipt.status === 0) {
            return new Response(JSON.stringify({ ok: false, error: 'tx not confirmed' }), { status: 402 });
          }
        }
      } catch {}
    } else if (proof?.type === 'pos.receipt.v1') {
      const dataHash = proof?.dataHash;
      const receiptId = proof?.receiptId;
      const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string | undefined;
      if (POS_ID) {
        try {
          const { getActor } = await import('@/services/ops/icAgent');
          const { idlFactory: posIdl } = await import('@/services/ops/idl/proof_of_state');
          const pos = await getActor<any>(POS_ID, posIdl);
          const tryIds = [dataHash, receiptId].filter(Boolean);
          let found = false;
          for (const id of tryIds) {
            try {
              const got = await pos.get_receipt(String(id));
              if (Array.isArray(got) && got.length === 1) { found = true; break; }
            } catch {}
          }
          if (!found) return new Response(JSON.stringify({ ok: false, error: 'receipt not found' }), { status: 402 });
        } catch {
          // If PoS lookup fails, treat as unpaid
          return new Response(JSON.stringify({ ok: false, error: 'receipt verification failed' }), { status: 402 });
        }
      } else {
        return new Response(JSON.stringify({ ok: false, error: 'proof_of_state canister not configured' }), { status: 500 });
      }
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'unsupported proof type' }), { status: 402 });
    }

    // Authorized - return protected resource (dummy compute result)
    return new Response(
      JSON.stringify({ ok: true, result: { quote: 'Agentic compute result', at: new Date().toISOString() } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'error' }), { status: 500 });
  }
}
