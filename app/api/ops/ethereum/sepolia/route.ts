import { NextResponse } from 'next/server';

const RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://eth-sepolia.public.blastapi.io',
];

async function withTimeout(url: string, body: any, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);
    return await res.json();
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function GET() {
  let block: any = null;
  let latestBlockHex: string = '';
  let used: string = '';

  for (const url of RPC_URLS) {
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
      continue;
    }
  }

  if (!block) {
    return NextResponse.json({
      ok: false,
      error: 'All RPC endpoints failed',
      chainId: '11155111',
      blockNumber: '—',
      latestTx: '—',
      rpcUrl: '—',
      at: new Date().toISOString()
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    chainId: '11155111',
    blockNumber: parseInt(block.number, 16).toLocaleString(),
    latestTx: block.transactions?.[0] || 'No transactions',
    rpcUrl: used,
    at: new Date().toISOString()
  });
}
