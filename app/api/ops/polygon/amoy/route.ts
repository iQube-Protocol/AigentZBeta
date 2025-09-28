import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Multi-endpoint fallback with timeouts for Polygon Amoy
    const endpoints = [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy.publicnode.com',
      'https://polygon-amoy.gateway.tenderly.co'
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
    let gasPriceHex = '0x0';
    let lastErr: any = null;
    for (const url of endpoints) {
      try {
        const bn = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 });
        if (!bn?.result) throw new Error('No block number');
        latestBlockHex = bn.result;
        const bd = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: [latestBlockHex, true], id: 2 });
        if (!bd?.result) throw new Error('No block details');
        block = bd.result;
        const gp = await withTimeout(url, { jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 3 });
        gasPriceHex = gp?.result || '0x0';
        used = url;
        break;
      } catch (e) { lastErr = e; }
    }

    if (!block || !latestBlockHex) {
      throw lastErr || new Error('All Polygon Amoy RPC endpoints failed');
    }

    const latestBlockNumber = parseInt(latestBlockHex, 16);
    const gasPrice = parseInt(gasPriceHex, 16);
    const rpcHost = used.replace(/^https?:\/\//, '');
    
    // Provide network stats without random transaction fetching
    return NextResponse.json({
      ok: true,
      chainId: '80002',
      blockNumber: Number.isFinite(latestBlockNumber) ? latestBlockNumber.toLocaleString() : '—',
      latestTx: 'Network active - create transaction to see hash',
      gasPrice: Number.isFinite(gasPrice) ? gasPrice.toLocaleString() : '—',
      transactionCount: block.transactions ? block.transactions.length : 0,
      rpcUrl: rpcHost,
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Polygon Amoy API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      chainId: '80002',
      blockNumber: '—',
      latestTx: '—',
      gasPrice: '—',
      transactionCount: 0,
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
