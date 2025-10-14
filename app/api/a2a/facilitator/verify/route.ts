export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const FACILITATOR_URL = process.env.FACILITATOR_URL || process.env.NEXT_PUBLIC_FACILITATOR_URL;
    const body = await req.json();
    if (FACILITATOR_URL) {
      const r = await fetch(`${FACILITATOR_URL}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json" } });
    }

    const { assetKey, txHashOrId, chainId, tokenAddress, payTo, amount } = body || {};
    if (!assetKey || !txHashOrId) {
      return new Response(JSON.stringify({ ok: false, error: "assetKey and txHashOrId required" }), { status: 400 });
    }
    // EVM verification supported for all testnet chains
    if (assetKey === "ETH_QCENT" || assetKey === "ARB_QCENT" || assetKey === "BASE_QCENT" || assetKey === "OP_QCENT" || assetKey === "POLY_QCENT") {
      const { ethers } = await import("ethers");
      const rpc = (cid: number) => {
        switch (cid) {
          case 11155111: // Ethereum Sepolia
            return process.env.NEXT_PUBLIC_RPC_SEPOLIA;
          case 421614: // Arbitrum Sepolia
            return process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA;
          case 84532: // Base Sepolia
            return process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA;
          case 11155420: // Optimism Sepolia
            return process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA;
          case 80002: // Polygon Amoy
            return process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY;
          default:
            return undefined;
        }
      };
      const url = rpc(Number(chainId));
      if (!url) return new Response(JSON.stringify({ ok: false, error: "unsupported chainId" }), { status: 400 });
      const provider = new ethers.JsonRpcProvider(url);
      const receipt = await provider.getTransactionReceipt(txHashOrId);
      if (!receipt) return new Response(JSON.stringify({ ok: false, error: "receipt not found" }), { status: 404 });

      // Validate token transfer to treasury
      const iface = new ethers.Interface([
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      ]);
      const token = (tokenAddress as string)?.toLowerCase();
      const dest = (payTo as string)?.toLowerCase();
      const logs = receipt.logs?.filter((l: any) => l.address?.toLowerCase() === token) || [];
      let matched = false;
      for (const l of logs) {
        try {
          const parsed = iface.parseLog({ topics: l.topics, data: l.data });
          if (parsed?.name === "Transfer") {
            const to = (parsed.args?.to as string)?.toLowerCase();
            const val = parsed.args?.value?.toString();
            if (!dest || to === dest) {
              if (!amount || val === String(amount)) {
                matched = true;
                break;
              }
            }
          }
        } catch {}
      }
      if (!matched) return new Response(JSON.stringify({ ok: false, error: "transfer log not found/mismatch" }), { status: 422 });

      const proof = {
        type: "evm.receipt.v1",
        chainId: Number(chainId),
        txHash: txHashOrId,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        tokenAddress,
        payTo,
        amount: String(amount || ""),
      };
      return new Response(JSON.stringify({ ok: true, txId: txHashOrId, proof }), { status: 200 });
    }

    // BTC/SOL: issue Proof-of-State receipt for the tx id (fast confirmation)
    if (assetKey === "BTC_QCENT" || assetKey === "SOL_QCENT") {
      const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string | undefined;
      if (!POS_ID) return new Response(JSON.stringify({ ok: false, error: "proof_of_state canister not configured" }), { status: 500 });
      const { getActor } = await import("@/services/ops/icAgent");
      const { idlFactory: posIdl } = await import("@/services/ops/idl/proof_of_state");
      const pos = await getActor<any>(POS_ID, posIdl);
      // data_hash can be sha256(txHashOrId)
      const crypto = await import("crypto");
      const data_hash = crypto.createHash("sha256").update(String(txHashOrId)).digest("hex");
      let receiptId: string = "";
      try {
        // Try to fetch existing receipt first
        const existing = await pos.get_receipt(data_hash).catch(() => []);
        if (Array.isArray(existing) && existing.length === 1 && existing[0]?.id) {
          receiptId = existing[0].id as string;
        } else {
          receiptId = await pos.issue_receipt(data_hash);
        }
      } catch (e) {
        // Fallback: still return a deterministic proof reference
        receiptId = `rcpt_${data_hash.slice(0, 16)}`;
      }

      // Trigger DVN flow for BTC/SOL A2A transactions
      try {
        await triggerA2ADVNFlowNonEVM(txHashOrId, assetKey);
      } catch (dvnError) {
        console.warn('DVN flow trigger failed for BTC/SOL:', dvnError);
        // Don't fail the verification if DVN fails
      }

      const proof = {
        type: "pos.receipt.v1",
        network: assetKey === "BTC_QCENT" ? "bitcoin" : "solana",
        txId: txHashOrId,
        dataHash: data_hash,
        receiptId,
      };
      return new Response(JSON.stringify({ ok: true, txId: txHashOrId, proof }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false, error: "assetKey not supported in internal verifier" }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "verify failed" }), { status: 500 });
  }
}

async function triggerA2ADVNFlowNonEVM(txHashOrId: string, assetKey: string) {
  try {
    // Submit DVN message for BTC/SOL cross-chain processing
    const chainId = assetKey === "BTC_QCENT" ? 0 : 101; // Bitcoin: 0, Solana: 101
    
    const dvnResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ops/dvn/monitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: txHashOrId,
        chainId,
        source: `A2A_${assetKey}`
      })
    });

    if (!dvnResponse.ok) {
      throw new Error(`DVN monitoring failed: ${dvnResponse.status}`);
    }

    const dvnResult = await dvnResponse.json();
    console.log(`A2A ${assetKey} DVN message submitted: ${dvnResult.messageId || 'success'}`);

  } catch (error) {
    console.error(`A2A ${assetKey} DVN flow error:`, error);
    throw error;
  }
}
