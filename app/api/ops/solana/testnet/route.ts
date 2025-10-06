import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    // Multi-endpoint fallback with timeouts for Solana Testnet
    const endpoints = [
      'https://api.testnet.solana.com',
      'https://solana-testnet.publicnode.com',
      'https://rpc.ankr.com/solana_testnet'
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
    let blockhash = '';
    let blockHeight = 0;
    let lastErr: any = null;

    for (const url of endpoints) {
      try {
        // getLatestBlockhash
        const bh = await withTimeout(url, {
          jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }]
        });
        const value = bh?.result?.value;
        if (!value?.blockhash) throw new Error('No blockhash');
        blockhash = value.blockhash as string;

        // getBlockHeight
        const h = await withTimeout(url, {
          jsonrpc: '2.0', id: 2, method: 'getBlockHeight', params: [{ commitment: 'confirmed' }]
        });
        if (typeof h?.result !== 'number') throw new Error('No block height');
        blockHeight = h.result as number;

        used = url;
        break;
      } catch (e) { lastErr = e; }
    }

    if (!blockhash || !blockHeight) {
      throw lastErr || new Error('All Solana Testnet RPC endpoints failed');
    }

    const rpcHost = used.replace(/^https?:\/\//, '');
    return NextResponse.json({
      ok: true,
      cluster: 'testnet',
      blockHeight,
      latestBlockhash: blockhash,
      rpcUrl: rpcHost,
      at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Solana Testnet API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch Solana Testnet data',
      cluster: 'testnet',
      blockHeight: '—',
      latestBlockhash: '—',
      rpcUrl: '—',
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
