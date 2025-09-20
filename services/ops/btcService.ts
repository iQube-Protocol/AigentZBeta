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

export async function getTestnetStatus(): Promise<ChainStatus> {
  // TODO: Replace with real BTC testnet RPC/canister calls
  const endpoint = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET || 'not configured';
  return {
    ok: Boolean(process.env.NEXT_PUBLIC_RPC_BTC_TESTNET),
    details: `endpoint: ${endpoint}`,
    at: new Date().toISOString(),
  };
}

export async function getAnchorStatus(): Promise<AnchorStatus> {
  // Placeholder until wired to proof_of_state + btc_signer_psbt canisters
  const pos = process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
  const btc = process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID;
  const ok = Boolean(pos && btc);
  return {
    ok,
    lastAnchorId: ok ? 'latest_batch_#0' : undefined,
    pending: ok ? 0 : undefined,
    at: new Date().toISOString(),
    details: ok ? `pos:${pos}, btc:${btc}` : 'not configured',
  };
}
