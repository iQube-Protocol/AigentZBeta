import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

// Small helpers to pick RPC endpoints per EVM chain
const rpcFor = (chainId: number): string[] => {
  switch (chainId) {
    case 11155111: // Ethereum Sepolia
      return ['https://rpc.sepolia.org', 'https://ethereum-sepolia.publicnode.com'];
    case 80002: // Polygon Amoy
      return ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy.publicnode.com'];
    case 11155420: // Optimism Sepolia
      return ['https://sepolia.optimism.io', 'https://optimism-sepolia.publicnode.com'];
    case 421614: // Arbitrum Sepolia
      return ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia.publicnode.com'];
    case 84532: // Base Sepolia
      return ['https://sepolia.base.org', 'https://base-sepolia.publicnode.com'];
    default:
      return [];
  }
};

const withTimeout = async (url: string, body: any, ms = 5000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(id); }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainIdParam = searchParams.get('chainId');
  const cluster = searchParams.get('cluster');
  const txHashParam = searchParams.get('txHash');

  try {
    // Solana planned for future: use separate route (already implemented under solana/testnet)
    if (cluster) {
      return NextResponse.json({ ok: false, error: 'Use /api/ops/solana/{cluster} for Solana', at: new Date().toISOString() }, { status: 400 });
    }

    const chainId = chainIdParam ? Number(chainIdParam) : undefined;
    if (!chainId || Number.isNaN(chainId)) {
      return NextResponse.json({ ok: false, error: 'chainId is required (EVM)' }, { status: 400 });
    }

    // 1) Try DVN canister for the latest iQube tx per chain (best-effort; method may not exist)
    let latestTx: string | undefined;
    try {
      const CANISTER_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
      if (CANISTER_ID) {
        const dvn = await getActor<any>(CANISTER_ID, dvnIdl);
        if (typeof dvn.get_latest_tx_for_chain === 'function') {
          const r = await dvn.get_latest_tx_for_chain(chainId).catch(() => undefined);
          if (r && typeof r === 'string' && r.startsWith('0x')) latestTx = r;
        }
      }
    } catch {}

    // 2) If DVN can't supply, fall back to client-provided txHash (e.g., from localStorage)
    if (!latestTx && txHashParam && txHashParam.startsWith('0x')) {
      latestTx = txHashParam;
    }

    if (!latestTx) {
      return NextResponse.json({ ok: true, chainId, missing: 'no_latest_tx', at: new Date().toISOString() });
    }

    // 3) Enrich via RPC: get receipt to find blockNumber, then get block
    const endpoints = rpcFor(chainId);
    let used = '';
    let blockNumberHex = '';
    let block: any = null;
    let lastErr: any = null;

    for (const url of endpoints) {
      try {
        const receipt = await withTimeout(url, { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [latestTx] });
        blockNumberHex = receipt?.result?.blockNumber;
        if (!blockNumberHex) throw new Error('No blockNumber in receipt');
        block = await withTimeout(url, { jsonrpc: '2.0', id: 2, method: 'eth_getBlockByNumber', params: [blockNumberHex, false] });
        block = block?.result;
        if (!block) throw new Error('No block');
        used = url;
        break;
      } catch (e) { lastErr = e; }
    }

    if (!blockNumberHex || !block) throw lastErr || new Error('Failed to enrich tx via RPC');

    const blockNumber = parseInt(blockNumberHex, 16);
    const rpcHost = used ? used.replace(/^https?:\/\//, '') : '—';

    return NextResponse.json({
      ok: true,
      chainId,
      txHash: latestTx,
      blockNumber,
      timestamp: block?.timestamp ? parseInt(block.timestamp, 16) : undefined,
      rpcUrl: rpcHost,
      at: new Date().toISOString(),
      source: txHashParam && !latestTx ? 'client' : 'dvn_or_client',
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load latest iQube tx' }, { status: 500 });
  }
}
