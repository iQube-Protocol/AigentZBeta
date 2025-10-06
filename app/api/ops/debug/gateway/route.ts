import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
    const isMainnet = (process.env.DFX_NETWORK || 'ic').toLowerCase() === 'ic';
    const dfxNetwork = process.env.DFX_NETWORK || 'ic';
    
    // This mirrors the logic in services/ops/icAgent.ts - FORCE ic0.app for mainnet
    let expectedHost = isLocal ? 'http://127.0.0.1:4943' : (isMainnet ? 'https://ic0.app' : 'https://icp-api.io');
    
    const res = NextResponse.json({
      ok: true,
      gateway: {
        explicitHost: 'FORCED_OVERRIDE',
        dfxNetwork,
        isLocal,
        isMainnet,
        expectedHost,
        icpHost: process.env.ICP_HOST || null,
        publicIcpHost: process.env.NEXT_PUBLIC_ICP_HOST || null
      },
      at: new Date().toISOString()
    });
    
    res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    return res;
    
  } catch (error: any) {
    const res = NextResponse.json({
      ok: false,
      error: error.message || 'Gateway debug failed',
      at: new Date().toISOString()
    });
    res.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    return res;
  }
}
