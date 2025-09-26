import { NextResponse } from 'next/server';

async function solanaRpc(method: string, params: any[] = [], endpoint?: string) {
  const url = (endpoint || process.env.NEXT_PUBLIC_RPC_SOLANA_DEVNET || 'https://api.devnet.solana.com').replace(/\/$/, '');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`RPC ${method} HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method} error: ${j.error.message || 'unknown'}`);
  return j.result;
}

export async function POST() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_RPC_SOLANA_DEVNET || 'https://api.devnet.solana.com';
    const address = process.env.NEXT_PUBLIC_SOLANA_ADDRESS;
    if (!address) {
      return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_SOLANA_ADDRESS not configured' }, { status: 400 });
    }
    // 1 SOL airdrop
    const lamports = 1_000_000_000; 
    const sig = await solanaRpc('requestAirdrop', [address, lamports], endpoint);
    return NextResponse.json({ ok: true, signature: sig, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to request airdrop' }, { status: 500 });
  }
}
