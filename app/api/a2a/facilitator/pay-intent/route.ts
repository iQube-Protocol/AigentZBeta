export const dynamic = "force-dynamic";

function mapAsset(assetKey: string) {
  const QCT_CONTRACT = "0x4C4f1aD931589449962bB675bcb8e95672349d09"; // Same on all testnets
  // Send A2A test payments to Aigent MoneyPenny's wallet
  const MONEYPENNY_ADDRESS = "0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5f";
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || MONEYPENNY_ADDRESS;
  const now = Math.floor(Date.now() / 1000);
  switch (assetKey) {
    case "ETH_QCENT":
      return {
        asset: "QCT",
        chainId: 11155111, // Ethereum Sepolia
        tokenAddress: QCT_CONTRACT,
        payTo: TREASURY_ADDRESS,
        amount: "800000000000000000", // 0.8 Q¢ @ 18 decimals
        currency: "QCT",
        deadline: now + 15 * 60,
      };
    case "ARB_QCENT":
      return {
        asset: "QCT",
        chainId: 421614, // Arbitrum Sepolia
        tokenAddress: QCT_CONTRACT,
        payTo: TREASURY_ADDRESS,
        amount: "800000000000000000",
        currency: "QCT",
        deadline: now + 15 * 60,
      };
    case "BASE_QCENT":
      return {
        asset: "QCT",
        chainId: 84532, // Base Sepolia
        tokenAddress: QCT_CONTRACT,
        payTo: TREASURY_ADDRESS,
        amount: "800000000000000000",
        currency: "QCT",
        deadline: now + 15 * 60,
      };
    case "OP_QCENT":
      return {
        asset: "QCT",
        chainId: 11155420, // Optimism Sepolia
        tokenAddress: QCT_CONTRACT,
        payTo: TREASURY_ADDRESS,
        amount: "800000000000000000",
        currency: "QCT",
        deadline: now + 15 * 60,
      };
    case "POLY_QCENT":
      return {
        asset: "QCT",
        chainId: 80002, // Polygon Amoy
        tokenAddress: QCT_CONTRACT,
        payTo: TREASURY_ADDRESS,
        amount: "800000000000000000",
        currency: "QCT",
        deadline: now + 15 * 60,
      };
    case "BTC_QCENT":
      return {
        asset: "BTC_QCENT",
        chainId: 0,
        tokenAddress: null,
        payTo: "tb1q03256641efc3dd9877560daf26e4d6bb46086a42", // BTC testnet address
        amount: "1000", // 1000 sats = ~$0.80 at current rates
        currency: "BTC_QCENT",
        deadline: now + 15 * 60,
      };
    case "SOL_QCENT":
      return {
        asset: "SOL_QCENT", 
        chainId: 0,
        tokenAddress: null,
        payTo: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // SOL testnet address
        amount: "5000000", // 0.005 SOL = ~$0.80 at current rates (6 decimals)
        currency: "SOL_QCENT",
        deadline: now + 15 * 60,
      };
    default:
      throw new Error(`Unknown assetKey: ${assetKey}`);
  }
}

export async function POST(req: Request) {
  try {
    const FACILITATOR_URL = process.env.FACILITATOR_URL || process.env.NEXT_PUBLIC_FACILITATOR_URL;
    const body = await req.json();
    if (FACILITATOR_URL) {
      const r = await fetch(`${FACILITATOR_URL}/pay-intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json" } });
    }

    const { resourceId, assetKey } = body || {};
    if (!resourceId || !assetKey) return new Response(JSON.stringify({ ok: false, error: "resourceId and assetKey required" }), { status: 400 });
    const payParams = mapAsset(assetKey);
    return new Response(JSON.stringify({ x402Version: "1", payParams }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "error" }), { status: 500 });
  }
}
