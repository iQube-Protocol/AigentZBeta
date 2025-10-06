import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    // Multi-endpoint fallback for Sepolia
    const endpoints = [
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia.publicnode.com'
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
      } finally { clearTimeout(id); }
    };

    let used = '';
    let latestBlockHex = '';
    let block: any = null;
    let lastErr: any = null;
    for (const url of endpoints) {
      try {
        const blockData = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 });
        if (!blockData?.result) throw new Error('No block number');
        latestBlockHex = blockData.result;
        const blockDetails = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: [latestBlockHex, true], id: 2 });
        if (!blockDetails?.result) throw new Error('No block details');
        block = blockDetails.result;
        used = url;
        break;
      } catch (e) { lastErr = e; }
    }

    if (!block || !latestBlockHex) {
      throw lastErr || new Error('All Sepolia RPC endpoints failed');
    }

    const latestBlockNumber = parseInt(latestBlockHex, 16);
    const latestTx = block.transactions && block.transactions.length > 0
      ? block.transactions[block.transactions.length - 1].hash
      : null;

    const rpcHost = used.replace(/^https?:\/\//, '');
    return NextResponse.json({
      ok: true,
      chainId: '11155111',
      blockNumber: Number.isFinite(latestBlockNumber) ? latestBlockNumber.toLocaleString() : '—',
      latestTx: latestTx || 'No transactions in latest block',
      rpcUrl: rpcHost,
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Sepolia API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      chainId: '11155111',
      blockNumber: '—',
      latestTx: '—',
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
