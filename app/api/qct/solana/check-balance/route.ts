import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousActor } from '@/services/ops/icAgent';
import { solRpcIdlFactory } from '@/services/ops/idl/sol_rpc';

const SOL_RPC = 'tghme-zyaaa-aaaar-qarca-cai';

export async function POST(req: NextRequest) {
  try {
    const { address, cluster = 'mainnet' } = await req.json();

    if (!address) {
      return NextResponse.json(
        { ok: false, error: 'Address is required' },
        { status: 400 }
      );
    }

    const sol = await getAnonymousActor(SOL_RPC, solRpcIdlFactory);
    
    const rpcSources = cluster === 'testnet' 
      ? { Testnet: [[]] } 
      : { Mainnet: [[]] };

    const balanceResult: any = await sol.sol_getBalance({
      rpcSources,
      address,
      config: [],
    });

    if ('Err' in balanceResult) {
      throw new Error(balanceResult.Err);
    }

    const lamports = Number(balanceResult.Ok);
    const sol_balance = lamports / 1_000_000_000; // Convert lamports to SOL

    return NextResponse.json({
      ok: true,
      address,
      cluster,
      balance: {
        lamports,
        sol: sol_balance,
      },
      at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Solana balance check error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to check Solana balance',
    }, { status: 500 });
  }
}
