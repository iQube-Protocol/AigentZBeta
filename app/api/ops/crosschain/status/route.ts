import { NextResponse } from 'next/server';
import { getCrossChainStatus } from '@/services/ops/crossChainService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';

export async function GET() {
  try {
    const base = await getCrossChainStatus();
    let supportedChains = base.supportedChains;
    try {
      const EVM_ID = process.env.EVM_RPC_CANISTER_ID as string;
      if (EVM_ID) {
        const evm = getActor<any>(EVM_ID, evmIdl);
        const chains = await evm.get_supported_chains();
        supportedChains = Array.isArray(chains) ? chains.length : supportedChains;
      }
    } catch {}

    const status = { ...base, supportedChains };
    return NextResponse.json({ ok: status.ok, status, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load cross-chain status' }, { status: 500 });
  }
}
