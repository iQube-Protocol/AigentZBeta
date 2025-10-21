import { payAndGetProof } from "@/app/utils/x402";

export type X402FetchResult = { ok: boolean; status: number; json?: any; text?: string };

async function tryParse(r: Response) {
  const t = await r.text();
  try { return { json: JSON.parse(t), status: r.status, ok: r.ok }; } catch { return { text: t, status: r.status, ok: r.ok } as any; }
}

/**
 * Performs an x402-aware fetch.
 * - First attempt: request the resource
 * - If 402 Payment Required, obtains pay-intent -> signer transfer -> verify
 * - Retries with proof header: { 'X-402-Proof': JSON.stringify(proof) }
 */
export function x402PaidFetchFactory(resourceId: string, assetKey: string) {
  return async function x402PaidFetch(input: RequestInfo | URL, init?: RequestInit): Promise<X402FetchResult> {
    // 1) First attempt
    const first = await fetch(input, init);
    if (first.status !== 402) {
      const p = await tryParse(first);
      return { ok: first.ok, status: first.status, ...p } as X402FetchResult;
    }

    // 2) Execute 402 payment flow
    const flow = await payAndGetProof(resourceId, assetKey);
    if (!flow.ok || !flow.proof) {
      return { ok: false, status: 402, text: flow.reason || "payment required and proof unavailable" };
    }

    // 3) Retry with proof header
    const headers = new Headers(init?.headers || {});
    headers.set("X-402-Proof", JSON.stringify(flow.proof));
    const second = await fetch(input, { ...(init || {}), headers });
    const parsed = await tryParse(second);
    return { ok: second.ok, status: second.status, ...parsed } as X402FetchResult;
  };
}
