export type EvmStatus = { ok: boolean; chain: string; endpoint?: string; at: string };

export async function getSepoliaStatus(): Promise<EvmStatus> {
  const endpoint = process.env.NEXT_PUBLIC_RPC_SEPOLIA;
  return {
    ok: Boolean(endpoint),
    chain: 'sepolia',
    endpoint,
    at: new Date().toISOString(),
  };
}

export async function getAmoyStatus(): Promise<EvmStatus> {
  const endpoint = process.env.NEXT_PUBLIC_RPC_AMOY;
  return {
    ok: Boolean(endpoint),
    chain: 'amoy',
    endpoint,
    at: new Date().toISOString(),
  };
}
