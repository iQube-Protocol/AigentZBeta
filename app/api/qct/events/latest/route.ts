import { NextRequest, NextResponse } from 'next/server';
import { getQCTEventListener } from '@/services/qct/EventListener';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');

    const listener = getQCTEventListener();

    if (chainId) {
      // Get latest transaction for specific chain
      const latest = listener.getLatestTransaction(chainId);
      
      if (!latest) {
        return NextResponse.json({
          ok: true,
          chainId,
          transaction: null,
          message: 'No transactions recorded for this chain',
          at: new Date().toISOString()
        });
      }

      // Serialize to handle BigInt values
      const serialized = JSON.parse(JSON.stringify(latest, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      return NextResponse.json({
        ok: true,
        chainId,
        transaction: serialized,
        at: new Date().toISOString()
      });
    } else {
      // Get latest transactions for all chains
      const allLatest = listener.getAllLatestTransactions();
      
      // Serialize to handle BigInt values
      const serialized = JSON.parse(JSON.stringify(allLatest, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      return NextResponse.json({
        ok: true,
        transactions: serialized,
        at: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('[QCT Events Latest API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch latest transactions'
    }, { status: 500 });
  }
}
