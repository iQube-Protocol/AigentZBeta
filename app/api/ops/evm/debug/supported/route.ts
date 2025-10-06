import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';

export async function GET(_req: NextRequest) {
  const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string | undefined;
  const host = process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST || 'https://icp-api.io';
  const network = process.env.DFX_NETWORK || 'ic';

  if (!EVM_ID) {
    const res = NextResponse.json({ ok: false, error: 'EVM_RPC_CANISTER_ID not configured', host, network }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    return res;
  }

  try {
    const evm = await getActor<any>(EVM_ID, evmIdl);
    // attempt supported chains
    const chains: any[] = await evm.get_supported_chains().catch((e: any) => { throw new Error(`get_supported_chains failed: ${e?.message || e}`); });

    // Try to fetch the identity principal if actor exposes it (optional)
    let principal: string | null = null;
    try {
      if (typeof (evm as any)._agent === 'object' && typeof (evm as any)._agent.getPrincipal === 'function') {
        principal = String(await (evm as any)._agent.getPrincipal());
      }
    } catch {}

    const res = NextResponse.json({
      ok: true,
      canisterId: EVM_ID,
      host,
      network,
      principal,
      length: Array.isArray(chains) ? chains.length : 0,
      chains
    });
    res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    return res;
  } catch (error: any) {
    const res = NextResponse.json({
      ok: false,
      error: error?.message || 'EVM supported chains debug failed',
      canisterId: EVM_ID,
      host,
      network
    }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    return res;
  }
}
