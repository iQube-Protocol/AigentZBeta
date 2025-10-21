/*
  Demo Loop: BTC Q¢ → ETH Q¢ → ARB Q¢ → BTC Q¢
  Uses internal API proxies:
    - /api/a2a/facilitator/pay-intent
    - /api/a2a/signer/transfer
    - /api/a2a/facilitator/verify
    - /api/a2a/faucet/airdrop
    - /api/a2a/faucet/swap
  Configure BASE_URL to your running Next dev server (e.g., http://localhost:3000)
*/

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function postJson(path: string, body: any) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try {
    return { ok: r.ok, status: r.status, json: JSON.parse(text) };
  } catch {
    return { ok: r.ok, status: r.status, json: text } as any;
  }
}

async function run() {
  console.log("[DemoLoop] Starting 4-hop Q¢ flow...");

  // Optional: ensure airdrop/swap from faucet first for ETH Q¢
  // 1) Airdrop USDC (Sepolia)
  console.log("[Faucet] Airdrop USDC on Sepolia (optional)");
  try {
    const ad = await postJson("/api/a2a/faucet/airdrop", { chain: "ethereum", symbol: "USDC" });
    console.log("  → ", ad.status, ad.json?.ok ? "ok" : ad.json);
  } catch (e) {
    console.log("  → faucet airdrop skipped", (e as Error).message);
  }

  // 2) Swap USDC → QCT (ETH)
  console.log("[Faucet] Swap USDC→QCT on ETH (optional)");
  try {
    const sw = await postJson("/api/a2a/faucet/swap", { from: "USDC", to: "QCT", chain: "ethereum", amount: "10" });
    console.log("  → ", sw.status, sw.json?.ok ? "ok" : sw.json);
  } catch (e) {
    console.log("  → faucet swap skipped", (e as Error).message);
  }

  // Payment hops via facilitator/signers (resource IDs and asset keys are illustrative)
  const hops = [
    { label: "BTC Q¢ → ETH Q¢", resourceId: "svc:bridge:btc-to-eth", assetKey: "BTC_QCENT" },
    { label: "ETH Q¢ → ARB Q¢", resourceId: "svc:bridge:eth-to-arb", assetKey: "ETH_QCENT" },
    { label: "ARB Q¢ → BTC Q¢", resourceId: "svc:bridge:arb-to-btc", assetKey: "ARB_QCENT" },
  ];

  for (const hop of hops) {
    console.log(`[Hop] ${hop.label}`);

    // 1) Pay intent
    const pi = await postJson("/api/a2a/facilitator/pay-intent", { resourceId: hop.resourceId, assetKey: hop.assetKey });
    if (!pi.ok) {
      console.error("  pay-intent failed", pi.status, pi.json);
      break;
    }
    const payParams = pi.json?.payParams;
    console.log("  payParams:", payParams);

    // 2) Signer transfer
    const tr = await postJson("/api/a2a/signer/transfer", {
      chainId: payParams.chainId,
      tokenAddress: payParams.tokenAddress,
      to: payParams.payTo,
      amount: payParams.amount,
      asset: payParams.asset,
      currency: payParams.currency,
      deadline: payParams.deadline,
    });
    if (!tr.ok) {
      console.error("  transfer failed", tr.status, tr.json);
      break;
    }
    const txId = tr.json?.txHash || tr.json?.txId || tr.json?.hash;
    console.log("  txId:", txId);

    // 3) Verify
    const vr = await postJson("/api/a2a/facilitator/verify", {
      assetKey: hop.assetKey,
      txHashOrId: txId,
      amount: payParams.amount,
    });
    if (!vr.ok || !vr.json?.ok) {
      console.error("  verify failed", vr.status, vr.json);
      break;
    }
    console.log("  proof:", vr.json?.proof ? "received" : vr.json);
  }

  console.log("[DemoLoop] Finished.");
}

run().catch((e) => {
  console.error("[DemoLoop] Error:", e);
  process.exit(1);
});
