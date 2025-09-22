export type ChainStatus = { ok: boolean; details?: string; at: string };
export type AnchorStatus = {
  ok: boolean;
  lastAnchorId?: string;
  pending?: number;
  txid?: string;
  confirmations?: number;
  blockHeight?: number;
  status?: 'confirmed' | 'pending';
  at: string;
  details?: string;
};

export async function getTestnetStatus(): Promise<ChainStatus & { blockHeight?: number }> {
  const endpoint = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET;
  if (!endpoint) {
    return {
      ok: false,
      details: 'endpoint: not configured',
      at: new Date().toISOString(),
    };
  }

  // Try multiple BTC testnet APIs with shorter timeout
  const apis = [
    { url: endpoint.replace(/\/$/, '') + '/blocks/tip/height', name: 'mempool.space' },
    { url: 'https://blockstream.info/testnet/api/blocks/tip/height', name: 'blockstream.info' }
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(api.url, { 
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'User-Agent': 'iQube-Protocol/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const text = await response.text();
          const blockHeight = Number(text.trim());
          if (Number.isFinite(blockHeight) && blockHeight > 0) {
            return {
              ok: true,
              blockHeight,
              details: `endpoint: ${api.name}`,
              at: new Date().toISOString(),
            };
          }
        }
        console.warn(`${api.name} API returned ${response.status}: ${response.statusText}`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn(`${api.name} API timeout after 5s`);
        } else {
          console.error(`${api.name} fetch error:`, fetchError);
        }
      }
    } catch (e) {
      console.error(`${api.name} error:`, e);
    }
  }

  return {
    ok: false,
    details: `endpoint: ${endpoint.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')} (unreachable)`,
    at: new Date().toISOString(),
  };
}

export async function getAnchorStatus(): Promise<AnchorStatus> {
  // Placeholder - real data comes from proof_of_state canister in /api/ops/btc/status
  const pos = process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
  const btc = process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID;
  const ok = Boolean(pos && btc);
  return {
    ok,
    lastAnchorId: undefined, // Will be populated by proof_of_state canister
    pending: undefined,
    at: new Date().toISOString(),
    details: ok ? `pos:${pos?.slice(0,8)}..., btc:${btc?.slice(0,8)}...` : 'canisters not configured',
  };
}
