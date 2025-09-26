import { NextResponse } from 'next/server';
import { getCrossChainStatus } from '@/services/ops/crossChainService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';

export async function GET() {
  try {
    const base = await getCrossChainStatus();
    let evmChainCount = 0;
    let nonEvmChainCount = 0;
    
    // Count EVM chains from EVM RPC canister
    try {
      const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
      if (EVM_ID) {
        const evm = await getActor<any>(EVM_ID, evmIdl);
        // Try to fetch supported chains; lazily init if empty
        let chains: any[] = await evm.get_supported_chains().catch(() => []);
        if (!Array.isArray(chains) || chains.length === 0) {
          try {
            // Initialize default chain configs on first run, then retry
            await evm.init_chain_configs();
            chains = await evm.get_supported_chains().catch(() => []);
          } catch {}
        }
        evmChainCount = Array.isArray(chains) ? chains.length : 0;
      } else {
        // No EVM canister configured
      }
    } catch (e) {
      // Swallow EVM errors – non-fatal to card
    }

    // Count non-EVM chains (BTC and Solana)
    const btcCanisterId = process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID;
    const solanaCanisterId = process.env.NEXT_PUBLIC_SOLANA_SIGNER_CANISTER_ID;
    
    if (btcCanisterId) {
      nonEvmChainCount += 1; // Bitcoin
    }
    
    if (solanaCanisterId) {
      nonEvmChainCount += 1; // Solana
    }

    const totalSupportedChains = evmChainCount + nonEvmChainCount;

    const status = { 
      ...base, 
      supportedChains: totalSupportedChains,
      evmChains: evmChainCount,
      nonEvmChains: nonEvmChainCount
    };
    return NextResponse.json({ ok: status.ok, status, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load cross-chain status' }, { status: 500 });
  }
}

