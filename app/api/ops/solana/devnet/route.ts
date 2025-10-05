import { NextResponse } from 'next/server';

// Simple JSON-RPC helper
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

export async function GET() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_RPC_SOLANA_DEVNET || 'https://api.devnet.solana.com';
    const address = process.env.NEXT_PUBLIC_SOLANA_ADDRESS; // optional: to show balance and signatures

    // Fetch slot and block height
    const [slot, blockHeight] = await Promise.all([
      solanaRpc('getSlot', [], endpoint),
      solanaRpc('getBlockHeight', [], endpoint),
    ]);

    // Optionally fetch balance and latest signature for configured address
    let balanceLamports: number | null = null;
    let latestSig: string | null = null;

    if (address) {
      try {
        const bal = await solanaRpc('getBalance', [address], endpoint);
        balanceLamports = bal?.value ?? null;
      } catch {}
      try {
        const sigs = await solanaRpc('getSignaturesForAddress', [address, { limit: 1 }], endpoint);
        latestSig = Array.isArray(sigs) && sigs.length > 0 ? sigs[0]?.signature : null;
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      network: 'devnet',
      endpoint,
      slot,
      blockHeight,
      address: address || null,
      balanceLamports,
      latestSig,
      at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load Solana devnet status' }, { status: 500 });
  }
}
