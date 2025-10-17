import { useCallback } from "react";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL as string | undefined;

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

export function useFacilitator() {
  const payIntent = useCallback(async (req: PayIntentReq): Promise<PayIntentRes> => {
    if (!FACILITATOR_URL) throw new Error("Facilitator URL not configured");
    const r = await fetch(`${FACILITATOR_URL}/pay-intent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!r.ok) throw new Error(`pay-intent failed: ${r.status}`);
    return r.json();
  }, []);

  const verify = useCallback(async (req: VerifyReq): Promise<VerifyRes> => {
    if (!FACILITATOR_URL) throw new Error("Facilitator URL not configured");
    const r = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!r.ok) return { ok: false, reason: await r.text() };
    return r.json();
  }, []);

  return { payIntent, verify };
}
