import { NextRequest, NextResponse } from 'next/server';
import { getCrossChainStatus } from '@/services/ops/crossChainService';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as evmIdl } from '@/services/ops/idl/evm_rpc';

const withTimeout = async (url: string, ms = 6000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { clearTimeout(id); }
};

export async function GET(req: NextRequest) {
  try {
    const base = await getCrossChainStatus();
    const origin = req.nextUrl.origin;

    // Live checks via per-network routes
    let checks: any[] = await Promise.all([
      withTimeout(`${origin}/api/ops/ethereum/sepolia`, 6000),
      withTimeout(`${origin}/api/ops/polygon/amoy`, 6000),
      withTimeout(`${origin}/api/ops/optimism/sepolia`, 8000),
      withTimeout(`${origin}/api/ops/arbitrum/sepolia`, 6000),
      withTimeout(`${origin}/api/ops/base/sepolia`, 6000),
      withTimeout(`${origin}/api/ops/btc/status`, 12000),
      withTimeout(`${origin}/api/ops/solana/testnet`, 8000),
    ]);
    // Retry with relative URLs if any failed (handles edge deployments / proxies)
    if (checks.some(c => !c)) {
      const rel = await Promise.all([
        withTimeout(`/api/ops/ethereum/sepolia`, 6000),
        withTimeout(`/api/ops/polygon/amoy`, 6000),
        withTimeout(`/api/ops/optimism/sepolia`, 8000),
        withTimeout(`/api/ops/arbitrum/sepolia`, 6000),
        withTimeout(`/api/ops/base/sepolia`, 6000),
        withTimeout(`/api/ops/btc/status`, 12000),
        withTimeout(`/api/ops/solana/testnet`, 8000),
      ]);
      // Replace only null entries
      checks = checks.map((c, i) => c || rel[i]);
    }

    const eth = checks[0];
    const pol = checks[1];
    const op = checks[2];
    const arb = checks[3];
    const baseEvm = checks[4];
    const btc = checks[5];
    const sol = checks[6];
    const isEvmHealthy = (j: any) => {
      if (!j) return false;
      if (j.ok === true) return true;
      // Accept if a valid block number is present (string or number)
      const bn = j.blockNumber;
      if (typeof bn === 'number' && Number.isFinite(bn) && bn > 0) return true;
      if (typeof bn === 'string') {
        const n = Number(String(bn).replace(/[,\s]/g, ''));
        if (Number.isFinite(n) && n > 0) return true;
      }
      return false;
    };
    const isBtcHealthy = (j: any) => {
      if (!j) return false;
      const t = j.testnet;
      if (t?.ok === true) return true;
      const h = t?.blockHeight ?? j?.blockHeight;
      if (typeof h === 'number' && h > 0) return true;
      // Also accept if anchor info is present/ok (indicates ICP side is healthy)
      const a = j.anchor;
      if (a?.ok === true) return true;
      if (typeof a?.pending === 'number') return true;
      return false;
    };
    const isSolHealthy = (j: any) => {
      if (!j) return false;
      if (j.ok === true) return true;
      return typeof j.blockHeight === 'number' && j.blockHeight > 0;
    };

    const evmResults = [eth, pol, op, arb, baseEvm].map(isEvmHealthy);
    const evmOk = evmResults.filter(Boolean).length;
    let btcHealthy = isBtcHealthy(btc);
    const nonEvmResults = [btcHealthy, isSolHealthy(sol)];
    const nonEvmOk = nonEvmResults.filter(Boolean).length;

    let evmChainCount = evmOk;
    let nonEvmChainCount = nonEvmOk;

    // If live checks failed or returned 0, fall back to canister hints
    if (evmChainCount === 0) {
      try {
        const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
        if (EVM_ID) {
          const evm = await getActor<any>(EVM_ID, evmIdl);
          let chains: any[] = await evm.get_supported_chains().catch(() => []);
          if (!Array.isArray(chains) || chains.length === 0) {
            try { await evm.init_chain_configs(); chains = await evm.get_supported_chains().catch(() => []); } catch {}
          }
          evmChainCount = Array.isArray(chains) ? chains.length : 0;
        }
      } catch {}
    }
    // If EVM live checks are fewer than configured chains, prefer configured count
    try {
      const EVM_ID = (process.env.EVM_RPC_CANISTER_ID || process.env.NEXT_PUBLIC_EVM_RPC_CANISTER_ID) as string;
      if (EVM_ID) {
        const evm = await getActor<any>(EVM_ID, evmIdl);
        const chains: any[] = await evm.get_supported_chains().catch(() => []);
        const cfg = Array.isArray(chains) ? chains.length : 0;
        if (cfg > evmChainCount) evmChainCount = cfg;
      }
    } catch {}

    if (nonEvmChainCount < 2) {
      const solId = process.env.NEXT_PUBLIC_SOLANA_SIGNER_CANISTER_ID;
      // If BTC not healthy, infer from canister env hints
      if (!btcHealthy) {
        const posId = process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
        const btcId = process.env.BTC_SIGNER_CANISTER_ID || process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID;
        if (posId || btcId) {
          btcHealthy = true;
        }
      }
      const inferredNonEvm = (btcHealthy ? 1 : 0) + (solId ? 1 : 0);
      if (inferredNonEvm > nonEvmChainCount) nonEvmChainCount = inferredNonEvm;
    }

    const totalSupportedChains = evmChainCount + nonEvmChainCount;
      const status = {
        ...base,
        supportedChains: totalSupportedChains,
        evmChains: evmChainCount,
        nonEvmChains: nonEvmChainCount,
        source: 'aggregated',
        diagnostics: {
          evm: {
            ethereumSepolia: { ok: evmResults[0] ?? false, retry: eth?.ok === false ? eth?.retry : null },
            polygonAmoy: { ok: evmResults[1] ?? false, retry: pol?.ok === false ? pol?.retry : null },
            optimismSepolia: { ok: evmResults[2] ?? false, retry: op?.ok === false ? op?.retry : null },
            arbitrumSepolia: { ok: evmResults[3] ?? false, retry: arb?.ok === false ? arb?.retry : null },
            baseSepolia: { ok: evmResults[4] ?? false, retry: baseEvm?.ok === false ? baseEvm?.retry : null },
          },
          nonEvm: {
            bitcoinTestnet: { ok: nonEvmResults[0] ?? false, retry: btc?.ok === false ? btc?.retry : null },
            solanaTestnet: { ok: nonEvmResults[1] ?? false, retry: sol?.ok === false ? sol?.retry : null },
          }
        }
      };
    return NextResponse.json({ ok: (status as any).ok ?? true, status, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load cross-chain status' }, { status: 500 });
  }
}
