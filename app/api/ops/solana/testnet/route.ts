import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const RPC_URLS = [
  'https://api.testnet.solana.com',
  'https://solana-testnet-rpc.publicnode.com',
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
  let blockHeight: number = 0;
  let latestBlockhash: string = '';
  let used: string = '';

  for (const url of RPC_URLS) {
    try {
      const slotRes = await withTimeout(url, { jsonrpc: '2.0', method: 'getSlot', params: [], id: 1 });
      if (!slotRes?.result) throw new Error('No slot');
      blockHeight = slotRes.result;
      
      const hashRes = await withTimeout(url, { jsonrpc: '2.0', method: 'getLatestBlockhash', params: [], id: 2 });
      if (!hashRes?.result?.value?.blockhash) throw new Error('No blockhash');
      latestBlockhash = hashRes.result.value.blockhash;
      
      used = url;
      break;
    } catch (e) {
      continue;
    }
  }

  if (!blockHeight) {
    return NextResponse.json({
      ok: false,
      error: 'All RPC endpoints failed',
      cluster: 'testnet',
      blockHeight: '—',
      latestBlockhash: '—',
      rpcUrl: '—',
      at: new Date().toISOString(),
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cluster: 'testnet',
    blockHeight: blockHeight.toLocaleString(),
    latestBlockhash: latestBlockhash.substring(0, 8) + '...',
    rpcUrl: used,
    at: new Date().toISOString(),
  });
}
