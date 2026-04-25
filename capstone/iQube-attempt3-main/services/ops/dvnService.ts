export type DVNStatus = {
  ok: boolean;
  pendingMessages: number;
  validatorsOnline?: number;
  at: string;
  details?: string;
};

export async function getDVNStatus(): Promise<DVNStatus> {
  const canister = process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  // Mocked numbers for now; wire to canister HTTP API later
  const ok = Boolean(canister && canister.length > 0);
  return {
    ok,
    pendingMessages: ok ? 0 : 0,
    validatorsOnline: ok ? 2 : 0,
    at: new Date().toISOString(),
    details: canister ? `id: ${canister}` : 'not configured',
  };
}
