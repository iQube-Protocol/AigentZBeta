/**
 * GET /api/ops/base/mainnet
 *
 * Base mainnet network status. Mirrors /api/ops/base/sepolia but
 * points at Base mainnet RPC endpoints. Added once Base mainnet
 * deployments (iQube contracts, Q¢) went live so /ops can monitor
 * the production rail alongside the Sepolia testnet card.
 *
 * RPC endpoint configured via NEXT_PUBLIC_RPC_BASE_MAINNET (preferred)
 * with public fallbacks. Explorer is basescan.org.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const configured = process.env.NEXT_PUBLIC_RPC_BASE_MAINNET || process.env.BASE_RPC_URL;
    const endpoints = [
      ...(configured ? [configured] : []),
      'https://mainnet.base.org',
      'https://base.blockpi.network/v1/rpc/public',
      'https://base.publicnode.com',
    ];

    const withTimeout = async (url: string, body: any, ms = 5000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(id);
      }
    };

    let used = '';
    let latestBlockHex = '';
    let block: any = null;
    let lastErr: any = null;
    for (const url of endpoints) {
      try {
        const bn = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 });
        if (!bn?.result) throw new Error('No block number');
        latestBlockHex = bn.result;
        const bd = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: [latestBlockHex, false], id: 2 });
        if (!bd?.result) throw new Error('No block details');
        block = bd.result;
        used = url;
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!block || !latestBlockHex) throw lastErr || new Error('All Base mainnet RPC endpoints failed');

    const blockNumber = parseInt(latestBlockHex, 16);
    const txCount = block?.transactions?.length || 0;
    const latestTx = txCount > 0 ? block.transactions[0] : null;
    const rpcHost = used.replace(/^https?:\/\//, '');

    // Surface deployed contract addresses if configured (operator-only).
    // Read-through only: the actual addresses live in env vars and the
    // canonical service modules. We expose them on this status so the
    // /ops card can render the live contract handles next to the block
    // height (no chain interaction required to read env).
    const contracts = {
      qct: process.env.NEXT_PUBLIC_QCT_BASE_MAINNET || null,
      qctReserve: process.env.NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET || null,
    };

    return NextResponse.json({
      ok: true,
      network: 'base-mainnet',
      chainId: 8453,
      blockNumber,
      txCount,
      latestTx,
      rpcUrl: rpcHost,
      explorerUrl: 'https://basescan.org',
      contracts,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Base mainnet API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to fetch Base mainnet data',
        at: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
