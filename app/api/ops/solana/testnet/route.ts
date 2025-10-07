import { NextResponse } from 'next/server';
import { getAnonymousActor } from '@/services/ops/icAgent';
import { solRpcIdlFactory } from '@/services/ops/idl/sol_rpc';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const SOL_RPC = 'tghme-zyaaa-aaaar-qarca-cai';

export async function GET() {
  try {
    // Use SOL RPC canister for Solana Testnet
    const sol = await getAnonymousActor(SOL_RPC, solRpcIdlFactory);
    
    const slotResult: any = await sol.sol_getSlot({
      rpcSources: { Testnet: [[]] },
      config: [],
    });

    if ('Err' in slotResult) {
      throw new Error(slotResult.Err);
    }

    const blockHeight = Number(slotResult.Ok);

    return NextResponse.json({
      ok: true,
      cluster: 'testnet',
      blockHeight,
      latestBlockhash: 'Via SOL RPC Canister',
      rpcUrl: 'SOL RPC Canister',
      at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Solana Testnet API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch Solana Testnet data',
      cluster: 'testnet',
      blockHeight: '—',
      latestBlockhash: '—',
      rpcUrl: '—',
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
