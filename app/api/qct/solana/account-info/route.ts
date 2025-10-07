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

    const accountResult: any = await sol.sol_getAccountInfo({
      rpcSources,
      address,
      config: [],
    });

    if ('Err' in accountResult) {
      throw new Error(accountResult.Err);
    }

    const accountInfo = accountResult.Ok;

    if (!accountInfo) {
      return NextResponse.json({
        ok: true,
        address,
        cluster,
        exists: false,
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      address,
      cluster,
      exists: true,
      account: {
        lamports: Number(accountInfo.lamports),
        owner: accountInfo.owner,
        executable: accountInfo.executable,
        rentEpoch: Number(accountInfo.rentEpoch),
        dataLength: accountInfo.data.length,
      },
      at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Solana account info error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to get account info',
    }, { status: 500 });
  }
}
