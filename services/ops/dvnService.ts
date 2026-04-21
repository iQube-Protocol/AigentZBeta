import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export type DVNStatus = {
  ok: boolean;
  pendingMessages: number;
  validatorsOnline?: number;
  at: string;
  details?: string;
};

export async function getDVNStatus(): Promise<DVNStatus> {
  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;

  if (!canisterId) {
    return { ok: false, pendingMessages: 0, validatorsOnline: 0, at: new Date().toISOString(), details: 'not configured' };
  }

  try {
    const dvn = await getActor<any>(canisterId, dvnIdl);
    const [pending, ready] = await Promise.all([
      dvn.get_pending_messages() as Promise<Array<unknown>>,
      dvn.get_ready_messages() as Promise<Array<unknown>>,
    ]);
    return {
      ok: true,
      pendingMessages: (pending?.length ?? 0) + (ready?.length ?? 0),
      validatorsOnline: 2, // attestation quorum size — update when canister exposes validator count
      at: new Date().toISOString(),
      details: `id: ${canisterId} | pending: ${pending?.length ?? 0} | ready: ${ready?.length ?? 0}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      pendingMessages: 0,
      validatorsOnline: 0,
      at: new Date().toISOString(),
      details: err?.message ?? 'canister call failed',
    };
  }
}
