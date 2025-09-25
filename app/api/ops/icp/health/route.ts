import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const explicit = process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST;
    const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
    const host = explicit || (isLocal ? 'http://127.0.0.1:4943' : 'https://icp-api.io');

    // Try a lightweight status request; fall back to a simple fetch to host root
    let ok = false;
    try {
      const url = host.replace(/\/$/, '') + '/api/v2/status';
      const res = await fetch(url, { cache: 'no-store' });
      ok = res.ok;
    } catch {
      try {
        const res = await fetch(host, { cache: 'no-store' });
        ok = res.ok;
      } catch {}
    }

    return NextResponse.json({ ok, host, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'ICP health check failed' }, { status: 500 });
  }
}
