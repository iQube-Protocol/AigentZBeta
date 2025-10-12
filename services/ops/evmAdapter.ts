/*
  EVM hybrid adapter: selects server vs canister path based on env flags and risk.
  - EVM_RPC_MODE: 'auto' | 'force_server' | 'force_canister'
  - EVM_RPC_HIGH_VALUE_THRESHOLD_USD: number (default 1000)
  - EVM_RPC_HIGH_RISK_METHODS: comma-separated list of method names

  Usage (server routes):
    const res = await evmCall({ method: 'eth_getBlockByNumber', params: [...], chainId: 11155111 });
*/

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';

export type EvmCallParams = {
  method: string;
  params: any[];
  chainId: number;
  valueUsd?: number;
  riskScore?: number; // 0-1 optional
};

export type EvmCallResult = any;

type Mode = 'auto' | 'force_server' | 'force_canister';

const MODE: Mode = (process.env.EVM_RPC_MODE as Mode) || 'auto';
const HIGH_VALUE_USD = Number(process.env.EVM_RPC_HIGH_VALUE_THRESHOLD_USD || 1000);
const HIGH_RISK_METHODS = String(process.env.EVM_RPC_HIGH_RISK_METHODS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isHighRisk(method: string, valueUsd?: number, riskScore?: number): boolean {
  if (HIGH_RISK_METHODS.includes(method)) return true;
  if ((valueUsd || 0) >= HIGH_VALUE_USD) return true;
  if ((riskScore || 0) >= 0.8) return true;
  return false;
}

async function callViaServer({ method, params, chainId }: EvmCallParams): Promise<EvmCallResult> {
  // NOTE: This function intentionally does not implement direct RPC here.
  // Server routes should wrap this adapter and provide concrete provider calls.
  // We include a stub so routes can detect the selected path.
  throw new Error(`Server path selected for ${method} on chain ${chainId} - implement in the calling route with your provider.`);
}

async function callViaCanister({ method, params, chainId }: EvmCallParams): Promise<EvmCallResult> {
  const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
  if (!EVM_ID) throw new Error('EVM_RPC canister ID not configured');
  const evm = await getActor<any>(EVM_ID, evmIdl);
  // Expect canister to expose a generic call or specific methods.
  // Common patterns: evm.call(method, params, chainId) or dedicated functions.
  if (typeof (evm as any).call === 'function') {
    return await (evm as any).call(method, params, BigInt(chainId));
  }
  // Fallback: try method name directly if exposed
  if (typeof (evm as any)[method] === 'function') {
    return await (evm as any)[method](...(params || []));
  }
  throw new Error(`EVM_RPC canister does not expose a compatible call for method: ${method}`);
}

export async function evmCall(args: EvmCallParams): Promise<{ path: 'server' | 'canister'; result?: any } > {
  const { method, valueUsd, riskScore } = args;
  const high = isHighRisk(method, valueUsd, riskScore);

  if (MODE === 'force_canister' || (MODE === 'auto' && high)) {
    const result = await callViaCanister(args);
    return { path: 'canister', result };
  }
  if (MODE === 'force_server' || MODE === 'auto') {
    // Intentionally throw to signal calling route to perform the actual server RPC.
    await callViaServer(args);
  }
  // Should not reach
  throw new Error('Invalid EVM adapter routing state');
}
