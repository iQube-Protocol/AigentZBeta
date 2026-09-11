import { NextResponse } from 'next/server';
import { getCanisterHealth } from '@/services/ops/icpService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { idlFactory as rqhIdl } from '@/services/ops/idl/rqh';
import { idlFactory as rewardHubIdl } from '@/services/ops/idl/reward_hub';
import { recordServerCall } from '@/services/devCommandCenter/requestTelemetry';

export async function GET() {
  const t0 = Date.now();
  try {
    // Base env ids
    const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
    const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
    const RQH_ID = (process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID) as string;
    const REWARD_HUB_ID = (process.env.REWARD_HUB_CANISTER_ID || process.env.NEXT_PUBLIC_REWARD_HUB_CANISTER_ID) as string;

    // Fallback summary based on presence of env vars
    const canisters = await getCanisterHealth();

    // Try live calls (gracefully degrade on failure)
    let pendingCount: bigint | null = null;
    let supportedChains: number | null = null;
    let dvnPending: number | null = null;
    let rqhHealthy: boolean | null = null;
    let rewardHubHealthy: boolean | null = null;
    let rewardHubConfig: { requiredApprovals: number; adminCount: number } | null = null;

    try {
      if (POS_ID) {
        const pos = await getActor<any>(POS_ID, posIdl);
        pendingCount = await pos.get_pending_count();
      }
    } catch {}

    try {
      if (EVM_ID) {
        const evm = await getActor<any>(EVM_ID, evmIdl);
        const chains = await evm.get_supported_chains();
        supportedChains = Array.isArray(chains) ? chains.length : 0;
      }
    } catch {}

    try {
      if (DVN_ID) {
        const dvn = await getActor<any>(DVN_ID, dvnIdl);
        const msgs = await dvn.get_pending_messages();
        dvnPending = Array.isArray(msgs) ? msgs.length : 0;
      }
    } catch {}

    // ReputationHub (RQH) health check
    try {
      if (RQH_ID) {
        const rqh = await getActor<any>(RQH_ID, rqhIdl);
        const health = await rqh.health();
        // Case-insensitive check for "healthy" in response
        rqhHealthy = typeof health === 'string' && health.toLowerCase().includes('healthy');
      }
    } catch {}

    // RewardHub health check
    try {
      if (REWARD_HUB_ID) {
        const rewardHub = await getActor<any>(REWARD_HUB_ID, rewardHubIdl);
        const health = await rewardHub.health();
        // Case-insensitive check for "healthy" in response
        rewardHubHealthy = typeof health === 'string' && health.toLowerCase().includes('healthy');
        // Get config for additional info
        const config = await rewardHub.get_config();
        if (config) {
          rewardHubConfig = {
            requiredApprovals: Number(config[0]),
            adminCount: Array.isArray(config[1]) ? config[1].length : 0,
          };
        }
      }
    } catch {}

    const dvn = {
      ok: dvnPending !== null,
      pendingMessages: dvnPending ?? 0,
      validatorsOnline: null,
      at: new Date().toISOString(),
      details: DVN_ID ? `id: ${DVN_ID}` : 'not configured',
    };

    const res = NextResponse.json({
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
          if (i.name === 'reputation_hub' && rqhHealthy !== null) {
            return { ...i, ok: rqhHealthy, details: `${i.details} • ${rqhHealthy ? 'healthy' : 'unhealthy'}` };
          }
          if (i.name === 'reward_hub' && rewardHubHealthy !== null) {
            const configInfo = rewardHubConfig 
              ? ` • approvals:${rewardHubConfig.requiredApprovals} admins:${rewardHubConfig.adminCount}`
              : '';
            return { ...i, ok: rewardHubHealthy, details: `${i.details}${configInfo}` };
          }
          return i;
        })
      },
      dvn,
      at: new Date().toISOString(),
    });
    recordServerCall({ method: 'GET', path: '/api/ops/canisters/health', status: 200, ms: Date.now() - t0 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load canister health' }, { status: 500 });
  }
}
