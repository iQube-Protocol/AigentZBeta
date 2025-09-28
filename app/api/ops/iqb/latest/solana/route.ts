import { NextRequest, NextResponse } from 'next/server';

const ENDPOINTS: Record<string, string[]> = {
  testnet: [
    'https://api.testnet.solana.com',
    'https://solana-testnet.publicnode.com',
    'https://rpc.ankr.com/solana_testnet',
  ],
  devnet: [
    'https://api.devnet.solana.com',
    'https://solana-devnet.publicnode.com',
    'https://rpc.ankr.com/solana_devnet',
  ],
};

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cluster = (searchParams.get('cluster') || 'testnet').toLowerCase();
  const signature = searchParams.get('signature') || '';

  try {
    if (!signature) {
      return NextResponse.json({ ok: false, error: 'signature is required' }, { status: 400 });
    }

    const urls = ENDPOINTS[cluster] || ENDPOINTS.testnet;

    let used = '';
    let statusRes: any = null;
    let txRes: any = null;
    let lastErr: any = null;

    for (const url of urls) {
      try {
        // getSignatureStatuses
        statusRes = await withTimeout(url, {
          jsonrpc: '2.0', id: 1, method: 'getSignatureStatuses', params: [[signature], { searchTransactionHistory: true }]
        });
        const status = statusRes?.result?.value?.[0];
        if (!status) throw new Error('No status');

        // getTransaction for slot/blockTime enrichment
        txRes = await withTimeout(url, {
          jsonrpc: '2.0', id: 2, method: 'getTransaction', params: [signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]
        });

        used = url;
        break;
      } catch (e) { lastErr = e; }
    }

    if (!statusRes) throw lastErr || new Error('All Solana RPC endpoints failed');

    const status = statusRes?.result?.value?.[0] || {};
    const conf = status?.confirmationStatus || status?.confirmations;
    const tx = txRes?.result || {};
    const slot = tx?.slot ?? status?.slot ?? null;
    const blockTime = tx?.blockTime ?? null;

    const rpcHost = used.replace(/^https?:\/\//, '');
    return NextResponse.json({
      ok: true,
      cluster: urls === ENDPOINTS.devnet ? 'devnet' : 'testnet',
      signature,
      slot,
      blockTime,
      confirmationStatus: typeof conf === 'string' ? conf : undefined,
      rpcUrl: rpcHost,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to enrich Solana signature' }, { status: 500 });
  }
}
