export type PayIntentReq = { resourceId: string; assetKey: string };
export type PayIntentRes = {
  x402Version: "1";
  payParams: {
    asset: string;
    chainId: number | string;
    tokenAddress: string | null;
    payTo: string;
    amount: string;
    currency: string;
    deadline: number;
  };
};

export type VerifyReq = { assetKey: string; txHashOrId: string; amount: string };
export type VerifyRes = { ok: boolean; proof?: any; reason?: string };

export type PayAndProofResult = { ok: boolean; txId?: string; proof?: any; reason?: string };

async function postJson(url: string, body: any): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

/**
 * Performs the 402 flow: pay-intent -> signer transfer -> verify -> return proof
 * Use this to obtain a proof blob you can attach to a follow-up request header
 * e.g. { 'X-402-Proof': JSON.stringify(proof) }
 */
export async function payAndGetProof(resourceId: string, assetKey: string): Promise<PayAndProofResult> {
  try {
    // 1) Get pay-intent
    const piRes = await postJson("/api/a2a/facilitator/pay-intent", { resourceId, assetKey });
    if (!piRes.ok) return { ok: false, reason: `pay-intent failed: ${piRes.status}` };
    const intent: PayIntentRes = await piRes.json();

    const { payParams } = intent;
    const transferBody = {
      chainId: payParams.chainId,
      tokenAddress: payParams.tokenAddress,
      to: payParams.payTo,
      amount: payParams.amount,
      asset: payParams.asset,
    };

    // 2) Execute transfer via signer
    const signerRes = await postJson("/api/a2a/signer/transfer", transferBody);
    if (!signerRes.ok) return { ok: false, reason: `signer transfer failed: ${signerRes.status}` };
    const signerJson = await signerRes.json();
    
    // Handle manual payment instructions for BTC/SOL
    if (signerJson?.requiresManualPayment) {
      return { 
        ok: false, 
        reason: `Manual payment required: ${signerJson.instructions?.note || 'Send payment manually then verify with transaction ID'}`,
        instructions: signerJson.instructions
      };
    }
    
    const txId: string = signerJson?.txHash || signerJson?.txId || signerJson?.hash || "";
    if (!txId) return { ok: false, reason: "missing tx id/hash from signer" };

    // 3) Verify with facilitator to obtain proof
    const verifyRes = await postJson("/api/a2a/facilitator/verify", {
      assetKey,
      txHashOrId: txId,
      chainId: payParams.chainId,
      tokenAddress: payParams.tokenAddress,
      payTo: payParams.payTo,
      amount: payParams.amount,
    });
    if (!verifyRes.ok) return { ok: false, reason: `verify failed: ${verifyRes.status}` };
    const verifyJson: VerifyRes = await verifyRes.json();
    if (!verifyJson.ok || !verifyJson.proof) return { ok: false, reason: verifyJson.reason || "verify not ok" };

    return { ok: true, txId, proof: verifyJson.proof };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "x402 flow failed" };
  }
}
