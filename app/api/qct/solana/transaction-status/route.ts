import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousActor } from '@/services/ops/icAgent';
import { solRpcIdlFactory } from '@/services/ops/idl/sol_rpc';

const SOL_RPC = 'tghme-zyaaa-aaaar-qarca-cai';

export async function POST(req: NextRequest) {
  try {
    const { signatures, cluster = 'mainnet' } = await req.json();

    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Signatures array is required' },
        { status: 400 }
      );
    }

    const sol = await getAnonymousActor(SOL_RPC, solRpcIdlFactory);
    
    const rpcSources = cluster === 'testnet' 
      ? { Testnet: [[]] } 
      : { Mainnet: [[]] };

    const statusResult: any = await sol.sol_getSignatureStatuses({
      rpcSources,
      signatures,
      config: [],
    });

    if ('Err' in statusResult) {
      throw new Error(statusResult.Err);
    }

    const statuses = statusResult.Ok.map((status: any) => {
      if (!status) return null;
      
      return {
        slot: Number(status.slot),
        confirmations: status.confirmations ? Number(status.confirmations) : null,
        err: status.err || null,
        confirmationStatus: status.confirmationStatus || null,
      };
    });

    return NextResponse.json({
      ok: true,
      signatures,
      cluster,
      statuses,
      at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Solana transaction status error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to check transaction status',
    }, { status: 500 });
  }
}
