import { NextResponse } from 'next/server';
import { getAnonymousActor } from '@/services/ops/icAgent';
import { evmRpcIdlFactory } from '@/services/ops/idl/evm_rpc_full';

const EVM_RPC = '7hfb6-caaaa-aaaar-qadga-cai';

export async function GET() {
  try {
    const evm = await getAnonymousActor(EVM_RPC, evmRpcIdlFactory);
    const result: any = await evm.eth_getBlockByNumber({
      rpcServices: { Custom: { chainId: BigInt(11155420), services: [{ url: 'https://sepolia.optimism.io', headers: [] }] } },
      blockTag: { Latest: null },
    });

    let block: any = null;
    if ('Consistent' in result && 'Ok' in result.Consistent) {
      block = result.Consistent.Ok;
    } else if ('Inconsistent' in result) {
      for (const [_, res] of result.Inconsistent) {
        if ('Ok' in res) { block = res.Ok; break; }
      }
    }

    if (!block) throw new Error('No block data');

    return NextResponse.json({
      ok: true,
      chainId: '11155420',
      blockNumber: Number(block.number).toLocaleString(),
      latestTx: block.transactions[0] || 'No transactions',
      rpcUrl: 'EVM RPC Canister',
      at: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      chainId: '11155420',
      blockNumber: '—',
      latestTx: '—',
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
