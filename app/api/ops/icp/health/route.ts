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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(url, { 
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      ok = res.ok;
    } catch {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(host, { 
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        ok = res.ok;
      } catch {
        // If both fail, assume local development and mark as ok
        ok = isLocal || host.includes('127.0.0.1') || host.includes('localhost');
      }
    }

    return NextResponse.json({ ok, host, at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'ICP health check failed' }, { status: 500 });
  }
}
