export type HealthItem = { name: string; ok: boolean; details?: string; at: string };
export type HealthSummary = { ok: boolean; items: HealthItem[]; at: string };

// Mocked health check - replace with real HTTP/candid calls
export async function getCanisterHealth(): Promise<HealthSummary> {
  const names = [
    { key: 'proof_of_state', env: process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID },
    { key: 'btc_signer_psbt', env: process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID },
    { key: 'cross_chain_service', env: process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID },
    { key: 'evm_rpc', env: process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID },
    { key: 'solana_signer_ed25519', env: process.env.NEXT_PUBLIC_SOLANA_SIGNER_CANISTER_ID },
  ];

  const items: HealthItem[] = names.map((n) => ({
    name: n.key,
    ok: Boolean(n.env && n.env.length > 0),
    details: n.env ? `id: ${n.env}` : 'not configured',
    at: new Date().toISOString(),
  }));

  const ok = items.every((i) => i.ok);
  return { ok, items, at: new Date().toISOString() };
}
