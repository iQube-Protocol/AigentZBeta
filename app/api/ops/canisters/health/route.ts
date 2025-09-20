import { NextResponse } from 'next/server';
import { getCanisterHealth } from '@/services/ops/icpService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export async function GET() {
  try {
    // Base env ids
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;

    // Fallback summary based on presence of env vars
    const canisters = await getCanisterHealth();

    // Try live calls (gracefully degrade on failure)
    let pendingCount: bigint | null = null;
    let supportedChains: number | null = null;
    let dvnPending: number | null = null;

    try {
      if (POS_ID) {
        const pos = getActor<any>(POS_ID, posIdl);
        pendingCount = await pos.get_pending_count();
      }
    } catch {}

    try {
      if (EVM_ID) {
        const evm = getActor<any>(EVM_ID, evmIdl);
        const chains = await evm.get_supported_chains();
        supportedChains = Array.isArray(chains) ? chains.length : 0;
      }
    } catch {}

    try {
      if (DVN_ID) {
        const dvn = getActor<any>(DVN_ID, dvnIdl);
        const msgs = await dvn.get_pending_messages();
        dvnPending = Array.isArray(msgs) ? msgs.length : 0;
      }
    } catch {}

    const dvn = {
      ok: dvnPending !== null,
      pendingMessages: dvnPending ?? 0,
      validatorsOnline: null,
      at: new Date().toISOString(),
      details: DVN_ID ? `id: ${DVN_ID}` : 'not configured',
    };

    return NextResponse.json({
      ok: canisters.ok,
      canisters: {
        ...canisters,
        items: canisters.items.map((i) => {
          if (i.name === 'proof_of_state' && pendingCount !== null) {
            return { ...i, details: `${i.details} • pending:${pendingCount.toString()}` };
          }
          if (i.name === 'evm_rpc' && supportedChains !== null) {
            return { ...i, details: `${i.details} • chains:${supportedChains}` };
          }
          return i;
        })
      },
      dvn,
      at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load canister health' }, { status: 500 });
  }
}
