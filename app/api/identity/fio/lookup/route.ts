import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';

/**
 * Lookup FIO handle information
 * GET /api/identity/fio/lookup?handle=alice@fio
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'Handle parameter is required' },
        { status: 400 }
      );
    }

    // Initialize FIO service
    const fioService = getFIOService();
    await fioService.initialize({
      endpoint: process.env.FIO_API_ENDPOINT || 'https://fio.eosusa.io',
      chainId: process.env.FIO_CHAIN_ID || '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c'
    });

    // Get handle info
    const info = await fioService.getHandleInfo(handle);

    return NextResponse.json({
      ok: true,
      data: {
        handle: info.fioAddress,
        owner: info.owner,
        expiration: info.expiration.toISOString(),
        bundledTxs: info.bundledTxs,
        expired: info.expiration < new Date()
      }
    });
  } catch (e: any) {
    console.error('FIO lookup error:', e);
    
    // If handle not found, return 404
    if (e?.message?.includes('not found')) {
      return NextResponse.json(
        { ok: false, error: 'FIO handle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to lookup FIO handle' },
      { status: 500 }
    );
  }
}
