import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';

/**
 * Check FIO handle availability
 * POST /api/identity/fio/check-availability
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { handle } = body;

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'Handle is required' },
        { status: 400 }
      );
    }

    // Initialize FIO service
    const fioService = getFIOService();
    await fioService.initialize({
      endpoint: process.env.FIO_API_ENDPOINT || 'https://fio.eosusa.io/v1/',
      chainId: process.env.FIO_CHAIN_ID || '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c'
    });

    // Check availability
    const available = await fioService.isHandleAvailable(handle);

    return NextResponse.json({
      ok: true,
      available,
      handle
    });
  } catch (e: any) {
    console.error('FIO availability check error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to check handle availability' },
      { status: 500 }
    );
  }
}
