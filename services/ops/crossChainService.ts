export type CrossChainStatus = {
  ok: boolean;
  supportedChains: number;
  at: string;
  details?: string;
};

export async function getCrossChainStatus(): Promise<CrossChainStatus> {
  const canister = process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  // Placeholder values until wired to canister HTTP API
  const ok = Boolean(canister && canister.length > 0);
  return {
    ok,
    supportedChains: ok ? 4 : 0,
    at: new Date().toISOString(),
    details: canister ? `id: ${canister}` : 'not configured',
  };
}
