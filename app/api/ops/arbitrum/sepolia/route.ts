import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const endpoints = [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia.blockpi.network/v1/rpc/public',
      'https://arbitrum-sepolia.publicnode.com'
    ];

    const withTimeout = async (url: string, body: any, ms = 5000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } finally { clearTimeout(id); }
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
      } catch (e) { lastErr = e; }
    }

    if (!block || !latestBlockHex) throw lastErr || new Error('All Arbitrum Sepolia RPC endpoints failed');

    const blockNumber = parseInt(latestBlockHex, 16);
    const txCount = block?.transactions?.length || 0;
    const latestTx = txCount > 0 ? block.transactions[0] : null;
    const rpcHost = used.replace(/^https?:\/\//, '');

    return NextResponse.json({
      ok: true,
      blockNumber,
      txCount,
      latestTx,
      rpcUrl: rpcHost,
      explorerUrl: 'https://sepolia.arbiscan.io',
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Arbitrum Sepolia API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch Arbitrum Sepolia data',
      at: new Date().toISOString()
    }, { status: 500 });
  }
}
